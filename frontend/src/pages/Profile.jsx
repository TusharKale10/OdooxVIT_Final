import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, User, Phone, ShieldCheck, Mail, Loader2, Video, X, RefreshCw, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client';
import { imageFor } from '../utils/serviceVisuals';
import { formatDateTime } from '../utils/format';

const fmtDt = formatDateTime;

const STATUS_PILL = {
  confirmed:    'pill-green',
  reserved:     'pill-amber',
  pending:      'pill-amber',
  cancelled:    'pill-rose',
  completed:    'pill-slate',
  rescheduled:  'pill-brand',
};

function ApptCard({ b, onCancel }) {
  return (
    <div className="card overflow-hidden flex flex-col sm:flex-row gap-3 hover:shadow-lg transition">
      <div className="sm:w-44 aspect-[16/9] sm:aspect-auto bg-cover bg-center"
           style={{ backgroundImage: `url(${imageFor({ name: b.service_name })})` }} />
      <div className="flex-1 p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-ink-900">{b.service_name}</h3>
          <span className={STATUS_PILL[b.status] || 'pill-slate'}>{b.status}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
          <span className="flex items-center gap-1"><CalendarDays size={12} /> {fmtDt(b.start_datetime)}</span>
          <span className="flex items-center gap-1"><User size={12} /> {b.resource_name}</span>
          <span className="flex items-center gap-1"><Clock size={12} /> {b.duration_minutes} min</span>
          {b.appointment_type === 'virtual' && <span className="flex items-center gap-1 text-brand-600"><Video size={12} /> Virtual</span>}
          {b.venue && b.appointment_type !== 'virtual' && <span className="flex items-center gap-1"><MapPin size={12} /> {b.venue}</span>}
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {b.payment_status !== 'not_required' && <span className="pill-slate">payment: {b.payment_status}</span>}
          {b.appointment_type === 'virtual' && b.meeting_link && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer" className="pill-brand"><Video size={10} /> Join meeting</a>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {b.payment_status === 'pending' && b.status !== 'cancelled' && (
            <Link to={`/booking/${b.id}/pay`} className="btn-primary !py-1.5 !px-3 text-xs"><CreditCard size={12} /> Pay now</Link>
          )}
          <Link to={`/booking/${b.id}`} className="btn-outline !py-1.5 !px-3 text-xs">View</Link>
          {b.status !== 'cancelled' && (
            <Link to={`/booking/${b.id}/reschedule`} className="btn-ghost !py-1.5 !px-3 text-xs"><RefreshCw size={12} /> Reschedule</Link>
          )}
          {b.status !== 'cancelled' && (
            <button onClick={() => onCancel(b.id)} className="btn-ghost !py-1.5 !px-3 text-xs text-rose-600 hover:bg-rose-50"><X size={12} /> Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [credits, setCredits] = useState(0);
  const [subscription, setSubscription] = useState(null);

  const reload = () => api.get('/bookings/mine').then((d) => setBookings(d.bookings)).catch((e) => setError(e.message));

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name, phone: user.phone || '' });
    reload();
    api.get('/credits/me').then((d) => setCredits(d.balance || 0)).catch(() => {});
    api.get('/subscriptions/mine').then((d) => setSubscription(d.subscription)).catch(() => {});
  }, [user]);

  const save = async (e) => {
    e.preventDefault(); setInfo(''); setError('');
    if (form.phone) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        setError('Mobile number must be 10–15 digits.'); return;
      }
    }
    setBusy(true);
    try { await api.put('/auth/me', form); await refresh(); setInfo('Profile updated.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const sendPhoneOtp = async () => {
    setError(''); setInfo('');
    try { await api.post('/auth/phone/send-otp', { phone: form.phone }); setPhoneOtpSent(true); setInfo('OTP sent to your phone (check server log for demo).'); }
    catch (e) { setError(e.message); }
  };

  const verifyPhoneOtp = async () => {
    setError(''); setInfo('');
    try { await api.post('/auth/phone/verify-otp', { otp: phoneOtp }); await refresh(); setInfo('Phone verified.'); setPhoneOtpSent(false); setPhoneOtp(''); }
    catch (e) { setError(e.message); }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this booking?')) return;
    try { await api.post(`/bookings/${id}/cancel`); reload(); }
    catch (e) { setError(e.message); }
  };

  const now = Date.now();
  const upcoming = useMemo(() => bookings.filter((b) => new Date(b.start_datetime.replace(' ', 'T')).getTime() >= now && b.status !== 'cancelled'), [bookings]);
  const past = useMemo(() => bookings.filter((b) => new Date(b.start_datetime.replace(' ', 'T')).getTime() < now || b.status === 'cancelled'), [bookings]);
  const initials = (user?.full_name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">My appointments</h1>
            <p className="text-sm text-ink-500">Upcoming and past bookings, all in one place</p>
          </div>
        </div>
        {error && <div className="card border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}

        <section>
          <h3 className="text-sm font-bold text-ink-700 uppercase tracking-wide mb-3">Upcoming</h3>
          {upcoming.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-ink-500 mb-3">You have no upcoming appointments.</p>
              <Link to="/" className="btn-primary inline-flex">Browse services</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b) => <ApptCard key={b.id} b={b} onCancel={cancel} />)}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-bold text-ink-700 uppercase tracking-wide mb-3">Past & cancelled</h3>
          {past.length === 0 ? (
            <p className="text-ink-500 text-sm">No history yet.</p>
          ) : (
            <div className="space-y-3">
              {past.slice(0, 10).map((b) => <ApptCard key={b.id} b={b} onCancel={cancel} />)}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 self-start">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-lg font-bold flex items-center justify-center">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{user?.full_name}</div>
              <div className="text-xs text-ink-500 truncate">{user?.email}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="pill-slate capitalize">{user?.role}</span>
            {user?.is_verified && <span className="pill-green"><ShieldCheck size={10} /> Email verified</span>}
            {user?.is_phone_verified && <span className="pill-green"><ShieldCheck size={10} /> Phone verified</span>}
            {subscription && <span className="pill-brand">{subscription.name} plan</span>}
          </div>
          {info && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">{info}</div>}
          <form className="space-y-3" onSubmit={save}>
            <div><label className="label flex items-center gap-1"><User size={12} /> Full name</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><label className="label flex items-center gap-1"><Phone size={12} /> Mobile number</label>
              <input type="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 9876543210" /></div>
            <div><label className="label flex items-center gap-1"><Mail size={12} /> Email</label>
              <input className="input bg-ink-50" value={user?.email || ''} disabled /></div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}{busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          {!user?.is_phone_verified && (
            <div className="mt-4 pt-4 border-t border-ink-100">
              <div className="text-xs text-ink-500 mb-2">Verify your phone to receive SMS reminders.</div>
              {!phoneOtpSent ? (
                <button onClick={sendPhoneOtp} className="btn-outline w-full">Send phone OTP</button>
              ) : (
                <div className="flex gap-2">
                  <input className="input text-center tracking-widest" placeholder="OTP"
                    value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} />
                  <button onClick={verifyPhoneOtp} className="btn-primary">Verify</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide font-semibold text-ink-500">Schedula credits</div>
          <div className="text-3xl font-bold text-ink-900 mt-1">{credits.toLocaleString()}</div>
          <div className="text-xs text-ink-500 mt-1">1 credit = ₹1 off your next booking</div>
          <Link to="/credits" className="btn-soft w-full mt-4">Manage credits</Link>
        </div>
      </aside>
    </div>
  );
}
