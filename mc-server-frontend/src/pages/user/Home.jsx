import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Card, Button, Badge } from '../../components/ui';
import { Server, ArrowRight, Network, Shield, Cpu, Activity } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock server list A, B, C, D fallback
  const mockServers = [
    { id: 1, name: 'Server A', status: 'online', current_players: 12, max_players: 20, ip: '192.168.1.101:25565' },
    { id: 2, name: 'Server B', status: 'online', current_players: 5, max_players: 20, ip: '192.168.1.102:25565' },
    { id: 3, name: 'Server C', status: 'offline', current_players: 0, max_players: 20, ip: '192.168.1.103:25565' },
    { id: 4, name: 'Server D', status: 'online', current_players: 18, max_players: 20, ip: '192.168.1.104:25565' },
  ];

  const mockRecentBookings = [
    { id: 101, username: 'steve99', serverName: 'Server A', date: '16 มิ.ย.', time: '14:00 - 16:00', status: 'confirmed' },
    { id: 102, username: 'alex_crafter', serverName: 'Server B', date: '17 มิ.ย.', time: '18:00 - 20:00', status: 'pending' },
    { id: 103, username: 'creeper_hunter', serverName: 'Server D', date: '18 มิ.ย.', time: '20:00 - 22:00', status: 'confirmed' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/servers');
        if (res.data && res.data.length > 0) {
          setServers(res.data);
        } else {
          setServers(mockServers);
        }
      } catch (err) {
        console.log('Using mock servers data');
        setServers(mockServers);
      }

      try {
        const resBookings = await api.get('/bookings/my');
        if (resBookings.data && resBookings.data.length > 0) {
          setRecentBookings(resBookings.data.slice(0, 3));
        } else {
          setRecentBookings(mockRecentBookings);
        }
      } catch (err) {
        setRecentBookings(mockRecentBookings);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleBook = (serverId) => {
    navigate(`/booking?serverId=${serverId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 text-[#E0E0E0]">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-wide">เลือกเซิฟเวอร์</h1>
        <p className="text-sm text-white/60">เลือกเซิฟเวอร์เเล้วกดจอง</p>
      </div>

      {/* Grid 2x2 Server Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-[#1a1a2e] border border-[#2A2A3A] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {servers.map((server) => {
            const isOnline = server.status === 'online';
            return (
              <Card
                key={server.id}
                className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 flex flex-col justify-between hover:border-[#7C3AED] transition-all shadow-xl"
              >
                <div className="space-y-4">
                  {/* Title & Badge */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">{server.name}</h3>
                    {isOnline ? (
                      <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-3 py-1 rounded-full font-semibold">
                        ● Online
                      </span>
                    ) : (
                      <span className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-xs px-3 py-1 rounded-full font-semibold">
                        ● Offline
                      </span>
                    )}
                  </div>

                  {/* Player Count */}
                  <div className="text-sm font-semibold text-white/40">
                    {server.current_players || 0}/20 Player
                  </div>
                </div>

                {/* Booking Button */}
                <div className="pt-6">
                  <button
                    onClick={() => handleBook(server.id)}
                    className="w-full border border-white text-white hover:bg-white hover:text-[#0f0f1a] font-bold py-2.5 rounded-full transition-all text-sm flex items-center justify-center gap-2"
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
