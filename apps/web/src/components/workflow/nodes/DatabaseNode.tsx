import React from 'react';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const DatabaseNode: React.FC<any> = ({ data, selected }) => (
  <NodeWrapper id={data.id} data={data} selected={selected}>
    <div className="min-w-[200px] bg-emerald-100 border-2 border-emerald-500 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🗄️</span>
        <div>
          <div className="font-semibold text-emerald-900">Database</div>
          <div className="text-xs text-emerald-700">{data.label}</div>
        </div>
      </div>
    </div>
  </NodeWrapper>
);