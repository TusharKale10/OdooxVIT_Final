const crypto = require('crypto');
const pool = require('../config/db');
const { HttpError } = require('../middlewares/error');
const { getAvailableSlots } = require('../services/slotService');

exports.listPublic = async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.description, s.duration_minutes, s.venue, s.price,
            s.tax_percent, s.manage_capacity, s.max_per_slot, s.advance_payment,
            s.manual_confirmation, s.assignment_mode, s.schedule_type,
            s.resource_kind, s.is_published, s.share_token, s.organiser_id,
            u.full_name AS organiser_name
       FROM services s
       JOIN users u ON u.id=s.organiser_id
      WHERE s.is_published=1
      ORDER BY s.id DESC`);
  res.json({ services: rows });
};

exports.byShareToken = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, u.full_name AS organiser_name
       FROM services s JOIN users u ON u.id=s.organiser_id
      WHERE s.share_token=?`, [req.params.token]);
  if (!rows.length) throw new HttpError(404, 'Not found');
  res.json({ service: rows[0] });
};

exports.getOne = async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(
    `SELECT s.*, u.full_name AS organiser_name
       FROM services s JOIN users u ON u.id=s.organiser_id WHERE s.id=?`, [id]);
  if (!rows.length) throw new HttpError(404, 'Service not found');
  const service = rows[0];

  if (!service.is_published) {
    if (!req.user || (req.user.role !== 'admin' && req.user.id !== service.organiser_id))
      throw new HttpError(403, 'Service not published');
  }

  const [resources] = await pool.query(
    'SELECT id, name, user_id, is_active FROM resources WHERE service_id=? AND is_active=1', [id]);
  const [questions] = await pool.query(
    'SELECT id, question, field_type, is_required, sort_order FROM booking_questions WHERE service_id=? ORDER BY sort_order',
    [id]);
  const [weekly] = await pool.query(
    'SELECT day_of_week, start_time, end_time FROM weekly_schedules WHERE service_id=? ORDER BY day_of_week, start_time', [id]);
  const [flex] = await pool.query(
    'SELECT id, start_datetime, end_datetime FROM availability_slots WHERE service_id=? ORDER BY start_datetime', [id]);

  res.json({ service, resources, questions, weekly, flex });
};

exports.getSlots = async (req, res) => {
  const id = Number(req.params.id);
  const dateStr = req.query.date;
  const resourceId = req.query.resource_id ? Number(req.query.resource_id) : null;
  if (!dateStr) throw new HttpError(400, 'date is required (YYYY-MM-DD)');
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');

  const [s] = await pool.query('SELECT is_published, organiser_id FROM services WHERE id=?', [id]);
  if (!s.length) throw new HttpError(404, 'Service not found');
  if (!s[0].is_published) {
    if (!req.user || (req.user.role !== 'admin' && req.user.id !== s[0].organiser_id))
      throw new HttpError(403, 'Service not published');
  }

  const slots = await getAvailableSlots({ serviceId: id, date, resourceId });

  let reason = null;
  if (!slots.length) {
    const [resCount] = await pool.query(
      'SELECT COUNT(*) AS c FROM resources WHERE service_id=? AND is_active=1', [id]);
    if (resCount[0].c === 0) reason = 'no_resources';
    else {
      const [svcRow] = await pool.query('SELECT schedule_type FROM services WHERE id=?', [id]);
      if (svcRow[0].schedule_type === 'weekly') {
        const [wsCount] = await pool.query(
          'SELECT COUNT(*) AS c FROM weekly_schedules WHERE service_id=? AND day_of_week=?',
          [id, date.getDay()]);
        reason = wsCount[0].c === 0 ? 'no_schedule_today' : 'all_full';
      } else {
        reason = 'no_flex_window_today';
      }
    }
  }
  res.json({ date: dateStr, slots, reason });
};

