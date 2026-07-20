import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Table, Button, Card } from '../../components/ui';
import { Trash2, AlertTriangle, ShieldCheck, Mail, Calendar } from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('ไม่สามารถเรียกข้อมูลผู้ใช้งานได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (userId, username) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งาน "${username}"? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      try {
        setError(null);
        setSuccess(null);
        await api.delete(`/admin/users/${userId}`);
        setSuccess(`ลบผู้ใช้งาน "${username}" สำเร็จเรียบร้อยแล้ว`);
        fetchUsers();
      } catch (err) {
        console.error('Delete user failed:', err);
        setError(err.response?.data?.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้งาน');
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-text-heading">จัดการข้อมูลผู้ใช้ (User Management)</h1>
        <p className="text-xs text-text-muted mt-1">รายชื่อบัญชีผู้ใช้ระบบและผู้เล่นทั้งหมดที่ลงทะเบียน</p>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3.5 rounded-xl text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-success-bg border border-success-border text-success-text px-4 py-3.5 rounded-xl text-xs">
          {success}
        </div>
      )}

      {loading ? (
        <Card className="h-64 bg-bg-surface border border-border-default rounded-xl animate-pulse" />
      ) : (
        <Table headers={['ID', 'ชื่อผู้ใช้', 'อีเมล', 'สิทธิ์การใช้งาน', 'วันที่สมัคร', 'การควบคุม']}>
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-bg-app/40 transition-colors">
              <td className="px-6 py-4.5 font-bold font-mono text-text-muted">{u.id}</td>
              <td className="px-6 py-4.5 font-semibold text-text-heading">{u.username}</td>
              <td className="px-6 py-4.5 font-medium text-text-body">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary-text" />
                  <span>{u.email}</span>
                </span>
              </td>
              <td className="px-6 py-4.5">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  u.role === 'admin' 
                    ? 'bg-primary-tint border-primary-border text-primary-text' 
                    : 'bg-bg-page border-border-subtle text-text-muted'
                }`}>
                  {u.role === 'admin' ? (
                    <>
                      <ShieldCheck className="w-3 h-3" />
                      <span>แอดมิน</span>
                    </>
                  ) : (
                    <span>ผู้เล่นทั่วไป</span>
                  )}
                </span>
              </td>
              <td className="px-6 py-4.5 font-medium text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(u.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
              </td>
              <td className="px-6 py-4.5">
                <Button
                  variant="danger"
                  className="px-2.5 py-1.5 flex items-center gap-1.5 text-xs"
                  disabled={u.role === 'admin'}
                  onClick={() => handleDelete(u.id, u.username)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบบัญชี</span>
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
};

export default Users;
