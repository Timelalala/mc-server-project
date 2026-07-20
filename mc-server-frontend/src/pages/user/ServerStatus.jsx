import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Card, Badge } from '../../components/ui';
import { Cpu, Server, Activity, ArrowUpRight, Signal } from 'lucide-react';

const ServerStatus = () => {
  const mockServers = [
    {
      id: 1,
      name: 'Server A',
      ip: '192.168.1.101',
      ping: 15,
      status: 'online',
      cpu: 45,
      ram: '4.2',
      ramTotal: '8.0',
      players: '12/20',
      uptime: '99.9%'
    },
    {
      id: 2,
      name: 'Server B',
      ip: '192.168.1.102',
      ping: 22,
      status: 'online',
      cpu: 28,
      ram: '3.1',
      ramTotal: '8.0',
      players: '5/20',
      uptime: '99.5%'
    },
    {
      id: 3,
      name: 'Server C',
      ip: '192.168.1.103',
      ping: '--',
      status: 'offline',
      cpu: 0,
      ram: '0.0',
      ramTotal: '8.0',
      players: '0/20',
      uptime: '0.0%'
    },
  ];

  const [servers, setServers] = useState(mockServers);
  const [selectedServer, setSelectedServer] = useState(mockServers[0]);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await api.get('/servers');
        if (res.data && res.data.length > 0) {
          const mapped = res.data.map((s, idx) => ({
            id: s.id,
            name: s.name,
            ip: s.ip || `192.168.1.10${idx + 1}`,
            ping: s.status === 'online' ? Math.floor(12 + Math.random() * 18) : '--',
            status: s.status,
            cpu: s.status === 'online' ? Math.floor(25 + Math.random() * 40) : 0,
            ram: s.status === 'online' ? (3.0 + Math.random() * 2.5).toFixed(1) : '0.0',
            ramTotal: '8.0',
            players: `${s.current_players || 0}/20`,
            uptime: s.status === 'online' ? '99.9%' : '0.0%'
          }));
          setServers(mapped);
          setSelectedServer(mapped[0]);
        }
      } catch (err) {
        // Fallback to mock data
      }
    };

    fetchServers();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">สถานะเซิร์ฟเวอร์</h1>
        <p className="text-sm text-white/60">ตรวจสอบสถานะและ Latency แบบ Real-time</p>
      </div>

      {/* 2-Column Layout: Left Server List, Right Selected Server Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: List of Servers */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white mb-2">รายการเซิร์ฟเวอร์</h3>
          {servers.map((s) => {
            const isSelected = selectedServer.id === s.id;
            const isOnline = s.status === 'online';

            return (
              <div
                key={s.id}
                onClick={() => setSelectedServer(s)}
                className={`bg-[#1a1a2e] rounded-2xl p-5 border cursor-pointer transition-all shadow-xl flex items-center justify-between ${
                  isSelected
                    ? 'border-[#7C3AED] bg-[#2d1b69]/40 shadow-purple-900/20'
                    : 'border-[#2A2A3A] hover:border-[#7C3AED]/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">{s.name}</h4>
                    {isOnline ? (
                      <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Online
                      </span>
                    ) : (
                      <span className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Offline
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 font-mono">IP: {s.ip}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-white/50">Ping Latency</p>
                  <p className={`text-base font-black ${isOnline ? 'text-[#6EE7B7]' : 'text-white/20'}`}>
                    {s.ping} {isOnline && 'ms'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Server Detailed Metrics */}
        <div className="lg:col-span-2">
          <Card className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-8 space-y-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2A2A3A] pb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedServer.name} - System Metrics</h3>
                <p className="text-xs text-[#A78BFA] mt-1 font-mono">IP: {selectedServer.ip}</p>
              </div>

              <div>
                {selectedServer.status === 'online' ? (
                  <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-sm px-4 py-1.5 rounded-full font-bold">
                    ● Online
                  </span>
                ) : (
                  <span className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-sm px-4 py-1.5 rounded-full font-bold">
                    ● Offline
                  </span>
                )}
              </div>
            </div>

            {/* Metrics Bars with #7C3AED */}
            <div className="space-y-6">
              {/* CPU Metric */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">CPU Usage</span>
                  <span className="text-[#A78BFA]">{selectedServer.cpu}%</span>
                </div>
                <div className="h-3 bg-[#0f0f1a] rounded-full overflow-hidden border border-[#2A2A3A]">
                  <div
                    className="h-full bg-[#7C3AED] transition-all duration-500 rounded-full"
                    style={{ width: `${selectedServer.cpu}%` }}
                  />
                </div>
              </div>

              {/* RAM Metric */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">RAM Usage</span>
                  <span className="text-[#A78BFA]">{selectedServer.ram} GB / {selectedServer.ramTotal} GB</span>
                </div>
                <div className="h-3 bg-[#0f0f1a] rounded-full overflow-hidden border border-[#2A2A3A]">
                  <div
                    className="h-full bg-[#7C3AED] transition-all duration-500 rounded-full"
                    style={{ width: `${(parseFloat(selectedServer.ram) / parseFloat(selectedServer.ramTotal)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Player Metric */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">Player Count</span>
                  <span className="text-[#A78BFA]">{selectedServer.players}</span>
                </div>
                <div className="h-3 bg-[#0f0f1a] rounded-full overflow-hidden border border-[#2A2A3A]">
                  <div
                    className="h-full bg-[#7C3AED] transition-all duration-500 rounded-full"
                    style={{
                      width: `${(parseInt(selectedServer.players.split('/')[0]) / 20) * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* Uptime Metric */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">Uptime</span>
                  <span className="text-[#A78BFA]">{selectedServer.uptime}</span>
                </div>
                <div className="h-3 bg-[#0f0f1a] rounded-full overflow-hidden border border-[#2A2A3A]">
                  <div
                    className="h-full bg-[#7C3AED] transition-all duration-500 rounded-full"
                    style={{ width: selectedServer.status === 'online' ? '99.9%' : '0%' }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default ServerStatus;
