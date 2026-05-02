import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Clock, MapPin, Star, User, Video, Tag, Coins,
  ChevronLeft, Sparkles, Calendar as CalIcon, ArrowRight, Loader2,
  QrCode, Smartphone, Crown,
} from 'lucide-react';
import { api } from '../api/client';
import Calendar from '../components/Calendar.jsx';
import { imageFor } from '../utils/serviceVisuals';
import { useAuth } from '../context/AuthContext.jsx';
import { formatTime, formatINR } from '../utils/format';
import { loadRazorpay, openRazorpay } from '../utils/razorpay';
import UpiQrModal from '../components/UpiQrModal.jsx';

// Identity questions ("Full name" / "Email" / "Phone number") that get
// auto-filled (and visually muted) when the user is logged in.
function inferIdentityField(q) {
  const text = (q.question || '').toLowerCase();
  if (q.field_type === 'email' || text.includes('email')) return 'email';
  if (q.field_type === 'phone' || /(phone|mobile)/.test(text)) return 'phone';
  if (/(full ?name|^name\b)/.test(text)) return 'name';
  return null;
}

const STEPS = [
  { key: 'service',   label: 'Service' },
  { key: 'provider',  label: 'Provider' },
  { key: 'date',      label: 'Date' },
  { key: 'slot',      label: 'Slot' },
  { key: 'details',   label: 'Details' },
  { key: 'payment',   label: 'Payment' },
  { key: 'confirm',   label: 'Confirm' },
];

const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtTime = (mysqlDt) => formatTime(mysqlDt);

