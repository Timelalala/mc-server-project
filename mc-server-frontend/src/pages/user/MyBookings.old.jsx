import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Card, Badge, Button, Table } from '../../components/ui';
import ShareModal from '../../components/user/ShareModal';
import { Copy, Share2, Check, Lock, Calendar, Server, Clock } from 'lucide-react';

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedStates, setCopiedStates] = useState({});

  const mockBookings = [
    {
      id: 1,
      server_name: 'Server A',
      date: '16 มิ.ย. 2026',
      time_slot: '14:00 - 16:00 น.',
      status: 'confirmed',
      ip: '192.168.1.101',
      port: '25565',
      password: 'mc-secret-pass-99'
    },
    {
      id: 2,
      server_name: 'Server B',
      date: '17 มิ.ย. 2026',
      time_slot: '18:00 - 20:00 น.',
      status: 'pending',
      ip: '-',
      port: '-',
      password: '-'
    }
  ];

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get('/bookings/my');
        if (res.data && res.data.length > 0) {
          setBookings(res.data);
        } else {
          setBookings(mockBookings);
        }
      } catch (err) {
        setBookings(mockBookings);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">การจองของฉัน</h1>
        <p className="text-sm text-white/60">รายการจองทั้งหมด — แชร์ให้เพื่อนเข้าเล่นด้วยกันได้เลย</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <Card className="bg-[#1a1a2e] border border-[#2A2A3A] p-12 text-center text-white/50 text-sm">
          ยังไม่มีรายการจองในขณะนี้
        </Card>
      ) : (
        <div className="space-y-6">
          {bookings.map((b) => {
            const isConfirmed = b.status === 'confirmed';

            return (
              <div
                key={b.id}
                className={`bg-[#1a1a2e] rounded-2xl p-6 border shadow-xl transition-all ${
                  isConfirmed ? 'border-[#059669]' : 'border-[#D97706]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2A2A3A] pb-4 mb-5">
                  <div>
                    <h3 className="text-xl font-bold text-white">{b.server_name}</h3>
                    <p className="text-xs text-white/50 mt-1">
                      วันที่ {b.date || b.created_at} • {b.time_slot || `${b.time_start} - ${b.time_end}`}
                    </p>
                  </div>

                  <div>
                    {isConfirmed ? (
                      <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-3.5 py-1 rounded-full font-bold">
                        ยืนยันแล้ว
                      </span>
                    ) : (
                      <span className="bg-[#78350F] border border-[#D97706] text-[#FDE68A] text-xs px-3.5 py-1 rounded-full font-bold">
                        รอยืนยัน
                      </span>
                    )}
                  </div>
                </div>

                {isConfirmed ? (
                  <div className="space-y-3 bg-[#0f0f1a] border border-[#2A2A3A] p-5 rounded-xl font-mono text-sm">
                    {/* IP */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 font-sans text-xs">IP Address:</span>
                        <span className="text-white font-bold">{b.ip}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(b.ip, `ip-${b.id}`)}
                        className="bg-[#2d1b69] border border-purple-500/30 hover:bg-[#4C1D95] text-white text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-sans"
                      >
                        {copiedStates[`ip-${b.id}`] ? '✓ คัดลอกแล้ว' : '📋 Copy'}
                      </button>
                    </div>

                    {/* Port */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 font-sans text-xs">Port:</span>
                        <span className="text-white font-bold">{b.port}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(String(b.port), `port-${b.id}`)}
                        className="bg-[#2d1b69] border border-purple-500/30 hover:bg-[#4C1D95] text-white text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-sans"
                      >
                        {copiedStates[`port-${b.id}`] ? '✓ คัดลอกแล้ว' : '📋 Copy'}
                      </button>
                    </div>

                    {/* Password */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 font-sans text-xs">Password:</span>
                        <span className="text-[#A78BFA] font-bold">{b.password}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(b.password, `pw-${b.id}`)}
                        className="bg-[#2d1b69] border border-purple-500/30 hover:bg-[#4C1D95] text-white text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-sans"
                      >
                        {copiedStates[`pw-${b.id}`] ? '✓ คัดลอกแล้ว' : '📋 Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#78350F]/20 border border-[#D97706]/40 p-4 rounded-xl text-center space-y-1">
                    <p className="text-sm font-bold text-[#FDE68A]">⏳ กำลังรอแอดมินยืนยันการชำระเงิน</p>
                    <p className="text-xs text-white/50">
                      เมื่อแอดมินอนุมัติสลิปโอนเงินแล้ว ข้อมูล IP Address, Port และ Password จะแสดงที่นี่ทันที
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
