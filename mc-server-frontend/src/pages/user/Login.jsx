import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { Card, Input, Button } from '../../components/ui';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(formData.username, formData.password);
      setLoading(false);
      if (res.success) {
        navigate('/');
      } else {
        setError(res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      setLoading(false);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4 text-[#E0E0E0]">
      <div className="w-full max-w-md space-y-6">
        {/* Logo Box */}
        <div className="bg-[#2d1b69] border border-purple-500/20 rounded-2xl p-6 flex items-center justify-center gap-3 shadow-xl">
          <img
            src="/mc-logo.png"
            alt="MC Logo"
            className="w-10 h-10 object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="%234C1D95"/><text x="20" y="26" fill="white" font-size="20" font-weight="bold" text-anchor="middle">MC</text></svg>';
            }}
          />
          <span className="text-2xl font-black text-white tracking-wider">MC Server</span>
        </div>

        {/* Form Card */}
        <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Login</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-[#450A0A] border border-[#DC2626] rounded-xl p-3.5 text-xs text-[#FCA5A5]">
                {error}
              </div>
            )}

            <Input
              label="Username เเละ Email"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="กรอก Username หรือ Email"
              required
              className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="กรอก Password"
              required
              className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-[#A78BFA] hover:underline">
                ลืมรหัสผ่าน?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4C1D95] hover:bg-[#5b21b6] text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm disabled:opacity-50"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'Login'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/register')}
              className="w-full bg-[#111827] hover:bg-[#1f2937] text-white font-bold py-3 rounded-xl transition-all border border-gray-700 text-sm mt-3"
            >
              สมัครสมาชิก
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
