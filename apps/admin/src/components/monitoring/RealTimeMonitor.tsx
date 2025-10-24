'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import {
  Activity,
  Server,
  Database,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
  activeConnections: number;
  requestsPerSecond: number;
  avgResponseTime: number;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  lastCheck: Date;
  responseTime?: number;
}

export function RealTimeMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    networkIn: 0,
    networkOut: 0,
    activeConnections: 0,
    requestsPerSecond: 0,
    avgResponseTime: 0,
  });

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API Gateway', status: 'healthy', uptime: 99.99, lastCheck: new Date(), responseTime: 45 },
    { name: 'Database', status: 'healthy', uptime: 99.95, lastCheck: new Date(), responseTime: 12 },
    { name: 'Queue Service', status: 'healthy', uptime: 99.99, lastCheck: new Date(), responseTime: 8 },
    { name: 'Storage', status: 'degraded', uptime: 98.5, lastCheck: new Date(), responseTime: 150 },
    { name: 'WebSocket Server', status: 'healthy', uptime: 99.99, lastCheck: new Date(), responseTime: 25 },
  ]);

  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>>([]);

  const { isConnected, lastMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'system_metrics') {
        setMetrics(message.payload);
      } else if (message.type === 'service_status') {
        setServices(prev =>
          prev.map(service =>
            service.name === message.payload.name
              ? { ...service, ...message.payload }
              : service
          )
        );
      } else if (message.type === 'alert') {
        setAlerts(prev => [message.payload, ...prev.slice(0, 9)]);
      }
    },
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpu: Math.random() * 100,
        memory: 60 + Math.random() * 30,
        requestsPerSecond: Math.floor(100 + Math.random() * 900),
        avgResponseTime: 50 + Math.random() * 100,
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'down':
        return 'text-red-600 bg-red-100';
    }
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'down':
        return <XCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Last update: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </Card>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="CPU Usage"
          value={metrics.cpu.toFixed(1)}
          unit="%"
          icon={<Server className="h-5 w-5" />}
          color={metrics.cpu > 80 ? 'red' : metrics.cpu > 60 ? 'yellow' : 'green'}
        />
        <MetricCard
          title="Memory"
          value={metrics.memory.toFixed(1)}
          unit="%"
          icon={<Database className="h-5 w-5" />}
          color={metrics.memory > 85 ? 'red' : metrics.memory > 70 ? 'yellow' : 'green'}
        />
        <MetricCard
          title="Requests/sec"
          value={metrics.requestsPerSecond}
          icon={<Zap className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          title="Avg Response"
          value={metrics.avgResponseTime.toFixed(0)}
          unit="ms"
          icon={<Clock className="h-5 w-5" />}
          color={metrics.avgResponseTime > 200 ? 'red' : metrics.avgResponseTime > 100 ? 'yellow' : 'green'}
        />
      </div>

      {/* Services Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Service Status</h3>
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(service.status)}
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-gray-500">
                    Uptime: {service.uptime.toFixed(2)}%
                    {service.responseTime && ` • ${service.responseTime}ms`}
                  </p>
                </div>
              </div>
              <Badge className={getStatusColor(service.status)}>
                {service.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Resource Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">CPU</span>
                <span className="text-sm">{metrics.cpu.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.cpu} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Memory</span>
                <span className="text-sm">{metrics.memory.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.memory} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Disk</span>
                <span className="text-sm">{metrics.disk.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.disk} className="h-2" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500">No alerts</p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 rounded-lg text-sm ${
                    alert.type === 'error' ? 'bg-red-50 text-red-700' :
                    alert.type === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-blue-50 text-blue-700'
                  }`}
                >
                  <p>{alert.message}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {alert.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color: 'green' | 'yellow' | 'red' | 'blue';
}

function MetricCard({ title, value, unit, icon, color }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <Card className={`p-4 ${colorClasses[color]} border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-xl font-bold">
            {value}
            {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
          </p>
        </div>
        <div className="opacity-75">
          {icon}
        </div>
      </div>
    </Card>
  );
}