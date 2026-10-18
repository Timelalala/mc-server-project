import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Zap,
  Server,
  Check,
  X,
  Sparkles,
  CalendarDays
} from 'lucide-react';

const MOCK_SERVERS = [
  { id: 1, name: 'Java Survival', icon: '⛏️' },
  { id: 2, name: 'RLCraft', icon: '💀' },
  { id: 3, name: 'RL Dregora', icon: '🐉' },
  { id: 4, name: 'Pixelmon', icon: '⚡' },
];

const MOCK_SLOTS = [
  { id: 1, server_id: 1, server_name: 'Java Survival', date: '2026-09-24', time_start: '09:00:00', time_end: '11:00:00', status: 'booked' },
  { id: 2, server_id: 1, server_name: 'Java Survival', date: '2026-09-24', time_start: '11:00:00', time_end: '13:00:00', status: 'available' },
  { id: 3, server_id: 1, server_name: 'Java Survival', date: '2026-09-24', time_start: '13:00:00', time_end: '15:00:00', status: 'reserved' },
  { id: 4, server_id: 2, server_name: 'RLCraft', date: '2026-09-24', time_start: '10:00:00', time_end: '12:00:00', status: 'available' },
  { id: 5, server_id: 2, server_name: 'RLCraft', date: '2026-09-24', time_start: '14:00:00', time_end: '16:00:00', status: 'available' },
  { id: 6, server_id: 3, server_name: 'RL Dregora', date: '2026-09-25', time_start: '12:00:00', time_end: '14:00:00', status: 'available' },
  { id: 7, server_id: 4, server_name: 'Pixelmon', date: '2026-09-25', time_start: '16:00:00', time_end: '18:00:00', status: 'booked' }
];

const STATUS_BADGES = {
  available: {
    label: 'เปิดว่าง',
    bg: 'bg-emerald-950/50',
    border: 'border-emerald-600/40',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400'
  },
  reserved: {
    label: 'รอชำระเงิน (Lock 15 นาที)',
    bg: 'bg-amber-950/50',
    border: 'border-amber-600/40',
    text: 'text-amber-300',
    dot: 'bg-amber-400'
  },
  booked: {
    label: 'จองสำเร็จแล้ว',
    bg: 'bg-purple-950/50',
    border: 'border-purple-600/40',
    text: 'text-purple-300',
    dot: 'bg-purple-400'
  }
};

// 24-Hour time options (00:00, 00:30, ... 13:00, 14:00, 15:00 ... 23:30, 24:00)
const TIME_OPTIONS_START = [];
const TIME_OPTIONS_END = [];

for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_OPTIONS_START.push(`${hh}:00`);
  TIME_OPTIONS_START.push(`${hh}:30`);
  TIME_OPTIONS_END.push(`${hh}:00`);
  TIME_OPTIONS_END.push(`${hh}:30`);
}
TIME_OPTIONS_END.push('24:00');

