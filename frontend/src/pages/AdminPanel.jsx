import { useEffect, useState } from 'react';
import { api } from '../api/client';

const StatCard = ({ icon, label, value, accent }) => (
  <div className={`stat-card ${accent ? 'accent' : ''}`}>
    <div className="stat-label">
      <span className="stat-icon">{icon}</span>{label}
    </div>
    <div className="stat-value">{value}</div>
  </div>
);

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [pendingId, setPendingId] = useState(null);

  const load = () => Promise.all([
    api.get('/admin/dashboard').then(setStats),
    api.get('/admin/users').then((d)=>setUsers(d.users)),
    api.get('/admin/reports').then(setReports),
  ]).catch((e)=>setError(e.message));

  useEffect(() => { load(); }, []);

  const setActive = async (id, val) => {
    setPendingId(id);
    try { await api.put(`/admin/users/${id}/active`, { is_active: val }); await load(); }
    catch (e) { setError(e.message); }
    finally { setPendingId(null); }
  };
  const setRole = async (id, role) => {
    setPendingId(id);
    try { await api.put(`/admin/users/${id}/role`, { role }); await load(); }
    catch (e) { setError(e.message); }
    finally { setPendingId(null); }
  };

  if (!stats) return <div className="container"><div className="muted">Loading…</div></div>;

  const filtered = users.filter((u) =>
    !filter || (u.full_name + ' ' + u.email + ' ' + u.role).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="container">
      <div className="section-header">
        <div>
          <h2>Admin dashboard</h2>
          <p>System-level monitoring and user management</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <StatCard icon="👥" label="Total users"        value={stats.total_users}        accent />
        <StatCard icon="🧑‍💼" label="Service providers" value={stats.total_providers} />
        <StatCard icon="📅" label="Appointments"       value={stats.total_appointments} />
        <StatCard icon="🗂️" label="Services"           value={stats.total_services} />
      </div>

      <div className="card">
        <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
          <h3 className="card-title" style={{margin:0}}>Users</h3>
          <input placeholder="Search users…" value={filter} onChange={(e)=>setFilter(e.target.value)}
            style={{maxWidth:260}} />
        </div>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map((u)=>(
              <tr key={u.id}>
                <td><b>{u.full_name}</b></td>
                <td className="muted">{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e)=>setRole(u.id, e.target.value)}
                    disabled={pendingId === u.id}>
                    <option value="customer">customer</option>
                    <option value="organiser">organiser</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="secondary" disabled={pendingId === u.id}
                    onClick={()=>setActive(u.id, !u.is_active)}>
                    {pendingId === u.id ? 'Updating…' : (u.is_active ? 'Deactivate' : 'Activate')}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="muted">No matching users.</td></tr>}
          </tbody>
        </table>
      </div>

      {reports && (
        <div className="two-col">
          <div className="card">
            <h3 className="card-title">Peak booking hours</h3>
            {reports.peak_hours.length === 0
              ? <div className="muted">No data yet — bookings will start appearing here.</div>
              : reports.peak_hours.slice(0, 8).map((p)=>(
                  <div className="cal-item" key={p.hour}>
                    <span><b>{String(p.hour).padStart(2,'0')}:00</b></span>
                    <span style={{display:'flex', alignItems:'center', gap:8, flex:1, marginLeft:14}}>
                      <span style={{
                        flex:1, height:8, background:'var(--surface-2)', borderRadius:999, overflow:'hidden'
                      }}>
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
            <h3 className="card-title">Provider utilisation</h3>
            {reports.provider_utilization.length === 0
              ? <div className="muted">No bookings yet.</div>
              : <table>
                  <thead><tr><th>Service</th><th>Resource</th><th>Bookings</th></tr></thead>
                  <tbody>
                    {reports.provider_utilization.map((p)=>(
                      <tr key={p.resource_id}>
                        <td>{p.service_name}</td>
                        <td>{p.resource_name}</td>
                        <td><b>{p.bookings}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </div>
        </div>
      )}
    </div>
  );
}
