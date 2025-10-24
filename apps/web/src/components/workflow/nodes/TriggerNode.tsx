import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const TriggerNode: React.FC<any> = ({ data, selected }) => {
  const getIcon = () => {
    switch (data.config?.triggerType) {
      case 'manual':
        return '👆';
      case 'schedule':
        return '⏰';
      case 'webhook':
        return '🔗';
      case 'event':
        return '⚡';
      default:
        return '▶️';
    }
  };

  return (
    <NodeWrapper id={data.id} data={data} selected={selected}>
      <div className="min-w-[200px] bg-green-100 border-2 border-green-500 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{getIcon()}</span>
          <div>
            <div className="font-semibold text-green-900">Trigger</div>
            <div className="text-xs text-green-700">{data.label}</div>
          </div>
        </div>
        {data.config?.triggerType === 'schedule' && data.config?.schedule?.cron && (
          <div className="text-xs text-green-600 mt-2 font-mono bg-green-50 p-1 rounded">
            {data.config.schedule.cron}
          </div>
        )}
        {data.config?.triggerType === 'webhook' && data.config?.webhook?.path && (
          <div className="text-xs text-green-600 mt-2 font-mono bg-green-50 p-1 rounded">
            {data.config.webhook.method} {data.config.webhook.path}
          </div>
        )}
      </div>
    </NodeWrapper>
  );
};