// ---------- ORGANISER endpoints ----------
exports.listMine = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, u.full_name AS organiser_name
       FROM services s JOIN users u ON u.id=s.organiser_id
      WHERE s.organiser_id=? ORDER BY s.id DESC`, [req.user.id]);
  res.json({ services: rows });
};

exports.create = async (req, res) => {
  const u = req.user;
  const b = req.body;
  if (!b.name) throw new HttpError(400, 'name is required');
  const token = crypto.randomBytes(16).toString('hex');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO services
         (organiser_id,name,description,duration_minutes,venue,price,tax_percent,
          manage_capacity,max_per_slot,advance_payment,manual_confirmation,
          assignment_mode,schedule_type,resource_kind,is_published,share_token)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.id, b.name, b.description || '', Number(b.duration_minutes) || 30,
       b.venue || '', Number(b.price) || 0, Number(b.tax_percent) || 0,
       b.manage_capacity ? 1 : 0, Number(b.max_per_slot) || 1,
       b.advance_payment ? 1 : 0, b.manual_confirmation ? 1 : 0,
       b.assignment_mode === 'manual' ? 'manual' : 'auto',
       b.schedule_type === 'flexible' ? 'flexible' : 'weekly',
       b.resource_kind === 'resource' ? 'resource' : 'user',
       b.is_published ? 1 : 0, token]
    );
    const serviceId = r.insertId;

    // Auto-create a default resource so booking works out of the box
    await conn.query(
      'INSERT INTO resources (service_id, name, user_id) VALUES (?,?,?)',
      [serviceId, u.full_name || 'Default Provider', u.id]
    );

    // Auto-create a default Mon-Fri 9-17 weekly schedule (only for weekly services)
    const scheduleType = b.schedule_type === 'flexible' ? 'flexible' : 'weekly';
    if (scheduleType === 'weekly') {
      for (const dow of [1, 2, 3, 4, 5]) {
        await conn.query(
          'INSERT INTO weekly_schedules (service_id, day_of_week, start_time, end_time) VALUES (?,?,?,?)',
          [serviceId, dow, '09:00:00', '17:00:00']
        );
      }
    }

    await conn.commit();
    res.status(201).json({ id: serviceId, share_token: token });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

const ensureOwn = async (serviceId, organiserId, role) => {
  const [rows] = await pool.query('SELECT organiser_id FROM services WHERE id=?', [serviceId]);
  if (!rows.length) throw new HttpError(404, 'Service not found');
  if (role !== 'admin' && rows[0].organiser_id !== organiserId)
    throw new HttpError(403, 'Forbidden');
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  const b = req.body;
  await pool.query(
    `UPDATE services SET
       name=COALESCE(?,name), description=COALESCE(?,description),
       duration_minutes=COALESCE(?,duration_minutes), venue=COALESCE(?,venue),
       price=COALESCE(?,price), tax_percent=COALESCE(?,tax_percent),
       manage_capacity=COALESCE(?,manage_capacity),
       max_per_slot=COALESCE(?,max_per_slot),
       advance_payment=COALESCE(?,advance_payment),
       manual_confirmation=COALESCE(?,manual_confirmation),
       assignment_mode=COALESCE(?,assignment_mode),
       schedule_type=COALESCE(?,schedule_type),
       resource_kind=COALESCE(?,resource_kind),
       is_published=COALESCE(?,is_published)
     WHERE id=?`,
    [b.name ?? null, b.description ?? null,
     b.duration_minutes ?? null, b.venue ?? null,
     b.price ?? null, b.tax_percent ?? null,
     b.manage_capacity == null ? null : (b.manage_capacity ? 1 : 0),
     b.max_per_slot ?? null,
     b.advance_payment == null ? null : (b.advance_payment ? 1 : 0),
     b.manual_confirmation == null ? null : (b.manual_confirmation ? 1 : 0),
     b.assignment_mode ?? null,
     b.schedule_type ?? null,
     b.resource_kind ?? null,
     b.is_published == null ? null : (b.is_published ? 1 : 0),
     id]
  );
  res.json({ message: 'updated' });
};

exports.publish = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  await pool.query('UPDATE services SET is_published=? WHERE id=?',
    [req.body.publish ? 1 : 0, id]);
  res.json({ message: 'updated' });
};

// Resources
exports.addResource = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  const { name, user_id } = req.body;
  if (!name) throw new HttpError(400, 'name required');
  const [r] = await pool.query(
    'INSERT INTO resources (service_id, name, user_id) VALUES (?,?,?)',
    [id, name, user_id || null]);
  res.status(201).json({ id: r.insertId });
};

exports.deleteResource = async (req, res) => {
  const sid = Number(req.params.id);
  const rid = Number(req.params.rid);
  await ensureOwn(sid, req.user.id, req.user.role);
  await pool.query('DELETE FROM resources WHERE id=? AND service_id=?', [rid, sid]);
  res.json({ message: 'deleted' });
};

// Weekly schedule (replace)
exports.setWeekly = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM weekly_schedules WHERE service_id=?', [id]);
    for (const it of items) {
      await conn.query(
        'INSERT INTO weekly_schedules (service_id, day_of_week, start_time, end_time) VALUES (?,?,?,?)',
        [id, Number(it.day_of_week), it.start_time, it.end_time]
      );
    }
    await conn.commit();
    res.json({ message: 'saved' });
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

// Flexible slots (replace)
exports.setFlexible = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM availability_slots WHERE service_id=?', [id]);
    for (const it of items) {
      await conn.query(
        'INSERT INTO availability_slots (service_id, start_datetime, end_datetime) VALUES (?,?,?)',
        [id, it.start_datetime, it.end_datetime]);
    }
    await conn.commit();
    res.json({ message: 'saved' });
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

// Questions (replace)
exports.setQuestions = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM booking_questions WHERE service_id=?', [id]);
    let order = 0;
    for (const q of items) {
      order += 1;
      await conn.query(
        'INSERT INTO booking_questions (service_id, question, field_type, is_required, sort_order) VALUES (?,?,?,?,?)',
        [id, q.question, q.field_type || 'text', q.is_required ? 1 : 0, q.sort_order || order]
      );
    }
    await conn.commit();
    res.json({ message: 'saved' });
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
};

// Calendar view: bookings of a service in a window
exports.calendar = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  const from = req.query.from || new Date().toISOString().slice(0, 10);
  const to   = req.query.to   || from;
  const [rows] = await pool.query(
    `SELECT b.*, u.full_name AS customer_name, r.name AS resource_name
       FROM bookings b
       JOIN users u ON u.id=b.customer_id
       JOIN resources r ON r.id=b.resource_id
      WHERE b.service_id=? AND b.start_datetime >= ? AND b.start_datetime < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY b.start_datetime`,
    [id, from + ' 00:00:00', to]
  );
  res.json({ bookings: rows });
};

exports.serviceBookings = async (req, res) => {
  const id = Number(req.params.id);
  await ensureOwn(id, req.user.id, req.user.role);
  const [rows] = await pool.query(
    `SELECT b.*, u.full_name AS customer_name, u.email AS customer_email,
            r.name AS resource_name
       FROM bookings b
       JOIN users u ON u.id=b.customer_id
       JOIN resources r ON r.id=b.resource_id
      WHERE b.service_id=?
      ORDER BY b.start_datetime DESC`, [id]);
  res.json({ bookings: rows });
};
