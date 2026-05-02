import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex bg-mesh-1">
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 text-white relative overflow-hidden">
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="absolute top-20 left-32 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-xl font-bold">S</div>
          <div>
            <div className="font-bold text-lg leading-none">Schedula</div>
            <div className="text-xs text-white/70">Smart appointment scheduling</div>
          </div>
        </Link>
        <div className="relative">
          <Sparkles size={20} className="text-amber-300 mb-3" />
          <h2 className="text-3xl font-bold leading-tight">Real-time slots, transparent pricing, instant confirmation.</h2>
          <p className="text-white/70 mt-3 max-w-md">Healthcare, sports, counseling, events, interviews & more — all in one place.</p>
          <div className="grid grid-cols-3 gap-3 mt-8 max-w-md">
            {[
              { k: '50K+', v: 'Bookings' },
              { k: '4.9★', v: 'Avg rating' },
              { k: '6', v: 'Categories' },
            ].map((s) => (
              <div key={s.k} className="bg-white/10 backdrop-blur rounded-xl p-3">
                <div className="text-xl font-bold">{s.k}</div>
                <div className="text-[11px] text-white/70 uppercase tracking-wide">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-white/60 relative">© Schedula. Built for VIT × Odoo Hackathon.</div>
      </div>

      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12">
        <div className="lg:hidden mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">S</div>
            <span className="font-bold">Schedula</span>
          </Link>
        </div>
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
