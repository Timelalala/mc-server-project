import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { StatCard, Card } from '../../components/ui';
import { Users, Server, CreditCard, Banknote, ShieldAlert, BarChart3, TrendingUp, Laptop, Cpu } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    cpu: '34%',
    ram: '5.2 GB / 16 GB',
    onlineUsers: 37,
    todayBookings: 12
  });

  const mockServers = [
    { id: 1, name: 'Server A', ip: '192.168.1.101', status: 'online', players: '12/20' },
    { id: 2, name: 'Server B', ip: '192.168.1.102', status: 'online', players: '5/20' },
    { id: 3, name: 'Server C', ip: '192.168.1.103', status: 'offline', players: '0/20' },
    { id: 4, name: 'Server D', ip: '192.168.1.104', status: 'online', players: '18/20' },
  ];

  const mockRecentBookings = [
    { id: 101, user: 'steve99', server: 'Server A', date: '2026-06-16', time: '14:00 - 16:00', amount: '50 บาท', status: 'confirmed' },
    { id: 102, user: 'alex_crafter', server: 'Server B', date: '2026-06-17', time: '18:00 - 20:00', amount: '50 บาท', status: 'pending' },
    { id: 103, user: 'creeper_hunter', server: 'Server D', date: '2026-06-18', time: '20:00 - 22:00', amount: '50 บาท', status: 'confirmed' },
    { id: 104, user: 'miner_boy', server: 'Server A', date: '2026-06-19', time: '10:00 - 12:00', amount: '50 บาท', status: 'pending' },
  ];

  return (
    <div className="space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-wide">Admin Dashboard</h1>
        <p className="text-sm text-white/60">ภาพรวมระบบการจองและสถานะฮาร์ดแวร์เซิร์ฟเวอร์</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU */}
        <StatCard
          title="CPU Usage"
          value={stats.cpu}
          icon={<Cpu className="w-6 h-6 text-[#A78BFA]" />}
          description="การประมวลผลเฉลี่ย"
          className="bg-[#1a1a2e] border border-[#2A2A3A]"
        />
        {/* RAM */}
        <StatCard
          title="RAM Usage"
          value={stats.ram}
          icon={<Server className="w-6 h-6 text-[#6EE7B7]" />}
          description="หน่วยความจำที่ถูกใช้งาน"
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
          title="การจองวันนี้"
          value={`${stats.todayBookings} รายการ`}
          icon={<CreditCard className="w-6 h-6 text-[#FCA5A5]" />}
          description="ยอดรายการจองในวันนี้"
          className="bg-[#1a1a2e] border border-[#2A2A3A]"
        />
      </div>

      {/* Middle Grid: Server Status List & Network Traffic Chart Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Server Status List */}
        <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-white flex items-center justify-between border-b border-[#2A2A3A] pb-3">
            <span>Server Status</span>
            <span className="text-xs text-[#A78BFA] font-normal">Real-time</span>
          </h3>

          <div className="space-y-3">
            {mockServers.map((s) => (
              <div key={s.id} className="bg-[#0f0f1a] border border-[#2A2A3A] p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-sm">{s.name}</p>
                  <p className="text-xs text-white/40 font-mono">{s.ip}</p>
                </div>
                <div className="text-right">
                  {s.status === 'online' ? (
                    <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Online ({s.players})
                    </span>
                  ) : (
                    <span className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Offline
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Network Traffic Graph (Grafana Embed Placeholder) */}
        <Card className="lg:col-span-2 bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#2A2A3A] pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#A78BFA]" />
              <span>Network Traffic Graph (Grafana Live Embed)</span>
            </h3>
            <span className="text-xs font-bold bg-[#052E16] text-[#6EE7B7] px-2.5 py-0.5 rounded-full border border-[#059669]">
              GRAFANA EMBED
            </span>
          </div>

          <div className="bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl p-6 min-h-[260px] flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
            {/* Graph simulated lines */}
            <div className="flex items-end h-32 w-full gap-2 px-4 border-b border-[#2A2A3A]">
              {[30, 45, 60, 40, 75, 90, 65, 80, 50, 70, 85, 95, 60, 40, 55, 75, 80, 70].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-[#4C1D95] to-[#7C3AED] rounded-t-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="text-xs text-white/50 pt-2 font-mono">
              [Grafana Dashboard Embedded Panel: Bandwidth rx/tx (Eth0 Trunking 802.3ad)]
            </p>
          </div>
        </Card>
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
              {mockRecentBookings.map((b) => (
                <tr key={b.id} className="hover:bg-[#251559]/30 transition-colors">
                  <td className="p-3 font-bold text-white">{b.user}</td>
                  <td className="p-3 text-[#A78BFA] font-semibold">{b.server}</td>
                  <td className="p-3 text-xs">{b.date}</td>
                  <td className="p-3 text-xs">{b.time}</td>
                  <td className="p-3 text-xs font-mono">{b.amount}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
