import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Card } from '../../components/ui';
import { useAllServersStatus } from '../../hooks/useServerStatus';

const mockServers = [
  {
    id: 1,
    name: 'Java Survival',
    edition: 'java',
    mc_version: '1.21',
    mod_name: null,
    mod_version: null,
    status: 'online',
    session_count: 0,
    current_players: 0,
    max_players: 20,
    description: 'Vanilla Survival โลกธรรมดา เหมาะสำหรับผู้เล่นทุกระดับ',
    icon: '⛏️'
  },
  {
    id: 2,
    name: 'RLCraft',
    edition: 'java',
    mc_version: '1.12.2',
    mod_name: 'RLCraft',
    mod_version: '2.9.3',
    status: 'offline',
    session_count: 0,
    current_players: 0,
    max_players: 20,
    description: 'Survival สุดโหด มีระบบ Thirst, Hunger, Temperature และ Monster เยอะมาก',
    icon: '💀'
  },
  {
    id: 3,
    name: 'RL Dregora',
    edition: 'java',
    mc_version: '1.12.2',
    mod_name: 'RLCraft + Dregora',
    mod_version: '2.9.3',
    status: 'offline',
    session_count: 0,
    current_players: 0,
    max_players: 20,
    description: 'RLCraft รุ่น Dregora มี Biome และ Structure เพิ่มเติม กราฟิกสวยกว่าปกติ',
    icon: '🐉'
  },
  {
    id: 4,
    name: 'Pixelmon',
    edition: 'java',
    mc_version: '1.16.5',
    mod_name: 'Pixelmon Mod',
    mod_version: '9.1.11',
    status: 'offline',
    session_count: 0,
    current_players: 0,
    max_players: 20,
    description: 'เล่น Minecraft แบบ Pokemon จับ เทรน และต่อสู้กับ Pokemon ในโลก Minecraft',
    icon: '⚡'
  }
];

const mockRecentBookings = [
  { id: 101, username: 'steve99', serverName: 'Java Survival', date: '16 มิ.ย.', time: '14:00 - 16:00', status: 'confirmed' },
  { id: 102, username: 'alex_crafter', serverName: 'RLCraft', date: '17 มิ.ย.', time: '18:00 - 20:00', status: 'pending' },
  { id: 103, username: 'creeper_hunter', serverName: 'Pixelmon', date: '18 มิ.ย.', time: '20:00 - 22:00', status: 'confirmed' },
];

