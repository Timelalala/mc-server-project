import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { Card } from '../../components/ui';

const getMockSlotsForDate = (dateStr) => {
  const baseSlots = [
    { id: 1, time: '08:00 - 10:00' },
    { id: 2, time: '10:00 - 12:00' },
    { id: 3, time: '13:00 - 15:00' },
    { id: 4, time: '15:00 - 17:00' },
    { id: 5, time: '17:00 - 19:00' },
    { id: 6, time: '19:00 - 21:00' },
  ];

  // Specific demo booked slots per date
  const bookedTimesPerDate = {
    '2026-06-16': ['13:00 - 15:00'],
    '2026-06-17': ['10:00 - 12:00', '17:00 - 19:00'], // 17th: 10:00-12:00 & 17:00-19:00 booked
    '2026-06-18': ['15:00 - 17:00'],
    '2026-06-19': ['08:00 - 10:00', '19:00 - 21:00'],
    '2026-06-20': ['10:00 - 12:00'],
  };

  const bookedList = bookedTimesPerDate[dateStr] || [];

  return baseSlots.map((s) => ({
    ...s,
    status: bookedList.includes(s.time) ? 'booked' : 'available'
  }));
};

const Booking = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mockServers = [
    { id: 1, name: 'Server A', ip: '192.168.1.101' },
    { id: 2, name: 'Server B', ip: '192.168.1.102' },
    { id: 3, name: 'Server C', ip: '192.168.1.103' },
    { id: 4, name: 'Server D', ip: '192.168.1.104' },
  ];

  const daysList = [
    { label: 'จ.16', fullDate: '2026-06-16', display: 'จ.16 มิ.ย' },
    { label: 'อ.17', fullDate: '2026-06-17', display: 'อ.17 มิ.ย' },
    { label: 'พ.18', fullDate: '2026-06-18', display: 'พ.18 มิ.ย' },
    { label: 'พฤ.19', fullDate: '2026-06-19', display: 'พฤ.19 มิ.ย' },
    { label: 'ศ.20', fullDate: '2026-06-20', display: 'ศ.20 มิ.ย' },
  ];

  const [servers, setServers] = useState(mockServers);
  const [selectedServer, setSelectedServer] = useState(mockServers[0]);
  const [selectedDay, setSelectedDay] = useState(daysList[1]); // Default to 17th
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Fetch servers from backend if available
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await api.get('/servers');
        if (res.data && res.data.length > 0) {
          setServers(res.data);
          setSelectedServer(res.data[0]);
        }
      } catch (err) {
        console.log('Using mock servers');
      }
    };
    fetchServers();
  }, []);

  // Fetch slots whenever selectedServer or selectedDay changes
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await api.get(`/servers/${selectedServer.id}/slots`, {
          params: { date: selectedDay.fullDate }
        });
        if (res.data && res.data.length > 0) {
          const formatted = res.data.map(s => ({
            id: s.id,
            time: `${s.time_start.slice(0, 5)} - ${s.time_end.slice(0, 5)}`,
            status: s.status
          }));
          setSlots(formatted);
          return;
        }
      } catch (err) {
        console.log('Fetch slots failed, using per-date mock slots');
      }
      setSlots(getMockSlotsForDate(selectedDay.fullDate));
    };

    fetchSlots();
  }, [selectedServer, selectedDay]);

  // Auto-select first available slot when slots update
  useEffect(() => {
    if (slots.length > 0) {
      const firstAvailable = slots.find(s => s.status === 'available');
      setSelectedSlot(firstAvailable || null);
    }
  }, [slots]);

  useEffect(() => {
    const qServerId = searchParams.get('serverId');
    if (qServerId && servers.length > 0) {
      const match = servers.find(s => s.id === parseInt(qServerId));
      if (match) setSelectedServer(match);
    }
  }, [searchParams, servers]);

  const handleConfirm = () => {
    if (!selectedServer || !selectedDay || !selectedSlot) return;

    navigate('/payment', {
      state: {
        serverId: selectedServer.id,
        serverName: selectedServer.name,
        slotId: selectedSlot.id,
        date: selectedDay.display,
        time: selectedSlot.time,
        duration: '2 ชั่วโมง',
        price: 50
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">จองเซิฟเวอร์</h1>
        <p className="text-sm text-[#A78BFA] font-semibold">
          {selectedServer.name} - เลือกวันเเละช่วงเวลาที่ต้องการ
        </p>
      </div>

      {/* 3-Column Layout: Left 2 Cols (Date & Time), Right 1 Col (Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Server Selector Bar */}
          <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-white/60 mr-2">เลือกเซิฟเวอร์:</span>
            {servers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedServer(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  selectedServer.id === s.id
                    ? 'bg-[#4C1D95] border-[#7C3AED] text-white shadow'
                    : 'bg-[#0f0f1a] border-[#2A2A3A] text-white/60 hover:text-white'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Date Picker: 5 Days */}
          <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-white">เลือกวันที่</h3>
            <div className="grid grid-cols-5 gap-3">
              {daysList.map((day) => {
                const isSelected = selectedDay.fullDate === day.fullDate;
                return (
                  <button
                    key={day.fullDate}
                    onClick={() => setSelectedDay(day)}
                    className={`py-3 px-2 rounded-xl font-bold text-sm transition-all border text-center ${
                      isSelected
                        ? 'border-[#7C3AED] bg-[#4C1D95]/30 text-white shadow-lg'
                        : 'border-[#2A2A3A] bg-[#0f0f1a] text-white/70 hover:border-[#7C3AED]/50'
                    }`}
                  >
                    {day.display}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot Picker: Grid 3 Columns x Slots */}
          <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-base font-bold text-white">
                ช่วงเวลาว่างในวันที่ {selectedDay.display}
              </h3>
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-[#A78BFA]">
                  <span className="w-3 h-3 rounded bg-[#7C3AED]" /> เลือกเเล้ว
                </span>
                <span className="flex items-center gap-1.5 text-[#6EE7B7]">
                  <span className="w-3 h-3 rounded bg-[#059669]" /> ว่างเเล้ว
                </span>
                <span className="flex items-center gap-1.5 text-white/30">
                  <span className="w-3 h-3 rounded bg-white/20" /> ถูกจองเเล้ว
                </span>
              </div>
            </div>

            {/* 3-Column Slot Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {slots.map((slot) => {
                const isBooked = slot.status === 'booked';
                const isSelected = selectedSlot?.id === slot.id;

                let slotStyle = '';
                if (isBooked) {
                  slotStyle = 'border-white/10 text-white/20 bg-[#0f0f1a]/50 cursor-not-allowed';
                } else if (isSelected) {
                  slotStyle = 'border-[#7C3AED] text-[#A78BFA] bg-[#4C1D95]/30 shadow-md';
                } else {
                  slotStyle = 'border-[#059669] text-[#6EE7B7] bg-[#052E16]/40 hover:bg-[#052E16]/80';
                }

                return (
                  <button
                    key={slot.id}
                    disabled={isBooked}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-4 px-3 rounded-xl border text-center font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 ${slotStyle}`}
                  >
                    <span>{slot.time}</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {isBooked ? 'ถูกจองแล้ว' : isSelected ? 'เลือกอยู่' : 'ว่าง (50 บาท)'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right 1 Col: Sticky Booking Summary */}
        <div className="space-y-6">
          <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-6 sticky top-24 shadow-2xl">
            <h3 className="text-lg font-bold text-white border-b border-[#2A2A3A] pb-4">
              สรุปการจอง
            </h3>

            <div className="space-y-4 text-sm font-semibold">
              <div className="flex justify-between items-center">
                <span className="text-white/50">เซิฟเวอร์:</span>
                <span className="text-white font-bold">{selectedServer.name}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/50">วันที่:</span>
                <span className="text-white font-bold">{selectedDay.display}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/50">เวลา:</span>
                <span className="text-white font-bold">{selectedSlot?.time || '-'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/50">ระยะเวลา:</span>
                <span className="text-white font-bold">2 ชั่วโมง</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[#2A2A3A] text-base">
                <span className="text-white/70">ราคา:</span>
                <span className="text-[#6EE7B7] text-xl font-black">50 บาท</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleConfirm}
                disabled={!selectedSlot || selectedSlot.status === 'booked'}
                className="w-full bg-[#4C1D95] hover:bg-[#5b21b6] border border-[#7C3AED] text-white font-bold py-3 rounded-xl transition-all shadow-lg text-sm disabled:opacity-40"
              >
                ยืนยันเเละชำระเงิน
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
    </div>
  );
};

export default Booking;
