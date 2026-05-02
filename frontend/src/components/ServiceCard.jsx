import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Star, Video, Users, Bookmark } from 'lucide-react';
import { imageFor, descriptionFor } from '../utils/serviceVisuals';
import { formatINR } from '../utils/format';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function ServiceCard({ service: s, to, savedIds, onToggleSaved }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const img = imageFor(s);
  const desc = descriptionFor(s);
  const price = Number(s.price || 0);
  const link = to || `/book/${s.id}`;
  const isVirtual = s.appointment_type === 'virtual';
  const cityLabel = s.city || s.venue;

  useEffect(() => {
    if (savedIds) setSaved(savedIds.has(s.id));
  }, [savedIds, s.id]);

  const toggleSave = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user || busy) return;
    setBusy(true);
    try {
      if (saved) { await api.del(`/saved/${s.id}`); setSaved(false); onToggleSaved?.(s.id, false); }
      else { await api.post(`/saved/${s.id}`); setSaved(true); onToggleSaved?.(s.id, true); }
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <Link to={link} className="card-hover overflow-hidden group flex flex-col animate-fade-in">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={img} alt={s.name}
             onError={(e) => { e.currentTarget.style.display = 'none'; }}
             className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          {s.category_name && (
            <span className="pill bg-white/90 text-ink-800 backdrop-blur">{s.category_name}</span>
          )}
          {isVirtual && (
            <span className="pill bg-brand-600 text-white"><Video size={12} /> Virtual</span>
          )}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="pill bg-white/90 text-ink-900 backdrop-blur">
            {price > 0 ? formatINR(price) : 'Free'}
          </span>
          {user && (
            <button onClick={toggleSave} disabled={busy}
              className={`p-1.5 rounded-full backdrop-blur transition ${saved ? 'bg-brand-600 text-white' : 'bg-white/90 text-ink-700 hover:text-brand-600'}`}
              title={saved ? 'Remove from saved' : 'Save'}>
              <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h3 className="text-lg font-bold leading-tight line-clamp-1">{s.name}</h3>
          <p className="text-xs opacity-90 line-clamp-2 mt-1">{desc}</p>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1"><Clock size={12} /> {s.duration_minutes} min</span>
          {!!s.manage_capacity && (
            <span className="inline-flex items-center gap-1"><Users size={12} /> Up to {s.max_per_slot}</span>
          )}
          {Number(s.rating) > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600"><Star size={12} fill="currentColor" /> {Number(s.rating).toFixed(1)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <MapPin size={12} />
          <span className="truncate">{cityLabel || '—'}</span>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xs text-ink-500">{s.organiser_name}</span>
          <span className="btn-soft !py-1.5 !px-3 text-xs">Book →</span>
        </div>
      </div>
    </Link>
  );
}
