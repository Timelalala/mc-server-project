import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

// ใช้งาน VITE_SOCKET_URL หรือแปลงจาก VITE_API_URL (ตัด /api ออก) หรือ fallback ตามสภาพแวดล้อม
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'))
let socket = null

// ใช้ instance เดียวกันทั้งแอป ไม่สร้างใหม่ทุกครั้งที่เปลี่ยนหน้า
export function getSocket() {
  if (!socket) socket = io(SOCKET_URL, { autoConnect: true })
  return socket
}

// Hook สำหรับหน้า Home — ดูสถานะทุก Server พร้อมกัน
export function useAllServersStatus(initialServers = []) {
  const [servers, setServers]   = useState(initialServers)
  const [connected, setConnected] = useState(false)

  // Sync with initialServers when baseServers are loaded from API
  useEffect(() => {
    if (initialServers && initialServers.length > 0) {
      setServers(initialServers);
    }
  }, [initialServers]);

  useEffect(() => {
    const s = getSocket()

    if (s.connected) setConnected(true)

    const handleConnect    = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)
    const handleStatus = (statusList) => {
      setServers(prev => prev.map(server => {
        const update = statusList.find(u => u.serverId === server.id)
        return update
          ? {
              ...server,
              status: update.status,
              session_count: update.current,
              current_players: update.current,
              max_players: update.max
            }
          : server
      }))
    }

    s.on('connect', handleConnect)
    s.on('disconnect', handleDisconnect)
    s.on('servers-status', handleStatus)

    return () => {
      s.off('connect', handleConnect)
      s.off('disconnect', handleDisconnect)
      s.off('servers-status', handleStatus)
    }
  }, [])

  return { servers, connected }
}

// Hook สำหรับหน้า ServerStatus — ดูเจาะจงตัวเดียว
export function useServerStatus(serverId) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!serverId) return
    const s = getSocket()
    const eventName = `server-${serverId}-status`
    const handleUpdate = (data) => setStatus(data)
    s.on(eventName, handleUpdate)
    return () => s.off(eventName, handleUpdate)
  }, [serverId])

  return status
}
