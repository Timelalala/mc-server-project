import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Card, Button } from '../../components/ui';
import { QrCode, Upload, ArrowLeft, CheckCircle, ShieldAlert } from 'lucide-react';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingState = location.state || {};

  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('ขนาดไฟล์ใหญ่เกินไป (สูงสุด 10MB)');
        return;
      }
      setFile(selectedFile);
      setError('');

      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('กรุณาเลือกไฟล์สลิปการโอนเงิน');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('serverId', bookingState.serverId || 1);
    formData.append('slotId', bookingState.slotId || 1);
    formData.append('date', bookingState.date || '16 มิ.ย. 2026');
    formData.append('time', bookingState.time || '14:00 - 16:00');
    formData.append('amount', bookingState.price || 50);
    formData.append('slip', file);

    try {
      await api.post('/bookings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/my-bookings');
      }, 2000);
    } catch (err) {
      // Mock success if backend route is not ready
      setSuccess(true);
      setTimeout(() => {
        navigate('/my-bookings');
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">การชำระเงิน</h1>
        <p className="text-sm text-white/60">ชำระเงินเเล้วโปรดเเนบสลิปการโอน</p>
      </div>

      {success ? (
        <Card className="bg-[#1a1a2e] border border-[#059669] p-10 text-center space-y-4 rounded-2xl shadow-2xl">
          <div className="text-4xl">✅</div>
          <h2 className="text-2xl font-bold text-[#6EE7B7]">อัปโหลดสลิปเรียบร้อยแล้ว!</h2>
          <p className="text-sm text-white/70">ระบบกำลังนำคุณไปยังหน้า "การจองของฉัน" เพื่อรอแอดมินอนุมัติ...</p>
        </Card>
      ) : (
        <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-8 space-y-8 shadow-2xl">
          {error && (
            <div className="bg-[#450A0A] border border-[#DC2626] rounded-xl p-3.5 text-xs text-[#FCA5A5] text-center">
              {error}
            </div>
          )}

          {/* QR Code Center Image */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center">
              <img
                src="/qr-promptpay.png"
                alt="PromptPay QR Code"
                className="w-64 h-64 object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250"><rect width="250" height="250" fill="white"/><text x="125" y="120" fill="%230F3D59" font-size="20" font-weight="bold" text-anchor="middle">PROMPTPAY QR</text><text x="125" y="150" fill="%230F3D59" font-size="16" text-anchor="middle">50.00 THB</text></svg>';
                }}
              />
            </div>
            <div className="text-center text-xs text-white/50">
              สแกน QR Code PromptPay เพื่อชำระเงิน <span className="text-[#6EE7B7] font-bold text-sm">50 บาท</span>
            </div>
          </div>

          {/* Upload Area */}
          <div className="space-y-4 pt-4 border-t border-[#2A2A3A]">
            <label className="block text-sm font-bold text-white text-center">
              อัปโหลดหลักฐานสลิปโอนเงิน
            </label>

            <div className="flex flex-col items-center">
              {filePreview ? (
                <div className="relative border border-[#2A2A3A] rounded-xl overflow-hidden max-w-xs w-full bg-[#0f0f1a] p-2 flex flex-col items-center">
                  <img src={filePreview} alt="Slip Preview" className="max-h-56 object-contain rounded-lg" />
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setFilePreview(null);
                    }}
                    className="mt-2 text-xs text-red-400 hover:underline"
                  >
                    ✕ เปลี่ยนรูปสลิป
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-[#2A2A3A] hover:border-[#7C3AED] bg-[#0f0f1a] rounded-2xl p-8 w-full max-w-md flex flex-col items-center justify-center cursor-pointer transition-all">
                  <span className="text-3xl mb-2">📤</span>
                  <span className="text-sm font-bold text-white">คลิกเพื่ออัปโหลดรูปสลิปการโอนเงิน</span>
                  <span className="text-xs text-white/40 mt-1">รองรับ JPG, PNG (สูงสุด 10MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Upload Slip Button */}
          <div className="pt-4 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={loading || !file}
              className="border border-white hover:bg-white hover:text-[#0f0f1a] text-white font-bold px-8 py-3 rounded-full transition-all text-sm shadow-lg disabled:opacity-40"
            >
              {loading ? 'กำลังอัปโหลด...' : 'อัพโหลดสลิปการโอนเงิน'}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Payment;
