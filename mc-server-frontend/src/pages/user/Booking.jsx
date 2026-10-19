import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { Card } from '../../components/ui';

const PRICE = {
  timeslot: 50,   // ฿50 ต่อช่อง (2 ชั่วโมง)
  fullday: 200,   // ฿200 ต่อวัน (00:00–23:59)
  multiday: 180,  // ฿180 ต่อวัน (ประหยัดกว่า fullday)
};

const MOCK_SLOTS = [
  { id: 1, time: '08:00-10:00', status: 'available' },
  { id: 2, time: '10:00-12:00', status: 'available' },
  { id: 3, time: '13:00-15:00', status: 'available' },
  { id: 4, time: '15:00-17:00', status: 'available' },
  { id: 5, time: '17:00-19:00', status: 'available' },
  { id: 6, time: '19:00-21:00', status: 'available' },
];

const MOCK_SERVERS = [
  { id: 1, name: 'Java Survival', icon: '⛏️', edition: 'java', mc_version: '1.21' },
  { id: 2, name: 'RLCraft', icon: '💀', edition: 'java', mc_version: '1.12.2' },
  { id: 3, name: 'RL Dregora', icon: '🐉', edition: 'java', mc_version: '1.12.2' },
  { id: 4, name: 'Pixelmon', icon: '⚡', edition: 'java', mc_version: '1.16.5' },
];

// Helper to generate next N days
const generateDays = (count) => {
  const result = [];
  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    result.push({
      label: `${days[d.getDay()]}.${d.getDate()} ${months[d.getMonth()]}`,
      dateNum: d.getDate(),
      dayName: days[d.getDay()],
      monthName: months[d.getMonth()],
      value: isoDate,
      fullLabel: `${d.getDate()} ${months[d.getMonth()]} ${yyyy}`
    });
  }
  return result;
};

// จัดรูปแบบช่วงวันที่แบบหลายวันให้ระบุวันที่เริ่มถึงสิ้นสุดอย่างชัดเจน เช่น "วันที่ 19 ถึง 21 ต.ค. (3 วัน)"
const fmtDateRangeText = (startDateStr, endDateStr, daysList, count) => {
  const startObj = daysList.find(d => d.value === startDateStr);
  const endObj = daysList.find(d => d.value === endDateStr);
  if (!startObj || !endObj) return `${startDateStr} ถึง ${endDateStr} (${count} วัน)`;

  if (startObj.value === endObj.value) {
    return `วันที่ ${startObj.dateNum} ${startObj.monthName} (1 วัน)`;
  }

  if (startObj.monthName === endObj.monthName) {
    return `วันที่ ${startObj.dateNum} ถึง ${endObj.dateNum} ${startObj.monthName} (${count} วัน)`;
  }

  return `วันที่ ${startObj.dateNum} ${startObj.monthName} ถึง ${endObj.dateNum} ${endObj.monthName} (${count} วัน)`;
};

