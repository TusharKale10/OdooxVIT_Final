import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { imageFor, descriptionFor } from '../utils/serviceVisuals';

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const fmtTime = (mysqlDt) => mysqlDt.slice(11, 16);
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

export default function BookingFlow() {
  const { serviceId } = useParams();
  const nav = useNavigate();

  const [service, setService] = useState(null);
  const [resources, setResources] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');

  const [step, setStep] = useState(1);
  const [resourceId, setResourceId] = useState('');  // empty = auto
  const [date, setDate] = useState(todayStr());
  const [stripStart, setStripStart] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [slotsReason, setSlotsReason] = useState(null);
  const [slot, setSlot] = useState(null);
  const [capacity, setCapacity] = useState(1);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/services/${serviceId}`)
      .then((d) => {
        setService(d.service); setResources(d.resources); setQuestions(d.questions);
        if (d.service.assignment_mode === 'manual' && d.resources.length) {
          setResourceId(String(d.resources[0].id));
        }
      })
      .catch((e) => setError(e.message));
  }, [serviceId]);

  useEffect(() => {
    if (!service) return;
    const q = new URLSearchParams({ date });
    if (resourceId) q.set('resource_id', resourceId);
    api.get(`/services/${service.id}/slots?${q.toString()}`)
      .then((d) => { setSlots(d.slots); setSlotsReason(d.reason || null); setSlot(null); })
      .catch((e) => setError(e.message));
  }, [service, date, resourceId]);

  const requiresPayment = service && service.advance_payment && Number(service.price) > 0;

  const total = useMemo(() => {
    if (!service) return 0;
    const sub = Number(service.price) * (service.manage_capacity ? Number(capacity)||1 : 1);
    const tax = sub * Number(service.tax_percent)/100;
    return +(sub + tax).toFixed(2);
  }, [service, capacity]);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const payload = {
        service_id: Number(serviceId),
        start_datetime: slot.start,
        capacity_taken: service.manage_capacity ? Number(capacity)||1 : 1,
        resource_id: resourceId ? Number(resourceId) : (slot.suggested_resource_id || null),
        answers: questions.map((q) => ({
          question_id: q.id, answer_text: (answers[q.id] || '').trim(),
        })).filter((a) => a.answer_text !== ''),
      };
      const d = await api.post('/bookings', payload);
      const b = d.booking;
      if (b.requires_payment) nav(`/booking/${b.id}/pay`);
      else nav(`/booking/${b.id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!service) return <div className="container"><div className="muted">Loading…</div></div>;

  const dateStrip = buildDateStrip(stripStart, 14);
  const subtotal = Number(service.price) * (service.manage_capacity ? Number(capacity)||1 : 1);
  const taxes = subtotal * Number(service.tax_percent) / 100;

  return (
    <div className="container">
      <div className="stepper">
        {[
          { n: 1, label: 'Resource' },
          { n: 2, label: 'Date & Time' },
          { n: 3, label: 'Your details' },
          { n: 4, label: 'Confirm' },
        ].map((s) => (
          <div key={s.n} className={`step ${step === s.n ? 'active' : step > s.n ? 'done' : ''}`}>
            <span className="step-num">{step > s.n ? '✓' : s.n}</span>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="two-col">
        <div className="card">
          {step === 1 && (
            <>
              <h3 className="card-title">Select {service.resource_kind === 'user' ? 'a provider' : 'a resource'}</h3>
              <p className="muted" style={{marginTop:-8, marginBottom:14}}>
                {service.assignment_mode === 'auto'
                  ? `Auto-assignment is on — we'll pick the best available option for your time. You can also pick manually.`
                  : `Please choose your preferred ${service.resource_kind}.`}
              </p>
              <div className="form">
                <select value={resourceId} onChange={(e)=>setResourceId(e.target.value)}>
                  <option value="">Auto (any available)</option>
                  {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div className="row">
                  <button onClick={()=>setStep(2)}>Continue →</button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="card-title">Pick a date & time</h3>
              <div className="row" style={{marginBottom:10}}>
                <input type="date" value={stripStart} min={todayStr()}
                  onChange={(e)=>{ setStripStart(e.target.value); setDate(e.target.value); }} />
                <span className="muted">Browse the next 14 days</span>
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

              <h4 style={{marginTop:18, marginBottom:10}}>Available slots</h4>
              {!slots.length && (
                <div className="alert alert-info">
                  {slotsReason === 'no_resources'         && 'This service has no providers configured yet. Please contact the organiser.'}
                  {slotsReason === 'no_schedule_today'    && 'The organiser has not set working hours for this weekday. Try another date.'}
                  {slotsReason === 'no_flex_window_today' && 'No availability windows configured for this date.'}
                  {slotsReason === 'all_full'             && 'All slots for this day are fully booked.'}
                  {!slotsReason                           && 'No slots for this day.'}
                </div>
              )}
              <div className="slots">
                {slots.map((s) => (
                  <button key={s.start} type="button"
                    className={`slot ${!s.available ? 'disabled' : ''} ${slot && slot.start===s.start ? 'selected' : ''}`}
                    disabled={!s.available}
                    onClick={()=>setSlot(s)}>
                    {fmtTime(s.start)}
                    {service.manage_capacity && <span className="slot-cap">{s.capacity_remaining} left</span>}
                  </button>
                ))}
              </div>

              {!!service.manage_capacity && slot && (
                <div className="form" style={{ marginTop: 16 }}>
                  <div className="form-row">
                    <label>People (max {Math.min(service.max_per_slot, slot.capacity_remaining)})</label>
                    <input type="number" min={1}
                      max={Math.min(service.max_per_slot, slot.capacity_remaining)}
                      value={capacity} onChange={(e)=>setCapacity(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="row" style={{ marginTop: 18 }}>
                <button className="secondary" onClick={()=>setStep(1)}>← Back</button>
                <button disabled={!slot} onClick={()=>setStep(3)}>Continue →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="card-title">Your details</h3>
              <p className="muted" style={{marginTop:-8, marginBottom:14}}>
                Help the organiser prepare for your visit.
              </p>
              <div className="form">
                {questions.map((q) => (
                  <div className="form-row" key={q.id}>
                    <label>{q.question}{q.is_required ? ' *' : ''}</label>
                    {q.field_type === 'textarea'
                      ? <textarea value={answers[q.id]||''}
                          onChange={(e)=>setAnswers({...answers,[q.id]:e.target.value})} />
                      : <input
                          type={q.field_type === 'email' ? 'email' : q.field_type === 'number' ? 'number' : 'text'}
                          value={answers[q.id]||''}
                          onChange={(e)=>setAnswers({...answers,[q.id]:e.target.value})}
                          required={!!q.is_required} />}
                  </div>
                ))}
                {!questions.length && <div className="muted">No additional questions for this service.</div>}
              </div>
              <div className="row" style={{ marginTop: 18 }}>
                <button className="secondary" onClick={()=>setStep(2)}>← Back</button>
                <button onClick={()=>{
                  for (const q of questions) {
                    if (q.is_required && !(answers[q.id]||'').trim()) {
                      setError(`Please fill: ${q.question}`); return;
                    }
                  }
                  setError(''); setStep(4);
                }}>Continue →</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h3 className="card-title">Review & confirm</h3>
              <div className="cal-item"><span className="muted">Service</span><b>{service.name}</b></div>
              <div className="cal-item"><span className="muted">Date</span><b>{date}</b></div>
              <div className="cal-item"><span className="muted">Time</span><b>{slot && fmtTime(slot.start)}</b></div>
              <div className="cal-item"><span className="muted">Duration</span><b>{service.duration_minutes} min</b></div>
              {!!service.manage_capacity &&
                <div className="cal-item"><span className="muted">People</span><b>{capacity}</b></div>}
              <div className="cal-item"><span className="muted">Venue</span><b>{service.venue || '—'}</b></div>
              {requiresPayment && (
                <div className="alert alert-info" style={{marginTop:14}}>
                  Total payable: <b>₹{total.toFixed(2)}</b> (incl. taxes). You'll be redirected to payment.
                </div>
              )}
              <div className="row" style={{ marginTop: 14 }}>
                <button className="secondary" onClick={()=>setStep(3)}>← Back</button>
                <button disabled={busy} onClick={submit}>
                  {busy ? 'Booking…' : (requiresPayment ? 'Proceed to payment →' : 'Confirm booking →')}
                </button>
              </div>
            </>
          )}
        </div>

        <aside className="card" style={{ position: 'sticky', top: 88 }}>
          <div style={{
            height: 140, marginBottom: 14, borderRadius: 12,
            backgroundImage: `url(${imageFor(service)})`,
            backgroundSize: 'cover', backgroundPosition: 'center'
          }} />
          <h3 className="card-title" style={{marginBottom:6}}>{service.name}</h3>
          <p className="muted" style={{marginTop:0}}>{descriptionFor(service)}</p>

          <hr/>

          <div className="cal-item"><span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span></div>
          <div className="cal-item"><span>Taxes ({service.tax_percent}%)</span>
            <span>₹{taxes.toFixed(2)}</span></div>
          <div className="cal-item" style={{paddingTop:10, borderTop:'1px solid var(--border)', marginTop:6}}>
            <b>Total</b><b style={{fontSize:18}}>₹{total.toFixed(2)}</b>
          </div>

          <div className="muted" style={{marginTop:14, lineHeight:1.5}}>
            {requiresPayment
              ? '🔒 Advance payment is required to confirm your booking.'
              : service.manual_confirmation
                ? '⏳ Manual confirmation — your booking will be reserved until the organiser confirms.'
                : '⚡ Instant confirmation — your booking is locked the moment you submit.'}
          </div>
        </aside>
      </div>
    </div>
  );
}
