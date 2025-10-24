import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth';
import { toast } from 'sonner';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    // Listen for real-time events
    socket.on('user_activity', (data) => {
      console.log('User activity:', data);
      // Update user activity in real-time
    });

    socket.on('project_status', (data) => {
      console.log('Project status update:', data);
      // Update project status
      if (data.status === 'completed') {
        toast.success(`Project ${data.projectId} has been completed!`);
      }
    });

    socket.on('payment_alerts', (data) => {
      console.log('Payment alert:', data);
      if (data.type === 'withdrawal_request') {
        toast.info(`New withdrawal request: ${data.amount} ${data.currency}`);
      }
    });

    socket.on('system_alerts', (data) => {
      console.log('System alert:', data);
      if (data.level === 'critical') {
        toast.error(data.message);
      } else if (data.level === 'warning') {
        toast.warning(data.message);
      }
    });

    socket.on('new_dispute', (data) => {
      console.log('New dispute:', data);
      toast.error(`New dispute opened in Project #${data.projectId}`);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = (type: string, data: any) => {
    if (socketRef.current && connected) {
      socketRef.current.emit(type, data);
    }
  };

  const subscribeToRoom = (room: string) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('join_room', room);
    }
  };

  const unsubscribeFromRoom = (room: string) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('leave_room', room);
    }
  };

  return {
    connected,
    sendMessage,
    subscribeToRoom,
    unsubscribeFromRoom,
  };
}