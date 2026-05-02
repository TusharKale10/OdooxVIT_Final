import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { imageFor } from '../utils/serviceVisuals';

const fmtDate = (mysqlDt) => new Date(mysqlDt.replace(' ','T')).toLocaleString([], {
  weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

// Build a Google Calendar "add event" URL from a booking row.
const googleCalendarUrl = (b) => {
  const fmt = (mysqlDt) => {
    const d = new Date(mysqlDt.replace(' ', 'T'));
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${b.service_name} appointment`,
    dates: `${fmt(b.start_datetime)}/${fmt(b.end_datetime)}`,
    details: `Provider: ${b.resource_name}\nStatus: ${b.status}`,
    location: b.venue || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export default function BookingConfirmed() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/bookings/${id}`).then(setData).catch((e)=>setError(e.message));
  useEffect(() => { load(); }, [id]);

  const cancel = async () => {
    if (!confirm('Cancel this appointment?')) return;
    setBusy(true);
    try { await api.post(`/bookings/${id}/cancel`); nav('/'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (error) return <div className="container"><div className="alert alert-error">{error}</div></div>;
  if (!data) return <div className="container"><div className="muted">Loading…</div></div>;
  const b = data.booking;

  const titleByStatus = {
    confirmed:  '🎉 Appointment confirmed',
    reserved:   '⏳ Appointment reserved',
    pending:    '💳 Awaiting payment',
    cancelled:  '❌ Appointment cancelled',
  };
  const statusBadge = b.status === 'confirmed' ? 'badge-green'
    : b.status === 'reserved' || b.status === 'pending' ? 'badge-yellow'
    : b.status === 'cancelled' ? 'badge-red' : 'badge-grey';

  return (
    <div className="container">
      <div className="two-col">
        <div className="card">
          <h2 className="card-title">{titleByStatus[b.status] || 'Appointment'}</h2>
          {b.status === 'reserved' && (
            <div className="alert alert-info">You'll get an email when the organiser confirms your booking.</div>
          )}
          {b.status === 'confirmed' && (
            <div className="alert alert-success">
              Thank you for your trust — we look forward to meeting you.
            </div>
          )}

          <div className="cal-item"><span className="muted">Time</span><b>{fmtDate(b.start_datetime)}</b></div>
          <div className="cal-item"><span className="muted">Duration</span><b>{b.duration_minutes} min</b></div>
          {b.capacity_taken > 1 && (
            <div className="cal-item"><span className="muted">No. of people</span><b>{b.capacity_taken}</b></div>
          )}
          <div className="cal-item"><span className="muted">Provider</span><b>{b.resource_name}</b></div>
          <div className="cal-item"><span className="muted">Service</span><b>{b.service_name}</b></div>
          <div className="cal-item"><span className="muted">Venue</span><b>{b.venue || '—'}</b></div>
          <div className="cal-item"><span className="muted">Status</span>
            <span className={`badge ${statusBadge}`}>{b.status}</span></div>
          <div className="cal-item"><span className="muted">Payment</span>
            <span className="badge badge-grey">{b.payment_status}</span></div>

          {data.answers.length > 0 && (
            <>
              <hr/>
              <h3 className="card-title">Submitted answers</h3>
              {data.answers.map((a, i) => (
                <div className="cal-item" key={i}>
                  <span className="muted">{a.question}</span>
                  <b>{a.answer_text}</b>
                </div>
              ))}
            </>
          )}

          <hr/>
          <div className="row">
            {b.status !== 'cancelled' && (
              <>
                <button className="danger" disabled={busy} onClick={cancel}>Cancel appointment</button>
                <Link to={`/booking/${b.id}/reschedule`}><button className="secondary">Reschedule</button></Link>
              </>
            )}
            <Link to="/profile" className="right"><button className="ghost">Back to my appointments →</button></Link>
          </div>
        </div>

        <aside className="card" style={{position:'sticky', top:88}}>
          <div style={{
            height: 160, marginBottom: 14, borderRadius: 12,
            backgroundImage: `url(${imageFor({ name: b.service_name })})`,
            backgroundSize: 'cover', backgroundPosition: 'center'
          }} />
          <h3 className="card-title">Save the date</h3>
          <a href={googleCalendarUrl(b)} target="_blank" rel="noreferrer">
            <button type="button" className="secondary block">📅 Add to Google Calendar</button>
          </a>
          <p className="muted" style={{marginTop:14}}>
            A confirmation email has been sent to your registered address.
            You can reschedule any time before the appointment starts.
          </p>
        </aside>
      </div>
    </div>
  );
}
