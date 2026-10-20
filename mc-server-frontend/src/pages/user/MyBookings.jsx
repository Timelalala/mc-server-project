import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { Copy, Check, Clock, Users } from 'lucide-react';
import { getSocket } from '../../hooks/useServerStatus';

const REFRESH_MS = 20000; // ask the backend for new slot status every 20 s

const fmtDateTime = (d) =>
  d.toLocaleString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

const fmtTime = (d) =>
  d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

// ตรวจสอบว่า d1 และ d2 เป็นวันเดียวกันหรือไม่
const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

// จัดรูปแบบช่วงเวลาการจอง: ถ้าหลายวัน/คนละวัน ให้แสดงทั้งวันเริ่มต้นและวันสิ้นสุดชัดเจน
const fmtBookingPeriod = (start, end) => {
  if (!start && !end) return '-';
  if (!start) return `ถึง ${fmtDateTime(end)} น.`;
  if (!end) return `${fmtDateTime(start)} น.`;

  if (isSameDay(start, end)) {
    return `${fmtDateTime(start)} ถึง ${fmtTime(end)} น.`;
  }
  return `${fmtDateTime(start)} ถึง ${fmtDateTime(end)} น.`;
};

const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

// เขียว > 10 นาที, เหลือง <= 10, แดง <= 5
const getBarColor = (minsLeft) => {
  if (minsLeft <= 5) return '#DC2626'; // แดง
  if (minsLeft <= 10) return '#D97706'; // เหลือง
  return '#059669'; // เขียว
};

const PlayerNames = ({ names, emptyText, isOnline = false }) => {
  if (!names || names.length === 0) {
    return <p className="text-xs text-white/40 mt-1.5">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {names.map((n) => (
        <span
          key={n}
          className={`font-mono text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
            isOnline
              ? 'bg-[#2d1b69] border-[#7C3AED]/40 text-[#A78BFA]'
              : 'bg-[#1a1a2e] border-[#2A2A3A] text-white/70'
          }`}
        >
          {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />}
          {n}
        </span>
      ))}
    </div>
  );
};

