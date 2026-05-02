import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function OrganiserNew() {
  const nav = useNavigate();
  const [f, setF] = useState({
    name:'', description:'', duration_minutes:30, venue:'', price:0, tax_percent:0,
    manage_capacity:false, max_per_slot:1, advance_payment:false,
    manual_confirmation:false, assignment_mode:'auto',
    schedule_type:'weekly', resource_kind:'user', is_published:false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type==='checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const d = await api.post('/services', f);
      nav(`/organiser/services/${d.id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="container">
      <div className="card" style={{maxWidth:640}}>
        <h2 className="card-title">Create appointment type</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="form" onSubmit={submit}>
          <div className="form-row"><label>Name</label>
            <input value={f.name} onChange={set('name')} required /></div>
          <div className="form-row"><label>Description</label>
            <textarea value={f.description} onChange={set('description')} /></div>
          <div className="row">
            <div className="form-row" style={{flex:1}}><label>Duration (minutes)</label>
              <input type="number" min={5} value={f.duration_minutes} onChange={set('duration_minutes')} /></div>
            <div className="form-row" style={{flex:1}}><label>Venue</label>
              <input value={f.venue} onChange={set('venue')} /></div>
          </div>
          <div className="row">
            <div className="form-row" style={{flex:1}}><label>Price (₹)</label>
              <input type="number" min={0} step="0.01" value={f.price} onChange={set('price')} /></div>
            <div className="form-row" style={{flex:1}}><label>Tax %</label>
              <input type="number" min={0} step="0.01" value={f.tax_percent} onChange={set('tax_percent')} /></div>
          </div>
          <div className="row">
            <div className="form-row" style={{flex:1}}><label>Schedule type</label>
              <select value={f.schedule_type} onChange={set('schedule_type')}>
                <option value="weekly">Weekly</option>
                <option value="flexible">Flexible</option>
              </select></div>
            <div className="form-row" style={{flex:1}}><label>Assignment</label>
              <select value={f.assignment_mode} onChange={set('assignment_mode')}>
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select></div>
            <div className="form-row" style={{flex:1}}><label>Resource kind</label>
              <select value={f.resource_kind} onChange={set('resource_kind')}>
                <option value="user">User</option>
                <option value="resource">Resource</option>
              </select></div>
          </div>
          <label><input type="checkbox" checked={f.manage_capacity} onChange={set('manage_capacity')} /> Manage capacity</label>
          {f.manage_capacity && (
            <div className="form-row"><label>Max bookings per slot</label>
              <input type="number" min={1} value={f.max_per_slot} onChange={set('max_per_slot')} /></div>
          )}
          <label><input type="checkbox" checked={f.advance_payment} onChange={set('advance_payment')} /> Advance payment required</label>
          <label><input type="checkbox" checked={f.manual_confirmation} onChange={set('manual_confirmation')} /> Manual confirmation</label>
          <label><input type="checkbox" checked={f.is_published} onChange={set('is_published')} /> Publish immediately</label>
          <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
        </form>
      </div>
    </div>
  );
}
