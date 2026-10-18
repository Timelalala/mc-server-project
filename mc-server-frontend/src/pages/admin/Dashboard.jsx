import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import { StatCard, Card } from '../../components/ui';
import { Users, Server, CreditCard, BarChart3, Cpu } from 'lucide-react';
import NetworkTrafficGraph from '../../components/admin/NetworkTrafficGraph';

const Dashboard = () => {
  const [healthData, setHealthData] = useState(null);
  const [stats, setStats] = useState({
    cpu: '0.0%',
    ram: '0.0 GB / 0.0 GB',
    onlineUsers: 0,
    todayBookings: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);

  // Fetch real-time server health (CPU & RAM) from /api/system/health
  const fetchServerHealth = useCallback(async () => {
    try {
      const res = await api.get('/system/health');
      if (res.data && res.data.ok) {
        setHealthData(res.data);
        const summary = res.data.summary || {};
        setStats((prev) => ({
          ...prev,
          cpu: summary.cpu_usage_text || `${summary.avg_cpu_pct || 0}%`,
          ram: summary.ram_usage_text || `${summary.ram_used_gb || 0} GB / ${summary.ram_total_gb || 0} GB`,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch server health:', err);
    }
  }, []);

  // Fetch dashboard statistics & recent bookings
  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, bookingsRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/bookings')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        const s = statsRes.value.data;
        setStats((prev) => ({
          ...prev,
          todayBookings: s.activeBookings ?? s.totalBookings ?? prev.todayBookings
        }));
      }

      if (bookingsRes.status === 'fulfilled' && Array.isArray(bookingsRes.value?.data)) {
        setRecentBookings(bookingsRes.value.data.slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  }, []);

  // Set up polling interval every 15 seconds (15000ms)
  useEffect(() => {
    fetchServerHealth();
    fetchDashboardData();

    const interval = setInterval(() => {
      fetchServerHealth();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchServerHealth, fetchDashboardData]);

  return (
    <div className="space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-wide">Admin Dashboard</h1>
          <p className="text-sm text-white/60">ภาพรวมระบบการจองและสถานะฮาร์ดแวร์เซิร์ฟเวอร์แบบเรียลไทม์</p>
        </div>
        {healthData && (
          <div className="text-xs text-white/40 flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>อัปเดตล่าสุด: {healthData.age_s != null ? `${healthData.age_s} วินาทีที่แล้ว` : 'สด'}</span>
          </div>
        )}
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU */}
        <StatCard
          title="CPU Usage"
          value={stats.cpu}
          icon={<Cpu className="w-6 h-6 text-[#A78BFA]" />}
          description="การประมวลผลเฉลี่ย (ทุกโหนด)"
          className="bg-[#1a1a2e] border border-[#2A2A3A]"
        />
        {/* RAM */}
        <StatCard
          title="RAM Usage"
          value={stats.ram}
          icon={<Server className="w-6 h-6 text-[#6EE7B7]" />}
          description="หน่วยความจำรวมที่ถูกใช้งาน"
          className="bg-[#1a1a2e] border border-[#2A2A3A]"
        />
        {/* Online Users */}
        <StatCard
          title="ผู้ใช้ออนไลน์"
          value={`${stats.onlineUsers} คน`}
          icon={<Users className="w-6 h-6 text-[#FDE68A]" />}
          description="ผู้เล่นที่เข้าเซิร์ฟเวอร์ขณะนี้"
          className="bg-[#1a1a2e] border border-[#2A2A3A]"
        />
        {/* Today's Bookings */}
        <StatCard
          title="การจองทั้งหมด"
          value={`${stats.todayBookings} รายการ`}
          icon={<CreditCard className="w-6 h-6 text-[#FCA5A5]" />}
          description="ยอดรายการจองในระบบ"
          className="bg-[#1a1a2e] border border-[#2A2A3A]"
        />
      </div>

      {/* Middle Grid: Server Status List & Network Traffic Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Server Status List */}
        <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-white flex items-center justify-between border-b border-[#2A2A3A] pb-3">
            <span>Server Status</span>
            <span className="text-xs text-[#A78BFA] font-normal flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              Real-time (15s)
            </span>
          </h3>

          <div className="space-y-3">
            {(healthData?.nodes || []).length === 0 ? (
              <div className="text-center py-6 text-white/40 text-xs">
                กำลังโหลดข้อมูลสุขภาพโหนด...
              </div>
            ) : (
              healthData.nodes.map((node) => (
                <div key={node.server_id} className="bg-[#0f0f1a] border border-[#2A2A3A] p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-sm">{node.name}</p>
                      <p className="text-xs text-white/40 font-mono">{node.host || 'local'}</p>
                    </div>
                    <div className="text-right">
                      {node.reachable ? (
                        <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-2.5 py-0.5 rounded-full font-bold">
                          {node.status === 'active' ? 'Active' : 'Online'}
                        </span>
                      ) : (
                        <span className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-xs px-2.5 py-0.5 rounded-full font-bold">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CPU, RAM, Temp metrics per node */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2A2A3A]/60 text-xs text-center font-mono">
                    <div className="bg-[#1a1a2e]/60 p-1.5 rounded-lg">
                      <span className="text-[10px] text-white/40 block font-sans">CPU</span>
                      <span className="text-white font-semibold">{node.cpu_usage_text}</span>
                    </div>
                    <div className="bg-[#1a1a2e]/60 p-1.5 rounded-lg">
                      <span className="text-[10px] text-white/40 block font-sans">RAM</span>
                      <span className="text-[#6EE7B7] font-semibold">{node.ram_usage_text}</span>
                    </div>
                    <div className="bg-[#1a1a2e]/60 p-1.5 rounded-lg">
                      <span className="text-[10px] text-white/40 block font-sans">Temp</span>
                      <span className={node.temp_c >= 70 ? 'text-[#FCA5A5]' : 'text-white'}>
                        {node.temp_c != null ? `${node.temp_c}°C` : '–'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Network Traffic Graph (Grafana Live Embed) */}
        <NetworkTrafficGraph className="lg:col-span-2" />
      </div>

      {/* Recent Bookings Table */}
      <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-white border-b border-[#2A2A3A] pb-3">
          รายการจองล่าสุด (Recent Bookings)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#E0E0E0]">
            <thead className="bg-[#0f0f1a] text-xs uppercase text-white/50 border-b border-[#2A2A3A]">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Server</th>
                <th className="p-3">Date</th>
                <th className="p-3">Time</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A3A]">
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-white/40 text-xs">
                    ไม่พบรายการจอง
                  </td>
                </tr>
              ) : (
                recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#251559]/30 transition-colors">
                    <td className="p-3 font-bold text-white">{b.username || b.user || `User #${b.user_id}`}</td>
                    <td className="p-3 text-[#A78BFA] font-semibold">{b.server_name || `Server #${b.server_id}`}</td>
                    <td className="p-3 text-xs">{b.date ? b.date.slice(0, 10) : '–'}</td>
                    <td className="p-3 text-xs">{b.time_start && b.time_end ? `${b.time_start.slice(0, 5)} - ${b.time_end.slice(0, 5)}` : '–'}</td>
                    <td className="p-3 text-xs font-mono">{b.amount} บาท</td>
                    <td className="p-3">
                      {b.status === 'confirmed' ? (
                        <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-2.5 py-0.5 rounded-full font-bold">
                          ยืนยันแล้ว
                        </span>
                      ) : (
                        <span className="bg-[#78350F] border border-[#D97706] text-[#FDE68A] text-xs px-2.5 py-0.5 rounded-full font-bold">
                          รอยืนยัน
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
