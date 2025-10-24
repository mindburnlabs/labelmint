'use client';

import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  const connect = () => {
    const token = authClient.getToken();
    if (!token) {
      console.warn('No auth token available for WebSocket connection');
      return;
    }

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}?token=${token}`;

    try {
      setConnectionStatus('connecting');
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectCountRef.current = 0;
        onConnect?.();

        // Send initial message to authenticate
        wsRef.current?.send(JSON.stringify({
          type: 'auth',
          payload: { token }
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onDisconnect?.();

        // Attempt to reconnect if not manually closed
        if (!event.wasClean && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`WebSocket disconnected. Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval * Math.pow(2, reconnectCountRef.current - 1)); // Exponential backoff
        }
      };

      wsRef.current.onerror = (error) => {
        setConnectionStatus('error');
        onError?.(error);
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      setConnectionStatus('error');
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const sendMessage = (type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: Date.now()
      };
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
    }
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    sendMessage,
    connect,
    disconnect
  };
}

// Specific hooks for different real-time updates
export function useProjectUpdates(projectId?: string) {
  const [projectUpdates, setProjectUpdates] = useState<any>(null);

  const { isConnected, lastMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'project_update' && (!projectId || message.payload.projectId === projectId)) {
        setProjectUpdates(message.payload);
      }
    }
  });

  return { isConnected, projectUpdates };
}

export function useTaskUpdates() {
  const [taskStats, setTaskStats] = useState<any>(null);

  const { isConnected, lastMessage, sendMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'task_stats_update') {
        setTaskStats(message.payload);
      }
    }
  });

  // Subscribe to task updates for specific projects
  const subscribeToProjectTasks = (projectId: string) => {
    sendMessage('subscribe_project_tasks', { projectId });
  };

  return { isConnected, taskStats, subscribeToProjectTasks };
}

export function useDashboardUpdates() {
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  const { isConnected, lastMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'dashboard_stats_update') {
        setDashboardStats(message.payload);
      }
    }
  });

  return { isConnected, dashboardStats };
}