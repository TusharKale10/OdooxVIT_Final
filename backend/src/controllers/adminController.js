const pool = require('../config/db');
const { HttpError } = require('../middlewares/error');

exports.dashboard = async (_req, res) => {
  const [[users]] = await pool.query("SELECT COUNT(*) AS c FROM users");
  const [[providers]] = await pool.query(
    "SELECT COUNT(*) AS c FROM users WHERE role IN ('organiser')");
  const [[apps]] = await pool.query(
    "SELECT COUNT(*) AS c FROM bookings WHERE status IN ('confirmed','reserved','pending')");
  const [[services]] = await pool.query("SELECT COUNT(*) AS c FROM services");

  res.json({
    total_users: users.c,
    total_providers: providers.c,
    total_appointments: apps.c,
    total_services: services.c,
  });
};

exports.allUsers = async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, is_active, is_verified, created_at FROM users ORDER BY id DESC');
  res.json({ users: rows });
};

exports.setActive = async (req, res) => {
  const id = Number(req.params.id);
  const { is_active } = req.body;
  await pool.query('UPDATE users SET is_active=? WHERE id=?',
    [is_active ? 1 : 0, id]);
  res.json({ message: 'updated' });
};

exports.setRole = async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body;
  if (!['customer','organiser','admin'].includes(role)) throw new HttpError(400, 'invalid role');
  await pool.query('UPDATE users SET role=? WHERE id=?', [role, id]);
  res.json({ message: 'updated' });
};

// Reports & insights (organiser/admin)
exports.reports = async (req, res) => {
  const isOrg = req.user.role === 'organiser';
  const orgFilter = isOrg ? 'AND s.organiser_id=' + Number(req.user.id) : '';

  const [[total]] = await pool.query(
    `SELECT COUNT(*) AS c FROM bookings b JOIN services s ON s.id=b.service_id
      WHERE 1=1 ${orgFilter}`);

  const [peak] = await pool.query(
    `SELECT HOUR(b.start_datetime) AS hour, COUNT(*) AS bookings
       FROM bookings b JOIN services s ON s.id=b.service_id
      WHERE b.status IN ('confirmed','reserved','pending') ${orgFilter}
      GROUP BY HOUR(b.start_datetime)
      ORDER BY bookings DESC, hour ASC`);

  const [util] = await pool.query(
    `SELECT r.id AS resource_id, r.name AS resource_name, s.name AS service_name,
            COUNT(b.id) AS bookings,
            COALESCE(SUM(b.capacity_taken),0) AS capacity_used
       FROM resources r
       JOIN services s ON s.id=r.service_id
       LEFT JOIN bookings b ON b.resource_id=r.id
            AND b.status IN ('confirmed','reserved','pending')
      WHERE 1=1 ${orgFilter}
      GROUP BY r.id, r.name, s.name
      ORDER BY bookings DESC`);

  res.json({ total_appointments: total.c, peak_hours: peak, provider_utilization: util });
};