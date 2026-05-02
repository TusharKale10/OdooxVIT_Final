const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const { sign } = require('../utils/jwt');
const { HttpError } = require('../middlewares/error');
const { sendMail } = require('../services/mailer');
const { otpEmail, resetEmail } = require('../services/emailTemplates');

const sanitize = (u) => ({
  id: u.id, full_name: u.full_name, email: u.email,
  role: u.role, is_verified: !!u.is_verified, phone: u.phone,
});

// Strip non-digits, accept 10–15 digit numbers (10 for IN local, more for E.164).
const isValidPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};
const normalizePhone = (raw) => String(raw || '').trim();

const isValidEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw || ''));

exports.register = async (req, res) => {
  const { full_name, email, password, role, phone } = req.body;

  if (!full_name || !String(full_name).trim()) throw new HttpError(400, 'Full name is required');
  if (!isValidEmail(email))                    throw new HttpError(400, 'A valid email is required');
  if (!password || String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (!isValidPhone(phone))                    throw new HttpError(400, 'A valid mobile number (10–15 digits) is required');

  const [exist] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
  if (exist.length) throw new HttpError(409, 'Email already registered');

  const hash   = await bcrypt.hash(password, 10);
  const otp    = String(Math.floor(100000 + Math.random() * 900000));
  const otpExp = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  const allowedRoles = ['customer', 'organiser'];
  const finalRole = allowedRoles.includes(role) ? role : 'customer';

  const [r] = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, phone, otp_code, otp_expires_at)
     VALUES (?,?,?,?,?,?,?)`,
    [full_name, email, hash, finalRole, normalizePhone(phone), otp, otpExp]
  );

  // Fire-and-forget email + simulated SMS (logged server-side, NEVER in API response)
  const tpl = otpEmail({ name: full_name, otp });
  sendMail({ to: email, ...tpl });
  console.log(`[sms:simulated] would send OTP ${otp} to phone ${normalizePhone(phone)}`);

  res.status(201).json({
    message: 'Account created. Please check your email for the verification code.',
    user_id: r.insertId,
  });
};

exports.resendOtp = async (req, res) => {
  const { email } = req.body;
  const [rows] = await pool.query('SELECT id, full_name, is_verified FROM users WHERE email=?', [email]);
  const u = rows[0];
  // Always respond identically to avoid email enumeration
  if (!u || u.is_verified) {
    return res.json({ message: 'If your account needs verification, a new code was sent.' });
  }
  const otp    = String(Math.floor(100000 + Math.random() * 900000));
  const otpExp = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query('UPDATE users SET otp_code=?, otp_expires_at=? WHERE id=?', [otp, otpExp, u.id]);
  sendMail({ to: email, ...otpEmail({ name: u.full_name, otp }) });
  res.json({ message: 'A new verification code has been sent to your email.' });
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw new HttpError(400, 'Email and OTP are required');
  const [rows] = await pool.query(
    'SELECT id, otp_code, otp_expires_at FROM users WHERE email=?', [email]);
  const u = rows[0];
  if (!u) throw new HttpError(404, 'User not found');
  if (!u.otp_code || u.otp_code !== String(otp).trim()) throw new HttpError(400, 'Invalid OTP');
  if (new Date(u.otp_expires_at) < new Date()) throw new HttpError(400, 'OTP expired — please request a new one');
  await pool.query(
    'UPDATE users SET is_verified=1, otp_code=NULL, otp_expires_at=NULL WHERE id=?',
    [u.id]);
  res.json({ message: 'Account verified. You can now sign in.' });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
  const u = rows[0];
  if (!u) throw new HttpError(401, 'Invalid credentials');
  if (!u.is_active) throw new HttpError(403, 'Account deactivated');
  if (!u.is_verified) throw new HttpError(403, 'Please verify your email before signing in');
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid credentials');
  const token = sign({ id: u.id, email: u.email, role: u.role, full_name: u.full_name });
  res.json({ token, user: sanitize(u) });
};

exports.forgot = async (req, res) => {
  const { email } = req.body;
  // Generic response prevents account enumeration
  const generic = { message: 'If that email exists, a password reset link has been sent.' };
  if (!isValidEmail(email)) return res.json(generic);

  const [rows] = await pool.query('SELECT id, full_name FROM users WHERE email=?', [email]);
  if (!rows.length) return res.json(generic);
  const u = rows[0];

  const token = crypto.randomBytes(24).toString('hex');
  const exp   = new Date(Date.now() + 30 * 60 * 1000);
  await pool.query('UPDATE users SET reset_token=?, reset_expires_at=? WHERE id=?',
    [token, exp, u.id]);

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset?email=${encodeURIComponent(email)}&token=${token}`;
  sendMail({ to: email, ...resetEmail({ name: u.full_name, token, email, resetUrl }) });

  res.json(generic);
};

exports.reset = async (req, res) => {
  const { email, token, new_password } = req.body;
  if (!new_password || String(new_password).length < 6)
    throw new HttpError(400, 'Password must be at least 6 characters');
  const [rows] = await pool.query(
    'SELECT id, reset_token, reset_expires_at FROM users WHERE email=?', [email]);
  const u = rows[0];
  if (!u || !u.reset_token || u.reset_token !== token)
    throw new HttpError(400, 'Invalid or expired reset token');
  if (new Date(u.reset_expires_at) < new Date())
    throw new HttpError(400, 'Reset token expired — please request a new one');
  const hash = await bcrypt.hash(new_password, 10);
  await pool.query(
    'UPDATE users SET password_hash=?, reset_token=NULL, reset_expires_at=NULL WHERE id=?',
    [hash, u.id]);
  res.json({ message: 'Password updated. You can now sign in.' });
};

exports.me = async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, is_verified, phone FROM users WHERE id=?',
    [req.user.id]);
  if (!rows.length) throw new HttpError(404, 'User not found');
  res.json({ user: rows[0] });
};

exports.updateMe = async (req, res) => {
  const { full_name, phone } = req.body;
  if (phone != null && phone !== '' && !isValidPhone(phone))
    throw new HttpError(400, 'Mobile number must be 10–15 digits');

  await pool.query(
    'UPDATE users SET full_name=COALESCE(?,full_name), phone=COALESCE(?,phone) WHERE id=?',
    [full_name || null, phone ? normalizePhone(phone) : null, req.user.id]
  );
  const [rows] = await pool.query(
    'SELECT id, full_name, email, role, is_verified, phone FROM users WHERE id=?',
    [req.user.id]);
  res.json({ user: rows[0] });
};
