import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Card, Button, Input, Table, Badge } from '../../components/ui';
import { CalendarDays, Plus, Trash2, ShieldAlert, Check } from 'lucide-react';

const TimeSlots = () => {
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Form states for adding a slot
  const [newSlot, setNewSlot] = useState({
    timeStart: '',
    timeEnd: ''
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch servers list
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await api.get('/servers');
        setServers(res.data);
        if (res.data.length > 0) {
          setSelectedServerId(res.data[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to fetch servers:', err);
      }
    };
    fetchServers();
  }, []);

  // Fetch slots whenever server or date changes
  const fetchSlots = async () => {
    if (!selectedServerId || !selectedDate) return;
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await api.get(`/servers/${selectedServerId}/slots`, {
        params: { date: selectedDate }
      });
      setSlots(res.data);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setError('ไม่สามารถดึงตารางเวลาเรียนของเครื่องที่ระบุได้');
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [selectedServerId, selectedDate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewSlot(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedServerId || !selectedDate || !newSlot.timeStart || !newSlot.timeEnd) {
      setError('กรุณากรอกข้อมูลช่วงเวลาให้ครบถ้วน');
      return;
    }

    try {
      await api.post('/admin/slots', {
        server_id: selectedServerId,
        date: selectedDate,
        time_start: `${newSlot.timeStart}:00`,
        time_end: `${newSlot.timeEnd}:00`
      });
      setSuccess('เพิ่มช่วงเวลาว่างสำเร็จเรียบร้อยแล้ว');
      setNewSlot({ timeStart: '', timeEnd: '' });
      fetchSlots();
    } catch (err) {
      console.error('Failed to create time slot:', err);
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้างช่วงเวลา');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบช่วงเวลานี้?')) {
      try {
        setError(null);
        setSuccess(null);
        await api.delete(`/admin/slots/${slotId}`);
        setSuccess('ลบช่วงเวลาเรียบร้อยแล้ว');
        fetchSlots();
      } catch (err) {
        console.error('Failed to delete slot:', err);
        setError(err.response?.data?.message || 'ไม่สามารถลบช่วงเวลานี้ได้ (สล็อตอาจถูกจองอยู่)');
      }
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-text-heading">จัดการตารางเวลาจอง (Time Slot Control)</h1>
        <p className="text-xs text-text-muted mt-1">ตั้งค่าหรือยกเลิกช่วงเวลาจอง (Time Slot) ของเซิร์ฟเวอร์แต่ละตัวแยกตามรายวัน</p>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-success-bg border border-success-border text-success-text px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Filter & Add form */}
        <div className="space-y-6">
          {/* Filter Panel */}
          <Card className="space-y-4">
            <h3 className="text-sm font-bold text-text-heading border-b border-border-subtle pb-2.5">
              เลือกขอบเขตข้อมูล
            </h3>
            
            <div className="space-y-4">
              {/* Server Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-muted">เซิร์ฟเวอร์</label>
                <select
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  className="bg-bg-input border border-border-default text-text-heading rounded-lg px-3 py-2 text-sm outline-none focus:border-border-active transition-all"
                >
                  {servers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Input */}
              <Input
                label="วันที่ต้องการดู"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </Card>

          {/* Add Slot Form */}
          <Card className="space-y-4">
            <h3 className="text-sm font-bold text-text-heading border-b border-border-subtle pb-2.5">
              เพิ่มช่วงเวลากิจกรรมใหม่
            </h3>
            
            <form onSubmit={handleAddSlot} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="เวลาเริ่มต้น (Start)"
                  type="time"
                  name="timeStart"
                  value={newSlot.timeStart}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="เวลาสิ้นสุด (End)"
                  type="time"
                  name="timeEnd"
                  value={newSlot.timeEnd}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full flex items-center justify-center gap-1.5 py-3"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>เพิ่มช่วงเวลาว่าง</span>
              </Button>
            </form>
          </Card>
        </div>

        {/* Existing slots Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-0 border-border-default overflow-hidden">
            <div className="px-5 py-4 border-b border-border-subtle bg-bg-app flex items-center gap-2">
              <CalendarDays className="w-4.5 h-4.5 text-primary-text" />
              <h3 className="text-sm font-bold text-text-heading">
                ช่วงเวลาที่เปิดบริการบนเครื่องในปัจจุบัน
              </h3>
            </div>

            {loadingSlots ? (
              <div className="h-60 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-border" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-xs text-text-muted p-8 text-center">ไม่มีช่วงเวลาที่ตั้งค่าในวันที่เลือก</p>
            ) : (
              <Table headers={['ID', 'ช่วงเวลาจอง', 'สถานะบริการ', 'การควบคุม']}>
                {slots.map((slot) => {
                  const isBooked = slot.status === 'booked';
                  return (
                    <tr key={slot.id} className="hover:bg-bg-app/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-text-muted font-bold">{slot.id}</td>
                      <td className="px-6 py-4 font-semibold text-text-heading">
                        {formatTime(slot.time_start)} - {formatTime(slot.time_end)} น.
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={slot.status}>
                          {isBooked ? 'จองแล้ว' : 'ว่าง'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="danger"
                          className="px-2 py-1.5 flex items-center gap-1 text-xs"
                          onClick={() => handleDeleteSlot(slot.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบ</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TimeSlots;
