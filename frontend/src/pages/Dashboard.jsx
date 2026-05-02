import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { imageFor, descriptionFor } from '../utils/serviceVisuals';

export default function Dashboard() {
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/services')
      .then((d) => setServices(d.services))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <section className="hero">
        <span className="hero-eyebrow">Smart scheduling</span>
        <h1>Book trusted services in seconds.</h1>
        <p>Browse curated providers, see real-time availability, and confirm your appointment instantly — no calls, no waiting.</p>
      </section>

      <div className="section-header">
        <div>
          <h2>Available services</h2>
          <p>Hand-picked appointment types from verified organisers</p>
        </div>
        <span className="muted">{services.length} active</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="muted">Loading services…</div>}
      {!loading && !services.length && !error && (
        <div className="empty">
          <div className="empty-icon">✨</div>
          <h3>No services published yet</h3>
          <p className="muted">Once an organiser publishes their first service, it'll show up here.</p>
        </div>
      )}

      <div className="svc-grid">
        {services.map((s) => {
          const img  = imageFor(s);
          const desc = descriptionFor(s);
          return (
            <Link key={s.id} to={`/book/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="svc-card">
                <div className="svc-media" style={{ backgroundImage: `url(${img})` }}>
                  <div className="svc-badges">
                    {Number(s.price) > 0
                      ? <span className="badge badge-overlay">₹{Number(s.price).toFixed(0)}</span>
                      : <span className="badge badge-overlay">Free</span>}
                    {!!s.manage_capacity && <span className="badge badge-overlay">Up to {s.max_per_slot}</span>}
                  </div>
                  <div className="svc-media-overlay">
                    <h3 className="svc-overlay-title">{s.name}</h3>
                    <p className="svc-overlay-desc">{desc}</p>
                    <div className="svc-overlay-cta"><button>Book Now →</button></div>
                  </div>
                </div>

                <div className="svc-body">
                  <h3>{s.name}</h3>
                  <p>{desc}</p>
                  <div className="svc-meta-row">
                    <span>⏱ {s.duration_minutes} min</span>
                    <span className="dot" />
                    <span>👤 {s.organiser_name}</span>
                    <span className="right svc-price">
                      {Number(s.price) > 0 ? `₹${Number(s.price).toFixed(0)}` : <span className="free">Free</span>}
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
