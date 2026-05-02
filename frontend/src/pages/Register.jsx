import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api/client';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthShell from '../components/AuthShell.jsx';

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
    if (!form.full_name.trim()) return setError('Full name is required.');
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) return setError(phoneErr);
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    try {
      await api.post('/auth/register', form);
      nav(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthShell
      title="Create your account"
      subtitle="Book in seconds. No calls required."
      footer={<>Already a member? <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link></>}
    >
      {error && <div className="card border-rose-200 bg-rose-50 text-rose-700 p-3 mb-4 text-sm">{error}</div>}
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.full_name} onChange={set('full_name')} required autoComplete="name" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Mobile number</label>
          <input type="tel" inputMode="tel" className="input" value={form.phone} onChange={set('phone')} required autoComplete="tel"
                 placeholder="e.g. 9876543210" />
        </div>
        <div>
          <label className="label">Password</label>
          <PasswordInput value={form.password} onChange={set('password')} required autoComplete="new-password" placeholder="At least 6 characters" />
        </div>
        <div>
          <label className="label">I am a…</label>
          <select className="input" value={form.role} onChange={set('role')}>
            <option value="customer">Customer (book appointments)</option>
            <option value="organiser">Organiser (offer services)</option>
          </select>
        </div>
        <button className="btn-primary w-full !py-3" disabled={busy} type="submit">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
