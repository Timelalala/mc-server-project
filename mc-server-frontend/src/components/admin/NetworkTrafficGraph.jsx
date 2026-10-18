import React, { useState } from 'react';
import { Activity, ExternalLink, RefreshCw } from 'lucide-react';
import { Card } from '../ui';

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000';
const PANEL_SRC = `${GRAFANA_URL}/d-solo/mc-cluster-traffic/mc-cluster-network-traffic?orgId=1&panelId=1&refresh=2s&theme=dark&kiosk`;
const DASHBOARD_URL = `${GRAFANA_URL}/d/mc-cluster-traffic/mc-cluster-network-traffic?orgId=1&refresh=2s`;

const NetworkTrafficGraph = ({ className = '' }) => {
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <Card className={`bg-[#1a1a2e] border border-[#2A2A3A] rounded-2xl p-6 space-y-4 shadow-xl ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A3A] pb-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#38BDF8]" />
          <span>Network Traffic (MC1 – MC4 Breakdown)</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold bg-[#052E16] text-[#6EE7B7] px-2.5 py-0.5 rounded-full border border-[#059669] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
            GRAFANA LIVE
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            title="รีโหลดกราฟ"
            className="p-1 rounded-lg bg-[#2A2A3A]/60 hover:bg-[#2A2A3A] text-white/70 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="เปิด Grafana เต็มจอ"
            className="p-1 rounded-lg bg-[#2A2A3A]/60 hover:bg-[#2A2A3A] text-white/70 hover:text-white transition-colors flex items-center gap-1 text-xs"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="w-full bg-[#0f0f1a] border border-[#2A2A3A] rounded-xl overflow-hidden min-h-[340px] relative">
        <iframe
          key={iframeKey}
          src={PANEL_SRC}
          width="100%"
          height="340"
          frameBorder="0"
          className="w-full rounded-xl"
          title="Cluster Network Traffic (Grafana Live)"
        />
      </div>
    </Card>
  );
};

export default NetworkTrafficGraph;
