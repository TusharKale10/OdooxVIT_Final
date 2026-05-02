import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Search, Sparkles, ArrowRight, Filter, LocateFixed, Loader2 } from 'lucide-react';
import { CATEGORIES, getCategoryBySlug } from '../data/categories';
import ServiceCard from '../components/ServiceCard.jsx';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function ServicesPage() {
  const { id } = useParams();
  const slug = id;
  const cat = getCategoryBySlug(slug);
  const nav = useNavigate();
  const { user } = useAuth();

  const [services, setServices] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [locTree, setLocTree] = useState({});
  const [filters, setFilters] = useState({
    q: '', state: '', city: '', max_price: '',
  });
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');

  useEffect(() => {
    api.get('/locations').then((d) => setLocTree(d.tree || {})).catch(() => {});
  }, []);

  useEffect(() => {
    if (!cat) { setLoading(false); return; }
    setLoading(true); setError('');
    const params = new URLSearchParams();
    if (cat.apiCategory) params.set('category', cat.apiCategory);
    if (cat.apiQuery) for (const [k, v] of Object.entries(cat.apiQuery)) params.set(k, v);
    if (filters.state) params.set('state', filters.state);
    if (filters.city)  params.set('city',  filters.city);
    if (filters.max_price) params.set('max_price', filters.max_price);

    api.get(`/services${params.toString() ? `?${params}` : ''}`)
      .then((d) => {
        let list = d.services || [];
        if (cat.excludeApiCategories) {
          list = list.filter((s) => !cat.excludeApiCategories.includes(s.category_key));
        }
        setServices(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, cat, filters.state, filters.city, filters.max_price]);

  useEffect(() => {
    if (user) api.get('/saved/ids').then((d) => setSavedIds(new Set(d.ids || []))).catch(() => {});
  }, [user]);

  const onToggleSaved = (id, saved) => {
    setSavedIds((prev) => { const next = new Set(prev); if (saved) next.add(id); else next.delete(id); return next; });
  };

  const states = useMemo(() => Object.keys(locTree.India || {}).sort(), [locTree]);
  const cities = useMemo(() => {
    if (!filters.state) return [];
    const districts = (locTree.India || {})[filters.state] || {};
    return Object.values(districts).flat().sort();
  }, [locTree, filters.state]);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const clearFilters = () => setFilters({ q: '', state: '', city: '', max_price: '' });
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return setGeoMsg('Geolocation not supported.');
    setGeoBusy(true); setGeoMsg('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const d = await api.get(`/locations/nearest?lat=${latitude}&lng=${longitude}`);
          setFilters((f) => ({ ...f, state: d.state, city: d.city }));
          setGeoMsg(`Showing services near ${d.city}, ${d.state}.`);
        } catch (e) { setGeoMsg(e.message || 'Could not detect a city.'); }
        finally { setGeoBusy(false); }
      },
      () => { setGeoBusy(false); setGeoMsg('Location permission denied.'); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const filtered = useMemo(
    () => services.filter((s) =>
      !filters.q || `${s.name} ${s.description || ''} ${s.organiser_name || ''}`.toLowerCase().includes(filters.q.toLowerCase())
    ),
    [services, filters.q]
  );

  if (!cat) {
    return (
      <div className="max-w-xl mx-auto card p-10 text-center">
        <h1 className="text-2xl font-bold">Category not found</h1>
        <p className="text-sm text-ink-500 mt-1 mb-5">"{slug}" is not a known category.</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={c.route} className="pill-brand hover:bg-brand-100">{c.title}</Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => nav(-1)} className="btn-ghost"><ChevronLeft size={16} /> Back</button>

      {/* Hero */}
      <header className={`relative overflow-hidden rounded-3xl p-8 sm:p-12 text-white bg-gradient-to-br ${cat.gradient}`}>
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
        <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-white/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="pill bg-white/20 text-white backdrop-blur"><Sparkles size={12} /> {cat.title}</span>
          <h1 className="text-3xl sm:text-5xl font-bold mt-4 leading-tight">{cat.title}</h1>
          <p className="text-white/90 mt-3 text-base sm:text-lg">{cat.description}</p>
        </div>
      </header>

      {/* Filters — scoped to this category page */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input !pl-9"
              placeholder={`Search inside ${cat.title.toLowerCase()}…`}
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
            />
          </div>
          <select className="input !w-auto" value={filters.state}
                  onChange={(e) => { setFilter('state', e.target.value); setFilter('city', ''); }}>
            <option value="">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input !w-auto" value={filters.city}
                  onChange={(e) => setFilter('city', e.target.value)} disabled={!filters.state}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input !w-auto" value={filters.max_price}
                  onChange={(e) => setFilter('max_price', e.target.value)}>
            <option value="">Any price</option>
            <option value="500">Under ₹500</option>
            <option value="1000">Under ₹1,000</option>
            <option value="2000">Under ₹2,000</option>
            <option value="5000">Under ₹5,000</option>
          </select>
          <button onClick={useMyLocation} disabled={geoBusy} className="btn-outline" title="Use my current location">
            {geoBusy ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
            <span className="hidden sm:inline">{geoBusy ? 'Locating…' : 'Near me'}</span>
          </button>
          {activeFilters > 0 && (
            <button onClick={clearFilters} className="btn-ghost"><Filter size={14} /> Clear ({activeFilters})</button>
          )}
          <span className={`pill ${cat.chipBg} ml-auto`}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        {geoMsg && <div className="text-xs text-ink-500 mt-2 px-1">{geoMsg}</div>}
      </section>

      {error && <div className="card border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}

      {/* Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="aspect-[16/10] shimmer-bg" />
              <div className="p-4 space-y-2">
                <div className="h-4 shimmer-bg w-2/3" />
                <div className="h-3 shimmer-bg w-full" />
                <div className="h-3 shimmer-bg w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !filtered.length && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-2">🪄</div>
          <h3 className="font-semibold text-ink-900">Nothing here yet in {cat.title}</h3>
          <p className="text-sm text-ink-500 mt-1 mb-4">Try clearing filters or another category.</p>
          {activeFilters > 0
            ? <button onClick={clearFilters} className="btn-soft">Clear filters</button>
            : <Link to="/" className="btn-primary inline-flex">Browse all categories</Link>}
        </div>
      )}

      {/* Service cards (booking flow entry point — clicking any card starts the multi-step flow) */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <ServiceCard key={s.id} service={s} savedIds={savedIds} onToggleSaved={onToggleSaved} />
          ))}
        </div>
      )}

      {/* Sibling categories navigator */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink-900">Browse another category</h3>
          <Link to="/" className="text-sm text-brand-600 hover:underline inline-flex items-center gap-1">
            All categories <ArrowRight size={14} />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.id !== cat.id).map((c) => (
            <Link key={c.id} to={c.route} className={`pill ${c.chipBg} hover:opacity-80 transition`}>
              {c.title}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
