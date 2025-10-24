import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const IntegrationNode: React.FC<any> = ({ data, selected }) => (
  <NodeWrapper id={data.id} data={data} selected={selected}>
    <div className="min-w-[200px] bg-indigo-100 border-2 border-indigo-500 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🔌</span>
        <div>
          <div className="font-semibold text-indigo-900">Integration</div>
          <div className="text-xs text-indigo-700">{data.label}</div>
        </div>
      </div>
    </div>
  </NodeWrapper>
);