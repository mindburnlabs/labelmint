import React from 'react';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const TransformNode: React.FC<any> = ({ data, selected }) => (
  <NodeWrapper id={data.id} data={data} selected={selected}>
    <div className="min-w-[200px] bg-pink-100 border-2 border-pink-500 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🔄</span>
        <div>
          <div className="font-semibold text-pink-900">Transform</div>
          <div className="text-xs text-pink-700">{data.label}</div>
        </div>
      </div>
    </div>
  </NodeWrapper>
);