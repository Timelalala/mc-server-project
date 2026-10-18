import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../../utils/api';
import { Card } from '../../components/ui';
import { ShieldAlert, Loader2 } from 'lucide-react';
import NetworkTrafficGraph from '../../components/admin/NetworkTrafficGraph';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const fmtCpu = (cpu) => {
  if (typeof cpu !== 'number' || cpu == null) return '–';
  return `${cpu.toFixed(1)}%`;
};

const fmtRam = (used, total) => {
  if (typeof used !== 'number' || typeof total !== 'number' || used == null || total == null) return '–';
  const usedGb = (used / 1024).toFixed(1);
  const totalGb = (total / 1024).toFixed(1);
  return `${usedGb}/${totalGb} GB`;
};

const fmtTemp = (temp) => {
  if (typeof temp !== 'number' || temp == null) return '–';
  return `${temp.toFixed(1)} °C`;
};

const fmtServiceState = (state) => {
  if (!state) return '–';
  if (state === 'active') return 'เกมเปิดอยู่';
  if (state === 'inactive') return 'เกมปิด';
  return state;
};

const fmtUptime = (seconds) => {
  if (typeof seconds !== 'number' || seconds == null) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
};

const renderStatusBadge = (node) => {
  const level = node ? node.level : 'stale';

  switch (level) {
    case 'ok':
      return (
        <span className="bg-[#052E16] border border-[#059669] text-[#6EE7B7] text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
          ปกติ
        </span>
      );
    case 'warn':
      return (
        <span className="bg-[#78350F] border border-[#D97706] text-[#FDE68A] text-xs px-3 py-1 rounded-full font-bold">
          ร้อน/เคยถูกลดความเร็ว
        </span>
      );
    case 'hot':
      return (
        <span className="bg-[#450A0A] border border-[#DC2626] text-[#FCA5A5] text-xs px-3 py-1 rounded-full font-bold animate-pulse">
          ร้อนเกิน
        </span>
      );
    case 'down':
      return (
        <div className="text-right">
          <span className="bg-[#450A0A] border border-[#991B1B] text-[#F87171] text-xs px-3 py-1 rounded-full font-bold">
            ขาดการติดต่อ
          </span>
          {node?.error && (
            <p className="text-[10px] text-[#F87171]/80 mt-1 max-w-[180px] truncate" title={node.error}>
              {node.error}
            </p>
          )}
        </div>
      );
    case 'stale':
    default:
      return (
        <span className="bg-[#1f1f2e] border border-[#3B3B4F] text-white/50 text-xs px-3 py-1 rounded-full font-bold">
          ไม่มีข้อมูลล่าสุด
        </span>
      );
  }
};

const shouldShowCommandBar = (cmd, now) => {
  if (!cmd) return false;
  if (cmd.status === 'pending' || cmd.status === 'running') return true;
  if (cmd.status === 'done' || cmd.status === 'failed') {
    const finishedAt = cmd.finished_at ? new Date(cmd.finished_at).getTime() : 0;
    return (now - finishedAt) <= 30000;
  }
  return false;
};

const getCommandBarStyle = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-[#1f1f2e] border-[#3B3B4F] text-white/70';
    case 'running':
      return 'bg-[#0c4a6e]/40 border-[#0284c7]/50 text-[#7dd3fc]';
    case 'done':
      return 'bg-[#052E16] border-[#059669] text-[#6EE7B7]';
    case 'failed':
      return 'bg-[#450A0A] border-[#DC2626] text-[#FCA5A5]';
    default:
      return 'bg-[#1f1f2e] border-[#3B3B4F] text-white/70';
  }
};

const renderCommandStatusContent = (cmd) => {
  if (cmd.status === 'pending') {
    return (
      <span className="flex items-center gap-1.5 text-white/70">
        <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
        รอ MC1 รับคำสั่ง…
      </span>
    );
  }
  if (cmd.status === 'running') {
    const actionVerb = cmd.action === 'start' ? 'เปิด' : cmd.action === 'stop' ? 'หยุด' : cmd.action === 'backup' ? 'สำรองข้อมูล' : 'รีสตาร์ท';
    return (
      <span className="flex items-center gap-2 text-[#7dd3fc]">
        <Loader2 size={14} className="animate-spin text-[#38bdf8]" />
        กำลัง{actionVerb}…
      </span>
    );
  }
  if (cmd.status === 'done') {
    return (
      <span className="text-[#6EE7B7] flex items-center gap-1.5 truncate">
        <span className="font-bold">✓</span>
        <span>{cmd.message || 'ทำรายการสำเร็จ'}</span>
      </span>
    );
  }
  if (cmd.status === 'failed') {
    return (
      <span className="text-[#FCA5A5] flex items-center gap-1.5 truncate">
        <span className="font-bold">✗</span>
        <span>{cmd.message || 'ทำรายการไม่สำเร็จ'}</span>
      </span>
    );
  }
  return null;
};

