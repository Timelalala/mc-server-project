import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { Gamepad2, User, LogOut, LayoutDashboard, Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { label: 'หน้าหลัก', path: '/' },
    { label: 'จองเซิฟเวอร์', path: '/booking' },
    { label: 'การจองของฉัน', path: '/my-bookings' },
    { label: 'สถานะเซิฟเวอร์', path: '/status' },
  ];

  const isActive = (path) => location.pathname === path;

  // First letter of username for circular purple avatar
  const avatarLetter = user?.username ? user.username.charAt(0).toUpperCase() : 'U';

  return (
    <nav className="bg-[#3B1F8C] border-b border-purple-900/50 sticky top-0 z-40 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="bg-[#2d1b69] p-1.5 rounded-lg border border-purple-400/20 flex items-center justify-center">
                <img
                  src="/mc-logo.png"
                  alt="MC Logo"
                  className="w-7 h-7 object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><rect width="30" height="30" fill="%232d1b69"/><text x="15" y="20" fill="white" font-size="16" font-weight="bold" text-anchor="middle">MC</text></svg>';
                  }}
                />
              </div>
              <span className="font-bold text-xl text-white tracking-wide">MC Server</span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link, idx) => (
              <Link
                key={idx}
                to={link.path}
                className={`text-sm font-medium transition-colors py-2 ${
                  isActive(link.path)
                    ? 'text-white font-bold border-b-2 border-[#7C3AED]'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Profile / Dropdown */}
          <div className="hidden md:flex items-center relative">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 bg-[#2d1b69] hover:bg-[#251559] border border-purple-400/30 rounded-full pl-1.5 pr-4 py-1 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-bold text-sm shadow">
                    {avatarLetter}
                  </div>
                  <span className="font-semibold text-sm text-white">{user.username}</span>
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-[#1a1a2e] border border-[#2A2A3A] rounded-xl shadow-2xl py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2 border-b border-[#2A2A3A] mb-1">
                        <p className="text-xs text-white/50">เข้าสู่ระบบในชื่อ</p>
                        <p className="text-sm font-bold text-white truncate">{user.username}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-[#E0E0E0] hover:bg-[#251559] transition-colors"
                      >
                        <User className="w-4 h-4 text-[#A78BFA]" />
                        <span>โปรไฟล์</span>
                      </Link>
                      <Link
                        to="/my-bookings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-[#E0E0E0] hover:bg-[#251559] transition-colors"
                      >
                        <Gamepad2 className="w-4 h-4 text-[#A78BFA]" />
                        <span>การจองของฉัน</span>
                      </Link>
                      <Link
                        to="/change-password"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-[#E0E0E0] hover:bg-[#251559] transition-colors"
                      >
                        <span className="w-4 text-center text-[#A78BFA]">🔑</span>
                        <span>เปลี่ยนรหัสผ่าน</span>
                      </Link>
                      {user.role === 'admin' && (
                        <Link
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-[#A78BFA] hover:bg-[#251559] transition-colors border-t border-[#2A2A3A] mt-1 pt-2"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          <span>ระบบจัดการแอดมิน</span>
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          handleLogout();
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950/40 transition-colors border-t border-[#2A2A3A] mt-1 pt-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>ออกจากระบบ</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-[#4C1D95] border border-[#7C3AED] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#5b21b6] transition-colors shadow"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-purple-200 p-2 rounded-lg bg-[#2d1b69]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-purple-900/50 bg-[#3B1F8C] px-4 pt-2 pb-4 space-y-2">
          {navLinks.map((link, idx) => (
            <Link
              key={idx}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-base font-medium ${
                isActive(link.path)
                  ? 'bg-[#2d1b69] text-white font-bold'
                  : 'text-purple-200 hover:bg-[#2d1b69]/60 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-purple-900/50 my-3 pt-3">
            {user ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-3 py-1">
                  <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-bold text-sm">
                    {avatarLetter}
                  </div>
                  <span className="text-white font-bold">{user.username}</span>
                </div>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-purple-200 hover:bg-[#2d1b69]"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>ระบบจัดการแอดมิน</span>
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/40"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center bg-[#4C1D95] text-white py-2 rounded-lg text-sm font-bold"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
