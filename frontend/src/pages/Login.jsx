import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await login(email, password); nav('/'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Welcome back</h2>
        <p className="auth-sub">Sign in to manage your appointments.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="form" style={{maxWidth:'none'}} onSubmit={submit}>
          <div className="form-row">
            <label>Email</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
              autoComplete="email" />
          </div>
          <div className="form-row">
            <label>Password</label>
            <PasswordInput value={password} onChange={(e)=>setPassword(e.target.value)}
              required autoComplete="current-password" />
          </div>
          <button className="lg block" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="row" style={{justifyContent:'space-between'}}>
            <Link to="/register">Create an account</Link>
            <Link to="/forgot">Forgot password?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
