import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Server,
  CalendarDays,
  BookOpen,
  LogOut,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
    { label: 'จัดการเซิร์ฟเวอร์', path: '/admin/servers', icon: <Server className="w-4.5 h-4.5" /> },
    { label: 'รายการจอง', path: '/admin/bookings', icon: <BookOpen className="w-4.5 h-4.5" /> },
    { label: 'Time Slots', path: '/admin/time-slots', icon: <CalendarDays className="w-4.5 h-4.5" /> },
    { label: 'จัดการผู้ใช้', path: '/admin/users', icon: <Users className="w-4.5 h-4.5" /> },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="w-64 bg-[#0f0f1a] border-r border-[#2A2A3A] flex flex-col h-screen sticky top-0 text-[#E0E0E0]">
      {/* Title / Logo */}
      <div className="p-6 border-b border-[#2A2A3A] flex items-center gap-3">
        <div className="bg-[#2d1b69] p-2 rounded-lg border border-purple-400/20">
          <img
            src="/mc-logo.png"
            alt="MC Logo"
            className="w-6 h-6 object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="%232d1b69"/><text x="12" y="16" fill="white" font-size="12" font-weight="bold" text-anchor="middle">MC</text></svg>';
            }}
          />
        </div>
        <div>
          <h1 className="font-extrabold text-white text-base tracking-wide">MC Server</h1>
          <span className="text-[10px] font-semibold text-[#A78BFA] uppercase tracking-wider">Admin Panel</span>
        </div>
      </div>

      {/* Menu Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item, idx) => {
          const active = isActive(item.path);
          return (
            <Link
              key={idx}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-[#1e1b4b] text-[#A78BFA] border border-[#7C3AED]/40 shadow-inner'
                  : 'text-[#E0E0E0]/70 hover:bg-[#1a1a2e] hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Controls */}
      <div className="p-4 border-t border-[#2A2A3A] space-y-2">
        <Link
          to="/"
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-[#E0E0E0]/70 hover:text-white bg-[#1a1a2e] border border-[#2A2A3A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับหน้าหลักผู้ใช้</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-[#450A0A] border border-red-900/40 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
