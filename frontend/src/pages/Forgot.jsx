import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      const d = await api.post('/auth/forgot', { email });
      setInfo(d.message || 'If that email exists, a password reset link has been sent.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Forgot password?</h2>
        <p className="auth-sub">Enter your email and we'll send a reset link.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {info  && <div className="alert alert-success">{info}</div>}
        <form className="form" style={{maxWidth:'none'}} onSubmit={submit}>
          <div className="form-row"><label>Email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
              autoComplete="email" /></div>
          <button className="lg block" disabled={busy} type="submit">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <div className="muted" style={{textAlign:'center'}}>
            Remembered it? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
