import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { Card, Input } from '../../components/ui';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (formData.password !== formData.confirmPassword) {
      return setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
    }

    setLoading(true);

    try {
      const res = await register(
        formData.username,
        formData.email,
        formData.password,
        formData.phone
      );
      setLoading(false);

      if (res.success) {
        setSuccessMsg('สมัครสมาชิกสำเร็จแล้ว! กำลังนำคุณไปหน้าเข้าสู่ระบบ...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setError(res.message || 'การสมัครสมาชิกไม่สำเร็จ');
      }
    } catch (err) {
      setLoading(false);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-4 text-[#E0E0E0] my-8">
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
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Register</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-[#450A0A] border border-[#DC2626] rounded-xl p-3.5 text-xs text-[#FCA5A5]">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-[#052E16] border border-[#059669] rounded-xl p-3.5 text-xs text-[#6EE7B7]">
                {successMsg}
              </div>
            )}

            <Input
              label="Username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="กรอก Username"
              required
              className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
            />

            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="example@email.com"
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

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="กรอก ยืนยัน Password"
              required
              className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
            />

            <Input
              label="Phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="กรอกเบอร์โทรศัพท์ (08X-XXX-XXXX)"
              required
              className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0f0f1a] hover:bg-[#151528] border border-[#7C3AED] text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm mt-4 disabled:opacity-50"
            >
              {loading ? 'กำลังลงทะเบียน...' : 'สมัครสมาชิก'}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-[#A78BFA] hover:underline">
                มีบัญชีผู้ใช้อยู่แล้ว? เข้าสู่ระบบ
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Register;
