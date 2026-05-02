import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PasswordInput from '../components/PasswordInput.jsx';

const validatePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return 'Mobile number must be at least 10 digits.';
  if (digits.length > 15) return 'Mobile number is too long.';
  return null;
};

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', role: 'customer',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim())          return setError('Full name is required.');
    const phoneErr = validatePhone(form.phone);
    if (phoneErr)                         return setError(phoneErr);
    if (form.password.length < 6)         return setError('Password must be at least 6 characters.');

    setBusy(true);
    try {
      await api.post('/auth/register', form);
      nav(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Create your account</h2>
        <p className="auth-sub">Book in seconds. No call required.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="form" style={{maxWidth:'none'}} onSubmit={submit}>
          <div className="form-row"><label>Full name</label>
            <input value={form.full_name} onChange={set('full_name')} required
              autoComplete="name" /></div>
          <div className="form-row"><label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required
              autoComplete="email" /></div>
          <div className="form-row"><label>Mobile number</label>
            <input type="tel" inputMode="tel" value={form.phone}
              onChange={set('phone')} required autoComplete="tel"
              placeholder="e.g. 9876543210 or +91 98765 43210" /></div>
          <div className="form-row"><label>Password</label>
            <PasswordInput value={form.password} onChange={set('password')}
              required autoComplete="new-password" placeholder="At least 6 characters" /></div>
          <div className="form-row"><label>I am a…</label>
            <select value={form.role} onChange={set('role')}>
              <option value="customer">Customer (book appointments)</option>
              <option value="organiser">Organiser (offer services)</option>
            </select></div>
          <button className="lg block" disabled={busy} type="submit">
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <div className="muted" style={{textAlign:'center'}}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
