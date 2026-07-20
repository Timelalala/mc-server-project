import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { Check, X, FileText, Calendar, DollarSign, User } from 'lucide-react';
import api from '../../utils/api';

const SlipVerify = ({ isOpen, onClose, payment, onStatusUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!payment) return null;

  const handleVerify = async (status) => {
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/admin/payments/${payment.id}`, { status });
      onStatusUpdate(payment.id, status);
      onClose();
    } catch (err) {
      console.error('Verify payment failed:', err);
      setError(err.response?.data?.message || 'Failed to update payment status.');
    } finally {
      setLoading(false);
    }
  };

  const imageSrc = `http://localhost:5000/uploads/${payment.slip_file}`;

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ตรวจสอบสลิปการโอนเงิน" className="max-w-2xl">
      {error && (
        <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slip Image Panel */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-muted uppercase">รูปภาพสลิป</span>
          <div className="bg-bg-input border border-border-default rounded-xl overflow-hidden flex items-center justify-center max-h-[350px] relative group">
            <img
              src={imageSrc}
              alt="Payment Slip"
              className="object-contain max-h-[350px] w-full hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?q=80&w=300&auto=format&fit=crop"; // Placeholder fallback
              }}
            />
          </div>
        </div>

        {/* Info Panel */}
        <div className="flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-text-muted uppercase border-b border-border-subtle pb-2">รายละเอียดการทำรายการ</h4>
            
            {/* User */}
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-primary-text mt-0.5" />
              <div>
                <p className="text-xs text-text-muted font-medium">ผู้ทำรายการ</p>
                <p className="text-sm text-text-heading font-semibold mt-0.5">{payment.username}</p>
                <p className="text-xs text-text-muted">{payment.email}</p>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-primary-text mt-0.5" />
              <div>
                <p className="text-xs text-text-muted font-medium">ยอดเงินที่ชำระ</p>
                <p className="text-base text-success-text font-extrabold mt-0.5">฿{payment.amount}</p>
              </div>
            </div>

            {/* Server Details */}
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary-text mt-0.5" />
              <div>
                <p className="text-xs text-text-muted font-medium">จองเซิร์ฟเวอร์</p>
                <p className="text-sm text-text-heading font-semibold mt-0.5">{payment.server_name}</p>
              </div>
            </div>

            {/* Time slot */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-primary-text mt-0.5" />
              <div>
                <p className="text-xs text-text-muted font-medium">วันที่และเวลาจอง</p>
                <p className="text-sm text-text-heading font-semibold mt-0.5">
                  {new Date(payment.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-primary-text mt-0.5">
                  {formatTime(payment.time_start)} - {formatTime(payment.time_end)} น.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-6 border-t border-border-subtle mt-6 md:mt-0">
            <Button
              variant="danger"
              className="flex-1 flex items-center justify-center gap-2"
              onClick={() => handleVerify('cancelled')}
              loading={loading}
              disabled={payment.status !== 'pending'}
            >
              <X className="w-4 h-4" />
              <span>ปฏิเสธสลิป</span>
            </Button>
            <Button
              variant="success"
              className="flex-1 flex items-center justify-center gap-2"
              onClick={() => handleVerify('confirmed')}
              loading={loading}
              disabled={payment.status !== 'pending'}
            >
              <Check className="w-4 h-4" />
              <span>อนุมัติรายการ</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SlipVerify;