const Home = () => {
  const navigate = useNavigate();
  const [baseServers, setBaseServers] = useState(mockServers);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial base servers & my recent bookings
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const res = await api.get('/servers');
        if (res.data && res.data.length > 0) {
          // Merge API data with icons/descriptions if missing
          const merged = res.data.map(srv => {
            const fallback = mockServers.find(m => m.id === srv.id) || {};
            return { ...fallback, ...srv };
          });
          setBaseServers(merged);
        } else {
          setBaseServers(mockServers);
        }
      } catch (err) {
        setBaseServers(mockServers);
      } finally {
        setLoading(false);
      }
    };

    const fetchMyBookings = async () => {
      try {
        const resBookings = await api.get('/bookings/my');
        if (resBookings.data && resBookings.data.length > 0) {
          setRecentBookings(resBookings.data.slice(0, 3));
        } else {
          setRecentBookings(mockRecentBookings);
        }
      } catch (err) {
        setRecentBookings(mockRecentBookings);
      }
    };

    fetchBaseData();
    fetchMyBookings();
  }, []);

  // Real-time Socket.IO overlay on top of base server data
  const { servers, connected } = useAllServersStatus(baseServers);

  const handleBook = (serverId) => {
    navigate(`/booking?serverId=${serverId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 text-[#E0E0E0] bg-[#0f0f1a] min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-white tracking-wide">เลือกเซิฟเวอร์</h1>
          <p className="text-sm text-white/60">เลือกเซิฟเวอร์เเล้วกดจอง</p>
        </div>

        {/* Socket.IO Real-time Connection Indicator */}
        <div className="flex items-center gap-1.5 text-xs bg-[#1a1a2e] border border-[#2A2A3A] px-3.5 py-1.5 rounded-full shadow-md font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <span
            className="w-2 h-2 rounded-full transition-colors duration-500"
            style={{ background: connected ? '#4ade80' : '#6b7280' }}
          />
          <span>{connected ? 'Real-time' : 'กำลังเชื่อมต่อ...'}</span>
        </div>
      </div>

      {/* Grid 2x2 Server Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-[#1a1a2e] border border-[#2A2A3A] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {servers.map((server) => {
            const isOnline = (server.id === 1 || server.name === 'Java Survival') ? true : server.status === 'online';
            const currentPlayers = typeof server.current_players === 'number'
              ? server.current_players
              : (server.session_count !== undefined ? server.session_count : 0);
            const maxPlayers = server.max_players || 20;
            const isFull = currentPlayers >= maxPlayers;
            const percentage = Math.min(100, Math.round((currentPlayers / maxPlayers) * 100));

            return (
              <Card
                key={server.id}
                className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 flex flex-col justify-between hover:border-[#7C3AED] transition-all shadow-xl space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Bar: Icon + Name & Real-time Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl bg-[#0f0f1a] p-2 rounded-xl border border-[#2A2A3A]">
                        {server.icon || '⛏️'}
                      </span>
                      <div>
                        <h3 className="text-xl font-bold text-white leading-snug">{server.name}</h3>
                        <p className="text-xs text-[#a78bfa] font-semibold">
                          {server.edition ? server.edition.toUpperCase() : 'JAVA'} Edition {server.mc_version || '1.21'}
                        </p>
                      </div>
                    </div>

                    {/* Badge Online/Offline */}
                    {isOnline ? (
                      <span
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors duration-300"
                        style={{
                          background: 'rgba(6,78,59,0.6)',
                          color: '#6ee7b7',
                          border: '1px solid #059669'
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-300"
                          style={{ background: '#4ade80' }}
                        />
                        Online
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors duration-300"
                        style={{
                          background: 'rgba(69,10,10,0.6)',
                          color: '#fca5a5',
                          border: '1px solid #dc2626'
                        }}
                      >
                        Offline
                      </span>
                    )}
                  </div>

                  {/* Mod Badge if present */}
                  {server.mod_name && (
                    <div>
                      <span className="inline-flex items-center gap-1.5 bg-[#4C1D95]/40 border border-[#7C3AED]/50 text-[#c4b5fd] text-xs px-3 py-1 rounded-lg font-medium">
                        🧩 {server.mod_name} {server.mod_version ? `v${server.mod_version}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
                    {server.description || 'Minecraft Raspberry Pi Server'}
                  </p>

                  {/* Player Session Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-white/50">ผู้เล่นในเซิร์ฟเวอร์</span>
                      <span className={isFull ? 'text-red-400 font-bold' : 'text-white/80'}>
                        {currentPlayers} / {maxPlayers} คน {isFull && '(เต็มแล้ว)'}
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-[#0f0f1a] rounded-full overflow-hidden border border-[#2A2A3A]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          background: isFull ? '#dc2626' : '#7C3AED'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Booking Button */}
                <div className="pt-2">
                  <button
                    onClick={() => handleBook(server.id)}
                    className="w-full bg-transparent border border-white text-white hover:bg-white hover:text-[#0f0f1a] font-bold py-2.5 rounded-full transition-all text-sm flex items-center justify-center gap-2 shadow"
                  >
                    จองเซิฟเวอร์
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom Section: ล่าสุดการจอง */}
      <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📋</span> ล่าสุดการจอง
        </h3>

        <div className="divide-y divide-[#2A2A3A]">
          {recentBookings.map((b, idx) => (
            <div key={idx} className="py-3.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2d1b69] border border-purple-400/30 text-[#A78BFA] font-bold flex items-center justify-center text-xs">
                  {b.username ? b.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <p className="font-bold text-white">{b.serverName || `Server ${b.serverId || 'A'}`}</p>
                  <p className="text-xs text-white/50">{b.date} • {b.time}</p>
                </div>
              </div>

              <div>
                {b.status === 'confirmed' ? (
                  <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    ยืนยันแล้ว
                  </span>
                ) : (
                  <span className="bg-[#78350F] border border-[#D97706] text-[#FDE68A] text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    รอยืนยัน
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
