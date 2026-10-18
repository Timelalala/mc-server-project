import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuth from './hooks/useAuth';
import Navbar from './components/layout/Navbar';
import AdminSidebar from './components/layout/AdminSidebar';

// Pages
import Login from './pages/user/Login';
import Home from './pages/user/Home';
import Booking from './pages/user/Booking';
import MyBookings from './pages/user/MyBookings';

import Register from './pages/user/Register';
import ForgotPassword from './pages/user/ForgotPassword';
import Payment from './pages/user/Payment';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import Users from './pages/admin/Users';
import Servers from './pages/admin/Servers';
import TimeSlots from './pages/admin/TimeSlots';
import Bookings from './pages/admin/Bookings';

// --- Loading Spinner Component ---
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center space-y-4">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7C3AED]" />
    <span className="text-sm font-semibold text-white/50">กำลังโหลดข้อมูลระบบ MC Server...</span>
  </div>
);

// --- User Layout Shell ---
const UserLayout = () => {
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <footer className="bg-[#1a1a2e] border-t border-[#2A2A3A] py-6 text-center text-xs font-semibold text-white/40">
        <p>© 2026 MC Server - Minecraft Server Booking Portal</p>
      </footer>
    </div>
  );
};

// --- Admin Layout Shell ---
const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-[#0f0f1a] flex">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto h-screen p-8 bg-[#0f0f1a]">
        <Outlet />
      </main>
    </div>
  );
};

// --- Protected Route Guard ---
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* User Protected Routes */}
        <Route element={<ProtectedRoute allowedRoles={['user', 'admin']} />}>
          <Route element={<UserLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/payment" element={<Payment />} />
          </Route>
        </Route>

        {/* Admin Protected Routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/servers" element={<Servers />} />
            <Route path="/admin/time-slots" element={<TimeSlots />} />
            <Route path="/admin/timeslots" element={<TimeSlots />} />
            <Route path="/admin/bookings" element={<Bookings />} />
            <Route path="/admin/payments" element={<Navigate to="/admin/bookings" replace />} />
          </Route>
        </Route>

        {/* Catch-all fallback redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
