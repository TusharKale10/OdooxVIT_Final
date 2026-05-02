import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyOtp from './pages/VerifyOtp.jsx';
import Forgot from './pages/Forgot.jsx';
import Reset from './pages/Reset.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ServiceDetail from './pages/ServiceDetail.jsx';
import BookingFlow from './pages/BookingFlow.jsx';
import BookingConfirmed from './pages/BookingConfirmed.jsx';
import Profile from './pages/Profile.jsx';
import Reschedule from './pages/Reschedule.jsx';
import Payment from './pages/Payment.jsx';
import OrganiserPanel from './pages/OrganiserPanel.jsx';
import OrganiserService from './pages/OrganiserService.jsx';
import OrganiserNew from './pages/OrganiserNew.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const initials = user
    ? (user.full_name || '?').split(' ').map((p)=>p[0]).slice(0,2).join('').toUpperCase()
    : '';
  return (
    <div className="nav">
      <Link to="/" className="nav-brand">
        <span className="nav-brand-dot" />
        Appointly
      </Link>
      <div className="nav-links">
        <Link to="/">Services</Link>
        {user && <Link to="/profile">My profile</Link>}
        {user && (user.role === 'organiser' || user.role === 'admin') &&
          <Link to="/organiser">Organiser</Link>}
        {user && user.role === 'admin' && <Link to="/admin">Admin</Link>}
        {!user && <Link to="/login">Sign in</Link>}
        {!user && <Link to="/register"><button>Get started</button></Link>}
        {user && (
          <span className="nav-user-chip">
            <span className="avatar">{initials}</span>
            <span>{user.full_name.split(' ')[0]}</span>
          </span>
        )}
        {user && <button className="ghost" onClick={() => { logout(); nav('/login'); }}>Sign out</button>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot"   element={<Forgot />} />
        <Route path="/reset"    element={<Reset />} />

        <Route path="/" element={<Dashboard />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/services/share/:token" element={<ServiceDetail share />} />

        <Route path="/book/:serviceId" element={
          <PrivateRoute><BookingFlow /></PrivateRoute>
        } />
        <Route path="/booking/:id" element={
          <PrivateRoute><BookingConfirmed /></PrivateRoute>
        } />
        <Route path="/booking/:id/pay" element={
          <PrivateRoute><Payment /></PrivateRoute>
        } />
        <Route path="/booking/:id/reschedule" element={
          <PrivateRoute><Reschedule /></PrivateRoute>
        } />

        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

        <Route path="/organiser" element={
          <PrivateRoute roles={['organiser','admin']}><OrganiserPanel /></PrivateRoute>
        } />
        <Route path="/organiser/new" element={
          <PrivateRoute roles={['organiser','admin']}><OrganiserNew /></PrivateRoute>
        } />
        <Route path="/organiser/services/:id" element={
          <PrivateRoute roles={['organiser','admin']}><OrganiserService /></PrivateRoute>
        } />

        <Route path="/admin" element={
          <PrivateRoute roles={['admin']}><AdminPanel /></PrivateRoute>
        } />

        <Route path="*" element={<div className="container">Not found</div>} />
      </Routes>
    </>
  );
}
