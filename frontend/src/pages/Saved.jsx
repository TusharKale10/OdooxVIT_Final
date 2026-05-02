import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { api } from '../api/client';
import ServiceCard from '../components/ServiceCard.jsx';

export default function Saved() {
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/saved')
      .then((d) => setServices(d.services || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
          <Bookmark size={20} className="text-brand-600" /> Saved services
        </h1>
        <p className="text-sm text-ink-500">Quick-access list of services you've bookmarked.</p>
      </div>

      {error && <div className="card border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}
      {loading && <div className="text-sm text-ink-500">Loading…</div>}

      {!loading && !services.length && (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-2">🔖</div>
          <h3 className="font-semibold text-ink-900">No saved services yet</h3>
          <p className="text-sm text-ink-500 mt-1 mb-4">Tap the bookmark icon on any service card to save it for later.</p>
          <Link to="/" className="btn-primary inline-flex">Browse services</Link>
        </div>
      )}

      {services.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s) => <ServiceCard key={s.id} service={s} />)}
        </div>
      )}
    </div>
  );
}
