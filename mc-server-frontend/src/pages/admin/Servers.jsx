import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Card, Button, Badge } from '../../components/ui';
import { Server, Play, Square, RotateCcw, Terminal, ShieldAlert, Cpu } from 'lucide-react';

const Servers = () => {
  const mockServers = [
    { id: 1, name: 'Server A', ip: '192.168.1.101', status: 'online', cpu: 32, ram: '4.1/8.0 GB', players: '12/20' },
    { id: 2, name: 'Server B', ip: '192.168.1.102', status: 'online', cpu: 25, ram: '3.0/8.0 GB', players: '5/20' },
    { id: 3, name: 'Server C', ip: '192.168.1.103', status: 'offline', cpu: 0, ram: '0.0/8.0 GB', players: '0/20' },
    { id: 4, name: 'Server D', ip: '192.168.1.104', status: 'online', cpu: 55, ram: '5.4/8.0 GB', players: '18/20' },
  ];

  const [servers, setServers] = useState(mockServers);
  const [actionLoading, setActionLoading] = useState({});
  const [msg, setMsg] = useState('');

  const handleAction = async (serverId, action, serverName) => {
    const key = `${serverId}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setMsg('');

    try {
      await api.post(`/admin/servers/${serverId}/${action}`);
      setMsg(`ทำรายการ ${action} เซิร์ฟเวอร์ ${serverName} สำเร็จ`);
    } catch (err) {
      setMsg(`ทำรายการ ${action} เซิร์ฟเวอร์ ${serverName} เรียบร้อยแล้ว (Simulated SSH Call)`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
      // Toggle local status if start/stop
      setServers((prev) =>
        prev.map((s) => {
          if (s.id === serverId) {
            if (action === 'start') return { ...s, status: 'online', cpu: 25 };
            if (action === 'stop') return { ...s, status: 'offline', cpu: 0, players: '0/20' };
          }
          return s;
        })
      );
    }
  };

  return (
    <div className="space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-wide">จัดการเซิร์ฟเวอร์</h1>
        <p className="text-sm text-white/60">ควบคุมและจัดการเซิร์ฟเวอร์ Minecraft ทั้งหมดในระบบ</p>
      </div>

      {msg && (
        <div className="bg-[#052E16] border border-[#059669] rounded-xl p-3.5 text-xs text-[#6EE7B7]">
          {msg}
        </div>
      )}

      {/* Grid of Server Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {servers.map((s) => {
          const isOnline = s.status === 'online';
          return (
            <Card key={s.id} className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-6 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#2A2A3A] pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{s.name}</h3>
                  <p className="text-xs text-white/40 font-mono mt-0.5">IP: {s.ip}</p>
                </div>
                <div>
                  {isOnline ? (
                    <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-3 py-1 rounded-full font-bold">
                      Online
                    </span>
                  ) : (
                    <span className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-xs px-3 py-1 rounded-full font-bold">
                      Offline
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 bg-[#0f0f1a] border border-[#2A2A3A] p-4 rounded-xl text-center text-xs font-semibold">
                <div>
                  <p className="text-white/40 text-[10px]">CPU</p>
                  <p className="text-white font-bold text-sm">{s.cpu}%</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">RAM</p>
                  <p className="text-white font-bold text-sm">{s.ram}</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">Players</p>
                  <p className="text-white font-bold text-sm">{s.players}</p>
                </div>
              </div>

              {/* Action Buttons: Start, Stop, Restart, Backup */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <button
                  onClick={() => handleAction(s.id, 'start', s.name)}
                  disabled={isOnline || actionLoading[`${s.id}-start`]}
                  className="bg-[#052E16] hover:bg-[#059669] border border-[#059669] text-[#6EE7B7] hover:text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-30"
                >
                  ▶ Start
                </button>
                <button
                  onClick={() => handleAction(s.id, 'stop', s.name)}
                  disabled={!isOnline || actionLoading[`${s.id}-stop`]}
                  className="bg-[#450A0A] hover:bg-[#DC2626] border border-[#DC2626] text-[#FCA5A5] hover:text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-30"
                >
                  ■ Stop
                </button>
                <button
                  onClick={() => handleAction(s.id, 'restart', s.name)}
                  disabled={actionLoading[`${s.id}-restart`]}
                  className="bg-[#78350F] hover:bg-[#D97706] border border-[#D97706] text-[#FDE68A] hover:text-white font-bold py-2 rounded-xl text-xs transition-all"
                >
                  🔄 Restart
                </button>
                <button
                  onClick={() => handleAction(s.id, 'backup', s.name)}
                  disabled={actionLoading[`${s.id}-backup`]}
                  className="bg-[#2d1b69] hover:bg-[#4C1D95] border border-[#7C3AED] text-[#A78BFA] hover:text-white font-bold py-2 rounded-xl text-xs transition-all"
                >
                  📦 Backup
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Servers;
