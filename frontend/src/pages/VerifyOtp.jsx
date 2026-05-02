import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      await api.post('/auth/verify-otp', { email, otp: otp.trim() });
      setDone(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setError(''); setInfo(''); setResending(true);
    try {
      const d = await api.post('/auth/resend-otp', { email });
      setInfo(d.message || 'A new verification code has been sent.');
    } catch (e) { setError(e.message); }
    finally { setResending(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Verify your email</h2>
        <p className="auth-sub">
          We sent a 6-digit code to <b>{email || 'your email'}</b>. The code expires in 5 minutes.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        {info  && <div className="alert alert-info">{info}</div>}
        {done && (
          <div className="alert alert-success">
            Verified! <a onClick={()=>nav('/login')} style={{cursor:'pointer'}}>Continue to sign in →</a>
          </div>
        )}
        <form className="form" style={{maxWidth:'none'}} onSubmit={submit}>
          <div className="form-row"><label>Email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></div>
          <div className="form-row"><label>OTP code</label>
            <input value={otp} onChange={(e)=>setOtp(e.target.value)} required
              placeholder="6-digit code" maxLength={6}
              style={{letterSpacing:'0.5em', textAlign:'center', fontWeight:600}} /></div>
          <button className="lg block" disabled={busy} type="submit">
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button" className="ghost" disabled={resending || !email} onClick={resend}>
            {resending ? 'Sending new code…' : 'Resend code'}
          </button>
        </form>
      </div>
    </div>
  );
}