function Stepper({ current }) {
  return (
    <ol className="grid grid-cols-7 gap-1">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-col items-center text-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition
              ${done ? 'bg-brand-600 text-white' : active ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-300' : 'bg-ink-100 text-ink-400'}`}>
              {done ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-[10px] sm:text-xs font-medium ${active ? 'text-ink-900' : 'text-ink-500'} truncate max-w-full`}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function BookingFlow() {
  const { serviceId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [service, setService] = useState(null);
  const [resources, setResources] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [calendarNotes, setCalendarNotes] = useState([]);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);

  const [resourceId, setResourceId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [slotsReason, setSlotsReason] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState(null);
  const [capacity, setCapacity] = useState(1);

  const [answers, setAnswers] = useState({});
  const [purpose, setPurpose] = useState('');
  const [bookFor, setBookFor] = useState('self'); // self | other
  const [bookedForName, setBookedForName] = useState('');
  const [bookedForPhone, setBookedForPhone] = useState('');

  const [discountInput, setDiscountInput] = useState('');
  const [discount, setDiscount] = useState(null);
  const [creditsAvail, setCreditsAvail] = useState(0);
  const [useCredits, setUseCredits] = useState(0);

  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [payConfig, setPayConfig] = useState({ upi_vpa: 'success@razorpay', upi_name: 'Schedula', is_mock: true });
  const [coupons, setCoupons] = useState([]);
  const [createdBooking, setCreatedBooking] = useState(null);

  useEffect(() => {
    api.get(`/services/${serviceId}`)
      .then((d) => {
        setService(d.service);
        setResources(d.resources);
        setQuestions(d.questions);
        setCalendarNotes(d.calendar_notes || []);
        if (d.service.assignment_mode === 'manual' && d.resources.length) {
          setResourceId(String(d.resources[0].id));
        }
        // Auto-fill identity questions from the logged-in profile.
        if (user) {
          const prefill = {};
          for (const q of d.questions) {
            const kind = inferIdentityField(q);
            if (kind === 'name'  && user.full_name) prefill[q.id] = user.full_name;
            if (kind === 'email' && user.email)     prefill[q.id] = user.email;
            if (kind === 'phone' && user.phone)     prefill[q.id] = user.phone;
          }
          if (Object.keys(prefill).length) setAnswers((a) => ({ ...prefill, ...a }));
        }
      })
      .catch((e) => setError(e.message));
    if (user) api.get('/credits/me').then((d) => setCreditsAvail(d.balance || 0)).catch(() => {});
    api.get('/payment/config').then(setPayConfig).catch(() => {});
    api.get('/discounts').then((d) => setCoupons(d.codes || [])).catch(() => {});
  }, [serviceId, user]);

  // Auto-refresh slots: re-fetch immediately when date/resource changes,
  // then poll every 20 s while the user is on the slot step so capacity
  // updates from concurrent bookings show up live. Pauses once a slot is
  // chosen to avoid disturbing the selection.
  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    const fetchSlots = (silent = false) => {
      if (!silent) setSlotsLoading(true);
      const q = new URLSearchParams({ date });
      if (resourceId) q.set('resource_id', resourceId);
      return api.get(`/services/${service.id}/slots?${q.toString()}`)
        .then((d) => {
          if (cancelled) return;
          setSlots(d.slots);
          setSlotsReason(d.reason || null);
          // Drop selection if the chosen slot disappeared / went full.
          setSlot((cur) => {
            if (!cur) return cur;
            const fresh = d.slots.find((s) => s.start === cur.start);
            return fresh && fresh.available ? fresh : null;
          });
        })
        .catch((e) => !cancelled && setError(e.message))
        .finally(() => !cancelled && !silent && setSlotsLoading(false));
    };
    fetchSlots();
    let timer = null;
    if (step === 3 && !slot) {
      timer = setInterval(() => fetchSlots(true), 20000);
    }
    return () => { cancelled = true; if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, date, resourceId, step, slot ? slot.start : null]);

  const requiresPayment = service && service.advance_payment && Number(service.price) > 0;

  const pricing = useMemo(() => {
    if (!service) return { subtotal: 0, tax: 0, total: 0, discountAmount: 0, credits: 0, creditsCap: 0 };
    const sub = +(Number(service.price) * (service.manage_capacity ? Number(capacity) || 1 : 1)).toFixed(2);
    const discountAmount = discount ? Number(discount.discount_amount) : 0;
    const taxableBase = Math.max(0, sub - discountAmount);
    const taxRate = Number(service.effective_tax_percent ?? service.tax_percent ?? 0);
    const tax = taxableBase >= Number(service.tax_threshold || 0) && taxRate > 0
      ? +(taxableBase * taxRate / 100).toFixed(2) : 0;
    // 50% cap on credits, mirrors backend bookingService.applyDiscountAndCredits
    const creditsCap = Math.floor(Math.max(0, sub - discountAmount) * 0.5);
    const credits = Math.min(Number(useCredits) || 0, creditsAvail, creditsCap);
    const total = +Math.max(0, sub - discountAmount + tax - credits).toFixed(2);
    return { subtotal: sub, tax, total, discountAmount, credits, creditsCap };
  }, [service, capacity, discount, useCredits, creditsAvail]);

  const applyDiscount = async () => {
    setError('');
    if (!discountInput.trim()) return;
    try {
      const d = await api.post('/discounts/validate', { code: discountInput.trim(), subtotal: pricing.subtotal });
      setDiscount(d);
    } catch (e) { setError(e.message); setDiscount(null); }
  };

  const submitBooking = async () => {
    setBusy(true); setError('');
    try {
      const payload = {
        service_id: Number(serviceId),
        start_datetime: slot.start,
        capacity_taken: service.manage_capacity ? Number(capacity) || 1 : 1,
        resource_id: resourceId ? Number(resourceId) : (slot.suggested_resource_id || null),
        answers: questions.map((q) => ({
          question_id: q.id, answer_text: (answers[q.id] || '').trim(),
        })).filter((a) => a.answer_text !== ''),
        discount_code: discount ? discount.code : null,
        credits_to_use: pricing.credits || 0,
        purpose: purpose || null,
        booked_for_name: bookFor === 'other' ? bookedForName : null,
        booked_for_phone: bookFor === 'other' ? bookedForPhone : null,
      };
      const d = await api.post('/bookings', payload);
      const b = d.booking;
      setCreatedBooking(b);
      if (b.requires_payment) {
        setStep(5);
      } else {
        setStep(6);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async () => {
    setBusy(true); setError('');
    let order = null;
    try {
      order = await api.post('/payment/create-order', { booking_id: createdBooking.id });
      let resp;
      if (order.is_mock) {
        await new Promise((r) => setTimeout(r, 600));
        resp = {
          razorpay_order_id:   order.razorpay_order_id,
          razorpay_payment_id: `pay_demo_${Date.now()}`,
          razorpay_signature:  'mock',
        };
      } else {
        const ok = await loadRazorpay();
        if (!ok) throw new Error('Could not load Razorpay checkout — check your internet connection.');
        resp = await openRazorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
          order_id: order.razorpay_order_id,
          prefill: user
            ? { name: user.full_name || '', email: user.email || '', contact: user.phone || '' }
            : {},
          notes: { booking_id: String(order.booking_id) },
        });
      }
      await api.post('/payment/verify', resp);
      setStep(6);
    } catch (e) {
      if (order?.razorpay_order_id && /cancel|fail/i.test(e.message || '')) {
        api.post('/payment/fail', { razorpay_order_id: order.razorpay_order_id }).catch(() => {});
      }
      setError(e.message || 'Payment failed');
    } finally { setBusy(false); }
  };

  // UPI QR demo confirmation — separate path from Razorpay.
  const confirmUpi = async () => {
    setError('');
    try {
      await api.post('/payment/upi-confirm', {
        booking_id: createdBooking.id,
        upi_reference: `upi_qr_${Date.now()}`,
      });
      setQrOpen(false);
      setStep(6);
    } catch (e) { setError(e.message || 'Could not record UPI payment'); }
  };

  if (!service) return <div className="p-12 text-center text-ink-500">Loading…</div>;

  const blockedDates = (calendarNotes || []).filter((n) => n.is_blocked).map((n) => n.note_date);

  const canContinue = (() => {
    switch (step) {
      case 0: return !!service;
      case 1: return service.assignment_mode === 'manual' ? !!resourceId : true;
      case 2: return !!date;
      case 3: return !!slot;
      case 4:
        if (bookFor === 'other' && (!bookedForName.trim() || !bookedForPhone.trim())) return false;
        for (const q of questions) {
          if (q.is_required && !(answers[q.id] || '').trim()) return false;
        }
        return true;
      default: return true;
    }
  })();

  const next = () => {
    setError('');
    if (!canContinue) {
      setError('Please complete the required fields before continuing.');
      return;
    }
    if (step === 4) {
      // Booking is created on transition from details -> payment/confirm
      if (requiresPayment) submitBooking();
      else submitBooking();
    } else {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => nav(-1)} className="btn-ghost mb-4"><ChevronLeft size={16} /> Back</button>
      <div className="card p-5 mb-5"><Stepper current={step} /></div>

      {error && (
        <div className="card border-rose-200 bg-rose-50 text-rose-700 p-3 mb-4 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="card p-5 sm:p-6"
            >
              {step === 0 && (
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{service.name}</h2>
                  <p className="text-sm text-ink-500 mt-1">{service.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="pill-brand"><Clock size={12} /> {service.duration_minutes} min</span>
                    {service.appointment_type === 'virtual' ? (
                      <span className="pill-green"><Video size={12} /> Virtual</span>
                    ) : (
                      <span className="pill-amber"><MapPin size={12} /> In-person</span>
                    )}
                    {service.category_name && <span className="pill-slate">{service.category_name}</span>}
                    {Number(service.rating) > 0 && (
                      <span className="pill-amber"><Star size={12} fill="currentColor" /> {Number(service.rating).toFixed(1)} ({service.rating_count})</span>
                    )}
                  </div>
                  <div className="text-sm text-ink-700 mt-4 space-y-1">
                    {service.venue && <div className="flex items-center gap-2"><MapPin size={14} /> {service.venue}</div>}
                    <div className="flex items-center gap-2"><User size={14} /> {service.organiser_name}</div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Choose a provider</h2>
                  <p className="text-sm text-ink-500 mt-1">
                    {service.assignment_mode === 'auto'
                      ? `Auto-assignment is on — pick "Any available" or choose your preferred ${service.resource_kind}.`
                      : `Please choose your preferred ${service.resource_kind}.`}
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {service.assignment_mode === 'auto' && (
                      <button onClick={() => setResourceId('')}
                        className={`card p-4 text-left transition ${!resourceId ? 'ring-2 ring-brand-400' : 'hover:shadow-lg'}`}>
                        <div className="font-semibold text-ink-900">Any available</div>
                        <div className="text-xs text-ink-500 mt-1">We'll pick the best provider for your time.</div>
                      </button>
                    )}
                    {resources.map((r) => (
                      <button key={r.id} onClick={() => setResourceId(String(r.id))}
                        className={`card p-4 text-left transition ${String(resourceId) === String(r.id) ? 'ring-2 ring-brand-400' : 'hover:shadow-lg'}`}>
                        <div className="font-semibold text-ink-900">{r.name}</div>
                        <div className="text-xs text-ink-500 mt-1">{service.resource_kind === 'user' ? 'Provider' : 'Resource'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Select a date</h2>
                  <p className="text-sm text-ink-500 mt-1">Available days are highlighted; blocked dates appear greyed out.</p>
                  <div className="mt-4 max-w-md">
                    <Calendar value={date} onChange={setDate} blockedDates={blockedDates} notes={calendarNotes} />
                  </div>
                  {calendarNotes.length > 0 && (
                    <div className="mt-3 text-xs text-ink-500 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Days with notes
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Select a slot</h2>
                  <p className="text-sm text-ink-500 mt-1">Real-time availability for <b>{date}</b>. {service.buffer_minutes ? `${service.buffer_minutes}-min buffer between slots.` : ''}</p>
                  {slotsLoading && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                      {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-10 shimmer-bg rounded-lg" />)}
                    </div>
                  )}
                  {!slotsLoading && !slots.length && (
                    <div className="card border-amber-200 bg-amber-50 text-amber-800 p-3 mt-4 text-sm">
                      {slotsReason === 'no_resources'         && 'This service has no providers configured yet.'}
                      {slotsReason === 'no_schedule_today'    && 'Provider does not work on this weekday — try another date.'}
                      {slotsReason === 'no_flex_window_today' && 'No flexible windows for this date.'}
                      {slotsReason === 'all_full'             && 'All slots booked for this day.'}
                      {slotsReason === 'date_blocked'         && 'This date is blocked by the organiser. Pick another day.'}
                      {slotsReason === 'beyond_horizon_upgrade' && (<>📅 Silver members can only book within 14 days. <a href="/plans" className="underline font-semibold">Upgrade to Gold</a> for 30-day visibility, or Platinum for unlimited.</>)}
                      {slotsReason === 'beyond_horizon_platinum' && (<>📅 Gold members can book within 30 days. <a href="/plans" className="underline font-semibold">Upgrade to Platinum</a> for unlimited horizon.</>)}
                      {!slotsReason                           && 'No slots for this day.'}
                    </div>
                  )}
                  {!slotsLoading && slots.length > 0 && (
                    <>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
                        {slots.map((s) => {
                          const lockedTier = !s.available && s.requires_priority > 0;
                          const tierLabel = s.requires_priority >= 2 ? 'Platinum' : 'Gold';
                          return (
                            <button key={s.start} disabled={!s.available}
                              onClick={() => setSlot(s)}
                              title={lockedTier ? `${tierLabel}-only slot` : undefined}
                              className={`px-3 py-2 rounded-xl text-sm font-medium border transition relative
                                ${slot && slot.start === s.start
                                  ? 'bg-brand-600 text-white border-brand-600 shadow-soft'
                                  : s.available
                                    ? 'bg-white border-ink-200 text-ink-800 hover:border-brand-400 hover:text-brand-700'
                                    : lockedTier
                                      ? 'bg-amber-50 border-amber-200 text-amber-800 cursor-not-allowed'
                                      : 'bg-ink-50 border-ink-100 text-ink-300 cursor-not-allowed'}
                              `}>
                              {fmtTime(s.start)}
                              {lockedTier ? (
                                <Crown size={10} className="absolute top-1 right-1 text-amber-600" />
                              ) : null}
                              {Boolean(service.manage_capacity) && s.available ? (
                                <span className={`block text-[10px] mt-0.5 ${slot && slot.start === s.start ? 'text-white/80' : 'text-ink-400'}`}>
                                  {s.capacity_remaining} left
                                </span>
                              ) : null}
                              {!s.available && !lockedTier ? (
                                <span className="block text-[10px] mt-0.5 text-ink-400">full</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      {slots.some((s) => s.requires_priority > 0) && (
                        <div className="text-xs text-amber-700 mt-3 flex items-center gap-1">
                          <Crown size={12} /> Slots marked with a crown are reserved for Gold/Platinum members.
                          <a href="/plans" className="underline ml-1">Upgrade →</a>
                        </div>
                      )}
                    </>
                  )}
                  {Boolean(service.manage_capacity) && slot && (
                    <div className="mt-5 max-w-xs">
                      <label className="label">People (max {Math.min(service.max_per_slot, slot.capacity_remaining)})</label>
                      <input type="number" min={1} max={Math.min(service.max_per_slot, slot.capacity_remaining)}
                             className="input" value={capacity}
                             onChange={(e) => setCapacity(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Your details</h2>
                  <p className="text-sm text-ink-500 mt-1">Help the provider prepare for your visit.</p>

                  <div className="mt-4">
                    <label className="label">Booking for</label>
                    <div className="flex gap-2">
                      <button onClick={() => setBookFor('self')}
                        className={`btn ${bookFor === 'self' ? 'btn-primary' : 'btn-outline'}`}>Myself</button>
                      <button onClick={() => setBookFor('other')}
                        className={`btn ${bookFor === 'other' ? 'btn-primary' : 'btn-outline'}`}>Someone else</button>
                    </div>
                  </div>

                  {bookFor === 'other' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="label">Their full name *</label>
                        <input className="input" value={bookedForName} onChange={(e) => setBookedForName(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Their phone *</label>
                        <input className="input" value={bookedForPhone} onChange={(e) => setBookedForPhone(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="label">Purpose / reason</label>
                    <input className="input" placeholder="e.g. routine check-up"
                           value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                  </div>

                  {(() => {
                    // Identity questions (name/email/phone) auto-fill from the
                    // logged-in profile and collapse into a compact summary.
                    const visibleQs = questions.filter((q) => !user || !inferIdentityField(q));
                    const autoFilledQs = questions.filter((q) => user && inferIdentityField(q));
                    return (
                      <>
                        {autoFilledQs.length > 0 && (
                          <div className="card p-3 bg-ink-50 border-dashed mt-5">
                            <div className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1">From your profile</div>
                            <div className="text-sm text-ink-700 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {autoFilledQs.map((q) => (
                                <div key={q.id} className="truncate">
                                  <span className="text-ink-400">{q.question}: </span>
                                  <span className="font-medium">{answers[q.id] || '—'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {visibleQs.length > 0 && (
                          <div className="mt-5 space-y-4">
                            {Object.entries(groupBy(visibleQs, 'category')).map(([cat, qs]) => (
                              <div key={cat || 'general'}>
                                {cat && <div className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">{cat}</div>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {qs.map((q) => (
                                    <div key={q.id}>
                                      <label className="label">{q.question}{q.is_required ? ' *' : ''}</label>
                                      {q.field_type === 'textarea' ? (
                                        <textarea className="input min-h-[88px]"
                                          value={answers[q.id] || ''}
                                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                                      ) : q.field_type === 'select' ? (
                                        <select className="input"
                                          value={answers[q.id] || ''}
                                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}>
                                          <option value="">Select…</option>
                                          {(q.options || '').split(',').filter(Boolean).map((o) => (
                                            <option key={o} value={o.trim()}>{o.trim()}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input className="input"
                                          type={q.field_type === 'email' ? 'email' : q.field_type === 'number' ? 'number' : q.field_type === 'phone' ? 'tel' : 'text'}
                                          value={answers[q.id] || ''}
                                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                          required={!!q.is_required} />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {step === 5 && (
                <div>
                  <h2 className="text-lg font-bold text-ink-900">Payment</h2>
                  <p className="text-sm text-ink-500 mt-1">Card, UPI, Net Banking & wallets — all via Razorpay's secure checkout.</p>
                  <div className="card p-4 bg-ink-50 border-dashed mt-4">
                    <div className="text-sm">
                      <div className="font-semibold text-ink-900">Total to pay: ₹{Number(createdBooking?.total_amount || pricing.total).toFixed(2)}</div>
                      <div className="text-xs text-ink-500 mt-1">
                        Click "Pay" below to launch Razorpay. Bookings are confirmed only after payment succeeds.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="text-center py-6">
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 14 }}
                    className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Check size={32} />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-ink-900 mt-4">Booking confirmed!</h2>
                  <p className="text-sm text-ink-500 mt-1">A confirmation has been emailed to you.</p>
                  {createdBooking?.meeting_link && (
                    <a href={createdBooking.meeting_link} target="_blank" rel="noreferrer" className="btn-primary mt-5"><Video size={14} /> Join virtual meeting</a>
                  )}
                  <div className="flex justify-center gap-2 mt-6">
                    <button className="btn-outline" onClick={() => nav('/profile')}>My bookings</button>
                    <button className="btn-primary" onClick={() => nav(`/booking/${createdBooking.id}`)}>View booking</button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {step < 5 && (
            <div className="flex items-center justify-between">
              <button className="btn-outline" onClick={back} disabled={step === 0}>
                <ChevronLeft size={14} /> Back
              </button>
              <button className="btn-primary" disabled={!canContinue || busy} onClick={next}>
                {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                {step === 4 ? (requiresPayment ? 'Continue to payment' : 'Confirm booking') : 'Continue'} <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === 5 && createdBooking && (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
              <button className="btn-outline" onClick={() => setQrOpen(true)} disabled={busy}>
                <QrCode size={14} /> Pay via UPI QR
              </button>
              <button className="btn-primary" disabled={busy} onClick={submitPayment}>
                {busy ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                Pay ₹{Number(createdBooking.total_amount).toFixed(2)} with Razorpay
              </button>
            </div>
          )}
        </div>

        {/* Right summary */}
        <aside className="space-y-3 lg:sticky lg:top-24 self-start">
          <div className="card overflow-hidden">
            <div className="aspect-[16/9] bg-cover bg-center" style={{ backgroundImage: `url(${imageFor(service)})` }} />
            <div className="p-4">
              <div className="font-bold text-ink-900">{service.name}</div>
              <div className="text-xs text-ink-500 mt-1">{service.organiser_name}</div>
              <div className="mt-3 space-y-1.5 text-sm">
                {date && <div className="flex items-center gap-2 text-ink-600"><CalIcon size={14} /> {date}</div>}
                {slot && <div className="flex items-center gap-2 text-ink-600"><Clock size={14} /> {fmtTime(slot.start)} ({service.duration_minutes} min)</div>}
                {service.venue && <div className="flex items-center gap-2 text-ink-600"><MapPin size={14} /> {service.venue}</div>}
              </div>
            </div>
          </div>

          {/* Discount + credits — visible from step 4+ */}
          {step >= 4 && Number(service.price) > 0 && (
            <div className="card p-4 space-y-3">
              <div>
                <label className="label flex items-center gap-1"><Tag size={12} /> Discount code</label>
                <div className="flex gap-2">
                  <input className="input" placeholder="e.g. WELCOME10"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())} />
                  <button className="btn-outline" onClick={applyDiscount} type="button">Apply</button>
                </div>
                {discount && (
                  <div className="text-xs text-emerald-700 mt-1.5 flex items-center justify-between">
                    <span>✓ Applied {discount.code} — saved ₹{discount.discount_amount}</span>
                    <button type="button" onClick={() => { setDiscount(null); setDiscountInput(''); }}
                      className="text-rose-600 hover:underline text-xs">Remove</button>
                  </div>
                )}
                {coupons.length > 0 && !discount && (
                  <div className="mt-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">Available coupons</div>
                    <div className="flex flex-wrap gap-1.5">
                      {coupons.slice(0, 4).map((c) => {
                        const eligible = pricing.subtotal >= Number(c.min_amount || 0);
                        return (
                          <button key={c.id} type="button"
                            disabled={!eligible}
                            onClick={() => { setDiscountInput(c.code); setTimeout(applyDiscount, 50); }}
                            className={`text-[11px] px-2 py-1 rounded-md border transition ${
                              eligible
                                ? 'border-dashed border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
                                : 'border-dashed border-ink-200 bg-ink-50 text-ink-400 cursor-not-allowed'
                            }`}
                            title={c.description || ''}>
                            <b>{c.code}</b>
                            <span className="ml-1 opacity-80">
                              {c.type === 'percent' ? `${Number(c.value)}% off` : `₹${Number(c.value)} off`}
                              {Number(c.min_amount) > 0 && ` · min ₹${c.min_amount}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {creditsAvail > 0 && (
                <div>
                  <label className="label flex items-center gap-1"><Coins size={12} /> Use credits</label>
                  <div className="flex gap-2">
                    <input type="number" min={0} max={Math.min(creditsAvail, pricing.creditsCap)}
                      className="input" value={useCredits}
                      onChange={(e) => setUseCredits(Math.max(0, Number(e.target.value) || 0))} />
                    <button type="button" className="btn-outline whitespace-nowrap"
                            onClick={() => setUseCredits(Math.min(creditsAvail, pricing.creditsCap))}>
                      Max
                    </button>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">
                    {creditsAvail} available · max {pricing.creditsCap} for this booking (50% cap)
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Subtotal</span><span>₹{pricing.subtotal.toFixed(2)}</span></div>
            {pricing.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−₹{pricing.discountAmount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-ink-500">
                GST {service.effective_tax_percent ? `@ ${Number(service.effective_tax_percent)}%` : ''}{Number(service.tax_threshold) > 0 ? ` (over ₹${service.tax_threshold})` : ''}
              </span>
              <span>{pricing.tax > 0 ? `₹${pricing.tax.toFixed(2)}` : '—'}</span>
            </div>
            {pricing.credits > 0 && (
              <div className="flex justify-between text-amber-700"><span>Credits</span><span>−₹{pricing.credits.toFixed(2)}</span></div>
            )}
            <div className="border-t border-ink-100 pt-2 flex justify-between font-bold text-ink-900">
              <span>Total</span><span className="text-lg">₹{pricing.total.toFixed(2)}</span>
            </div>
            <div className="text-xs text-ink-500 mt-2 leading-relaxed flex items-start gap-2">
              <Sparkles size={12} className="mt-0.5 flex-shrink-0" />
              <span>{requiresPayment ? 'Advance payment required to confirm.' : service.manual_confirmation ? 'Reserved until provider confirms.' : 'Instant confirmation on submit.'}</span>
            </div>
          </div>
        </aside>
      </div>

      {createdBooking && (
        <UpiQrModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          amount={createdBooking.total_amount}
          vpa={payConfig.upi_vpa}
          name={payConfig.upi_name}
          note={`Schedula booking #${createdBooking.id}`}
          onConfirm={confirmUpi}
        />
      )}
    </div>
  );
}

function groupBy(list, key) {
  const out = {};
  for (const x of list) {
    const k = x[key] || '';
    out[k] = out[k] || [];
    out[k].push(x);
  }
  return out;
}
