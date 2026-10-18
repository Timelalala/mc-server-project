import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const MOCK_USERS = [
  { id: 1, username: 'jirawat', email: 'jirawat@gmail.com', role: 'user',  booking_count: 6, created_at: '15 มิ.ย. 2569', status: 'active' },
  { id: 2, username: 'Tim',     email: 'tim@gmail.com',     role: 'user',  booking_count: 3, created_at: '10 ก.ค. 2569', status: 'active' },
  { id: 3, username: 'admin',   email: 'admin@mcserver.com', role: 'admin', booking_count: 0, created_at: '1 มิ.ย. 2569',  status: 'active' },
];

const Users = () => {
  const [users, setUsers] = useState(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    if (typeof dateStr === 'string' && dateStr.includes('มิ.ย.') || dateStr.includes('ก.ค.')) {
      return dateStr;
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Fetch Users list
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      if (res.data && Array.isArray(res.data)) {
        const formattedUsers = res.data.map(u => ({
          ...u,
          status: u.status || 'active',
          booking_count: u.booking_count ?? 0,
          created_at: formatDate(u.created_at)
        }));
        setUsers(formattedUsers);
      } else {
        setUsers(MOCK_USERS);
      }
    } catch (err) {
      console.error('Failed to fetch users from API, falling back to mock users:', err);
      setUsers(MOCK_USERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Suspend / Activate Handler
  const handleSuspend = async (userId) => {
    setError('');
    setSuccess('');
    setActionLoadingId(userId);

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    if (targetUser.role === 'admin') {
      setError('ไม่สามารถระงับบัญชีผู้ดูแลระบบ (Admin) ได้');
      setActionLoadingId(null);
      return;
    }

    try {
      const res = await api.patch(`/api/admin/users/${userId}/suspend`);
      const updatedStatus = res.data?.status || (targetUser.status === 'active' ? 'suspended' : 'active');

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: updatedStatus } : u));
      setSuccess(`เปลี่ยนสถานะบัญชี "${targetUser.username}" เป็น ${updatedStatus === 'active' ? 'เปิดใช้งาน' : 'ถูกระงับ'} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Failed to update user suspend status via API, toggling locally:', err);
      const updatedStatus = targetUser.status === 'active' ? 'suspended' : 'active';
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: updatedStatus } : u));
      setSuccess(`เปลี่ยนสถานะบัญชี "${targetUser.username}" เป็น ${updatedStatus === 'active' ? 'เปิดใช้งาน' : 'ถูกระงับ'} (Mock Data Mode)`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Confirm Delete Handler
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.role === 'admin') {
      setError('ไม่สามารถลบบัญชีผู้ดูแลระบบ (Admin) ได้');
      setDeleteTarget(null);
      return;
    }

    setError('');
    setSuccess('');
    const targetId = deleteTarget.id;
    const targetName = deleteTarget.username;

    try {
      await api.delete(`/admin/users/${targetId}`);
      setUsers(prev => prev.filter(u => u.id !== targetId));
      setSuccess(`ลบบัญชีผู้ใช้ "${targetName}" สำเร็จเรียบร้อย`);
    } catch (err) {
      console.error('Failed to delete user via API, removing locally:', err);
      setUsers(prev => prev.filter(u => u.id !== targetId));
      setSuccess(`ลบบัญชีผู้ใช้ "${targetName}" สำเร็จ (Mock Data Mode)`);
    } finally {
      setDeleteTarget(null);
    }
  };

  // Search Filter Logic
  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6" style={{ background: '#0f0f1a', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">จัดการผู้ใช้</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Admin ดูรายชื่อผู้ใช้ทั้งหมด, ค้นหา, ดูจำนวนการจองของแต่ละคน, ระงับ/ลบบัญชี
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: 'rgba(69,10,10,0.6)', border: '1px solid rgba(220,38,38,0.5)', color: '#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: 'rgba(6,78,59,0.6)', border: '1px solid rgba(16,185,129,0.5)', color: '#6ee7b7' }}>
          ✅ {success}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 ค้นหาชื่อผู้ใช้หรืออีเมล..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all focus:border-purple-500"
          style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
        />
      </div>

      {/* Users Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            กำลังโหลดข้อมูลผู้ใช้งาน...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ไม่พบผู้ใช้ที่ตรงกับการค้นหา "{search}"
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase font-semibold" style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', background: '#0f0f1a' }}>
                  <th className="px-6 py-4">ผู้ใช้</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">จำนวนการจอง</th>
                  <th className="px-6 py-4">สมัครเมื่อ</th>
                  <th className="px-6 py-4">สถานะ</th>
                  <th className="px-6 py-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map(user => {
                  const roleBadge = user.role === 'admin'
                    ? { bg: 'rgba(124,58,237,0.3)', color: '#c4b5fd', text: 'Admin' }
                    : { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', text: 'User' };

                  const isSuspended = user.status === 'suspended';
                  const statusBadge = isSuspended
                    ? { bg: 'rgba(120,53,15,0.6)', color: '#fde68a', text: 'ถูกระงับ' }
                    : { bg: 'rgba(6,78,59,0.6)', color: '#6ee7b7', text: 'ใช้งานปกติ' };

                  const isActionLoading = actionLoadingId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Avatar + Username + Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner flex-shrink-0"
                            style={{ background: '#4C1D95' }}
                          >
                            {user.username ? user.username[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">{user.username}</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-6 py-4">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block"
                          style={{ background: roleBadge.bg, color: roleBadge.color }}
                        >
                          {roleBadge.text}
                        </span>
                      </td>

                      {/* Booking Count */}
                      <td className="px-6 py-4 font-bold" style={{ color: '#a78bfa' }}>
                        {user.booking_count ?? 0} ครั้ง
                      </td>

                      {/* Registration Date */}
                      <td className="px-6 py-4 text-white/70 text-xs">
                        {user.created_at}
                      </td>

                      {/* Account Status Badge */}
                      <td className="px-6 py-4">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-semibold inline-block"
                          style={{ background: statusBadge.bg, color: statusBadge.color }}
                        >
                          {statusBadge.text}
                        </span>
                      </td>

                      {/* Management Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {user.role !== 'admin' ? (
                            <>
                              {/* Suspend / Activate Button */}
                              <button
                                onClick={() => handleSuspend(user.id)}
                                disabled={isActionLoading}
                                className="text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 cursor-pointer disabled:opacity-50"
                                style={{ borderColor: 'rgba(217,119,6,0.5)', color: '#fde68a' }}
                              >
                                {isActionLoading ? '⏳...' : user.status === 'active' ? '⏸ ระงับ' : '▶ เปิดใช้'}
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => setDeleteTarget(user)}
                                className="text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 cursor-pointer"
                                style={{ borderColor: 'rgba(220,38,38,0.5)', color: '#fca5a5' }}
                              >
                                🗑 ลบ
                              </button>
                            </>
                          ) : (
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setDeleteTarget(null)} />
          <div className="relative rounded-2xl p-6 w-full max-w-sm z-10 shadow-2xl" style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="text-white font-medium mb-2 text-base">ยืนยันการลบผู้ใช้</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              ต้องการลบ <strong className="text-white">{deleteTarget.username}</strong> ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 cursor-pointer"
                style={{ background: 'rgba(69,10,10,0.6)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.5)' }}
              >
                ยืนยันลบ
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5 cursor-pointer"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
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

export default Users;
