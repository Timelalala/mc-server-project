import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Table, Badge, Card, Button } from '../../components/ui';
import SlipVerify from '../../components/admin/SlipVerify';
import { BookOpen, Calendar, Mail, FileImage, User, ShieldAlert } from 'lucide-react';

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [error, setError] = useState(null);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/admin/bookings');
      setBookings(res.data);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setError('ไม่สามารถเรียกข้อมูลประวัติการจองทั้งหมดได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleVerifyOpen = (booking) => {
    setSelectedPayment(booking);
    setVerifyOpen(true);
  };

  const handleStatusUpdate = (bookingId, newStatus) => {
    setBookings(prev =>
      prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b)
    );
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  const getStatusBadge = (status) => {
    const labels = {
      pending: 'รอแอดมินยืนยัน',
      confirmed: 'อนุมัติแล้ว',
      cancelled: 'ยกเลิกรายการ'
    };
    return <Badge status={status}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-text-heading">ประวัติการจองทั้งหมด (Booking Archives)</h1>
        <p className="text-xs text-text-muted mt-1">บันทึกข้อมูลและตรวจสอบสถานะการจองเซิร์ฟเวอร์ Minecraft ของสมาชิกทุกคน</p>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3.5 rounded-xl text-xs flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <Card className="h-64 bg-bg-surface border border-border-default rounded-xl animate-pulse" />
      ) : bookings.length === 0 ? (
        <Card className="p-12 text-center text-text-muted text-sm border border-dashed border-border-default">
          ไม่มีประวัติการจองของสมาชิกในขณะนี้
        </Card>
      ) : (
        <Table headers={['ID', 'ผู้จอง', 'เซิร์ฟเวอร์', 'วันที่ & เวลาการใช้งาน', 'ยอดชำระ', 'สถานะ', 'สลิปโอนเงิน']}>
          {bookings.map((booking) => (
            <tr key={booking.id} className="hover:bg-bg-app/30 transition-colors">
              <td className="px-6 py-4.5 font-bold font-mono text-text-muted">{booking.id}</td>
              <td className="px-6 py-4.5">
                <div className="flex flex-col">
                  <span className="font-semibold text-text-heading flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-primary-text" />
                    {booking.username}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-text-muted" />
                    {booking.email}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4.5 font-bold text-text-heading">{booking.server_name}</td>
              <td className="px-6 py-4.5 font-medium text-text-body">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-primary-text" />
                    {new Date(booking.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-primary-text mt-0.5 font-bold">
                    {formatTime(booking.time_start)} - {formatTime(booking.time_end)} น.
                  </span>
                </div>
              </td>
              <td className="px-6 py-4.5 font-extrabold text-success-text">฿{booking.amount}</td>
              <td className="px-6 py-4.5">{getStatusBadge(booking.status)}</td>
              <td className="px-6 py-4.5">
                <Button
                  variant="outline"
                  className="px-2.5 py-1.5 text-xs flex items-center gap-1"
                  onClick={() => handleVerifyOpen(booking)}
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>ดูภาพสลิป</span>
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Slip Verify Modal */}
      <SlipVerify
        isOpen={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        payment={selectedPayment}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  );
};

export default Bookings;
