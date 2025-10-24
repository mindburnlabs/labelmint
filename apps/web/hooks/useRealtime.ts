import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeClient } from '../lib/realtime-client';
import { useAuth } from './useAuth';
import { toast } from 'react-hot-toast';

interface UseRealtimeOptions {
  autoConnect?: boolean;
  projectId?: string;
  role?: string;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { autoConnect = true, projectId, role = 'worker' } = options;
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [liveProgress, setLiveProgress] = useState<any>(null);
  const [projectAnalytics, setProjectAnalytics] = useState<any>(null);
  const [projectQuality, setProjectQuality] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  const clientRef = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    if (!token || !autoConnect) return;

    const client = new RealtimeClient({
      serverUrl: process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:3001',
      token,
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    });

    clientRef.current = client;

    client.connect().then(() => {
      setIsConnected(true);
      if (projectId) {
        client.joinProject(projectId, role);
      }
      requestNotificationPermission();
    }).catch(error => {
      console.error('Failed to connect to real-time server:', error);
      toast.error('Failed to connect to real-time features');
    });

    client.on('connect', () => {
      setIsConnected(true);
      toast.success('Connected to real-time updates');
    });

    client.on('disconnect', () => {
      setIsConnected(false);
      toast.error('Disconnected from real-time updates');
    });

    client.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 49)]);

      toast(notification.message, {
        duration: notification.priority === 'critical' ? 5000 : 3000,
        icon: notification.type === 'payment_received' ? '💰' :
              notification.type === 'task_assigned' ? '📋' :
              notification.type === 'quality_alert' ? '⚠️' : '🔔'
      });
    });

    client.on('task_assigned', (data) => {
      toast(`New task assigned: ${data.task.type}`, {
        icon: '📋',
        action: {
          label: 'View Task',
          onClick: () => window.location.href = `/tasks/${data.task.id}`
        }
      });
    });

    client.on('task_updated', (data) => {
      setLiveProgress(prev => ({
        ...prev,
        [data.taskId]: data
      }));
    });

    client.on('progress_update', (data) => {
      setLiveProgress(prev => ({
        ...prev,
        [data.taskId]: {
          ...prev?.[data.taskId],
          ...data
        }
      }));
    });

    client.on('live_progress', (data) => {
      setLiveProgress(data);
    });

    client.on('analytics_update', (data) => {
      setProjectAnalytics(data);
    });

    client.on('project_quality', (data) => {
      setProjectQuality(data);
    });

    client.on('leaderboard_updated', (data) => {
      setLeaderboard(data.leaderboard || []);
    });

    client.on('user_joined', (data) => {
      setOnlineUsers(prev => [...prev.filter(u => u.userId !== data.userId), data]);
      toast(`${data.userId} joined the project`, { icon: '👋' });
    });

    client.on('user_left', (data) => {
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      toast(`${data.userId} left the project`, { icon: '👋' });
    });

    client.on('collaboration_started', (data) => {
      toast('Collaboration session started', {
        icon: '🤝',
        action: {
          label: 'Join',
          onClick: () => window.location.href = `/collaborate/${data.taskId}`
        }
      });
    });

    return () => {
      client.disconnect();
    };
  }, [token, autoConnect, projectId, role]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        clientRef.current?.subscribeToPushNotifications().catch(error => {
          console.error('Failed to subscribe to push notifications:', error);
        });
      }
    }
  }, []);

  const joinProject = useCallback((projectId: string, role: string = 'worker') => {
    clientRef.current?.joinProject(projectId, role);
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    clientRef.current?.leaveProject(projectId);
  }, []);

  const updateTaskProgress = useCallback((data: {
    taskId: string;
    projectId: string;
    progress: number;
    status: string;
    timeSpent?: number;
    quality?: number;
  }) => {
    clientRef.current?.updateTaskProgress(data);
  }, []);

  const startCollaboration = useCallback((data: {
    taskId: string;
    participants: string[];
    deadline?: number;
  }) => {
    clientRef.current?.startCollaboration(data);
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/realtime/notifications/' + notificationId + '/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [token]);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/realtime/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read: true }))
        );
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [token]);

  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  return {
    isConnected,
    notifications,
    unreadCount: getUnreadCount(),
    liveProgress,
    projectAnalytics,
    projectQuality,
    leaderboard,
    onlineUsers,
    joinProject,
    leaveProject,
    updateTaskProgress,
    startCollaboration,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    requestNotificationPermission
  };
}