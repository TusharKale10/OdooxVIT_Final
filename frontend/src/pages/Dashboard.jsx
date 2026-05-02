import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Search, ShieldCheck, Zap, Star } from 'lucide-react';
import { api } from '../api/client';
import ServiceCard from '../components/ServiceCard.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [recommended, setRecommended] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [heroQuery, setHeroQuery] = useState('');

  useEffect(() => {
    api.get('/services/recommended').then((d) => setRecommended(d.services || [])).catch(() => {});
    if (user) api.get('/saved/ids').then((d) => setSavedIds(new Set(d.ids || []))).catch(() => {});
    else setSavedIds(new Set());
  }, [user]);

  const onToggleSaved = (id, saved) => {
    setSavedIds((prev) => { const next = new Set(prev); if (saved) next.add(id); else next.delete(id); return next; });
  };

  return (
    <div className="space-y-8">
      {/* Hero — bold gradient, embedded search, supporting feature pills */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl text-white">
        {/* Layered backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-brand-700 to-[#581c87]" />
        <div className="absolute inset-0 bg-mesh-1 opacity-50 mix-blend-screen" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative px-6 sm:px-12 py-12 sm:py-16">
          <div className="max-w-3xl">
            <span className="pill bg-white/15 text-white backdrop-blur border border-white/15">
              <Sparkles size={12} className="text-amber-300" /> Smart scheduling
            </span>
            <motion.h1
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="text-4xl sm:text-6xl font-extrabold mt-5 leading-[1.05] tracking-tight">
              Book trusted services <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-fuchsia-300 bg-clip-text text-transparent">in seconds</span>.
            </motion.h1>
            <p className="text-white/80 mt-4 text-base sm:text-lg max-w-2xl">
              Real-time availability across <b className="text-white">Healthcare, Sports, Counseling, Events, Interviews & Virtual</b> services. No calls. No waiting.
            </p>

            {/* Inline search */}
            <form
              onSubmit={(e) => { e.preventDefault(); const q = heroQuery.trim(); nav(q ? `/search?q=${encodeURIComponent(q)}` : '/search'); }}
              className="mt-7 flex flex-col sm:flex-row gap-2 max-w-2xl">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl text-ink-900 placeholder-ink-400 bg-white shadow-2xl shadow-black/30 outline-none focus:ring-4 focus:ring-amber-200/40"
                  placeholder="What are you looking for? e.g. dentist, yoga, therapy…"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="px-6 py-3.5 rounded-2xl bg-amber-300 text-ink-900 font-semibold hover:bg-amber-200 transition shadow-lg shadow-amber-500/20">
                Find services
              </button>
            </form>

            {/* Trust strip */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/80">
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-300" /> Verified providers</span>
              <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-300" /> Instant confirmation</span>
              <span className="flex items-center gap-1.5"><Star size={14} className="text-amber-300 fill-amber-300" /> 4.9 avg rating</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {!user && <Link to="/register" className="btn bg-white text-brand-700 hover:bg-ink-50">Get started</Link>}
              <Link to="/plans" className="btn bg-white/10 text-white hover:bg-white/20 backdrop-blur border border-white/20">View plans <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Featured: interactive category grid — clicking any tile opens /services/:slug with its own filters */}
      <CategoryGrid />

      {/* Recommended (curated, not filtered) */}
      {recommended.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-ink-900 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" /> Recommended for you
              </h2>
              <p className="text-sm text-ink-500">
                Top-rated picks {user?.city ? `near ${user.city}` : 'across the platform'}
              </p>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {recommended.map((s) => (
              <div key={s.id} className="snap-start min-w-[300px] sm:min-w-[340px] max-w-[340px] flex-shrink-0">
                <ServiceCard service={s} savedIds={savedIds} onToggleSaved={onToggleSaved} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
