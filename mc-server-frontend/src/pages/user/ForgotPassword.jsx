import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Input } from '../../components/ui';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleStep1Submit = (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      return setError('กรุณากรอกอีเมล');
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
      setSuccessMsg('กรุณากำหนดรหัสผ่านใหม่');
    }, 800);
  };

  const handleStep2Submit = (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      return setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccessMsg('เปลี่ยนรหัสผ่านสำเร็จแล้ว! กำลังนำคุณไปหน้าเข้าสู่ระบบ...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    }, 1000);
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
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Forgot Password</h2>

          {error && (
            <div className="bg-[#450A0A] border border-[#DC2626] rounded-xl p-3.5 text-xs text-[#FCA5A5] mb-4">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-[#052E16] border border-[#059669] rounded-xl p-3.5 text-xs text-[#6EE7B7] mb-4">
              {successMsg}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอก Email ที่ใช้สมัครบัญชี"
                required
                className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4C1D95] hover:bg-[#5b21b6] text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm disabled:opacity-50"
              >
                {loading ? 'กำลังส่งข้อมูล...' : 'Submit Reset password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="กรอก รหัสผ่านใหม่"
                required
                className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
              />

              <Input
                label="Confirm New Password"
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="กรอก ยืนยันรหัสผ่านใหม่"
                required
                className="[&_input]:bg-[#0f0f1a] [&_input]:rounded-xl [&_input]:border-[#2A2A3A]"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4C1D95] hover:bg-[#5b21b6] text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm mt-4 disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : 'Submit Reset password'}
              </button>
            </form>
          )}

          <div className="text-center pt-4 border-t border-[#2A2A3A] mt-6">
            <Link to="/login" className="text-xs text-[#A78BFA] hover:underline">
              ย้อนกลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
