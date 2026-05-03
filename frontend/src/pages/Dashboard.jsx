import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Search, ShieldCheck, Zap, Star } from 'lucide-react';
import { api } from '../api/client';
import ServiceCard from '../components/ServiceCard.jsx';
import CategoryGrid from '../components/CategoryGrid.jsx';
import FaqSection from '../components/FaqSection.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

// Hero taglines that rotate every few seconds. Each entry's `accent` is
// rendered with the amber→fuchsia gradient so the eye-catching word changes
// along with the headline.
const HERO_LINES = [
  { lead: 'Book trusted services',         accent: 'in seconds',     tail: '.' },
  { lead: 'Real-time slots,',              accent: 'zero waiting',   tail: '.' },
  { lead: 'From dentist to therapy —',     accent: 'one tap away',   tail: '.' },
  { lead: 'Pay smart, earn credits,',      accent: 'book again',     tail: '.' },
];
const HERO_ROTATE_MS = 4000;

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [recommended, setRecommended] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [heroQuery, setHeroQuery] = useState('');
  const [heroIdx, setHeroIdx] = useState(0);

  // Rotate headline. Pause when the tab isn't visible to save cycles.
  useEffect(() => {
    let id;
    const start = () => { id = setInterval(() => setHeroIdx((i) => (i + 1) % HERO_LINES.length), HERO_ROTATE_MS); };
    const stop  = () => { if (id) clearInterval(id); };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

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
            {/* Rotating headline — 4 variants animate in/out every 4 s */}
            <h1 className="text-4xl sm:text-6xl font-extrabold mt-5 leading-[1.05] tracking-tight relative min-h-[5.5rem] sm:min-h-[7.25rem]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={heroIdx}
                  initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
                  className="block"
                >
                  {HERO_LINES[heroIdx].lead}{' '}
                  <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-fuchsia-300 bg-clip-text text-transparent">
                    {HERO_LINES[heroIdx].accent}
                  </span>
                  {HERO_LINES[heroIdx].tail}
                </motion.span>
              </AnimatePresence>
              {/* Tiny progress dots so users can see they're rotating */}
              <span className="absolute -bottom-2 left-0 hidden sm:flex gap-1">
                {HERO_LINES.map((_, i) => (
                  <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i === heroIdx ? 'w-6 bg-amber-300' : 'w-1.5 bg-white/30'}`} />
                ))}
              </span>
            </h1>
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

      {/* Recommended — auto-scrolling marquee with edge fades + drifting glow.
          Pauses on hover so users can read & click any card. */}
      {recommended.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-ink-900 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" /> Recommended for you
              </h2>
              <p className="text-sm text-ink-500">
                Top-rated picks {user?.city ? `near ${user.city}` : 'across the platform'} · scrolling — hover to pause
              </p>
            </div>
          </div>

          <div className="relative group rounded-3xl bg-gradient-to-br from-white via-ink-50/60 to-white animate-glow-drift overflow-hidden">
            {/* Soft ambient glows that move with the marquee */}
            <div className="absolute -top-8 left-10 w-48 h-48 rounded-full bg-brand-300/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 right-10 w-56 h-56 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />

            {/* Edge fade masks — cards smoothly appear/disappear at the sides */}
            <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 z-10 bg-gradient-to-r from-ink-50 via-ink-50/85 to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 z-10 bg-gradient-to-l from-ink-50 via-ink-50/85 to-transparent pointer-events-none" />

            <div
              className="flex gap-5 animate-marquee group-hover:[animation-play-state:paused] py-5 px-4"
              style={{ width: 'max-content' }}
            >
              {/* Render the list TWICE so the loop is seamless when -50% wraps. */}
              {[...recommended, ...recommended].map((s, i) => (
                <div
                  key={`${s.id}-${i}`}
                  className="w-[280px] sm:w-[320px] flex-shrink-0 transition-transform duration-300 hover:scale-[1.02] [&_.card-hover]:shadow-[0_18px_50px_-18px_rgba(99,102,241,0.35)] [&:hover_.card-hover]:shadow-[0_24px_50px_-18px_rgba(168,85,247,0.45)]"
                  aria-hidden={i >= recommended.length}
                >
                  <ServiceCard service={s} savedIds={savedIds} onToggleSaved={onToggleSaved} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ — animated accordion with floating SVG decoration */}
      <FaqSection />
    </div>
  );
}
