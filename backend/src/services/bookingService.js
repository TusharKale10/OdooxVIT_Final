// Race-safe booking engine. All multi-step writes happen inside a TX.
// Uses SELECT ... FOR UPDATE on competing bookings to prevent
// double-booking when capacity is exhausted.

const pool = require('../config/db');
const { HttpError } = require('../middlewares/error');
const { getAvailableSlots, toMysqlLocal } = require('./slotService');

const isAlignedToBaseSlots = (slots, startStr) =>
  slots.some((s) => s.start === startStr);

async function createBooking({
  serviceId, customerId, startDatetime, resourceId,
  capacityTaken = 1, answers = [],
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Load service + lock matching booking rows for the slot
    const [serviceRows] = await conn.query('SELECT * FROM services WHERE id=? FOR UPDATE', [serviceId]);
    if (!serviceRows.length) throw new HttpError(404, 'Service not found');
    const service = serviceRows[0];
    if (!service.is_published) throw new HttpError(403, 'Service not published');

    const startDate = new Date(startDatetime.replace(' ', 'T'));
    if (Number.isNaN(startDate.getTime())) throw new HttpError(400, 'Invalid start_datetime');
    const endDate   = new Date(startDate.getTime() + service.duration_minutes * 60000);

    // 2. Recompute available slots from scratch using the same TX connection
    const dateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const slots = await getAvailableSlots({ serviceId, date: dateOnly, conn });
    const startStr = toMysqlLocal(startDate);
    if (!isAlignedToBaseSlots(slots, startStr))
      throw new HttpError(400, 'Slot not in service availability');

    // 3. Decide resource to assign
    const [resources] = await conn.query(
      'SELECT * FROM resources WHERE service_id=? AND is_active=1', [serviceId]);
    if (!resources.length) throw new HttpError(409, 'No resources configured');

    let chosenResource = null;
    if (service.assignment_mode === 'manual') {
      if (!resourceId) throw new HttpError(400, 'resource_id required');
      chosenResource = resources.find((r) => r.id === Number(resourceId));
      if (!chosenResource) throw new HttpError(400, 'Invalid resource for service');
    }

    // 4. Lock all overlapping bookings for this slot (per resource) for FOR UPDATE
    const resourceIds = resources.map((r) => r.id);
    const [activeBookings] = await conn.query(
      `SELECT id, resource_id, capacity_taken, status FROM bookings
         WHERE resource_id IN (?)
           AND start_datetime = ?
           AND status IN ('reserved','pending','confirmed')
         FOR UPDATE`,
      [resourceIds, startStr]
    );
    const usedByResource = {};
    for (const r of resources) usedByResource[r.id] = 0;
    for (const b of activeBookings) usedByResource[b.resource_id] += Number(b.capacity_taken);

    const cap = service.manage_capacity ? Number(service.max_per_slot) : 1;
    const requested = service.manage_capacity ? Math.max(1, Number(capacityTaken) || 1) : 1;
    if (requested > cap) throw new HttpError(400, 'Capacity exceeds slot maximum');

    if (chosenResource) {
      const remain = cap - usedByResource[chosenResource.id];
      if (remain < requested) throw new HttpError(409, 'Slot full for selected resource');
    } else {
      // auto: pick first resource that fits the requested capacity
      chosenResource = resources.find((r) => (cap - usedByResource[r.id]) >= requested);
      if (!chosenResource) throw new HttpError(409, 'Slot full');
    }

    // 5. Validate question answers
    const [questions] = await conn.query(
      'SELECT id, is_required FROM booking_questions WHERE service_id=?', [serviceId]);
    const answerMap = {};
    for (const a of (answers || [])) answerMap[Number(a.question_id)] = (a.answer_text || '').trim();
    for (const q of questions) {
      if (q.is_required && !answerMap[q.id]) {
        throw new HttpError(400, `Answer required for question_id ${q.id}`);
      }
    }

    // 6. Decide initial status / payment_status
    const requiresPayment = !!service.advance_payment && Number(service.price) > 0;
    const requiresManual  = !!service.manual_confirmation;
    let status, paymentStatus;
    if (requiresPayment) { status = 'pending';   paymentStatus = 'pending'; }
    else if (requiresManual) { status = 'reserved'; paymentStatus = 'not_required'; }
    else { status = 'confirmed'; paymentStatus = 'not_required'; }

    const subtotal = Number(service.price) * requested;
    const tax      = subtotal * (Number(service.tax_percent) / 100);
    const total    = +(subtotal + tax).toFixed(2);

    // 7. Insert booking
    const [ins] = await conn.query(
      `INSERT INTO bookings
         (service_id, resource_id, customer_id, start_datetime, end_datetime,
          capacity_taken, status, payment_status, total_amount)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [serviceId, chosenResource.id, customerId, startStr, toMysqlLocal(endDate),
       requested, status, paymentStatus, total]
    );
    const bookingId = ins.insertId;

    // 8. Insert answers
    for (const q of questions) {
      const text = answerMap[q.id];
      if (text !== undefined && text !== '') {
        await conn.query(
          'INSERT INTO booking_answers (booking_id, question_id, answer_text) VALUES (?,?,?)',
          [bookingId, q.id, text]
        );
      }
    }

    await conn.commit();
    return {
      id: bookingId, status, payment_status: paymentStatus,
      total_amount: total, requires_payment: requiresPayment,
      service_id: serviceId, resource_id: chosenResource.id,
      start_datetime: startStr, end_datetime: toMysqlLocal(endDate),
      capacity_taken: requested,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function rescheduleBooking({ bookingId, newStart, customerId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM bookings WHERE id=? FOR UPDATE', [bookingId]);
    const booking = rows[0];
    if (!booking) throw new HttpError(404, 'Booking not found');
    if (booking.customer_id !== customerId)
      throw new HttpError(403, 'Not your booking');
    if (booking.status === 'cancelled')
      throw new HttpError(400, 'Cancelled bookings cannot be rescheduled');

    const [serviceRows] = await conn.query('SELECT * FROM services WHERE id=?', [booking.service_id]);
    const service = serviceRows[0];
    const newStartDate = new Date(newStart.replace(' ', 'T'));
    if (Number.isNaN(newStartDate.getTime())) throw new HttpError(400, 'Invalid datetime');
    const newEndDate = new Date(newStartDate.getTime() + service.duration_minutes * 60000);
    const newStartStr = toMysqlLocal(newStartDate);

    // Validate new slot is still inside service availability
    const dateOnly = new Date(newStartDate.getFullYear(), newStartDate.getMonth(), newStartDate.getDate());
    const slots = await getAvailableSlots({ serviceId: booking.service_id, date: dateOnly, conn });
    if (!isAlignedToBaseSlots(slots, newStartStr))
      throw new HttpError(400, 'Slot not in service availability');

    // Lock competing bookings on the SAME resource at the new slot, excluding self
    const [active] = await conn.query(
      `SELECT id, capacity_taken FROM bookings
         WHERE resource_id=? AND start_datetime=? AND id<>?
           AND status IN ('reserved','pending','confirmed')
         FOR UPDATE`,
      [booking.resource_id, newStartStr, booking.id]
    );
    const used = active.reduce((s, b) => s + Number(b.capacity_taken), 0);
    const cap  = service.manage_capacity ? Number(service.max_per_slot) : 1;
    if (used + Number(booking.capacity_taken) > cap)
      throw new HttpError(409, 'New slot full for this resource');

    await conn.query(
      'UPDATE bookings SET start_datetime=?, end_datetime=? WHERE id=?',
      [newStartStr, toMysqlLocal(newEndDate), booking.id]
    );
    await conn.commit();
    return { id: booking.id, start_datetime: newStartStr, end_datetime: toMysqlLocal(newEndDate) };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

async function cancelBooking({ bookingId, userId, role }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM bookings WHERE id=? FOR UPDATE', [bookingId]);
    const b = rows[0];
    if (!b) throw new HttpError(404, 'Booking not found');
    if (role !== 'admin') {
      // Customer must own; organiser must own the service
      if (role === 'customer' && b.customer_id !== userId) throw new HttpError(403, 'Forbidden');
      if (role === 'organiser') {
        const [s] = await conn.query('SELECT organiser_id FROM services WHERE id=?', [b.service_id]);
        if (!s.length || s[0].organiser_id !== userId) throw new HttpError(403, 'Forbidden');
      }
    }
    if (b.status === 'cancelled') {
      await conn.commit();
      return { id: b.id, status: 'cancelled' };
    }
    await conn.query("UPDATE bookings SET status='cancelled' WHERE id=?", [b.id]);
    await conn.commit();
    return { id: b.id, status: 'cancelled' };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

async function confirmPayment({ bookingId, customerId, method }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM bookings WHERE id=? FOR UPDATE', [bookingId]);
    const b = rows[0];
    if (!b) throw new HttpError(404, 'Booking not found');
    if (b.customer_id !== customerId) throw new HttpError(403, 'Forbidden');
    if (b.payment_status === 'paid') throw new HttpError(400, 'Already paid');

    const txnId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000);
    await conn.query(
      `INSERT INTO payments (booking_id, amount, method, status, transaction_id, paid_at)
       VALUES (?,?,?,?,?,NOW())`,
      [b.id, b.total_amount, method, 'success', txnId]
    );

    const [serviceRows] = await conn.query('SELECT manual_confirmation FROM services WHERE id=?', [b.service_id]);
    const newStatus = serviceRows[0].manual_confirmation ? 'reserved' : 'confirmed';
    await conn.query(
      "UPDATE bookings SET payment_status='paid', status=? WHERE id=?",
      [newStatus, b.id]
    );
    await conn.commit();
    return { booking_id: b.id, status: newStatus, payment_status: 'paid', transaction_id: txnId };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

async function organiserConfirm({ bookingId, organiserId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT b.*, s.organiser_id, s.manual_confirmation
         FROM bookings b JOIN services s ON s.id=b.service_id
         WHERE b.id=? FOR UPDATE`, [bookingId]);
    const b = rows[0];
    if (!b) throw new HttpError(404, 'Booking not found');
    if (b.organiser_id !== organiserId) throw new HttpError(403, 'Forbidden');
    if (b.status === 'confirmed') { await conn.commit(); return { id: b.id, status: 'confirmed' }; }
    if (b.status === 'cancelled') throw new HttpError(400, 'Already cancelled');
    await conn.query("UPDATE bookings SET status='confirmed' WHERE id=?", [b.id]);
    await conn.commit();
    return { id: b.id, status: 'confirmed' };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

module.exports = {
  createBooking, rescheduleBooking, cancelBooking,
  confirmPayment, organiserConfirm,
};
