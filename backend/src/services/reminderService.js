// Background reminder loop — runs once a minute and notifies customers
// about bookings starting in the next 15 → 60 minutes (in-app + email).
// Idempotent via the existing bookings.reminder_sent flag.

const pool = require('../config/db');
const { sendMail } = require('./mailer');
const { bookingEmail } = require('./emailTemplates');

async function tick() {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.start_datetime, b.end_datetime, b.appointment_type, b.meeting_link,
              b.total_amount, b.customer_id, b.reminder_sent,
              s.name AS service_name, s.venue,
              r.name AS resource_name,
              u.full_name AS customer_name, u.email AS customer_email
         FROM bookings b
         JOIN services s ON s.id=b.service_id
         JOIN resources r ON r.id=b.resource_id
         JOIN users u ON u.id=b.customer_id
        WHERE b.status IN ('confirmed','reserved','pending')
          AND b.reminder_sent=0
          AND b.start_datetime > NOW()
          AND b.start_datetime <= DATE_ADD(NOW(), INTERVAL 60 MINUTE)`);

    for (const b of rows) {
      // Mark first to avoid duplicate sends if mail is slow.
      await pool.query('UPDATE bookings SET reminder_sent=1 WHERE id=?', [b.id]);
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES (?, 'reminder', ?, ?, ?)`,
        [b.customer_id, 'Appointment starting soon',
         `${b.service_name} starts at ${b.start_datetime}. ${b.appointment_type === 'virtual' ? 'Join link is ready.' : `Venue: ${b.venue || '—'}.`}`,
         `/booking/${b.id}`]);
      if (b.customer_email) {
        try {
          const tpl = bookingEmail({
            name: b.customer_name, action: 'reminder',
            service_name: b.service_name, when: b.start_datetime, end: b.end_datetime,
            provider: b.resource_name, status: 'reminder',
            venue: b.appointment_type === 'virtual' ? (b.meeting_link || 'Online') : b.venue,
            total: b.total_amount,
          });
          sendMail({ to: b.customer_email, ...tpl });
        } catch { /* ignore */ }
      }
    }
    if (rows.length) console.log(`[reminder] sent ${rows.length} reminder(s)`);
  } catch (e) {
    console.error('[reminder] tick failed:', e.message);
  }
}

function start() {
  // Every 60 seconds, with an immediate kickoff for hot reloads.
  tick();
  return setInterval(tick, 60 * 1000);
}

module.exports = { start, tick };
