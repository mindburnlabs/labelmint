import React from 'react';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const NotificationNode: React.FC<any> = ({ data, selected }) => (
  <NodeWrapper id={data.id} data={data} selected={selected}>
    <div className="min-w-[200px] bg-red-100 border-2 border-red-500 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🔔</span>
        <div>
          <div className="font-semibold text-red-900">Notification</div>
          <div className="text-xs text-red-700">{data.label}</div>
        </div>
      </div>
    </div>
  </NodeWrapper>
);