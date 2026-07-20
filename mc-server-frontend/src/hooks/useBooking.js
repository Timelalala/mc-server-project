import { useState, useCallback } from 'react';
import api from '../utils/api';

const useBooking = () => {
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);

  const fetchSlots = useCallback(async (serverId, date) => {
    if (!serverId || !date) return;
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await api.get(`/servers/${serverId}/slots`, {
        params: { date }
      });
      setSlots(res.data);
    } catch (err) {
      console.error('Error fetching slots:', err);
      setError(err.response?.data?.message || 'Failed to fetch slots.');
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  const selectServer = (server) => {
    setSelectedServer(server);
    setSelectedSlot(null);
    setSlots([]);
    fetchSlots(server.id, selectedDate);
  };

  const changeDate = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (selectedServer) {
      fetchSlots(selectedServer.id, date);
    }
  };

  const selectSlot = (slot) => {
    setSelectedSlot(slot);
  };

  const resetBooking = () => {
    setSelectedServer(null);
    setSelectedSlot(null);
    setSlots([]);
    setError(null);
  };

  return {
    selectedServer,
    selectedDate,
    selectedSlot,
    slots,
    loadingSlots,
    error,
    selectServer,
    changeDate,
    selectSlot,
    fetchSlots,
    resetBooking
  };
};

export default useBooking;
