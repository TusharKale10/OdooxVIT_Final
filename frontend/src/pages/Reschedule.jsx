import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Check } from 'lucide-react';
import { api } from '../api/client';
import Calendar from '../components/Calendar.jsx';
import { formatTime, formatDateTime } from '../utils/format';

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export default function Reschedule() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [reason, setReason] = useState(null);
  const [pick, setPick] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/bookings/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const b = data.booking;
    const q = new URLSearchParams({ date, resource_id: b.resource_id });
    api.get(`/services/${b.service_id}/slots?${q.toString()}`)
      .then((d) => { setSlots(d.slots); setReason(d.reason || null); setPick(null); })
      .catch((e) => setError(e.message));
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

  if (!data) return <div className="p-12 text-center text-ink-500">Loading…</div>;
  const b = data.booking;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => nav(-1)} className="btn-ghost mb-4"><ChevronLeft size={16} /> Back</button>
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-ink-900">Reschedule your appointment</h1>
        <p className="text-sm text-ink-500 mt-1">Current — <b>{formatDateTime(b.start_datetime)}</b></p>
        {error && <div className="card border-rose-200 bg-rose-50 text-rose-700 p-3 mt-4 text-sm">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 mt-5">
          <div>
            <Calendar value={date} onChange={setDate} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-700 mb-3">Available slots on {date}</h3>
            {!slots.length && (
              <div className="card border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm">
                {reason === 'no_resources'         && 'This service has no providers configured.'}
                {reason === 'no_schedule_today'    && 'No working hours for this weekday — try another date.'}
                {reason === 'no_flex_window_today' && 'No availability windows for this date.'}
                {reason === 'all_full'             && 'All slots booked for this day.'}
                {reason === 'date_blocked'         && 'This date is blocked by the organiser.'}
                {!reason                           && 'No slots for this day.'}
              </div>
            )}
            {slots.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((s) => (
                  <button key={s.start} disabled={!s.available} onClick={() => setPick(s)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition
                      ${pick && pick.start === s.start ? 'bg-brand-600 text-white border-brand-600' :
                        s.available ? 'bg-white border-ink-200 text-ink-800 hover:border-brand-400' : 'bg-ink-50 border-ink-200 text-ink-300 cursor-not-allowed'}
                    `}>
                    {formatTime(s.start)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-ink-200 flex justify-between">
          <button className="btn-outline" onClick={() => nav(-1)}><ChevronLeft size={14} /> Back</button>
          <button className="btn-primary" disabled={!pick || busy} onClick={submit}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {busy ? 'Updating…' : 'Confirm new time'}
          </button>
        </div>
      </div>
    </div>
  );
}
