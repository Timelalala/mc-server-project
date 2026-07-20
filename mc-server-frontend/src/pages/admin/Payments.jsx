import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Table, Badge, Button, Card, Modal } from '../../components/ui';
import SlipVerify from '../../components/admin/SlipVerify';
import { CreditCard, FileImage, ShieldAlert, CheckCircle, Mail, User } from 'lucide-react';

const Payments = () => {
  const mockPendingPayments = [
    {
      id: 1,
      username: 'steve99',
      server_name: 'Server A',
      time_slot: '14:00 - 16:00',
      date: '16 มิ.ย. 2026',
      amount: '50 บาท',
      slip_url: '/qr-promptpay.png'
    },
    {
      id: 2,
      username: 'alex_crafter',
      server_name: 'Server B',
      time_slot: '18:00 - 20:00',
      date: '17 มิ.ย. 2026',
      amount: '50 บาท',
      slip_url: '/qr-promptpay.png'
    }
  ];

  const [payments, setPayments] = useState(mockPendingPayments);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const handleOpenModal = (p) => {
    setSelectedPayment(p);
    setIsModalOpen(true);
  };

  const handleAction = async (action) => {
    if (!selectedPayment) return;

    try {
      await api.patch(`/admin/payments/${selectedPayment.id}`, { action });
    } catch (err) {
      // Ignore API fail for demo
    }

    setPayments((prev) => prev.filter((p) => p.id !== selectedPayment.id));
    setMsg(
      action === 'approve'
        ? `อนุมัติสลิปของ ${selectedPayment.username} เรียบร้อยแล้ว`
        : `ปฏิเสธสลิปของ ${selectedPayment.username} เรียบร้อยแล้ว`
    );
    setIsModalOpen(false);
    setSelectedPayment(null);
  };

  return (
    <div className="space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-wide">ยืนยันชำระเงิน (Payments)</h1>
        <p className="text-sm text-white/60">ตรวจสอบและยืนยันสลิปการโอนเงินของผู้จอง</p>
      </div>

      {msg && (
        <div className="bg-[#052E16] border border-[#059669] rounded-xl p-3.5 text-xs text-[#6EE7B7]">
          {msg}
        </div>
      )}

      {/* Payments Table / Cards */}
      <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white border-b border-[#2A2A3A] pb-3">
          รายการรอยืนยัน (Pending Payments)
        </h3>

        {payments.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">
            ไม่มีรายการสลิปรอยืนยันในขณะนี้
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#E0E0E0]">
              <thead className="bg-[#0f0f1a] text-xs uppercase text-white/50 border-b border-[#2A2A3A]">
                <tr>
                  <th className="p-3.5">ชื่อผู้จอง</th>
                  <th className="p-3.5">Server</th>
                  <th className="p-3.5">เวลาที่จอง</th>
                  <th className="p-3.5">ยอดเงิน</th>
                  <th className="p-3.5 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A3A]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#251559]/30 transition-colors">
                    <td className="p-3.5 font-bold text-white">{p.username}</td>
                    <td className="p-3.5 text-[#A78BFA] font-semibold">{p.server_name}</td>
                    <td className="p-3.5 text-xs">
                      {p.date} ({p.time_slot})
                    </td>
                    <td className="p-3.5 font-bold text-[#6EE7B7]">{p.amount}</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleOpenModal(p)}
                        className="bg-[#4C1D95] hover:bg-[#5b21b6] border border-[#7C3AED] text-white text-xs px-4 py-1.5 rounded-lg transition-all font-bold"
                      >
                        🖼 ดูสลิป
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal View Slip */}
      {selectedPayment && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`ตรวจสอบสลิป - ${selectedPayment.username}`}
          className="bg-[#1a1a2e] border-[#2A2A3A]"
        >
          <div className="space-y-6 text-[#E0E0E0]">
            <div className="bg-[#0f0f1a] border border-[#2A2A3A] p-4 rounded-xl flex items-center justify-center">
              <img
                src={selectedPayment.slip_url}
                alt="Slip"
                className="max-h-72 object-contain rounded-lg"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="250" viewBox="0 0 200 250"><rect width="200" height="250" fill="%230f0f1a"/><text x="100" y="120" fill="white" font-size="16" text-anchor="middle">SLIP IMAGE</text><text x="100" y="150" fill="%236EE7B7" font-size="14" text-anchor="middle">50 THB</text></svg>';
                }}
              />
            </div>

            <div className="bg-[#0f0f1a] border border-[#2A2A3A] p-4 rounded-xl space-y-1 text-xs">
              <p><span className="text-white/50">ผู้จอง:</span> <strong className="text-white">{selectedPayment.username}</strong></p>
              <p><span className="text-white/50">เซิร์ฟเวอร์:</span> <strong className="text-[#A78BFA]">{selectedPayment.server_name}</strong></p>
              <p><span className="text-white/50">วันและช่วงเวลา:</span> {selectedPayment.date} ({selectedPayment.time_slot})</p>
              <p><span className="text-white/50">ยอดชำระ:</span> <strong className="text-[#6EE7B7]">{selectedPayment.amount}</strong></p>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleAction('approve')}
                className="flex-1 bg-[#052E16] hover:bg-[#059669] border border-[#059669] text-[#6EE7B7] hover:text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg"
              >
                ✓ อนุมัติ
              </button>

              <button
                onClick={() => handleAction('reject')}
                className="flex-1 bg-[#450A0A] hover:bg-[#DC2626] border border-[#DC2626] text-[#FCA5A5] hover:text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg"
              >
                ✕ ปฏิเสธ
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Payments;