const Booking = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Mode state: 'timeslot' | 'fullday' | 'multiday'
  const [bookingMode, setBookingMode] = useState('timeslot');

  // Server selection
  const serverIdFromUrl = params.get('server') || params.get('serverId') || '1';
  const initialServerName = params.get('name') || params.get('serverName') || 'Java Survival';

  const [servers, setServers] = useState(MOCK_SERVERS);
  const [currentServerId, setCurrentServerId] = useState(serverIdFromUrl);
  const [serverName, setServerName] = useState(initialServerName);

  // Time slot mode states
  const timeslotDays = generateDays(7);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [slots, setSlots] = useState(MOCK_SLOTS);

  // Full day mode states
  const fulldayDays = generateDays(14);
  const [fullDayDate, setFullDayDate] = useState(fulldayDays[0].value);

  // Multi day mode states
  const multidayDays = generateDays(14);
  const [startDate, setStartDate] = useState(multidayDays[0].value);
  const [endDate, setEndDate] = useState(multidayDays[2].value);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullBookedDates, setFullBookedDates] = useState([]);
  const [ongoingConfirmSlot, setOngoingConfirmSlot] = useState(null);

  // ดึงรายการวันที่ถูกจองเต็มทั้งวันเพื่อบล็อกในโหมด fullday และ multiday
  useEffect(() => {
    api.get(`/servers/busy-dates?serverId=${currentServerId}`)
      .then(res => {
        if (res.data?.fullBookedDates) {
          setFullBookedDates(res.data.fullBookedDates);
        }
      })
      .catch(() => {});
  }, [currentServerId]);

  // Computed fields
  const selectedDateObj = timeslotDays[selectedDateIndex] || timeslotDays[0];
  const sortedSlots = [...selectedSlots].sort((a, b) => a.id - b.id);

  // คำนวณ validEndDates ในโหมด multiday:
  // กติกา: ตัวเลือกจองหลายวันไม่แสดงวันที่ข้ามวันเต็ม (วัน N+2 เต็มแล้วตัวเลือกจากวัน N หยุดที่ N+1)
  const calculateValidEndDates = () => {
    const list = [];
    const startIndex = multidayDays.findIndex(d => d.value === startDate);
    if (startIndex === -1) return multidayDays.filter(d => d.value >= startDate);

    for (let i = startIndex; i < multidayDays.length; i++) {
      const day = multidayDays[i];
      // หากวันนั้นเต็มทั้งวัน ให้หยุดทันที ไม่ให้ข้ามวันเต็ม
      if (fullBookedDates.includes(day.value)) {
        break;
      }
      list.push(day);
    }
    return list.length > 0 ? list : [multidayDays[startIndex]];
  };

  const validEndDates = calculateValidEndDates();

  // ปรับ endDate อัตโนมัติเมื่อ validEndDates เปลี่ยนและ endDate เดิมอยู่นอกช่วง
  useEffect(() => {
    if (validEndDates.length > 0 && !validEndDates.some(d => d.value === endDate)) {
      setEndDate(validEndDates[validEndDates.length - 1].value);
    }
  }, [startDate, fullBookedDates]);

  // Multi day days count calculation
  const multiDayCount = Math.max(
    1,
    Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1
  );

  // Total price calculation per mode
  let totalPrice = 0;
  let totalHours = 0;
  let timeSummary = '';

  if (bookingMode === 'timeslot') {
    totalPrice = selectedSlots.length * PRICE.timeslot;
    totalHours = selectedSlots.length * 2;
    timeSummary = sortedSlots.map(s => s.time).join(', ');
  } else if (bookingMode === 'fullday') {
    totalPrice = PRICE.fullday;
    totalHours = 24;
    const matchedDay = fulldayDays.find(d => d.value === fullDayDate);
    timeSummary = matchedDay ? `วันที่ ${matchedDay.dateNum} ${matchedDay.monthName} (ทั้งวัน)` : fullDayDate;
  } else if (bookingMode === 'multiday') {
    totalPrice = multiDayCount * PRICE.multiday;
    totalHours = multiDayCount * 24;
    timeSummary = fmtDateRangeText(startDate, endDate, multidayDays, multiDayCount);
  }

  // Savings callout for multiday (vs full day separately ฿200 vs ฿180 = ฿20 saved per day)
  const multiDaySavings = multiDayCount * (PRICE.fullday - PRICE.multiday);

  // Validation logic
  const canConfirm =
    (bookingMode === 'timeslot' && selectedSlots.length >= 1) ||
    (bookingMode === 'fullday' && !!fullDayDate && !fullBookedDates.includes(fullDayDate)) ||
    (bookingMode === 'multiday' && !!startDate && !!endDate && new Date(endDate) >= new Date(startDate));

  // Fetch servers list on mount
  useEffect(() => {
    api.get('/servers')
      .then(res => {
        if (res.data && res.data.length > 0) {
          setServers(res.data);
          const match = res.data.find(s => String(s.id) === String(currentServerId));
          if (match) setServerName(match.name);
        }
      })
      .catch(() => console.log('Using mock servers list'));
  }, [currentServerId]);

  // Load time slots when date or server changes in timeslot mode
  useEffect(() => {
    if (bookingMode !== 'timeslot') return;
    const date = timeslotDays[selectedDateIndex]?.value;
    if (!date) return;

    api.get(`/servers/${currentServerId}/slots?date=${date}`)
      .then(r => {
        if (r.data && Array.isArray(r.data) && r.data.length > 0) {
          const formatted = r.data.map(s => ({
            id: s.id,
            time: `${s.time_start.slice(0, 5)}-${s.time_end.slice(0, 5)}`,
            status: s.status,
            label: s.label || (s.status === 'booked' ? 'เต็มแล้ว' : s.status === 'expired' ? 'หมดเวลา' : s.status === 'too_short' ? 'เหลือน้อยกว่า 15 นาที' : s.status === 'ongoing' ? 'กำลังดำเนินอยู่' : 'ว่าง'),
            canBook: s.canBook !== undefined ? s.canBook : (s.status === 'available' || s.status === 'ongoing'),
            minutesLeft: s.minutesLeft || 0
          }));
          setSlots(formatted);
        } else {
          setSlots(MOCK_SLOTS);
        }
      })
      .catch(() => setSlots(MOCK_SLOTS));

    setSelectedSlots([]);
    setError('');
  }, [selectedDateIndex, currentServerId, bookingMode]);

  // Handle start date change in multiday mode
  const handleStartDateChange = (newStart) => {
    setStartDate(newStart);
    if (endDate < newStart) {
      setEndDate(newStart);
    }
  };

  const toggleSlot = (slot) => {
    if (
      slot.status === 'booked' ||
      slot.status === 'expired' ||
      slot.status === 'too_short' ||
      slot.status === 'reserved' ||
      slot.canBook === false
    ) {
      return;
    }

    const exists = selectedSlots.find(s => s.id === slot.id);

    // ถ้ากำลังจะเลือก slot ที่สถานะเป็น ongoing (เริ่มแล้วแต่เหลือ >= 15 นาที) ให้เปิด popup ยืนยัน
    if (!exists && slot.status === 'ongoing') {
      setOngoingConfirmSlot(slot);
      return;
    }

    setSelectedSlots(prev => {
      if (exists) return prev.filter(s => s.id !== slot.id);
      return [...prev, slot];
    });
    setError('');
  };

  const handleClearAll = () => {
    setSelectedSlots([]);
    setError('');
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setLoading(true);
    setError('');

    const body = {
      serverId: currentServerId,
      bookingType: bookingMode,
      amount: totalPrice * 100, // in satang

      ...(bookingMode === 'timeslot' ? { slotIds: sortedSlots.map(s => s.id) } : {}),
      ...(bookingMode === 'fullday' ? { startDate: fullDayDate, endDate: fullDayDate } : {}),
      ...(bookingMode === 'multiday' ? { startDate, endDate } : {}),
    };

    let summaryDisplay = '';
    if (bookingMode === 'timeslot') {
      summaryDisplay = `${selectedDateObj.label} (${timeSummary})`;
    } else if (bookingMode === 'fullday') {
      summaryDisplay = `ทั้งวัน: ${timeSummary}`;
    } else {
      summaryDisplay = `หลายวัน: ${timeSummary}`;
    }

    try {
      const res = await api.post('/bookings', body);
      navigate('/payment', {
        state: {
          bookingId: res.data?.bookingId,
          serverName,
          timeSlot: summaryDisplay,
          totalPrice,
          totalHours,
          price: totalPrice
        }
      });
    } catch (err) {
      console.error('Create booking error:', err);
      const errMsg = err.response?.data?.message || 'ช่วงเวลานี้ไม่ว่างหรือไม่สามารถจองได้ กรุณาเลือกช่วงเวลาใหม่';
      setError(errMsg);

      // Re-fetch slots to update disabled UI state
      const date = timeslotDays[selectedDateIndex]?.value;
      if (date && bookingMode === 'timeslot') {
        api.get(`/servers/${currentServerId}/slots?date=${date}`)
          .then(r => {
            if (r.data && Array.isArray(r.data) && r.data.length > 0) {
              const formatted = r.data.map(s => ({
                id: s.id,
                time: `${s.time_start.slice(0, 5)}-${s.time_end.slice(0, 5)}`,
                status: s.status
              }));
              setSlots(formatted);
            }
          })
          .catch(() => {});
      }
      setSelectedSlots([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#E0E0E0] bg-[#0f0f1a] min-h-screen">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">จองเซิฟเวอร์</h1>
        <p className="text-sm text-[#a78bfa] font-semibold">
          {serverName} — เลือกรูปแบบการจองและเวลาที่ต้องการ
        </p>
      </div>

      {/* Top Mode Selector Tabs */}
      <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-2.5 grid grid-cols-3 gap-2 shadow-lg">
        <button
          id="tab-timeslot"
          onClick={() => { setBookingMode('timeslot'); setError(''); }}
          className={`py-3 px-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center border cursor-pointer ${
            bookingMode === 'timeslot'
              ? 'bg-[#4C1D95] border-[#7C3AED] text-white shadow-lg'
              : 'bg-[#0f0f1a] border-[#2A2A3A] text-white/60 hover:text-white hover:border-[#7C3AED]/50'
          }`}
        >
          <span className="text-base mb-0.5">⏰ เลือก Time Slot</span>
          <span className="text-[11px] font-medium opacity-80">฿50 / ช่อง (2 ชม.)</span>
        </button>

        <button
          id="tab-fullday"
          onClick={() => { setBookingMode('fullday'); setError(''); }}
          className={`py-3 px-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center border cursor-pointer ${
            bookingMode === 'fullday'
              ? 'bg-[#4C1D95] border-[#7C3AED] text-white shadow-lg'
              : 'bg-[#0f0f1a] border-[#2A2A3A] text-white/60 hover:text-white hover:border-[#7C3AED]/50'
          }`}
        >
          <span className="text-base mb-0.5">📅 จองทั้งวัน</span>
          <span className="text-[11px] font-medium opacity-80">฿200 / วัน</span>
        </button>

        <button
          id="tab-multiday"
          onClick={() => { setBookingMode('multiday'); setError(''); }}
          className={`py-3 px-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center border cursor-pointer ${
            bookingMode === 'multiday'
              ? 'bg-[#4C1D95] border-[#7C3AED] text-white shadow-lg'
              : 'bg-[#0f0f1a] border-[#2A2A3A] text-white/60 hover:text-white hover:border-[#7C3AED]/50'
          }`}
        >
          <span className="text-base mb-0.5">🗓 จองหลายวัน</span>
          <span className="text-[11px] font-medium opacity-80">฿180 / วัน (ประหยัด)</span>
        </button>
      </div>

      {/* Main 3-Column Grid Layout (Left 2 Cols, Right 1 Col Sticky) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column (2 Cols Wide) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Server Selector Bar */}
          <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-white/60 mr-2">เลือกเซิฟเวอร์:</span>
            {servers.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setCurrentServerId(s.id);
                  setServerName(s.name);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  String(currentServerId) === String(s.id)
                    ? 'bg-[#4C1D95] border-[#7C3AED] text-white shadow'
                    : 'bg-[#0f0f1a] border-[#2A2A3A] text-white/60 hover:text-white'
                }`}
              >
                <span>{s.icon || '⛏️'}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>

          {/* MODE 1: TIMESLOT */}
          {bookingMode === 'timeslot' && (
            <div className="space-y-8">
              {/* Date Picker */}
              <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-white">เลือกวันที่ (7 วันถัดไป)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {timeslotDays.map((day, idx) => {
                    const isSelected = selectedDateIndex === idx;
                    return (
                      <button
                        key={day.value}
                        onClick={() => setSelectedDateIndex(idx)}
                        className={`py-3 px-2 rounded-xl font-bold text-xs transition-all border text-center ${
                          isSelected
                            ? 'border-[#7C3AED] bg-[#7C3AED]/20 text-white shadow-lg'
                            : 'border-[#2A2A3A] bg-[#0f0f1a] text-white/70 hover:border-[#7C3AED]/50'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots Grid */}
              <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h3 className="text-base font-bold text-white">
                    ช่วงเวลาว่างในวันที่ {selectedDateObj.label}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-[#6ee7b7]">
                      <span className="w-2.5 h-2.5 rounded bg-[#6ee7b7]" /> ว่าง
                    </span>
                    <span className="flex items-center gap-1.5 text-[#fde68a]">
                      <span className="w-2.5 h-2.5 rounded bg-[#d97706]" /> กำลังดำเนินอยู่ (เริ่มแล้ว)
                    </span>
                    <span className="flex items-center gap-1.5 text-[#c4b5fd]">
                      <span className="w-2.5 h-2.5 rounded bg-[#7C3AED]" /> เลือกแล้ว
                    </span>
                    <span className="flex items-center gap-1.5 text-white/30">
                      <span className="w-2.5 h-2.5 rounded bg-white/20" /> เต็ม/หมดเวลา
                    </span>

                    {selectedSlots.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-xs text-red-400 hover:underline font-semibold ml-2 cursor-pointer"
                      >
                        ล้างทั้งหมด
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {slots.map((slot) => {
                    const isSelected = selectedSlots.some(s => s.id === slot.id);
                    const isBooked = slot.status === 'booked' || slot.status === 'reserved';
                    const isExpired = slot.status === 'expired';
                    const isTooShort = slot.status === 'too_short';
                    const isOngoing = slot.status === 'ongoing';
                    const isDisabled = isBooked || isExpired || isTooShort || slot.canBook === false;

                    let slotStyle = '';
                    let subLabel = '฿50 (2 ชม.)';

                    if (isExpired) {
                      slotStyle = 'border-white/10 text-white/30 opacity-40 cursor-not-allowed bg-[#0f0f1a]';
                      subLabel = 'หมดเวลา';
                    } else if (isBooked) {
                      slotStyle = 'border-red-900/30 text-red-400/60 opacity-40 cursor-not-allowed bg-[#0f0f1a]';
                      subLabel = 'เต็มแล้ว';
                    } else if (isTooShort) {
                      slotStyle = 'border-amber-900/30 text-amber-400/60 opacity-40 cursor-not-allowed bg-[#0f0f1a]';
                      subLabel = 'เหลือน้อยกว่า 15 นาที';
                    } else if (isSelected) {
                      slotStyle = 'border-[#7C3AED] text-[#c4b5fd] bg-[rgba(124,58,237,0.25)] shadow-lg relative cursor-pointer';
                      subLabel = 'เลือกแล้ว';
                    } else if (isOngoing) {
                      slotStyle = 'border-amber-500/60 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer shadow-sm';
                      subLabel = `เหลืออีก ${slot.minutesLeft} นาที`;
                    } else {
                      slotStyle = 'border-[#6ee7b7]/60 text-[#6ee7b7] bg-transparent hover:bg-[#6ee7b7]/10 cursor-pointer';
                      subLabel = '฿50 (2 ชม.)';
                    }

                    return (
                      <button
                        key={slot.id}
                        disabled={isDisabled}
                        onClick={() => toggleSlot(slot)}
                        className={`py-3.5 px-3 rounded-xl border text-center font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 relative ${slotStyle}`}
                      >
                        {isSelected && (
                          <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[10px]">
                            ✓
                          </span>
                        )}
                        <span>{slot.time}</span>
                        <span className="text-[11px] font-normal opacity-90">
                          {subLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: FULLDAY */}
          {bookingMode === 'fullday' && (
            <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">เลือกวันที่ต้องการจองทั้งวัน (14 วันล่วงหน้า)</h3>
                <p className="text-xs text-white/50">เข้าใช้งานได้ตลอด 24 ชั่วโมงในวันที่เลือก</p>
              </div>

              {/* 14 Days Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {fulldayDays.map((day) => {
                  const isBooked = fullBookedDates.includes(day.value);
                  const isSelected = fullDayDate === day.value;
                  return (
                    <button
                      key={day.value}
                      disabled={isBooked}
                      onClick={() => setFullDayDate(day.value)}
                      className={`py-3.5 px-2 rounded-xl font-bold text-xs transition-all border text-center ${
                        isBooked
                          ? 'border-white/10 bg-[#0f0f1a] text-white/30 opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'border-[#7C3AED] bg-[#7C3AED]/25 text-white shadow-lg scale-105 cursor-pointer'
                          : 'border-[#2A2A3A] bg-[#0f0f1a] text-white/70 hover:border-[#7C3AED]/50 cursor-pointer'
                      }`}
                    >
                      <div>{day.label}</div>
                      <div className="text-[10px] font-normal opacity-70 mt-1">
                        {isBooked ? 'เต็มหมดแล้ว' : '฿200/วัน'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Info Box */}
              <div className="bg-[#4C1D95]/20 border border-[#7C3AED]/40 rounded-xl p-4 flex items-center gap-3 text-xs text-[#c4b5fd]">
                <span className="text-xl">ℹ️</span>
                <span>
                  <strong>การจองแบบทั้งวัน:</strong> เข้าใช้ Server ได้ตั้งแต่ <strong>00:00 – 23:59 น.</strong> ในวันที่เลือก ไม่จำกัดจำนวนชั่วโมง
                </span>
              </div>
            </div>
          )}

          {/* MODE 3: MULTIDAY */}
          {bookingMode === 'multiday' && (
            <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">เลือกช่วงวันที่ต้องการจอง (หลายวัน)</h3>
                <p className="text-xs text-white/50">รับส่วนลดพิเศษ ฿180 / วัน (เมื่อจองตั้งแต่ 1 วันขึ้นไป)</p>
              </div>

              {/* Start & End Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Start Date Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/70 block">วันเริ่มต้น (Start Date)</label>
                  <select
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full bg-[#0f0f1a] border border-[#2A2A3A] focus:border-[#7C3AED] text-white text-sm font-semibold rounded-xl p-3 outline-none transition-colors"
                  >
                    {multidayDays.map((d) => (
                      <option key={d.value} value={d.value}>
                        วันที่ {d.dateNum} {d.monthName} ({d.dayName}.)
                      </option>
                    ))}
                  </select>
                </div>

                {/* End Date Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/70 block">วันสิ้นสุด (End Date)</label>
                  <select
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#0f0f1a] border border-[#2A2A3A] focus:border-[#7C3AED] text-white text-sm font-semibold rounded-xl p-3 outline-none transition-colors"
                  >
                    {validEndDates.map((d) => (
                      <option key={d.value} value={d.value}>
                        วันที่ {d.dateNum} {d.monthName} ({d.dayName}.)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selection Preview Badge & Summary */}
              <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-white/60">ช่วงวันที่เลือก:</span>
                  <span className="bg-[#4C1D95] border border-[#7C3AED] text-white text-sm font-bold px-4 py-1.5 rounded-full shadow">
                    🗓 {timeSummary}
                  </span>
                </div>

                <div className="text-xs text-white/60 bg-[#141424] p-3 rounded-lg border border-[#2A2A3A] flex items-center gap-2">
                  <span className="text-base">⏰</span>
                  <span>
                    เวลาที่ได้รับ: <strong>วันที่ {multidayDays.find(d => d.value === startDate)?.dateNum} {multidayDays.find(d => d.value === startDate)?.monthName} (00:00 น.)</strong> ถึง <strong>วันที่ {multidayDays.find(d => d.value === endDate)?.dateNum} {multidayDays.find(d => d.value === endDate)?.monthName} (23:59 น.)</strong> รวม {multiDayCount} วันเต็ม
                  </span>
                </div>

                <div className="border-t border-[#2A2A3A] pt-3 flex flex-wrap items-center justify-between text-xs">
                  <span className="text-white/70 font-semibold">
                    คำนวณราคา: <strong>{multiDayCount} วัน</strong> × ฿180
                  </span>
                  <span className="text-[#a78bfa] text-base font-black">
                    = ฿{totalPrice}
                  </span>
                </div>

                {/* Savings Callout */}
                {multiDaySavings > 0 && (
                  <div className="bg-[rgba(6,78,59,0.4)] border border-[#059669]/60 text-[#6EE7B7] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between">
                    <span>🎉 ส่วนลดแพ็กเกจหลายวัน:</span>
                    <span>ประหยัดกว่าจองแยกวันละ ฿20 (ประหยัดได้ ฿{multiDaySavings})</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Sticky Summary Panel */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white border-b border-[#2A2A3A] pb-4 flex items-center justify-between">
              <span>สรุปการจอง</span>
              <span className="text-xs font-normal text-[#a78bfa] bg-[#4C1D95]/40 border border-[#7C3AED]/50 px-2.5 py-0.5 rounded-full">
                {bookingMode === 'timeslot' ? 'Time Slot' : bookingMode === 'fullday' ? 'ทั้งวัน' : 'หลายวัน'}
              </span>
            </h3>

            <div className="space-y-4 text-sm font-semibold">
              <div className="flex justify-between items-center">
                <span className="text-white/50">เซิฟเวอร์:</span>
                <span className="text-white font-bold">{serverName}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/50">ประเภท:</span>
                <span className="text-white font-bold">
                  {bookingMode === 'timeslot' ? 'เลือกช่วงเวลา' : bookingMode === 'fullday' ? 'จองทั้งวัน (24 ชม.)' : 'จองหลายวัน'}
                </span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-white/50">วัน/เวลา:</span>
                <span className="text-[#a78bfa] font-bold text-right max-w-[180px] break-words">
                  {timeSummary || '-'}
                </span>
              </div>

              {/* Capacity Limit Callout */}
              <div className="bg-[#0f0f1a] border border-[#2A2A3A] p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-white/70">
                <span>👥</span>
                <span>จำกัด 20 คน/เซิฟเวอร์ Real-time</span>
              </div>

              {/* Price Calculation Summary */}
              <div className="flex justify-between items-center pt-4 border-t border-[#2A2A3A]">
                <div>
                  <span className="text-white/70 block">ราคารวม:</span>
                  <span className="text-[11px] text-white/40 font-normal block">
                    {bookingMode === 'timeslot'
                      ? `(${selectedSlots.length} ช่อง × ฿50)`
                      : bookingMode === 'fullday'
                      ? '(1 วัน × ฿200)'
                      : `(${multiDayCount} วัน × ฿180)`
                    }
                  </span>
                </div>
                <span className="text-[#a78bfa] text-2xl font-black">
                  ฿{totalPrice}
                </span>
              </div>
            </div>

            {/* Error Message Box */}
            {error && (
              <div className="bg-[rgba(69,10,10,0.6)] border border-[rgba(220,38,38,0.4)] text-[#fca5a5] p-3 rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || loading}
                className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-lg text-sm border flex items-center justify-center gap-2 ${
                  canConfirm && !loading
                    ? 'bg-[#4C1D95] hover:bg-[#5b21b6] border-[#7C3AED] text-white cursor-pointer'
                    : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                {loading ? 'กำลังดำเนินการ...' : 'ยืนยันเเละชำระเงิน'}
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full bg-transparent hover:bg-white/5 border border-white/20 text-white/70 font-semibold py-2.5 rounded-xl transition-all text-xs"
              >
                ยกเลิก
              </button>
            </div>
          </Card>
        </div>

      </div>

      {/* Ongoing Slot Confirmation Modal */}
      {ongoingConfirmSlot && (
        <div
          id="ongoing-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-[#1a1a2e] border border-amber-500/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-base font-bold text-white">ช่วงเวลานี้เริ่มไปแล้ว</h3>
                <span className="text-xs text-amber-300 font-semibold">
                  รอบ {ongoingConfirmSlot.time}
                </span>
              </div>
            </div>

            <p className="text-sm text-white/80 leading-relaxed">
              ช่วงเวลานี้เริ่มเล่นไปแล้ว เหลือเวลาอีกประมาณ{' '}
              <strong className="text-amber-400 font-black text-base underline">
                {ongoingConfirmSlot.minutesLeft} นาที
              </strong>
            </p>

            <p className="text-xs text-white/50">
              คุณต้องการเลือกช่วงเวลานี้ต่อไปยังขั้นตอนการชำระเงินหรือไม่?
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                id="btn-confirm-ongoing"
                type="button"
                onClick={() => {
                  setSelectedSlots(prev => [...prev, ongoingConfirmSlot]);
                  setOngoingConfirmSlot(null);
                }}
                className="flex-1 bg-[#4C1D95] hover:bg-[#5b21b6] border border-[#7C3AED] text-white py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                ยืนยันเลือกช่วงนี้
              </button>
              <button
                id="btn-cancel-ongoing"
                type="button"
                onClick={() => setOngoingConfirmSlot(null)}
                className="flex-1 bg-[#0f0f1a] hover:bg-white/10 border border-white/20 text-white/80 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                เลือกช่วงอื่น
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Booking;
