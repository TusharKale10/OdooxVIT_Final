import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

const pad = (n) => String(n).padStart(2,'0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const buildDateStrip = (centerStr, span = 14) => {
  const center = new Date(centerStr + 'T00:00:00');
  const out = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(center.getFullYear(), center.getMonth(), center.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
      dow: DOW[d.getDay()],
      day: d.getDate(),
      mon: MON[d.getMonth()],
    });
  }
  return out;
};

export default function Reschedule() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [stripStart, setStripStart] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [reason, setReason] = useState(null);
  const [pick, setPick] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/bookings/${id}`).then(setData).catch((e)=>setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const b = data.booking;
    const q = new URLSearchParams({ date, resource_id: b.resource_id });
    api.get(`/services/${b.service_id}/slots?${q.toString()}`)
      .then((d)=>{ setSlots(d.slots); setReason(d.reason || null); setPick(null); })
      .catch((e)=>setError(e.message));
  }, [data, date]);

  const submit = async () => {
    if (!pick) return;
    setBusy(true); setError('');
    try {
      await api.post(`/bookings/${id}/reschedule`, { start_datetime: pick.start });
      nav(`/booking/${id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="container"><div className="muted">Loading…</div></div>;
  const b = data.booking;
  const dateStrip = buildDateStrip(stripStart, 14);

  return (
    <div className="container">
      <div className="card">
        <h2 className="card-title">Reschedule your appointment</h2>
        <p className="muted" style={{marginTop:-6}}>
          Current reservation — <b>{new Date(b.start_datetime.replace(' ','T')).toLocaleString()}</b>
        </p>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="row" style={{marginBottom:10}}>
          <input type="date" value={stripStart} min={todayStr()}
            onChange={(e)=>{ setStripStart(e.target.value); setDate(e.target.value); }} />
          <span className="muted">Pick a new date</span>
        </div>
        <div className="date-strip">
          {dateStrip.map((d) => (
            <div key={d.iso}
              className={`date-pill ${date === d.iso ? 'selected' : ''}`}
              onClick={() => setDate(d.iso)}>
              <div className="dow">{d.dow}</div>
              <div className="day">{d.day}</div>
              <div className="mon">{d.mon}</div>
            </div>
          ))}
        </div>

        <h4 style={{margin:'18px 0 10px'}}>Available slots</h4>
        {!slots.length && (
          <div className="alert alert-info">
            {reason === 'no_resources'         && 'This service has no providers configured.'}
            {reason === 'no_schedule_today'    && 'No working hours configured for this weekday. Try another date.'}
            {reason === 'no_flex_window_today' && 'No availability windows for this date.'}
            {reason === 'all_full'             && 'All slots for this day are fully booked.'}
            {!reason                           && 'No slots for this day.'}
          </div>
        )}
        <div className="slots">
          {slots.map((s)=> (
            <button key={s.start} type="button"
              className={`slot ${!s.available ? 'disabled' : ''} ${pick && pick.start===s.start ? 'selected' : ''}`}
              disabled={!s.available}
              onClick={()=>setPick(s)}>
              {s.start.slice(11,16)}
            </button>
          ))}
        </div>

        <hr />
        <div className="row">
          <button className="secondary" onClick={()=>nav(-1)}>← Back</button>
          <button disabled={!pick || busy} onClick={submit}>
            {busy ? 'Updating…' : 'Confirm new time →'}
          </button>
        </div>
      </div>
    </div>
  );
}