const BookingCard = ({ b, now, copyIp, copiedId, fetchBookingStatus }) => {
  const [isExpired, setIsExpired] = useState(false);
  const start = b.start_time ? new Date(b.start_time) : null;
  const end = b.end_time ? new Date(b.end_time) : null;
  const slot = b.slot_status || 'waiting';

  const remainingTime = end ? end.getTime() - now : 0;

  useEffect(() => {
    if (remainingTime <= 0) {
      // ซ่อนข้อมูล IP หรือสั่ง refresh ข้อมูลสถานะใหม่จากเซิร์ฟเวอร์
      setIsExpired(true);
      fetchBookingStatus();
    }
  }, [remainingTime, fetchBookingStatus]);

  const hasEnded = slot === 'ended' || (slot === 'started' && (isExpired || remainingTime <= 0));
  const isConfirmed = b.status === 'confirmed';

  let badgeText = 'รอยืนยัน';
  let badgeStyle = 'bg-[#78350F] border-[#D97706] text-[#FDE68A]'; // สีเหลืองอำพัน

  if (isConfirmed) {
    if (hasEnded) {
      badgeText = 'จบแล้ว';
      badgeStyle = 'bg-[#0f0f1a] border-[#2A2A3A] text-white/50'; // สีเทา
    } else if (slot === 'started') {
      badgeText = 'กำลังเล่น';
      badgeStyle = 'bg-[#052E16] border-[#059669] text-[#6EE7B7]'; // สีเขียว
    } else {
      if (remainingTime <= 0) {
        badgeText = 'หมดเวลา';
        badgeStyle = 'bg-[#0f0f1a] border-[#2A2A3A] text-white/50'; // สีเทา
      } else {
        badgeText = 'รอเริ่ม';
        badgeStyle = 'bg-[#78350F] border-[#D97706] text-[#FDE68A]'; // สีเหลืองอำพัน
      }
    }
  } else {
    if (remainingTime <= 0) {
      badgeText = 'หมดเวลา';
      badgeStyle = 'bg-[#0f0f1a] border-[#2A2A3A] text-white/50'; // สีเทา
    } else {
      badgeText = 'รอยืนยัน';
      badgeStyle = 'bg-[#78350F] border-[#D97706] text-[#FDE68A]'; // สีเหลืองอำพัน
    }
  }

  const renderConnectionBox = () => {
    // 1. สถานะ: กำลังเล่น (started) และยังไม่หมดเวลา
    if (slot === 'started' && b.ip && !hasEnded) {
      const totalMinutes = start && end ? Math.max(1, (end - start) / 60000) : 1;
      const leftMinutes = end ? Math.max(0, Math.ceil(remainingTime / 60000)) : 0;
      const barColor = getBarColor(leftMinutes);

      return (
        <div className="space-y-4">
          {/* กล่องการเชื่อมต่อ (กรอบสีเขียวเด่น) */}
          <div className="bg-[#0f0f1a] border-2 border-[#059669] rounded-xl p-5 sm:p-6 shadow-lg shadow-[#059669]/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-white/50 block">ที่อยู่สำหรับเข้าเล่น</span>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-wider break-all block mt-0.5">
                  {b.ip}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyIp(b.ip, b.id)}
                className="self-start sm:self-center bg-[#7C3AED]/20 hover:bg-[#7C3AED]/35 text-[#A78BFA] border border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#A78BFA] focus:ring-offset-2 focus:ring-offset-[#0f0f1a] px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {copiedId === b.id ? <Check size={16} className="text-[#10B981]" /> : <Copy size={16} />}
                {copiedId === b.id ? 'คัดลอกแล้ว' : 'คัดลอก IP ส่งให้เพื่อน'}
              </button>
            </div>

            <p className="text-xs text-white/60">
              {b.mod_name
                ? `ใช้ Minecraft Java ${b.mc_version || ''} พร้อมติดตั้ง ${b.mod_name}${b.mod_version ? ` ${b.mod_version}` : ''} ไม่ต้องใส่พอร์ต`
                : b.mc_version
                ? `ใช้ Minecraft Java เวอร์ชัน ${b.mc_version} ไม่ต้องใส่พอร์ต`
                : 'ใช้ Minecraft Java เวอร์ชัน 26.3 ไม่ต้องใส่พอร์ต'}
            </p>

            {/* แถบเวลาที่เหลือ */}
            <div className="pt-2 border-t border-[#2A2A3A]">
              <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                <span className="flex items-center gap-1.5 font-medium text-white/80">
                  <Clock size={14} className="text-[#A78BFA]" />
                  เหลือเวลา <strong className="text-white text-sm ml-0.5">{leftMinutes} นาที</strong>
                </span>
                <span>
                  จบ {end ? (start && !isSameDay(start, end) ? `${fmtDateTime(end)} น.` : `${fmtTime(end)} น.`) : '-'}
                </span>
              </div>
              <div
                className="h-2.5 rounded-full bg-[#2A2A3A] overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={Math.round(totalMinutes)}
                aria-valuenow={leftMinutes}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (leftMinutes / totalMinutes) * 100)}%`,
                    backgroundColor: barColor
                  }}
                />
              </div>
            </div>
          </div>

          {/* ส่วน "ใครเข้าเล่นได้บ้าง" */}
          <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-[#A78BFA]" />
                ใครเข้าเล่นได้บ้าง
              </h4>
              <span className="text-xs text-white/60">
                กำลังเล่น {(b.online_players || []).length} คน จากที่รับได้ 20 คน
              </span>
            </div>
            <PlayerNames
              names={b.online_players}
              emptyText="ยังไม่มีใครเข้ามา"
              isOnline={true}
            />
            <p className="text-xs text-white/40 pt-1">
              อัปเดตทุกนาที ใครมี IP นี้เข้าเล่นได้ อย่าแชร์ในที่สาธารณะ
            </p>
          </div>
        </div>
      );
    }

    // 2. สถานะ: จบแล้ว (ended) หรือ หมดเวลาแล้ว
    if (hasEnded) {
      return (
        <div className="space-y-4">
          <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl p-5 sm:p-6 space-y-2">
            <p className="text-sm font-semibold text-white">
              รอบนี้จบแล้ว IP ของรอบนี้ถูกคืนแล้ว ใช้เข้าเล่นไม่ได้อีก
            </p>
            <p className="text-xs text-white/50">
              โลกของคุณถูกบันทึกไว้ จองรอบหน้าจะเจอของเดิม
            </p>
          </div>

          {/* ส่วน "ใครเข้าเล่นได้บ้าง" */}
          <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl p-4 sm:p-5 space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-[#A78BFA]" />
              ใครเข้าเล่นได้บ้าง
            </h4>
            <p className="text-xs text-white/60">คนที่เข้ามาเล่นในรอบนี้</p>
            <PlayerNames
              names={b.seen_players}
              emptyText="ไม่มีใครเข้ามาเล่นในรอบนี้"
              isOnline={false}
            />
          </div>
        </div>
      );
    }

    // 3. สถานะ: รอเริ่ม (waiting) หรือ หมดเวลา
    const startsIn = start ? start.getTime() - now : null;
    const isSlotExpired = end ? remainingTime <= 0 : false;

    return (
      <div className="space-y-4">
        {/* กล่องการเชื่อมต่อ (รอเริ่ม หรือ หมดเวลา) */}
        <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl p-6 text-center space-y-3">
          {isSlotExpired ? (
            <p className="text-sm sm:text-base font-semibold text-white/80">
              รอบนี้หมดเวลาแล้วโดยที่ server ไม่ได้เปิด กรุณาติดต่อแอดมิน
            </p>
          ) : startsIn !== null && startsIn > 0 ? (
            <>
              <span className="text-xs font-semibold text-white/50 block">เริ่มในอีก</span>
              <div className="font-mono text-3xl sm:text-5xl font-extrabold text-white tracking-widest my-2">
                {fmtCountdown(startsIn)}
              </div>
              <p className="text-xs sm:text-sm text-white/70">
                IP สำหรับเข้าเล่นจะขึ้นเมื่อถึงเวลาเริ่ม
              </p>
            </>
          ) : (
            <>
              <p className="text-base sm:text-lg font-bold text-[#6EE7B7] animate-pulse">
                กำลังเปิด server ให้คุณ รอสักครู่
              </p>
              <p className="text-xs sm:text-sm text-white/80">
                {Number(b.server_id) === 2
                  ? 'ใช้เวลาประมาณ 2-3 นาที เพราะ server มีมอดจำนวนมาก'
                  : 'ใช้เวลาประมาณ 30 วินาที'}
              </p>
              <p className="text-xs sm:text-sm text-white/70">
                IP สำหรับเข้าเล่นจะขึ้นเมื่อถึงเวลาเริ่ม
              </p>
            </>
          )}
        </div>

        {/* ส่วน "ใครเข้าเล่นได้บ้าง" (ซ่อนเมื่อหมดเวลา) */}
        {!isSlotExpired && (
          <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl p-4 sm:p-5 space-y-1.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-[#A78BFA]" />
              ใครเข้าเล่นได้บ้าง
            </h4>
            <p className="text-xs text-white/60 leading-relaxed">
              ระบบสร้าง IP ใหม่ให้การจองนี้โดยเฉพาะ ส่ง IP ให้เพื่อนเข้ามาเล่นด้วยได้ ไม่ต้องลงชื่อล่วงหน้า
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`bg-[#1a1a2e] rounded-2xl p-5 sm:p-6 border transition-all ${
        slot === 'started' && !hasEnded
          ? 'border-[#059669]/60 shadow-lg shadow-[#059669]/5'
          : 'border-[#2A2A3A]'
      }`}
    >
      {/* Header การ์ด: ชื่อ Server, วันเวลา, ป้ายสถานะ */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2A2A3A] pb-4 mb-5">
        <div>
          <h3 className="text-xl font-bold text-white">{b.server_name}</h3>
          <p className="text-xs text-white/50 mt-1">
            {fmtBookingPeriod(start, end)}
          </p>
        </div>
        <span className={`border text-xs px-3 py-1 rounded-full font-bold tracking-wide ${badgeStyle}`}>
          {badgeText}
        </span>
      </div>

      {isConfirmed ? (
        renderConnectionBox()
      ) : remainingTime <= 0 ? (
        <div className="bg-[#0f0f1a] border border-[#2A2A3A] p-5 sm:p-6 rounded-xl text-center space-y-1.5">
          <p className="text-sm sm:text-base font-semibold text-white/80">
            เลยเวลาจองแล้ว การจองนี้ยังไม่ได้รับการยืนยัน
          </p>
        </div>
      ) : (
        <div className="bg-[#78350F]/20 border border-[#D97706]/40 p-5 rounded-xl text-center space-y-1.5">
          <p className="text-sm font-bold text-[#FDE68A]">กำลังรอแอดมินยืนยันการชำระเงิน</p>
          <p className="text-xs text-white/50">
            เมื่อยืนยันแล้ว ระบบจะแสดงเวลานับถอยหลัง และ IP จะขึ้นเมื่อถึงเวลาเริ่ม
          </p>
        </div>
      )}
    </div>
  );
};

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const fetchBookings = useCallback(async () => {
    try {
      const res = await api.get('/bookings/my');
      const list = Array.isArray(res.data) ? res.data : [];
      // ซ่อนรายการที่ลูกค้ายกเลิก/หมดอายุการชำระเงินออกเด็ดขาด
      const HIDDEN = ['cancelled', 'expired'];
      setBookings(list.filter(b => !HIDDEN.includes(b.status) && !HIDDEN.includes(b.payment_status)));
      setError('');
    } catch (err) {
      setError('โหลดรายการจองไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง');
    } finally {
      setLoading(false);
    }
  }, []);

  // Alias สำหรับเรียกฟังก์ชันรีเฟรชสถานะการจอง
  const fetchBookingStatus = fetchBookings;

  useEffect(() => {
    fetchBookings();
    const poll = setInterval(fetchBookings, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);

    // รับอีเวนต์แจ้งเตือนสถานะการจองเปลี่ยนจาก Socket.IO
    const s = getSocket();
    const handleStatusUpdate = () => {
      fetchBookings();
    };
    s.on('booking_status_updated', handleStatusUpdate);

    return () => {
      clearInterval(poll);
      clearInterval(tick);
      s.off('booking_status_updated', handleStatusUpdate);
    };
  }, [fetchBookings]);

  const copyIp = async (ip, id) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      setCopiedId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#E0E0E0]">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">การจองของฉัน</h1>
        <p className="text-sm text-white/60">IP สำหรับเข้าเล่นจะขึ้นเมื่อถึงเวลาเริ่ม ส่งให้เพื่อนเข้ามาเล่นด้วยได้</p>
      </div>

      {error && (
        <div className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-sm p-4 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-12 text-center text-white/50 text-sm">
          ยังไม่มีรายการจอง เลือกเวลาที่ว่างในหน้าจองเซิร์ฟเวอร์ได้เลย
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((b) => (
            <BookingCard
              key={b.id}
              b={b}
              now={now}
              copyIp={copyIp}
              copiedId={copiedId}
              fetchBookingStatus={fetchBookingStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
