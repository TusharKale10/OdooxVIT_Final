import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client';
import { imageFor } from '../utils/serviceVisuals';

const fmtDt = (s) => new Date(s.replace(' ','T')).toLocaleString([], {
  weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit',
});

const statusBadge = (s) =>
  s === 'confirmed' ? 'badge-green'
  : s === 'reserved' ? 'badge-yellow'
  : s === 'pending'  ? 'badge-yellow'
  : s === 'cancelled' ? 'badge-red' : 'badge-grey';

function ApptCard({ b }) {
  return (
    <div className="appt-card">
      <div className="appt-thumb" style={{ backgroundImage: `url(${imageFor({ name: b.service_name })})` }} />
      <div className="appt-body">
        <h3 className="appt-title">{b.service_name}</h3>
        <div className="appt-meta">
          <span>📅 {fmtDt(b.start_datetime)}</span>
          <span className="dot" />
          <span>👤 {b.resource_name}</span>
          <span className="dot" />
          <span>⏱ {b.duration_minutes} min</span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className={`badge ${statusBadge(b.status)}`}>{b.status}</span>
          {b.payment_status !== 'not_required' &&
            <span className="badge badge-grey">payment: {b.payment_status}</span>}
        </div>
      </div>
      <div className="appt-actions">
        <Link to={`/booking/${b.id}`}><button className="secondary">View</button></Link>
        {b.status !== 'cancelled' && (
          <Link to={`/booking/${b.id}/reschedule`}><button className="ghost">Reschedule</button></Link>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name:'', phone:'' });
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name, phone: user.phone || '' });
    api.get('/bookings/mine').then((d)=>setBookings(d.bookings)).catch((e)=>setError(e.message));
  }, [user]);

  const save = async (e) => {
    e.preventDefault(); setInfo(''); setError('');
    if (form.phone) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        setError('Mobile number must be 10–15 digits.');
        return;
      }
    }
    setBusy(true);
    try { await api.put('/auth/me', form); await refresh(); setInfo('Profile updated.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const now = Date.now();
  const upcoming = bookings.filter((b)=> new Date(b.start_datetime.replace(' ','T')).getTime() >= now && b.status !== 'cancelled');
  const past     = bookings.filter((b)=> new Date(b.start_datetime.replace(' ','T')).getTime() <  now || b.status === 'cancelled');

  const initials = (user?.full_name || '?').split(' ').map((p)=>p[0]).slice(0,2).join('').toUpperCase();

  return (
    <div className="container">
      <div className="two-col">
        <div>
          <div className="section-header">
            <div>
              <h2>My appointments</h2>
              <p>Upcoming and past bookings, all in one place</p>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <h4 style={{margin:'18px 0 10px'}}>Upcoming</h4>
          {upcoming.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <div className="muted">You have no upcoming appointments.</div>
              <Link to="/" style={{display:'inline-block', marginTop:10}}><button>Browse services</button></Link>
            </div>
          ) : (
            <div className="appt-grid">
              {upcoming.map((b) => <ApptCard key={b.id} b={b} />)}
            </div>
          )}

          <h4 style={{margin:'28px 0 10px'}}>Past & cancelled</h4>
          {past.length === 0
            ? <div className="muted">No history yet.</div>
            : <div className="appt-grid">
                {past.slice(0, 10).map((b) => <ApptCard key={b.id} b={b} />)}
              </div>}
        </div>

        <aside className="card">
          <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:14}}>
            <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials}</div>
            <div>
              <div style={{fontWeight:700}}>{user?.full_name}</div>
              <div className="muted">{user?.email}</div>
            </div>
          </div>
          <div className="row" style={{marginBottom:14}}>
            <span className="badge">{user?.role}</span>
            {user?.is_verified && <span className="badge badge-green">verified</span>}
          </div>

          {info && <div className="alert alert-success">{info}</div>}
          <form className="form" onSubmit={save}>
            <div className="form-row"><label>Full name</label>
              <input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} /></div>
            <div className="form-row"><label>Mobile number</label>
              <input type="tel" inputMode="tel" value={form.phone}
                onChange={(e)=>setForm({...form,phone:e.target.value})}
                placeholder="e.g. 9876543210 or +91 98765 43210" /></div>
            <div className="form-row"><label>Email</label>
              <input value={user?.email || ''} disabled /></div>
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
