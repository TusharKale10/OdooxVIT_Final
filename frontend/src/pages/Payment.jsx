import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

const METHODS = [
  { value: 'credit_card', label: 'Credit Card', icon: '💳' },
  { value: 'debit_card',  label: 'Debit Card',  icon: '💳' },
  { value: 'upi',         label: 'UPI',         icon: '📱' },
  { value: 'paypal',      label: 'PayPal',      icon: '🅿️' },
];

export default function Payment() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [method, setMethod] = useState('credit_card');
  const [card, setCard] = useState({ name:'', number:'', exp:'', cvv:'' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/bookings/${id}`).then(setData).catch((e)=>setError(e.message));
  }, [id]);

  const pay = async () => {
    setBusy(true); setError('');
    try { await api.post(`/bookings/${id}/pay`, { method }); nav(`/booking/${id}`); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="container"><div className="muted">Loading…</div></div>;
  const b = data.booking;

  return (
    <div className="container">
      <div className="two-col">
        <div className="card">
          <h2 className="card-title">Secure payment</h2>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form">
            <div className="form-row"><label>Payment method</label>
              <div className="row" style={{gap:8, flexWrap:'wrap'}}>
                {METHODS.map((m) => (
                  <button key={m.value} type="button"
                    onClick={()=>setMethod(m.value)}
                    className={method === m.value ? '' : 'secondary'}
                    style={{padding:'10px 14px'}}>
                    <span style={{marginRight:6}}>{m.icon}</span>{m.label}
                  </button>
                ))}
              </div>
            </div>

            {(method === 'credit_card' || method === 'debit_card') && (
              <>
                <div className="form-row"><label>Name on Card</label>
                  <input value={card.name} onChange={(e)=>setCard({...card,name:e.target.value})}
                    placeholder="Name as printed" /></div>
                <div className="form-row"><label>Card Number</label>
                  <input value={card.number} onChange={(e)=>setCard({...card,number:e.target.value})}
                    placeholder="1234 5678 9012 3456" /></div>
                <div className="row">
                  <div className="form-row" style={{flex:1}}><label>Expiration Date</label>
                    <input value={card.exp} onChange={(e)=>setCard({...card,exp:e.target.value})}
                      placeholder="MM/YY" /></div>
                  <div className="form-row" style={{flex:1}}><label>CVV</label>
                    <input value={card.cvv} onChange={(e)=>setCard({...card,cvv:e.target.value})}
                      placeholder="•••" /></div>
                </div>
              </>
            )}
            {method === 'upi' && (
              <div className="form-row"><label>UPI ID</label>
                <input placeholder="yourname@bank" /></div>
            )}
            {method === 'paypal' && (
              <div className="alert alert-info">You'll be redirected to PayPal to complete payment.</div>
            )}

            <button className="lg block" disabled={busy} onClick={pay}>
              {busy ? 'Processing…' : `Pay ₹${Number(b.total_amount).toFixed(2)}`}
            </button>
            <div className="muted" style={{textAlign:'center'}}>🔒 Encrypted end-to-end. Your card details never touch our servers.</div>
          </div>
        </div>

        <aside className="card">
          <h3 className="card-title">Order Summary</h3>
          <div className="cal-item"><span className="muted">{b.service_name}</span>
            <b>₹{Number(b.total_amount).toFixed(2)}</b></div>
          <div className="cal-item"><span className="muted">Status</span>
            <span className="badge badge-yellow">Awaiting payment</span></div>
          <div className="cal-item" style={{paddingTop:10, borderTop:'1px solid var(--border)', marginTop:6}}>
            <b>Total</b><b style={{fontSize:20}}>₹{Number(b.total_amount).toFixed(2)}</b></div>
          <div className="muted" style={{marginTop:14}}>
            Once payment is confirmed your booking is locked in and you'll get a confirmation email.
          </div>
        </aside>
      </div>
    </div>
  );
}
