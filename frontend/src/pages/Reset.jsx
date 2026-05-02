import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Reset() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: params.get('email') || '',
    token: params.get('token') || '',
    new_password: '',
  });
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api.post('/auth/reset', form);
      setInfo('Password updated. Redirecting…');
      setTimeout(()=> nav('/login'), 1200);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Set a new password</h2>
        <p className="auth-sub">Choose something memorable but secure.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {info  && <div className="alert alert-success">{info}</div>}
        <form className="form" style={{maxWidth:'none'}} onSubmit={submit}>
          <div className="form-row"><label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required /></div>
          <div className="form-row"><label>Reset token</label>
            <input value={form.token} onChange={set('token')} required
              placeholder="From the email we sent you" /></div>
          <div className="form-row"><label>New password</label>
            <PasswordInput value={form.new_password} onChange={set('new_password')}
              required autoComplete="new-password" placeholder="At least 6 characters" /></div>
          <button className="lg block" disabled={busy} type="submit">
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