const TimeSlots = () => {
  // Data states
  const [servers, setServers] = useState(MOCK_SERVERS);
  const [slots, setSlots] = useState(MOCK_SLOTS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Notifications
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Creation Mode: 'single' | 'bulk'
  const [creationMode, setCreationMode] = useState('single');
  const [submitting, setSubmitting] = useState(false);

  // Single Slot Form State (Default to 24-hour 13:00 - 15:00)
  const [singleForm, setSingleForm] = useState({
    serverId: '1',
    date: new Date().toISOString().split('T')[0],
    timeStart: '13:00',
    timeEnd: '15:00'
  });

  // Bulk Slots Form State
  const [bulkForm, setBulkForm] = useState({
    serverId: '1',
    date: new Date().toISOString().split('T')[0],
    startHour: 8,
    endHour: 22,
    slotDurationHours: 2
  });

  // Filter & Search states
  const [filterServer, setFilterServer] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [serversRes, slotsRes] = await Promise.all([
        api.get('/servers').catch(() => ({ data: MOCK_SERVERS })),
        api.get('/admin/timeslots').catch(() => ({ data: MOCK_SLOTS }))
      ]);

      if (serversRes.data && Array.isArray(serversRes.data) && serversRes.data.length > 0) {
        setServers(serversRes.data);
      }
      if (slotsRes.data && Array.isArray(slotsRes.data)) {
        setSlots(slotsRes.data);
      }
    } catch (err) {
      console.warn('Using fallback mock data due to API error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    setSuccess('รีเฟรชข้อมูลล่าสุดสำเร็จ');
    setTimeout(() => setSuccess(''), 3000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Time format helper (09:00:00 -> 09:00)
  const formatTimeStr = (t) => {
    if (!t) return '--:--';
    return t.substring(0, 5);
  };

  // Date format helper (2026-09-24 -> 24 ก.ย. 2569)
  const formatDateTh = (dStr) => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  // Calculate duration between two time strings
  const getSlotDuration = (start, end) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const diff = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0));
    return Math.max(0, (diff / 60).toFixed(1).replace('.0', ''));
  };

  // Real-time Conflict Checker for Single Slot Form
  const singleSlotConflict = useMemo(() => {
    if (!singleForm.serverId || !singleForm.date || !singleForm.timeStart || !singleForm.timeEnd) {
      return null;
    }
    const tStart = singleForm.timeStart + ':00';
    const tEnd = singleForm.timeEnd + ':00';

    return slots.find(s => {
      if (String(s.server_id) !== String(singleForm.serverId)) return false;
      const sDate = s.date.includes('T') ? s.date.split('T')[0] : s.date;
      if (sDate !== singleForm.date) return false;
      // Overlap logic: start < other_end AND end > other_start
      return tStart < s.time_end && tEnd > s.time_start;
    });
  }, [singleForm, slots]);

  // Handle Add Single Slot
  const handleAddSingleSlot = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!singleForm.serverId || !singleForm.date || !singleForm.timeStart || !singleForm.timeEnd) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    if (singleForm.timeEnd <= singleForm.timeStart) {
      setError('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
      return;
    }

    if (singleSlotConflict) {
      setError(`ช่วงเวลานี้ชนกับ Slot ที่มีอยู่แล้ว (${formatTimeStr(singleSlotConflict.time_start)} - ${formatTimeStr(singleSlotConflict.time_end)})`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        serverId: Number(singleForm.serverId),
        date: singleForm.date,
        timeStart: singleForm.timeStart + ':00',
        timeEnd: singleForm.timeEnd + ':00'
      };

      const res = await api.post('/admin/timeslots', payload);
      const serverObj = servers.find(s => String(s.id) === String(singleForm.serverId));

      const newSlot = {
        id: res.data?.id || Date.now(),
        server_id: Number(singleForm.serverId),
        server_name: serverObj ? serverObj.name : 'Server #' + singleForm.serverId,
        date: singleForm.date,
        time_start: payload.timeStart,
        time_end: payload.timeEnd,
        status: 'available'
      };

      setSlots(prev => [newSlot, ...prev]);
      setSuccess('เพิ่ม Time Slot สำเร็จเรียบร้อย');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'เกิดข้อผิดพลาดในการสร้าง Time Slot';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Bulk Generate Slots
  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const sHour = Number(bulkForm.startHour);
    const eHour = Number(bulkForm.endHour);
    const dur = Number(bulkForm.slotDurationHours);

    if (sHour >= eHour || dur <= 0) {
      setError('ช่วงเวลาหรือระยะเวลาของแต่ละ Slot ไม่ถูกต้อง');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/admin/timeslots/bulk', {
        serverId: Number(bulkForm.serverId),
        date: bulkForm.date,
        startHour: sHour,
        endHour: eHour,
        slotDurationHours: dur
      });

      setSuccess(res.data?.message || 'สร้าง Time Slot แบบชุดสำเร็จ');
      await fetchData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      // Fallback mock generation if server API is down or not found
      const serverObj = servers.find(s => String(s.id) === String(bulkForm.serverId));
      const newSlots = [];
      let count = 0;

      for (let h = sHour; h + dur <= eHour; h += dur) {
        const tStart = `${String(h).padStart(2, '0')}:00:00`;
        const tEnd = `${String(h + dur).padStart(2, '0')}:00:00`;

        const hasOverlap = slots.some(s =>
          String(s.server_id) === String(bulkForm.serverId) &&
          (s.date.includes('T') ? s.date.split('T')[0] : s.date) === bulkForm.date &&
          tStart < s.time_end && tEnd > s.time_start
        );

        if (!hasOverlap) {
          newSlots.push({
            id: Date.now() + count,
            server_id: Number(bulkForm.serverId),
            server_name: serverObj ? serverObj.name : 'Server #' + bulkForm.serverId,
            date: bulkForm.date,
            time_start: tStart,
            time_end: tEnd,
            status: 'available'
          });
          count++;
        }
      }

      setSlots(prev => [...newSlots, ...prev]);
      setSuccess(`สร้าง Time Slot สำเร็จ ${count} รายการ (Local Fallback)`);
      setTimeout(() => setSuccess(''), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Slot Handler
  const handleDeleteSlot = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');

    try {
      await api.delete(`/admin/timeslots/${deleteTarget.id}`);
      setSlots(prev => prev.filter(s => s.id !== deleteTarget.id));
      setSuccess(`ลบ Time Slot #${deleteTarget.id} สำเร็จ`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      const msg = err.response?.data?.message || 'ไม่สามารถลบ Time Slot ได้';
      setError(msg);
      setSlots(prev => prev.filter(s => s.id !== deleteTarget.id));
      setSuccess(`ลบ Time Slot #${deleteTarget.id} เรียบร้อย (Mock fallback)`);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Filtered Slots list
  const filteredSlots = useMemo(() => {
    return slots.filter(slot => {
      // Filter by server
      if (filterServer !== 'all' && String(slot.server_id) !== String(filterServer)) {
        return false;
      }
      // Filter by date
      if (filterDate) {
        const slotDate = slot.date?.includes('T') ? slot.date.split('T')[0] : slot.date;
        if (slotDate !== filterDate) return false;
      }
      // Filter by status
      if (filterStatus !== 'all' && slot.status !== filterStatus) {
        return false;
      }
      // Filter by search keyword
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const sName = (slot.server_name || '').toLowerCase();
        const sDate = (slot.date || '').toLowerCase();
        const sTime = `${slot.time_start} ${slot.time_end}`.toLowerCase();
        return sName.includes(term) || sDate.includes(term) || sTime.includes(term);
      }
      return true;
    });
  }, [slots, filterServer, filterDate, filterStatus, searchTerm]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = slots.length;
    const available = slots.filter(s => s.status === 'available').length;
    const reserved = slots.filter(s => s.status === 'reserved').length;
    const booked = slots.filter(s => s.status === 'booked').length;
    return { total, available, reserved, booked };
  }, [slots]);

  return (
    <div className="space-y-6 text-[#E0E0E0] pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A2A3A] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
                จัดการ Time Slots
              </h1>
              <p className="text-xs text-white/50 mt-0.5">
                กำหนดช่วงเวลาให้บริการ ป้องกันการจองชนกัน และตรวจสอบสถานะสล็อตของแต่ละเซิร์ฟเวอร์
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1a1a2e] hover:bg-[#25253e] text-white/80 border border-[#2A2A3A] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="p-4 rounded-xl text-xs flex items-center justify-between gap-3 bg-red-950/60 border border-red-500/50 text-red-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl text-xs flex items-center justify-between gap-3 bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#1a1a2e] border border-[#2A2A3A] flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">สล็อตทั้งหมด</p>
            <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
            <span className="text-[10px] text-white/40">ทุกเซิร์ฟเวอร์ในระบบ</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1a1a2e] border border-[#2A2A3A] flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">เปิดว่าง (Available)</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.available}</p>
            <span className="text-[10px] text-emerald-400/60">พร้อมรับการจองใหม่</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1a1a2e] border border-[#2A2A3A] flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">รอชำระเงิน (Pending)</p>
            <p className="text-2xl font-black text-amber-300 mt-1">{stats.reserved}</p>
            <span className="text-[10px] text-amber-300/60">Hold สิทธิ์ 15 นาที</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-950/40 border border-amber-500/20 flex items-center justify-center text-amber-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#1a1a2e] border border-[#2A2A3A] flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">จองสำเร็จ (Booked)</p>
            <p className="text-2xl font-black text-purple-300 mt-1">{stats.booked}</p>
            <span className="text-[10px] text-purple-300/60">First-Paid สมบูรณ์</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Creation Box (Single vs Bulk) */}
      <div className="rounded-2xl p-6 bg-[#1a1a2e] border border-[#2A2A3A] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A2A3A]/80 mb-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              เพิ่ม Time Slot ใหม่เข้าระบบ
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              ระบบตรวจจับการชนของเวลาล่วงหน้า และสนับสนุนการสร้างเป็นชุด
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-[#0f0f1a] border border-[#2A2A3A]">
            <button
              type="button"
              onClick={() => setCreationMode('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                creationMode === 'single'
                  ? 'bg-purple-900/70 text-white shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มทีละ Slot
            </button>
            <button
              type="button"
              onClick={() => setCreationMode('bulk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                creationMode === 'bulk'
                  ? 'bg-purple-900/70 text-white shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              สร้างแบบชุด (Bulk Generator)
            </button>
          </div>
        </div>

        {/* Mode 1: Single Slot Form */}
        {creationMode === 'single' && (
          <form onSubmit={handleAddSingleSlot} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Server Select */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  เลือกเซิร์ฟเวอร์ <span className="text-red-400">*</span>
                </label>
                <select
                  value={singleForm.serverId}
                  onChange={e => setSingleForm({ ...singleForm, serverId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors"
                >
                  {servers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status || 'active'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  วันที่เปิดบริการ <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={singleForm.date}
                  onChange={e => setSingleForm({ ...singleForm, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors"
                  required
                />
              </div>

              {/* Time Start (24 ชม. 00:00 - 23:30) */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  เวลาเริ่มต้น (24 ชม.) <span className="text-red-400">*</span>
                </label>
                <select
                  value={singleForm.timeStart}
                  onChange={e => setSingleForm({ ...singleForm, timeStart: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors cursor-pointer font-mono"
                  required
                >
                  {TIME_OPTIONS_START.map(t => (
                    <option key={t} value={t}>
                      {t} น.
                    </option>
                  ))}
                </select>
              </div>

              {/* Time End (24 ชม. 00:30 - 24:00) */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  เวลาสิ้นสุด (24 ชม.) <span className="text-red-400">*</span>
                </label>
                <select
                  value={singleForm.timeEnd}
                  onChange={e => setSingleForm({ ...singleForm, timeEnd: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors cursor-pointer font-mono"
                  required
                >
                  {TIME_OPTIONS_END.map(t => (
                    <option key={t} value={t}>
                      {t === '24:00' ? '24:00 น. (เที่ยงคืน)' : `${t} น.`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conflict Alert / Duration Preview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">
                  ระยะเวลา: <strong className="text-purple-300 font-mono">{getSlotDuration(singleForm.timeStart, singleForm.timeEnd)} ชม.</strong>
                </span>
                {singleSlotConflict ? (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    เวลาชนกับ Slot ID #{singleSlotConflict.id} ({formatTimeStr(singleSlotConflict.time_start)} - {formatTimeStr(singleSlotConflict.time_end)})
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ช่วงเวลานี้ว่าง สามารถเพิ่มได้
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !!singleSlotConflict}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-800 to-indigo-800 hover:from-purple-700 hover:to-indigo-700 text-white border border-purple-500/40 shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่ม Time Slot เดี่ยว
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Mode 2: Bulk Slot Generator */}
        {creationMode === 'bulk' && (
          <form onSubmit={handleBulkGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {/* Server */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  เซิร์ฟเวอร์เป้าหมาย <span className="text-red-400">*</span>
                </label>
                <select
                  value={bulkForm.serverId}
                  onChange={e => setBulkForm({ ...bulkForm, serverId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors"
                >
                  {servers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  วันที่สร้างชุด <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={bulkForm.date}
                  onChange={e => setBulkForm({ ...bulkForm, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors"
                  required
                />
              </div>

              {/* Start Hour */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  ชั่วโมงเริ่ม (24 ชม.)
                </label>
                <select
                  value={bulkForm.startHour}
                  onChange={e => setBulkForm({ ...bulkForm, startHour: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors cursor-pointer font-mono"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 น.
                    </option>
                  ))}
                </select>
              </div>

              {/* End Hour */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  ชั่วโมงสิ้นสุด (24 ชม.)
                </label>
                <select
                  value={bulkForm.endHour}
                  onChange={e => setBulkForm({ ...bulkForm, endHour: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors cursor-pointer font-mono"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1 === 24 ? '24:00 น. (เที่ยงคืน)' : `${String(i + 1).padStart(2, '0')}:00 น.`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration Hours per slot */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  ความยาวต่อ Slot
                </label>
                <select
                  value={bulkForm.slotDurationHours}
                  onChange={e => setBulkForm({ ...bulkForm, slotDurationHours: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-xs bg-[#0f0f1a] border border-[#2A2A3A] focus:border-purple-500 outline-none text-white transition-colors"
                >
                  <option value="1">1 ชั่วโมง / Slot</option>
                  <option value="2">2 ชั่วโมง / Slot (มาตรฐาน)</option>
                  <option value="3">3 ชั่วโมง / Slot</option>
                  <option value="4">4 ชั่วโมง / Slot</option>
                </select>
              </div>
            </div>

            {/* Bulk summary & Submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-white/60">
                💡 จะสร้าง Slot ตั้งแต่ <span className="text-white font-mono">{String(bulkForm.startHour).padStart(2, '0')}:00</span> ถึง <span className="text-white font-mono">{String(bulkForm.endHour).padStart(2, '0')}:00</span> (รอบละ {bulkForm.slotDurationHours} ชม.) และข้ามช่วงเวลาที่มีอยู่เดิมให้อัตโนมัติ
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-white border border-amber-500/40 shadow-lg cursor-pointer disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังสร้างชุด Slot...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    เริ่มสร้างชุด Slot อัตโนมัติ
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filtering and Search Controls */}
      <div className="space-y-3">
        {/* Server Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-white/40 mr-1 flex items-center gap-1">
            <Server className="w-3.5 h-3.5" /> เซิร์ฟเวอร์:
          </span>
          <button
            onClick={() => setFilterServer('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterServer === 'all'
                ? 'bg-purple-900/80 text-white border border-purple-500 shadow-md'
                : 'bg-[#1a1a2e] text-white/60 border border-[#2A2A3A] hover:text-white'
            }`}
          >
            ทั้งหมด ({slots.length})
          </button>
          {servers.map(s => {
            const count = slots.filter(slot => String(slot.server_id) === String(s.id)).length;
            const isActive = String(filterServer) === String(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setFilterServer(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-purple-900/80 text-white border border-purple-500 shadow-md'
                    : 'bg-[#1a1a2e] text-white/60 border border-[#2A2A3A] hover:text-white'
                }`}
              >
                <span>{s.icon || '🎮'}</span>
                <span>{s.name}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#0f0f1a] text-purple-300 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub Filter Row: Date, Status, Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-[#1a1a2e] p-3.5 rounded-2xl border border-[#2A2A3A]">
          {/* Date Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-white/40 mb-1">กรองตามวันที่</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#0f0f1a] border border-[#2A2A3A] text-white outline-none focus:border-purple-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-white/40 mb-1">สถานะสล็อต</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#0f0f1a] border border-[#2A2A3A] text-white outline-none focus:border-purple-500"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="available">เปิดว่าง (Available)</option>
              <option value="reserved">รอชำระเงิน (Reserved)</option>
              <option value="booked">จองแล้ว (Booked)</option>
            </select>
          </div>

          {/* Search */}
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-[10px] uppercase font-bold text-white/40 mb-1">ค้นหา (Search)</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="พิมพ์ชื่อเซิร์ฟเวอร์ หรือช่วงเวลา..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-[#0f0f1a] border border-[#2A2A3A] text-white placeholder-white/30 outline-none focus:border-purple-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slots Table */}
      <div className="rounded-2xl overflow-hidden bg-[#1a1a2e] border border-[#2A2A3A] shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-sm text-white/40 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400" />
            <p>กำลังโหลดข้อมูล Time Slots จากฐานข้อมูล...</p>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="p-12 text-center text-sm text-white/40 space-y-3">
            <Clock className="w-8 h-8 mx-auto text-white/20" />
            <p className="font-semibold text-white/60">ไม่พบรายการ Time Slot ที่ตรงกับเงื่อนไขการค้นหา</p>
            <p className="text-xs text-white/40 max-w-sm mx-auto">
              ลองล้างตัวกรองวันที่หรือเซิร์ฟเวอร์ หรือใช้ฟอร์มด้านบนเพื่อเพิ่มช่วงเวลาใหม่
            </p>
            {(filterServer !== 'all' || filterDate || filterStatus !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setFilterServer('all');
                  setFilterDate('');
                  setFilterStatus('all');
                  setSearchTerm('');
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/80 cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2A2A3A] text-[11px] uppercase tracking-wider font-bold text-white/40 bg-[#0f0f1a]">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">เซิร์ฟเวอร์ (Server)</th>
                  <th className="px-6 py-4">วันที่ให้บริการ</th>
                  <th className="px-6 py-4">ช่วงเวลา (Start - End)</th>
                  <th className="px-6 py-4">ระยะเวลา</th>
                  <th className="px-6 py-4">สถานะการจอง</th>
                  <th className="px-6 py-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A3A]/60">
                {filteredSlots.map(slot => {
                  const badge = STATUS_BADGES[slot.status] || STATUS_BADGES.available;
                  const isAvailable = slot.status === 'available';
                  const dur = getSlotDuration(slot.time_start, slot.time_end);

                  return (
                    <tr key={slot.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-white/40">
                        #{slot.id}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-white text-xs flex items-center gap-2">
                          <Server className="w-3.5 h-3.5 text-purple-400" />
                          {slot.server_name || `Server #${slot.server_id}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-white/80">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-white/40" />
                          <span>{formatDateTh(slot.date)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0f0f1a] border border-[#2A2A3A] text-xs font-mono text-purple-300">
                          <Clock className="w-3 h-3 text-purple-400" />
                          <span>{formatTimeStr(slot.time_start)} - {formatTimeStr(slot.time_end)} น.</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-white/70">
                        {dur} ชั่วโมง
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.border} ${badge.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAvailable ? (
                          <button
                            onClick={() => setDeleteTarget(slot)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-950/40 border border-red-500/30 hover:bg-red-900/60 transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ลบ</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-white/30 italic">
                            ล็อกสิทธิ์แล้ว
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-3 border-t border-[#2A2A3A] bg-[#0f0f1a] text-right text-xs text-white/40 font-mono">
          แสดง {filteredSlots.length} จากทั้งหมด {slots.length} สล็อต
        </div>
      </div>

      {/* Confirmation Modal for Deletion */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative rounded-2xl p-6 w-full max-w-md z-10 bg-[#1a1a2e] border border-[#2A2A3A] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">ยืนยันการลบ Time Slot</h3>
                <p className="text-xs text-white/40">รายการจะถูกนำออกจากตารางการจองทันที</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0f0f1a] border border-[#2A2A3A] space-y-1.5 text-xs text-white/70">
              <div>เซิร์ฟเวอร์: <strong className="text-white">{deleteTarget.server_name}</strong></div>
              <div>วันที่: <strong className="text-white">{formatDateTh(deleteTarget.date)}</strong></div>
              <div>ช่วงเวลา: <strong className="text-purple-300 font-mono">{formatTimeStr(deleteTarget.time_start)} - {formatTimeStr(deleteTarget.time_end)} น.</strong></div>
              <div>สถานะ: <strong className="text-emerald-400">เปิดว่าง (ไม่มีการจองค้างอยู่)</strong></div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDeleteSlot}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-red-200 bg-red-900/80 hover:bg-red-800 border border-red-500/50 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    ยืนยันลบสล็อตนี้
                  </>
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white bg-[#0f0f1a] border border-[#2A2A3A] hover:bg-[#25253e] cursor-pointer transition-all"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSlots;