const Servers = () => {
  const [servers, setServers] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [commands, setCommands] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [msg, setMsg] = useState('');
  const [now, setNow] = useState(Date.now());

  // Tick every second to update command banner visibility (30s timeout)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchServers = useCallback(async () => {
    try {
      const res = await api.get('/admin/servers');
      if (res.data && Array.isArray(res.data)) {
        setServers(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await api.get('/admin/nodes/health');
      if (res.data) {
        setHealthData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch node health:', err);
    }
  }, []);

  const fetchCommands = useCallback(async () => {
    try {
      const res = await api.get('/admin/nodes/commands');
      if (res.data?.commands && Array.isArray(res.data.commands)) {
        setCommands(res.data.commands);
      }
    } catch (err) {
      console.error('Failed to fetch commands:', err);
    }
  }, []);

  useEffect(() => {
    fetchServers();
    fetchHealth();
    fetchCommands();

    const interval = setInterval(fetchHealth, 30000);

    const socket = io(SOCKET_URL, { autoConnect: true });
    const handleHealthUpdate = () => {
      fetchHealth();
    };
    const handleCommandUpdate = () => {
      fetchCommands();
    };

    socket.on('nodes-health-updated', handleHealthUpdate);
    socket.on('node-command-updated', handleCommandUpdate);

    return () => {
      clearInterval(interval);
      socket.off('nodes-health-updated', handleHealthUpdate);
      socket.off('node-command-updated', handleCommandUpdate);
      socket.disconnect();
    };
  }, [fetchServers, fetchHealth, fetchCommands]);

  // Poll commands every 3 seconds if any command is active (pending or running)
  useEffect(() => {
    const hasActive = commands.some((c) => c.status === 'pending' || c.status === 'running');
    if (!hasActive) return;

    const pollInterval = setInterval(() => {
      fetchCommands();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [commands, fetchCommands]);

  const handleAction = async (serverId, action) => {
    const key = `${serverId}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true, [serverId]: true }));
    setMsg('');

    try {
      await api.post(`/admin/servers/${serverId}/${action}`);
      fetchCommands();
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data || {};

      if (status === 409 && data.needs_confirm) {
        const verb = action === 'stop' ? 'หยุด' : 'รีสตาร์ท';
        const confirmMsg = `มีลูกค้ากำลังเล่นอยู่ (การจอง #${data.booking_id} ถึง ${data.end_at} น.) ต้องการ${verb}จริงหรือไม่?\nลูกค้าจะหลุดจากเกมทันที`;
        if (window.confirm(confirmMsg)) {
          try {
            await api.post(`/admin/servers/${serverId}/${action}`, { force: true });
            fetchCommands();
          } catch (forceErr) {
            setMsg(forceErr.response?.data?.message || forceErr.message || 'เกิดข้อผิดพลาดในการส่งคำสั่ง');
          }
        }
      } else if (status === 409 && data.busy) {
        setMsg('มีคำสั่งของเซิร์ฟเวอร์นี้กำลังทำงานอยู่');
      } else if (status === 501) {
        setMsg('Backup จากหน้าเว็บยังไม่รองรับ');
      } else {
        setMsg(data.message || err.message || 'เกิดข้อผิดพลาดในการส่งคำสั่ง');
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false, [serverId]: false }));
    }
  };

  return (
    <div className="space-y-8 text-[#E0E0E0]">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-wide">จัดการเซิร์ฟเวอร์</h1>
        <p className="text-sm text-white/60">ควบคุมและจัดการเซิร์ฟเวอร์ Minecraft ทั้งหมดในระบบ</p>
      </div>

      {/* Warning banner if stale */}
      {healthData?.stale && (
        <div className="bg-[#78350F]/20 border border-[#D97706]/40 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm text-[#FDE68A] flex items-center gap-2.5">
          <ShieldAlert size={18} className="text-[#D97706] flex-shrink-0" />
          <span>
            {healthData.age_s != null
              ? `ไม่ได้รับข้อมูลจาก MC1 มา ${healthData.age_s} วินาที — ตรวจ SSH tunnel หรือ MC1`
              : 'ไม่ได้รับข้อมูลจาก MC1 (ยังไม่เคยได้รับข้อมูล) — ตรวจ SSH tunnel หรือ MC1'}
          </span>
        </div>
      )}

      {msg && (
        <div className="bg-[#450A0A] border border-[#DC2626] rounded-xl p-3.5 text-xs text-[#FCA5A5] flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-[#FCA5A5]/60 hover:text-white ml-2 text-sm font-bold">✕</button>
        </div>
      )}

      {/* Network Traffic Live Graph (Grafana Embed) */}
      <NetworkTrafficGraph />

      {/* Grid of Server Cards */}
      {servers.length === 0 ? (
        <div className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-12 text-center text-white/50 text-sm">
          กำลังโหลดข้อมูลเซิร์ฟเวอร์...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {servers.map((s) => {
            const node = (healthData?.nodes || []).find((n) => Number(n.server_id) === Number(s.id));
            const latestCmd = commands.find((c) => Number(c.server_id) === Number(s.id));
            const level = node ? node.level : 'stale';
            const serviceState = node?.service_state;

            const isBusy = latestCmd && (latestCmd.status === 'pending' || latestCmd.status === 'running');
            const isDownOrStale = level === 'down' || level === 'stale';
            const isServerLoading = !!actionLoading[s.id];
            const allDisabled = isBusy || isDownOrStale || isServerLoading;

            const startDisabled = allDisabled || !(serviceState === 'inactive' || serviceState === 'failed');
            const stopDisabled = allDisabled || !(serviceState === 'active');
            const restartDisabled = allDisabled || !(serviceState === 'active');
            const backupDisabled = allDisabled;

            return (
              <Card key={s.id} className="bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-5 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#2A2A3A] pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{s.name}</h3>
                    <p className="text-xs text-white/40 font-mono mt-0.5">
                      {node?.host || s.ip || '–'}
                    </p>
                  </div>
                  <div>
                    {renderStatusBadge(node)}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#0f0f1a] border border-[#2A2A3A] p-4 rounded-xl text-center text-xs font-semibold">
                  <div>
                    <p className="text-white/40 text-[10px]">CPU</p>
                    <p className="text-white font-bold text-sm">{fmtCpu(node?.cpu_pct)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px]">RAM</p>
                    <p className="text-white font-bold text-sm">{fmtRam(node?.ram_used_mb, node?.ram_total_mb)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px]">อุณหภูมิ</p>
                    <p className={`font-bold text-sm ${node?.temp_c >= 80 ? 'text-[#F87171]' : node?.temp_c >= 70 ? 'text-[#FDE68A]' : 'text-white'}`}>
                      {fmtTemp(node?.temp_c)}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px]">สถานะเกม</p>
                    <p className={`font-bold text-sm ${serviceState === 'active' ? 'text-[#6EE7B7]' : serviceState === 'inactive' ? 'text-white/60' : 'text-white'}`}>
                      {fmtServiceState(serviceState)}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px]">Uptime</p>
                    <p className="text-white font-bold text-sm">{fmtUptime(node?.uptime_s)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[10px]">Players</p>
                    <p className="text-white font-bold text-sm">
                      {(typeof s.current_players === 'number' ? s.current_players : 0)} / {s.max_players || 20} คน
                    </p>
                  </div>
                </div>

                {/* Latest Command Status Bar (only if active or ended <= 30 seconds ago) */}
                {shouldShowCommandBar(latestCmd, now) && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${getCommandBarStyle(latestCmd.status)}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      {renderCommandStatusContent(latestCmd)}
                    </div>
                    {latestCmd.status === 'running' && (
                      <span className="text-[10px] text-white/40">MC1 กำลังดำเนินการ</span>
                    )}
                  </div>
                )}

                {/* Action Buttons: Start, Stop, Restart, Backup */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <button
                    onClick={() => handleAction(s.id, 'start')}
                    disabled={startDisabled}
                    className="bg-[#052E16] hover:bg-[#059669] border border-[#059669] text-[#6EE7B7] hover:text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▶ Start
                  </button>
                  <button
                    onClick={() => handleAction(s.id, 'stop')}
                    disabled={stopDisabled}
                    className="bg-[#450A0A] hover:bg-[#DC2626] border border-[#DC2626] text-[#FCA5A5] hover:text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ■ Stop
                  </button>
                  <button
                    onClick={() => handleAction(s.id, 'restart')}
                    disabled={restartDisabled}
                    className="bg-[#78350F] hover:bg-[#D97706] border border-[#D97706] text-[#FDE68A] hover:text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    🔄 Restart
                  </button>
                  <button
                    onClick={() => handleAction(s.id, 'backup')}
                    disabled={backupDisabled}
                    className="bg-[#2e1065] hover:bg-[#7c3aed] border border-[#7c3aed] text-[#c4b5fd] hover:text-white font-bold py-2 rounded-xl text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    📦 Backup
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Servers;


