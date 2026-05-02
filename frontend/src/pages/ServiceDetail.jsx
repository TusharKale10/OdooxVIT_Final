import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';

export default function ServiceDetail({ share }) {
  const { id, token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = share ? `/services/share/${token}` : `/services/${id}`;
    api.get(url)
      .then((d) => share ? setData({ service: d.service }) : setData(d))
      .catch((e) => setError(e.message));
  }, [id, token, share]);

  if (error) return <div className="container"><div className="alert alert-error">{error}</div></div>;
  if (!data) return <div className="container">Loading...</div>;
  const s = data.service;

  return (
    <div className="container">
      <div className="card">
        <h2 className="card-title">{s.name}</h2>
        <p>{s.description}</p>
        <div className="muted">Duration: {s.duration_minutes} min · Venue: {s.venue || '—'}</div>
        <div className="muted">Organiser: {s.organiser_name}</div>
        <div className="row" style={{ marginTop: 12 }}>
          {Number(s.price) > 0
            ? <span className="badge badge-yellow">₹{Number(s.price).toFixed(2)} + {s.tax_percent}% tax</span>
            : <span className="badge badge-green">Free</span>}
          {s.manage_capacity ? <span className="badge">Capacity {s.max_per_slot}</span> : null}
          {s.advance_payment ? <span className="badge badge-yellow">Advance payment</span> : null}
          {s.manual_confirmation ? <span className="badge badge-grey">Manual confirm</span> : null}
        </div>
        <hr />
        <Link to={`/book/${s.id}`}><button>Book Appointment</button></Link>
      </div>
    </div>
  );
}
