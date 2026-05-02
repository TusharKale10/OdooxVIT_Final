import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

export default function OrganiserService() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [calRange, setCalRange] = useState({ from: todayStr(), to: todayStr() });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // editor state
  const [s, setS] = useState(null);
  const [resources, setResources] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [flex, setFlex] = useState([]);

  const load = async () => {
    const d = await api.get(`/services/${id}`);
    setData(d); setS(d.service); setResources(d.resources);
    setQuestions(d.questions); setWeekly(d.weekly); setFlex(d.flex);
  };
  const loadBookings = () => api.get(`/services/${id}/bookings`).then((d)=>setBookings(d.bookings));
  const loadCalendar = () => api.get(`/services/${id}/calendar?from=${calRange.from}&to=${calRange.to}`).then((d)=>setCalendar(d.bookings));

  useEffect(() => { load().catch((e)=>setError(e.message)); loadBookings(); }, [id]);
  useEffect(() => { loadCalendar(); }, [calRange]);

  const setSField = (k) => (e) =>
    setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const saveService = async () => {
    setError(''); setInfo('');
    try {
      await api.put(`/services/${id}`, s);
      setInfo('Service settings saved.');
    } catch (e) { setError(e.message); }
  };

  const togglePublish = async () => {
    await api.put(`/services/${id}/publish`, { publish: !s.is_published });
    setS({ ...s, is_published: !s.is_published });
  };

  const addResource = async () => {
    const name = prompt('Resource / provider name:'); if (!name) return;
    await api.post(`/services/${id}/resources`, { name });
    await load();
  };
  const delResource = async (rid) => {
    if (!confirm('Delete this resource?')) return;
    await api.del(`/services/${id}/resources/${rid}`);
    await load();
  };

  const setWeeklyRow = (i, k, v) => {
    const next = weekly.slice(); next[i] = { ...next[i], [k]: v }; setWeekly(next);
  };
  const addWeekly = () => setWeekly([...weekly, { day_of_week: 1, start_time: '09:00', end_time: '17:00' }]);
  const delWeekly = (i) => setWeekly(weekly.filter((_,idx)=>idx!==i));
  const saveWeekly = async () => {
    await api.put(`/services/${id}/weekly`, { items: weekly.map((w)=>({
      day_of_week: Number(w.day_of_week),
      start_time: w.start_time.length === 5 ? w.start_time + ':00' : w.start_time,
      end_time:   w.end_time.length   === 5 ? w.end_time   + ':00' : w.end_time,
    })) });
    setInfo('Weekly schedule saved.');
  };

  const setFlexRow = (i, k, v) => {
    const next = flex.slice(); next[i] = { ...next[i], [k]: v }; setFlex(next);
  };
  const addFlex = () => setFlex([...flex, { start_datetime: todayStr()+' 09:00:00', end_datetime: todayStr()+' 17:00:00' }]);
  const delFlex = (i) => setFlex(flex.filter((_,idx)=>idx!==i));
  const saveFlex = async () => {
    await api.put(`/services/${id}/flexible`, { items: flex });
    setInfo('Flexible slots saved.');
  };

  const setQRow = (i, k, v) => {
    const next = questions.slice(); next[i] = { ...next[i], [k]: v }; setQuestions(next);
  };
  const addQ  = () => setQuestions([...questions, { question:'', field_type:'text', is_required:1 }]);
  const delQ  = (i) => setQuestions(questions.filter((_,idx)=>idx!==i));
  const saveQ = async () => {
    await api.put(`/services/${id}/questions`, { items: questions });
    setInfo('Questions saved.');
  };

  const confirmBooking = async (bid) => { await api.post(`/bookings/${bid}/confirm`); loadBookings(); };
  const cancelBooking  = async (bid) => { if (confirm('Cancel?')) { await api.post(`/bookings/${bid}/cancel`); loadBookings(); } };

  if (!data || !s) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      {error && <div className="alert alert-error">{error}</div>}
      {info  && <div className="alert alert-success">{info}</div>}

      <div className="card">
        <div className="row">
          <h2 style={{margin:0}}>{s.name}</h2>
          <span className={`badge ${s.is_published ? 'badge-green' : 'badge-grey'}`}>
            {s.is_published ? 'Published' : 'Unpublished'}
          </span>
          <button className="secondary right" onClick={togglePublish}>
            {s.is_published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
        <div className="muted">Share link: <code>/services/share/{s.share_token}</code></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 className="card-title">Configuration</h3>
          <div className="form">
            <div className="form-row"><label>Name</label><input value={s.name} onChange={setSField('name')} /></div>
            <div className="form-row"><label>Description</label><textarea value={s.description||''} onChange={setSField('description')} /></div>
            <div className="row">
              <div className="form-row" style={{flex:1}}><label>Duration (min)</label>
                <input type="number" min={5} value={s.duration_minutes} onChange={setSField('duration_minutes')} /></div>
              <div className="form-row" style={{flex:1}}><label>Venue</label>
                <input value={s.venue||''} onChange={setSField('venue')} /></div>
            </div>
            <div className="row">
              <div className="form-row" style={{flex:1}}><label>Price (₹)</label>
                <input type="number" min={0} step="0.01" value={s.price} onChange={setSField('price')} /></div>
              <div className="form-row" style={{flex:1}}><label>Tax %</label>
                <input type="number" min={0} step="0.01" value={s.tax_percent} onChange={setSField('tax_percent')} /></div>
            </div>
            <div className="row">
              <div className="form-row" style={{flex:1}}><label>Schedule</label>
                <select value={s.schedule_type} onChange={setSField('schedule_type')}>
                  <option value="weekly">Weekly</option><option value="flexible">Flexible</option>
                </select></div>
              <div className="form-row" style={{flex:1}}><label>Assignment</label>
                <select value={s.assignment_mode} onChange={setSField('assignment_mode')}>
                  <option value="auto">Auto</option><option value="manual">Manual</option>
                </select></div>
              <div className="form-row" style={{flex:1}}><label>Resource kind</label>
                <select value={s.resource_kind} onChange={setSField('resource_kind')}>
                  <option value="user">User</option><option value="resource">Resource</option>
                </select></div>
            </div>
            <label><input type="checkbox" checked={!!Number(s.manage_capacity)} onChange={setSField('manage_capacity')} /> Manage capacity</label>
            {!!Number(s.manage_capacity) && (
              <div className="form-row"><label>Max bookings per slot</label>
                <input type="number" min={1} value={s.max_per_slot} onChange={setSField('max_per_slot')} /></div>
            )}
            <label><input type="checkbox" checked={!!Number(s.advance_payment)} onChange={setSField('advance_payment')} /> Advance payment required</label>
            <label><input type="checkbox" checked={!!Number(s.manual_confirmation)} onChange={setSField('manual_confirmation')} /> Manual confirmation</label>
            <button onClick={saveService}>Save settings</button>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Resources / Providers</h3>
          <table>
            <thead><tr><th>Name</th><th></th></tr></thead>
            <tbody>
              {resources.map((r)=>(
                <tr key={r.id}><td>{r.name}</td>
                  <td><button className="danger" onClick={()=>delResource(r.id)}>Delete</button></td></tr>
              ))}
            </tbody>
          </table>
          <button onClick={addResource} style={{marginTop:8}}>+ Add</button>

          <hr/>
          <h3 className="card-title">Booking questions</h3>
          {questions.map((q,i)=>(
            <div className="row" key={i} style={{marginBottom:6}}>
              <input placeholder="Question" value={q.question} onChange={(e)=>setQRow(i,'question',e.target.value)} style={{flex:2}} />
              <select value={q.field_type} onChange={(e)=>setQRow(i,'field_type',e.target.value)}>
                <option value="text">text</option><option value="textarea">textarea</option>
                <option value="number">number</option><option value="email">email</option><option value="phone">phone</option>
              </select>
              <label><input type="checkbox" checked={!!Number(q.is_required)} onChange={(e)=>setQRow(i,'is_required',e.target.checked?1:0)} /> required</label>
              <button className="danger" onClick={()=>delQ(i)}>x</button>
            </div>
          ))}
          <div className="row"><button className="secondary" onClick={addQ}>+ Add question</button>
            <button onClick={saveQ}>Save questions</button></div>
        </div>
      </div>

      {s.schedule_type === 'weekly' ? (
        <div className="card">
          <h3 className="card-title">Weekly schedule</h3>
          {weekly.map((w,i)=>(
            <div className="row" key={i} style={{marginBottom:6}}>
              <select value={w.day_of_week} onChange={(e)=>setWeeklyRow(i,'day_of_week',e.target.value)}>
                {DAYS.map((d,idx)=> <option key={idx} value={idx}>{d}</option>)}
              </select>
              <input type="time" value={String(w.start_time).slice(0,5)} onChange={(e)=>setWeeklyRow(i,'start_time',e.target.value)} />
              <input type="time" value={String(w.end_time).slice(0,5)} onChange={(e)=>setWeeklyRow(i,'end_time',e.target.value)} />
              <button className="danger" onClick={()=>delWeekly(i)}>Remove</button>
            </div>
          ))}
          <div className="row"><button className="secondary" onClick={addWeekly}>+ Add window</button>
            <button onClick={saveWeekly}>Save weekly schedule</button></div>
        </div>
      ) : (
        <div className="card">
          <h3 className="card-title">Flexible slots</h3>
          {flex.map((w,i)=>(
            <div className="row" key={i} style={{marginBottom:6}}>
              <input type="datetime-local" value={String(w.start_datetime).replace(' ','T').slice(0,16)}
                onChange={(e)=>setFlexRow(i,'start_datetime',e.target.value.replace('T',' ')+':00')} />
              <input type="datetime-local" value={String(w.end_datetime).replace(' ','T').slice(0,16)}
                onChange={(e)=>setFlexRow(i,'end_datetime',e.target.value.replace('T',' ')+':00')} />
              <button className="danger" onClick={()=>delFlex(i)}>Remove</button>
            </div>
          ))}
          <div className="row"><button className="secondary" onClick={addFlex}>+ Add window</button>
            <button onClick={saveFlex}>Save flexible slots</button></div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Calendar view</h3>
        <div className="row">
          <input type="date" value={calRange.from} onChange={(e)=>setCalRange({...calRange, from:e.target.value})} />
          <input type="date" value={calRange.to}   onChange={(e)=>setCalRange({...calRange, to:e.target.value})} />
        </div>
        {calendar.length === 0 && <div className="muted" style={{marginTop:8}}>No bookings in range.</div>}
        {calendar.map((b)=>(
          <div className="cal-item" key={b.id}>
            <span><b>{new Date(b.start_datetime.replace(' ','T')).toLocaleString()}</b> · {b.customer_name} · {b.resource_name}</span>
            <span><span className={`badge ${b.status==='confirmed'?'badge-green':b.status==='reserved'?'badge-yellow':b.status==='cancelled'?'badge-red':'badge-grey'}`}>{b.status}</span></span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card-title">All bookings</h3>
        <table>
          <thead><tr><th>When</th><th>Customer</th><th>Resource</th><th>Cap</th><th>Status</th><th>Pay</th><th></th></tr></thead>
          <tbody>
            {bookings.map((b)=>(
              <tr key={b.id}>
                <td>{new Date(b.start_datetime.replace(' ','T')).toLocaleString()}</td>
                <td>{b.customer_name}<br/><span className="muted">{b.customer_email}</span></td>
                <td>{b.resource_name}</td>
                <td>{b.capacity_taken}</td>
                <td><span className={`badge ${b.status==='confirmed'?'badge-green':b.status==='reserved'?'badge-yellow':b.status==='cancelled'?'badge-red':'badge-grey'}`}>{b.status}</span></td>
                <td>{b.payment_status}</td>
                <td>
                  {b.status === 'reserved' && <button onClick={()=>confirmBooking(b.id)}>Confirm</button>}
                  {b.status !== 'cancelled' && <button className="danger" onClick={()=>cancelBooking(b.id)}>Cancel</button>}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={7} className="muted">No bookings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
