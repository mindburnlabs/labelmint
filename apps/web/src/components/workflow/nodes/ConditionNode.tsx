import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const ConditionNode: React.FC<any> = ({ data, selected }) => (
  <NodeWrapper id={data.id} data={data} selected={selected}>
    <div className="min-w-[200px] bg-cyan-100 border-2 border-cyan-500 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🔀</span>
        <div>
          <div className="font-semibold text-cyan-900">Condition</div>
          <div className="text-xs text-cyan-700">{data.label}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="w-3 h-3 bg-green-400 border-2 border-white"
        style={{ left: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="w-3 h-3 bg-red-400 border-2 border-white"
        style={{ left: '65%' }}
      />
    </div>
  </NodeWrapper>
);