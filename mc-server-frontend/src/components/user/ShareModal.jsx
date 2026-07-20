import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { Share2, Copy, Check } from 'lucide-react';

const ShareModal = ({ isOpen, onClose, booking }) => {
  const [copied, setCopied] = useState(false);

  if (!booking) return null;

  // Format time (HH:MM)
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  // Convert MySQL Date String to Thai format
  const formatDateThai = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '25xx' // Thai Buddhist year representation or standard conversion
    }).replace('25xx', date.getFullYear() + 543);
  };

  const getShareMessage = () => {
    return `🎮 ชวนมาเล่น Minecraft!
🖥 ${booking.server_name}
🌐 IP: ${booking.ip}
🔌 Port: ${booking.port}
🔑 Password: ${booking.mc_password}
📅 วันที่: ${formatDateThai(booking.date)}
⏰ เวลา: ${formatTime(booking.time_start)} – ${formatTime(booking.time_end)} น.
👥 รองรับได้ 20 คน`;
  };

  const handleCopy = () => {
    const text = getShareMessage();
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error('Failed to copy text: ', err));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แชร์ข้อมูลเซิร์ฟเวอร์">
      <div className="space-y-5">
        <p className="text-sm text-text-muted">
          คัดลอกข้อความด้านล่างนี้เพื่อส่งชวนเพื่อนใน Line หรือ Discord ได้ทันที!
        </p>

        {/* Share Message Container */}
        <div className="bg-bg-input border border-border-default rounded-xl p-4.5 font-mono text-sm leading-relaxed text-text-body whitespace-pre-wrap select-all">
          {getShareMessage()}
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            ปิด
          </Button>
          <Button variant="primary" onClick={handleCopy} className="flex items-center gap-2">
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span>คัดลอกสำเร็จ!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>คัดลอกข้อความ</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ShareModal;
