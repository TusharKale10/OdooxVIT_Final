import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { imageFor, descriptionFor } from '../utils/serviceVisuals';

export default function OrganiserPanel() {
  const [services, setServices] = useState([]);
  const [reports, setReports]   = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/services/mine/list').then((d)=>setServices(d.services)).catch((e)=>setError(e.message));
    api.get('/admin/reports').then(setReports).catch(()=>{});
  }, []);

  const published = services.filter((s)=>s.is_published).length;

  return (
    <div className="container">
      <div className="section-header">
        <div>
          <h2>My services</h2>
          <p>Manage your appointment types, schedules, and bookings</p>
        </div>
        <Link to="/organiser/new"><button>+ New service</button></Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!!services.length && (
        <div className="stat-grid" style={{marginBottom:18}}>
          <div className="stat-card accent">
            <div className="stat-label"><span className="stat-icon">🗂️</span>Services</div>
            <div className="stat-value">{services.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><span className="stat-icon">✅</span>Published</div>
            <div className="stat-value">{published}</div>
          </div>
          {reports && (
            <div className="stat-card">
              <div className="stat-label"><span className="stat-icon">📅</span>Total bookings</div>
              <div className="stat-value">{reports.total_appointments}</div>
            </div>
          )}
        </div>
      )}

      {!services.length && (
        <div className="empty">
          <div className="empty-icon">🚀</div>
          <h3>Create your first service</h3>
          <p className="muted">Set up an appointment type and start accepting bookings in minutes.</p>
          <Link to="/organiser/new" style={{display:'inline-block', marginTop:10}}>
            <button>+ New service</button>
          </Link>
        </div>
      )}

      <div className="svc-grid">
        {services.map((s)=> (
          <article className="svc-card" key={s.id}>
            <div className="svc-media" style={{ backgroundImage: `url(${imageFor(s)})` }}>
              <div className="svc-badges">
                <span className={`badge ${s.is_published ? 'badge-green' : 'badge-grey'}`}>
                  {s.is_published ? 'Published' : 'Draft'}
                </span>
                <span className="badge badge-overlay">{s.duration_minutes} min</span>
              </div>
            </div>
            <div className="svc-body">
              <h3>{s.name}</h3>
              <p>{descriptionFor(s)}</p>
              <div className="muted" style={{fontSize:12, wordBreak:'break-all'}}>
                Share link: <code>/services/share/{s.share_token}</code>
              </div>
              <div className="row">
                <Link to={`/organiser/services/${s.id}`}><button className="secondary">Manage →</button></Link>
                <Link to={`/services/${s.id}`} className="right"><button className="ghost">Preview</button></Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {reports && services.length > 0 && (
        <div className="two-col" style={{marginTop:24}}>
          <div className="card">
            <h3 className="card-title">Peak booking hours</h3>
            {reports.peak_hours.length === 0
              ? <div className="muted">No data yet.</div>
              : reports.peak_hours.slice(0, 8).map((p)=>(
                  <div className="cal-item" key={p.hour}>
                    <span><b>{String(p.hour).padStart(2,'0')}:00</b></span>
                    <span style={{display:'flex', alignItems:'center', gap:8, flex:1, marginLeft:14}}>
                      <span style={{flex:1, height:8, background:'var(--surface-2)', borderRadius:999, overflow:'hidden'}}>
                        <span style={{
                          display:'block', height:'100%',
                          width: `${Math.min(100, (p.bookings / Math.max(1, reports.peak_hours[0].bookings)) * 100)}%`,
                          background:'linear-gradient(90deg, var(--primary), #a855f7)',
                          borderRadius:999, transition:'width 400ms ease',
                        }} />
                      </span>
                      <b style={{minWidth:30, textAlign:'right'}}>{p.bookings}</b>
                    </span>
                  </div>
                ))}
          </div>
          <div className="card">
            <h3 className="card-title">Resource utilisation</h3>
            <table>
              <thead><tr><th>Service</th><th>Resource</th><th>Bookings</th></tr></thead>
              <tbody>
                {reports.provider_utilization.map((p)=>(
                  <tr key={p.resource_id}>
                    <td>{p.service_name}</td>
                    <td>{p.resource_name}</td>
                    <td><b>{p.bookings}</b></td>
                  </tr>
                ))}
                {reports.provider_utilization.length === 0 && (
                  <tr><td colSpan={3} className="muted">No bookings yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
