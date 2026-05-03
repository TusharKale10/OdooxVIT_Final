import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Crown, Award, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';

const PLAN_ICON = { silver: Sparkles, gold: Award, platinum: Crown };

export default function Plans() {
  const nav = useNavigate();
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    api.get('/subscriptions/plans').then((d) => setPlans(d.plans || [])).catch((e) => setError(e.message));
    api.get('/subscriptions/mine').then((d) => setCurrent(d.subscription)).catch(() => {});
  }, []);

  const subscribe = async (planKey) => {
    setBusyKey(planKey); setError(''); setInfo('');
    try {
      const d = await api.post('/subscriptions/subscribe', { plan_key: planKey });
      setInfo(`Activated ${d.plan}. ${d.bonus_credits ? `+${d.bonus_credits} bonus credits added!` : ''}`);
      const m = await api.get('/subscriptions/mine');
      setCurrent(m.subscription);
    } catch (e) { setError(e.message); }
    finally { setBusyKey(null); }
  };

  const cancel = async () => {
    if (!confirm('Cancel your current subscription?')) return;
    await api.post('/subscriptions/cancel');
    setCurrent(null);
    setInfo('Subscription cancelled.');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <span className="eyebrow inline-flex"><Sparkles size={11} className="text-accent-500" /> Subscription</span>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink-900 mt-3 tracking-tightest leading-tight">
          Choose the plan that
          <br />
          <span className="font-serif italic font-medium text-accent-600">fits your routine.</span>
        </h1>
        <p className="text-ink-500 mt-4 max-w-xl mx-auto leading-relaxed">Unlock priority booking, free reschedules, and faster credit accrual. Upgrade or cancel any time.</p>
      </div>

      {error && <div className="card border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm mb-4">{error}</div>}
      {info && <div className="card border-emerald-200 bg-emerald-50 text-emerald-700 p-3 text-sm mb-4">{info}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((p, i) => {
          const Icon = PLAN_ICON[p.key] || Sparkles;
          const isCurrent = current && current.key === p.key;
          const featured = p.key === 'gold';
          return (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`card p-7 flex flex-col relative ${featured ? 'ring-2 ring-ink-900 border-ink-900' : ''}`}>
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 pill bg-accent-500 text-white shadow-soft">Most popular</span>
              )}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: p.color }}>
                <Icon size={22} />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-900 mt-4 tracking-crisp">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-ink-900 tracking-tightest">₹{Number(p.price_monthly).toFixed(0)}</span>
                <span className="text-sm text-ink-500">/ month</span>
              </div>
              <ul className="space-y-2 mt-5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
                    <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="btn-outline w-full mt-6" onClick={cancel}>Cancel subscription</button>
              ) : (
                <button className={`${featured ? 'btn-primary' : 'btn-outline'} w-full mt-6`}
                  onClick={() => subscribe(p.key)} disabled={busyKey === p.key}>
                  {busyKey === p.key ? <Loader2 size={14} className="animate-spin" /> : null}
                  {busyKey === p.key ? 'Activating…' : (p.price_monthly === 0 ? 'Activate' : 'Subscribe')}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="text-center mt-10">
        <button onClick={() => nav('/')} className="btn-ghost">Continue browsing services →</button>
      </div>
    </div>
  );
}
