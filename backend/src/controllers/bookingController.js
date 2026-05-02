const pool = require('../config/db');
const { HttpError } = require('../middlewares/error');
const {
  createBooking, rescheduleBooking, cancelBooking,
  confirmPayment, organiserConfirm,
} = require('../services/bookingService');
const { sendMail } = require('../services/mailer');
const { bookingEmail } = require('../services/emailTemplates');

// Pulls the data we need to render a booking email and dispatches it.
// Fire-and-forget — failures are logged but never block the API response.
async function notify(bookingId, action) {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, s.name AS service_name, s.venue,
              r.name AS resource_name,
              u.full_name AS customer_name, u.email AS customer_email
         FROM bookings b
         JOIN services s ON s.id=b.service_id
         JOIN resources r ON r.id=b.resource_id
         JOIN users u ON u.id=b.customer_id
        WHERE b.id=?`, [bookingId]);
    const b = rows[0];
    if (!b || !b.customer_email) return;
    const tpl = bookingEmail({
      name: b.customer_name,
      action,
      service_name: b.service_name,
      when: b.start_datetime,
      end:  b.end_datetime,
      provider: b.resource_name,
      status: b.status,
      venue: b.venue,
      total: b.total_amount,
    });
    sendMail({ to: b.customer_email, ...tpl });
  } catch (e) {
    console.error('[booking notify] failed:', e.message);
  }
}

exports.create = async (req, res) => {
  const { service_id, start_datetime, resource_id, capacity_taken, answers } = req.body;
  if (!service_id || !start_datetime)
    throw new HttpError(400, 'service_id and start_datetime are required');
  const out = await createBooking({
    serviceId: Number(service_id),
    customerId: req.user.id,
    startDatetime: start_datetime,
    resourceId: resource_id ? Number(resource_id) : null,
    capacityTaken: Number(capacity_taken) || 1,
    answers: answers || [],
  });
  notify(out.id, 'created');
  res.status(201).json({ booking: out });
};

exports.reschedule = async (req, res) => {
  const id = Number(req.params.id);
  const { start_datetime } = req.body;
  if (!start_datetime) throw new HttpError(400, 'start_datetime required');
  const out = await rescheduleBooking({
    bookingId: id, newStart: start_datetime, customerId: req.user.id,
  });
  notify(id, 'rescheduled');
  res.json({ booking: out });
};

exports.cancel = async (req, res) => {
  const id = Number(req.params.id);
  const out = await cancelBooking({
    bookingId: id, userId: req.user.id, role: req.user.role,
  });
  notify(id, 'cancelled');
  res.json({ booking: out });
};

exports.pay = async (req, res) => {
  const id = Number(req.params.id);
  const { method } = req.body;
  if (!['credit_card','debit_card','upi','paypal'].includes(method))
    throw new HttpError(400, 'invalid method');
  const out = await confirmPayment({ bookingId: id, customerId: req.user.id, method });
  // After payment the booking either becomes 'confirmed' or 'reserved'
  notify(id, out.status === 'confirmed' ? 'confirmed' : 'created');
  res.json({ payment: out });
};

exports.organiserConfirm = async (req, res) => {
  const id = Number(req.params.id);
  const out = await organiserConfirm({ bookingId: id, organiserId: req.user.id });
  notify(id, 'confirmed');
  res.json({ booking: out });
};

const baseSelect = `
  SELECT b.*, s.name AS service_name, s.duration_minutes, s.venue,
         r.name AS resource_name, u.full_name AS customer_name
    FROM bookings b
    JOIN services s ON s.id=b.service_id
    JOIN resources r ON r.id=b.resource_id
    JOIN users u ON u.id=b.customer_id
`;

exports.mine = async (req, res) => {
  const [rows] = await pool.query(
    `${baseSelect} WHERE b.customer_id=? ORDER BY b.start_datetime DESC`,
    [req.user.id]);
  res.json({ bookings: rows });
};

exports.detail = async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`${baseSelect} WHERE b.id=?`, [id]);
  if (!rows.length) throw new HttpError(404, 'Booking not found');
  const b = rows[0];
  if (req.user.role !== 'admin') {
    if (req.user.role === 'customer' && b.customer_id !== req.user.id)
      throw new HttpError(403, 'Forbidden');
    if (req.user.role === 'organiser') {
      const [s] = await pool.query('SELECT organiser_id FROM services WHERE id=?', [b.service_id]);
      if (!s.length || s[0].organiser_id !== req.user.id) throw new HttpError(403, 'Forbidden');
    }
  }
  const [answers] = await pool.query(
    `SELECT ba.answer_text, q.question, q.field_type
       FROM booking_answers ba JOIN booking_questions q ON q.id=ba.question_id
      WHERE ba.booking_id=?`, [id]);
  const [pays] = await pool.query('SELECT * FROM payments WHERE booking_id=? ORDER BY id DESC', [id]);
  res.json({ booking: b, answers, payments: pays });
};
