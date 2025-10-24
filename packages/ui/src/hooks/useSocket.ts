import { useEffect, useRef, useState, useCallback } from 'react';
import {
  SocketService,
  SocketConfig,
  SocketEventName,
  SocketEventHandler,
  getSocketService,
  initializeSocketService,
} from '../services/socketService';

export interface UseSocketOptions extends Partial<SocketConfig> {
  autoConnect?: boolean;
  subscribeToUser?: string;
  subscribeToProject?: string;
  subscribeToGlobal?: boolean;
}

export interface UseSocketReturn {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  socketId: string | undefined;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  emit: (event: string, ...args: any[]) => void;
  emitWithAck: <T = any>(event: string, data?: any) => Promise<T>;
  on: <E extends SocketEventName>(event: E, handler: SocketEventHandler<E>) => void;
  off: <E extends SocketEventName>(event: E, handler?: SocketEventHandler<E>) => void;
  joinRoom: (room: string) => Promise<void>;
  leaveRoom: (room: string) => Promise<void>;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
    auth,
    autoConnect = true,
    subscribeToUser,
    subscribeToProject,
    subscribeToGlobal = false,
    ...socketConfig
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [socketId, setSocketId] = useState<string | undefined>(undefined);

  // Refs
  const socketServiceRef = useRef<SocketService | null>(null);
  const mountedRef = useRef(true);

  // Initialize socket service
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Try to get existing instance or create new one
      try {
        socketServiceRef.current = getSocketService();
      } catch {
        socketServiceRef.current = initializeSocketService({
          url,
          auth,
          autoConnect: false,
          ...socketConfig,
        });
      }

      // Set up connection event handlers
      socketServiceRef.current.on('connect', () => {
        if (mountedRef.current) {
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          setSocketId(socketServiceRef.current?.getSocketId());

          // Subscribe to rooms
          if (subscribeToUser) {
            socketServiceRef.current?.subscribeToUser(subscribeToUser);
          }
          if (subscribeToProject) {
            socketServiceRef.current?.subscribeToProject(subscribeToProject);
          }
          if (subscribeToGlobal) {
            socketServiceRef.current?.subscribeToGlobal();
          }
        }
      });

      socketServiceRef.current.on('disconnect', () => {
        if (mountedRef.current) {
          setIsConnected(false);
          setSocketId(undefined);
        }
      });

      socketServiceRef.current.on('connect_error', (err) => {
        if (mountedRef.current) {
          setError(err);
          setIsConnecting(false);
        }
      });

      // Auto-connect if enabled
      if (autoConnect) {
        connect();
      }
    } catch (err) {
      console.error('Failed to initialize socket service:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize socket'));
    }

    return () => {
      mountedRef.current = false;
    };
  }, [url, auth, autoConnect, subscribeToUser, subscribeToProject, subscribeToGlobal]);

  // Connect
  const connect = useCallback(async () => {
    if (!socketServiceRef.current || isConnecting) return;

    try {
      setIsConnecting(true);
      setError(null);
      await socketServiceRef.current.connect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect socket');
      setError(error);
      console.error('Failed to connect socket:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (!socketServiceRef.current) return;

    socketServiceRef.current.disconnect();
    setIsConnected(false);
    setSocketId(undefined);
  }, []);

  // Emit event
  const emit = useCallback((event: string, ...args: any[]) => {
    if (!socketServiceRef.current) {
      console.warn('Socket service not initialized');
      return;
    }

    socketServiceRef.current.emit(event, ...args);
  }, []);

  // Emit with acknowledgment
  const emitWithAck = useCallback(
    async <T = any>(event: string, data?: any): Promise<T> => {
      if (!socketServiceRef.current) {
        throw new Error('Socket service not initialized');
      }

      return socketServiceRef.current.emitWithAck<T>(event, data);
    },
    []
  );

  // Subscribe to event
  const on = useCallback(
    <E extends SocketEventName>(event: E, handler: SocketEventHandler<E>) => {
      if (!socketServiceRef.current) {
        console.warn('Socket service not initialized');
        return;
      }

      socketServiceRef.current.on(event, handler);
    },
    []
  );

  // Unsubscribe from event
  const off = useCallback(
    <E extends SocketEventName>(event: E, handler?: SocketEventHandler<E>) => {
      if (!socketServiceRef.current) return;

      socketServiceRef.current.off(event, handler);
    },
    []
  );

  // Join room
  const joinRoom = useCallback(async (room: string) => {
    if (!socketServiceRef.current) {
      throw new Error('Socket service not initialized');
    }

    return socketServiceRef.current.joinRoom(room);
  }, []);

  // Leave room
  const leaveRoom = useCallback(async (room: string) => {
    if (!socketServiceRef.current) {
      throw new Error('Socket service not initialized');
    }

    return socketServiceRef.current.leaveRoom(room);
  }, []);

  return {
    // State
    isConnected,
    isConnecting,
    error,
    socketId,

    // Actions
    connect,
    disconnect,
    emit,
    emitWithAck,
    on,
    off,
    joinRoom,
    leaveRoom,
  };
}

/**
 * Hook for listening to specific socket events
 */
export function useSocketEvent<E extends SocketEventName>(
  event: E,
  handler: SocketEventHandler<E>,
  dependencies: any[] = []
): void {
  const { on, off, isConnected } = useSocket({ autoConnect: false });

  useEffect(() => {
    if (!isConnected) return;

    on(event, handler);

    return () => {
      off(event, handler);
    };
  }, [isConnected, event, handler, ...dependencies]);
}

/**
 * Hook for real-time notifications
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const { on, off, isConnected } = useSocket();

  useEffect(() => {
    if (!isConnected) return;

    const handleNotification = (notification: any) => {
      setNotifications((prev) => [notification, ...prev]);
    };

    on('user:notification', handleNotification);

    return () => {
      off('user:notification', handleNotification);
    };
  }, [isConnected, on, off]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notifications,
    clearNotifications,
    removeNotification,
  };
}

/**
 * Hook for real-time balance updates
 */
export function useBalanceUpdates(userId?: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const { on, off, isConnected } = useSocket({
    subscribeToUser: userId,
  });

  useEffect(() => {
    if (!isConnected || !userId) return;

    const handleBalanceUpdate = (data: { userId: string; newBalance: number }) => {
      if (data.userId === userId) {
        setBalance(data.newBalance);
      }
    };

    on('user:balance_update', handleBalanceUpdate);

    return () => {
      off('user:balance_update', handleBalanceUpdate);
    };
  }, [isConnected, userId, on, off]);

  return balance;
}

/**
 * Hook for real-time leaderboard updates
 */
export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const { on, off, isConnected, emit } = useSocket({
    subscribeToGlobal: true,
  });

  useEffect(() => {
    if (!isConnected) return;

    const handleLeaderboardUpdate = (data: any[]) => {
      setLeaderboard(data);
    };

    on('leaderboard:update', handleLeaderboardUpdate);

    // Request initial leaderboard data
    emit('leaderboard:get');

    return () => {
      off('leaderboard:update', handleLeaderboardUpdate);
    };
  }, [isConnected, on, off, emit]);

  const refreshLeaderboard = useCallback(() => {
    emit('leaderboard:get');
  }, [emit]);

  return {
    leaderboard,
    refreshLeaderboard,
  };
}

export default useSocket;

