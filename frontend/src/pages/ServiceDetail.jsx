import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, MapPin, Star, User, Video, Tag, Share2, ArrowRight, Calendar } from 'lucide-react';
import { api } from '../api/client';
import { imageFor } from '../utils/serviceVisuals';

export default function ServiceDetail({ share }) {
  const { id, token } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = share ? `/services/share/${token}` : `/services/${id}`;
    api.get(url)
      .then((d) => share ? setData({ service: d.service }) : setData(d))
      .catch((e) => setError(e.message));
  }, [id, token, share]);

  const shareLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ url, title: data?.service?.name });
      else { await navigator.clipboard.writeText(url); alert('Link copied to clipboard'); }
    } catch { /* empty */ }
  };

  if (error) return <div className="card border-rose-200 bg-rose-50 text-rose-700 p-4">{error}</div>;
  if (!data) return <div className="p-12 text-center text-ink-500">Loading…</div>;
  const s = data.service;

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => nav(-1)} className="btn-ghost mb-4"><ChevronLeft size={16} /> Back</button>
      <div className="card overflow-hidden">
        <div className="relative aspect-[21/9] bg-cover bg-center" style={{ backgroundImage: `url(${imageFor(s)})` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <div className="flex flex-wrap gap-2 mb-3">
              {s.category_name && <span className="pill bg-white/90 text-ink-800 backdrop-blur">{s.category_name}</span>}
              {s.appointment_type === 'virtual' && <span className="pill bg-brand-600 text-white"><Video size={10} /> Virtual</span>}
              {Number(s.price) > 0 ? <span className="pill bg-amber-500 text-white"><Tag size={10} /> ₹{Number(s.price).toFixed(0)}</span> : <span className="pill bg-emerald-500 text-white">Free</span>}
              {Number(s.rating) > 0 && <span className="pill bg-white/90 text-ink-800"><Star size={10} fill="currentColor" /> {Number(s.rating).toFixed(1)} ({s.rating_count})</span>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold">{s.name}</h1>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
          <div>
            <p className="text-ink-700 leading-relaxed">{s.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <Info icon={Clock} label="Duration" value={`${s.duration_minutes} min`} />
              <Info icon={User} label="Organiser" value={s.organiser_name} />
              {s.appointment_type === 'virtual'
                ? <Info icon={Video} label="Mode" value="Virtual" />
                : <Info icon={MapPin} label="City" value={s.city || '—'} />}
              <Info icon={Calendar} label="Schedule" value={s.schedule_type === 'weekly' ? 'Weekly' : 'Flexible'} />
            </div>
            {s.venue && (
              <div className="card p-4 mt-5 bg-ink-50 border-dashed">
                <div className="text-xs text-ink-500 mb-1 uppercase tracking-wide font-semibold">Venue</div>
                <div className="text-sm">{s.venue}</div>
              </div>
            )}

            {data.reviews && data.reviews.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-ink-900 mb-3">What customers say</h3>
                <div className="space-y-3">
                  {data.reviews.map((r, i) => (
                    <div key={i} className="card p-4">
                      <div className="flex items-center gap-1 text-amber-500 mb-1">
                        {Array.from({ length: r.rating }).map((_, j) => <Star key={j} size={14} fill="currentColor" />)}
                      </div>
                      <p className="text-sm text-ink-700">{r.comment}</p>
                      <div className="text-xs text-ink-400 mt-2">— {r.full_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wide font-semibold text-ink-500">Price</div>
              <div className="text-3xl font-bold text-ink-900 mt-1">
                {Number(s.price) > 0 ? `₹${Number(s.price).toFixed(0)}` : 'Free'}
              </div>
              {Number(s.tax_percent) > 0 && <div className="text-xs text-ink-500 mt-1">+{s.tax_percent}% tax {Number(s.tax_threshold) > 0 && `(over ₹${s.tax_threshold})`}</div>}
              <Link to={`/book/${s.id}`} className="btn-primary w-full mt-4">Book now <ArrowRight size={14} /></Link>
              <button onClick={shareLink} className="btn-ghost w-full mt-2"><Share2 size={14} /> Share</button>
            </div>
            <div className="card p-4 text-xs text-ink-600 leading-relaxed space-y-1">
              {Boolean(s.advance_payment) && <div>💳 Advance payment required to confirm.</div>}
              {!!Number(s.manual_confirmation) && <div>⏳ Manual confirmation by provider.</div>}
              {!!Number(s.manage_capacity) && <div>👥 Up to {s.max_per_slot} per slot.</div>}
              {Number(s.buffer_minutes) > 0 && <div>⏸ {s.buffer_minutes}-min buffer between slots.</div>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 text-xs text-ink-500 uppercase tracking-wide font-semibold">
        <Icon size={14} /> {label}
      </div>
      <div className="text-sm font-semibold text-ink-900 mt-1 truncate">{value}</div>
    </div>
  );
}
