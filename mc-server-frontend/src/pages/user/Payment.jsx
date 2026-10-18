import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import useAuth from '../../hooks/useAuth';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  UploadCloud,
  FileImage,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Check
} from 'lucide-react';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const bookingState = location.state || {};
  const totalPrice = bookingState.totalPrice || bookingState.price || 50;
  const satang = totalPrice * 100;

  const [step, setStep] = useState('loading'); // 'loading' | 'qrcode' | 'success' | 'failed' | 'expired'
  const [chargeData, setChargeData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 mins
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Slip Upload & EasySlip states
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [verifyingSlip, setVerifyingSlip] = useState(false);
  const [slipError, setSlipError] = useState('');
  const [slipSuccessData, setSlipSuccessData] = useState(null);

  const countdownIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. If bookingId is missing, redirect to home immediately
  useEffect(() => {
    if (!bookingState?.bookingId) {
      navigate('/', { replace: true });
    }
  }, [bookingState, navigate]);

  const handleCancel = async () => {
    if (bookingState?.bookingId) {
      try {
        await api.post(`/bookings/${bookingState.bookingId}/cancel`);
      } catch (e) {
        console.error('Cancel failed:', e);
      }
    }
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    navigate('/');
  };

  // Helper function to create charge or prepare payment
  const handleCreateCharge = async () => {
    if (!bookingState?.bookingId) return;

    setStep('loading');
    setIsSubmitting(true);
    setErrorMessage('');
    setSlipError('');

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    try {
      const res = await api.post('/payment/create-charge', {
        bookingId: bookingState.bookingId,
        amount: satang
      });

      const data = res.data;
      setChargeData(data);

      let initialSeconds = 900;
      if (data.expiresAt) {
        const expiresTime = new Date(data.expiresAt).getTime();
        const nowTime = Date.now();
        initialSeconds = Math.max(0, Math.floor((expiresTime - nowTime) / 1000));
      }
      setTimeLeft(initialSeconds > 0 ? initialSeconds : 900);
      setStep('qrcode');
    } catch (err) {
      console.error('Create charge error (fallback mode):', err);
      const mockChargeId = 'chg_easyslip_' + Math.random().toString(36).substring(2, 10);
      setChargeData({
        chargeId: mockChargeId,
        qrUrl: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
      setTimeLeft(900);
      setStep('qrcode');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (bookingState?.bookingId) {
      handleCreateCharge();
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [bookingState?.bookingId]);

  // Countdown timer
  useEffect(() => {
    if (step !== 'qrcode') return;

    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setStep('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [step]);

  // Optional Polling (if Omise charge was generated)
  useEffect(() => {
    if (step !== 'qrcode' || !chargeData?.chargeId || chargeData?.chargeId?.startsWith('chg_easyslip_')) return;

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/payment/status/${chargeData.chargeId}`);
        const status = res.data?.status;

        if (status === 'successful') {
          clearInterval(pollingIntervalRef.current);
          clearInterval(countdownIntervalRef.current);
          setStep('success');
        } else if (status === 'failed') {
          clearInterval(pollingIntervalRef.current);
          clearInterval(countdownIntervalRef.current);
          setStep('failed');
        } else if (status === 'expired') {
          clearInterval(pollingIntervalRef.current);
          clearInterval(countdownIntervalRef.current);
          setStep('expired');
        }
      } catch (err) {
        // Continue polling
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [step, chargeData?.chargeId]);

  // Redirect on success state after 4 seconds
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        navigate('/my-bookings');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [step, navigate]);

  // Handle Slip File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setSlipError('กรุณาเลือกไฟล์รูปภาพสลิปเท่านั้น (JPEG, PNG)');
      return;
    }

    setSlipError('');
    setSlipFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setSlipPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload and Verify with EasySlip
  const handleVerifySlip = async () => {
    if (!slipFile) {
      setSlipError('กรุณาเลือกรูปภาพสลิปโอนเงินก่อนกดยืนยัน');
      return;
    }

    setVerifyingSlip(true);
    setSlipError('');

    try {
      const formData = new FormData();
      formData.append('slip', slipFile);
      formData.append('bookingId', bookingState.bookingId);

      const res = await api.post('/payment/verify-slip', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data?.success) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setSlipSuccessData(res.data?.data);
        setStep('success');
      } else {
        setSlipError(res.data?.message || 'ไม่สามารถตรวจสอบสลิปได้');
      }
    } catch (err) {
      console.error('Slip verification error:', err);
      const msg = err.response?.data?.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาตรวจสอบว่ามี QR Code อยู่บนสลิปชัดเจน';
      setSlipError(msg);
    } finally {
      setVerifyingSlip(false);
    }
  };

  // Format seconds into MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render PromptPay QR image (ใช้รูป QR พร้อมเพย์จริงจากระบบ)
  const renderQrCodeImage = () => {
    return (
      <img
        src="/qr-promptpay.png"
        alt="PromptPay QR Code"
        className="w-56 max-w-full h-auto object-contain rounded-xl shadow-sm border border-gray-100"
        onError={(e) => {
          if (e.target.src !== window.location.origin + '/promptpay-qr.png') {
            e.target.onerror = null;
            e.target.src = '/promptpay-qr.png';
          }
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center font-sans text-white">
      <div className="w-full max-w-xl">

        {/* STATE 1: LOADING */}
        {step === 'loading' && (
          <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-3xl p-12 text-center space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-[#7C3AED] border-t-transparent animate-spin flex items-center justify-center" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">กำลังเตรียมข้อมูลการชำระเงิน...</h2>
              <p className="text-sm text-[rgba(255,255,255,0.4)]">กรุณารอสักครู่ ระบบกำลังสร้างรายการชำระเงิน</p>
            </div>
          </div>
        )}

        {/* STATE 2: QR CODE & SLIP VERIFICATION */}
        {step === 'qrcode' && (
          <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-3xl overflow-hidden shadow-2xl space-y-0">
            
            {/* Top Banner */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-6 text-center space-y-2 border-b border-purple-500/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">ยอดที่ต้องชำระ</span>
              <div className="text-4xl font-extrabold text-white tracking-tight">฿{totalPrice.toLocaleString()}</div>
              <div className="text-xs text-white/80 font-medium">
                {bookingState.serverName || 'Server A'} &bull; {bookingState.timeSlot || 'ช่วงเวลาที่เลือก'}
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              
              {/* QR Code Section */}
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="bg-white p-3 rounded-2xl shadow-xl flex flex-col items-center justify-center relative">
                  {renderQrCodeImage()}
                </div>

                <div className="inline-flex items-center gap-1.5 bg-[#003B6A] text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                  <span>PromptPay (สแกนจ่ายได้ทุกธนาคาร)</span>
                </div>

                {/* Countdown Timer */}
                <div
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    timeLeft < 60
                      ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                      : 'bg-white/5 text-white/80 border border-white/10'
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 ${timeLeft < 60 ? 'animate-pulse text-red-400' : 'text-white/60'}`} />
                  <span>สิทธิ์การจองหมดอายุใน {formatTime(timeLeft)}</span>
                </div>
              </div>

              {/* SLIP UPLOAD & EASYSLIP VERIFICATION BOX */}
              <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#2A2A3A] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-white">แนบสลิปเพื่อตรวจสอบอัตโนมัติ</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> EasySlip API
                  </span>
                </div>

                <p className="text-xs text-white/60">
                  โอนเงินเสร็จแล้ว ให้แนบรูปสลิปที่มี <strong>QR Code</strong> ระบบจะทำการตรวจสอบยอดเงินและปลดล็อกเซิร์ฟเวอร์ให้อัตโนมัติทันที
                </p>

                {/* File Dropzone / Selector */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                />

                {!slipPreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2A2A3A] hover:border-purple-500/60 rounded-xl p-6 text-center cursor-pointer transition-all bg-[#1a1a2e]/40 hover:bg-[#1a1a2e] space-y-2"
                  >
                    <UploadCloud className="w-8 h-8 mx-auto text-purple-400/70" />
                    <div>
                      <p className="text-xs font-semibold text-white">คลิกเพื่อเลือกรูปภาพสลิป</p>
                      <p className="text-[10px] text-white/40 mt-0.5">รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-purple-500/30 bg-black/40 flex items-center justify-center max-h-56 p-2">
                      <img
                        src={slipPreview}
                        alt="Slip Preview"
                        className="max-h-52 object-contain rounded-lg shadow-md"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60 truncate max-w-[200px] flex items-center gap-1.5 font-mono text-[11px]">
                        <FileImage className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        {slipFile?.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSlipFile(null);
                          setSlipPreview(null);
                          setSlipError('');
                        }}
                        className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                      >
                        ลบและเลือกใหม่
                      </button>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {slipError && (
                  <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-red-300">ตรวจสอบไม่ผ่าน:</p>
                      <p className="text-[11px] opacity-90 mt-0.5">{slipError}</p>
                    </div>
                  </div>
                )}

                {/* Submit Slip Button */}
                <button
                  type="button"
                  onClick={handleVerifySlip}
                  disabled={!slipFile || verifyingSlip}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-800 to-indigo-800 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg border border-purple-500/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifyingSlip ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
                      กำลังส่งตรวจสลิปผ่าน EasySlip...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      ตรวจสอบสลิปและยืนยันการจอง
                    </>
                  )}
                </button>
              </div>

              {/* Simulation Test Button - admin only (backend also enforces adminOnly) */}
              {isAdmin && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      await api.post('/payment/simulate-success', { bookingId: bookingState.bookingId });
                      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                      setStep('success');
                    } catch (err) {
                      console.error('Simulation pay error:', err);
                      const msg = err.response?.data?.message || 'เกิดข้อผิดพลาดในการชำระเงิน';
                      setErrorMessage(msg);
                      setStep('failed');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="text-xs text-white/30 hover:text-white/60 underline cursor-pointer"
                >
                  (โหมดทดสอบ: จำลองการชำระเงินสำเร็จโดยไม่ต้องแนบสลิป)
                </button>
              </div>
              )}

              {/* Cancel Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting || verifyingSlip}
                  className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 font-semibold text-xs transition-all disabled:opacity-40"
                >
                  ยกเลิกและกลับหน้าการจอง
                </button>
              </div>

            </div>
          </div>
        )}

        {/* STATE 3: SUCCESS */}
        {step === 'success' && (
          <div className="bg-[#1a1a2e] border border-[#059669] rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-[#052E16] border-2 border-[#059669] flex items-center justify-center text-[#6EE7B7] shadow-lg">
                <CheckCircle2 className="w-12 h-12 text-[#6EE7B7]" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">ชำระเงินและยืนยันสิทธิ์สำเร็จ!</h2>
              <p className="text-xs text-[#6EE7B7] font-semibold flex items-center justify-center gap-1">
                <ShieldCheck className="w-4 h-4" /> สลิปได้รับการตรวจสอบผ่าน EasySlip เรียบร้อย
              </p>
            </div>

            {slipSuccessData && (
              <div className="p-4 rounded-2xl bg-[#0f0f1a] border border-[#2A2A3A] text-left text-xs space-y-1.5 font-mono text-white/70">
                <div className="flex justify-between">
                  <span className="text-white/40">Transaction Ref:</span>
                  <span className="text-purple-300 font-bold">{slipSuccessData.transRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">ยอดเงินที่ตรวจสอบ:</span>
                  <span className="text-emerald-400 font-bold">฿{Number(slipSuccessData.amount).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate('/my-bookings')}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
              >
                ดูรายการจองเซิร์ฟเวอร์ของฉัน (My Bookings)
              </button>
              <span className="text-[11px] text-white/40">
                กำลังพาท่านไปหน้าการจองอัตโนมัติในไม่กี่วินาที...
              </span>
            </div>
          </div>
        )}

        {/* STATE 4: FAILED */}
        {step === 'failed' && (
          <div className="bg-[#1a1a2e] border border-[#DC2626] rounded-3xl p-10 text-center space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-[#450A0A] border-2 border-[#DC2626] flex items-center justify-center text-[#FCA5A5]">
                <XCircle className="w-12 h-12 text-[#FCA5A5]" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">ชำระเงินไม่สำเร็จ</h2>
              <p className="text-sm text-[#FCA5A5]">{errorMessage || 'เกิดข้อผิดพลาดในการตรวจสอบรายการชำระเงิน'}</p>
            </div>
            <div className="pt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCreateCharge}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#4C1D95] hover:bg-[#5b21b6] border border-[#7C3AED] text-white font-bold text-sm rounded-xl transition-all shadow-lg disabled:opacity-40"
              >
                ลองใหม่อีกครั้ง
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="w-full py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/5 font-semibold text-xs transition-all"
              >
                กลับหน้าหลัก
              </button>
            </div>
          </div>
        )}

        {/* STATE 5: EXPIRED */}
        {step === 'expired' && (
          <div className="bg-[#1a1a2e] border border-amber-500/50 rounded-3xl p-10 text-center space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-amber-950/50 border-2 border-amber-500 flex items-center justify-center text-amber-300">
                <Clock className="w-12 h-12 text-amber-300" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">หมดเวลาการชำระเงิน (15 นาที)</h2>
              <p className="text-sm text-white/50">
                สิทธิ์การจองช่วงเวลานี้ได้ถูกปลดล็อกกลับไปเป็นสถานะว่างแล้ว เพื่อเปิดโอกาสให้ผู้ใช้อื่นจองได้
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="w-full py-3.5 bg-gradient-to-r from-purple-800 to-indigo-800 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg"
              >
                กลับไปเลือกช่วงเวลาใหม่
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Payment;
