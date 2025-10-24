import React from 'react';
import { Handle, Position } from 'reactflow';
import { NodeWrapper } from '../canvas/WorkflowCanvas';

export const AINode: React.FC<any> = ({ data, selected }) => {
  const getIcon = () => {
    switch (data.config?.operation) {
      case 'classify':
        return '🏷️';
      case 'extract':
        return '🔍';
      case 'analyze':
        return '📊';
      case 'predict':
        return '🔮';
      case 'generate':
        return '✨';
      default:
        return '🤖';
    }
  };

  return (
    <NodeWrapper id={data.id} data={data} selected={selected}>
      <div className="min-w-[200px] bg-purple-100 border-2 border-purple-500 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{getIcon()}</span>
          <div>
            <div className="font-semibold text-purple-900">AI Operation</div>
            <div className="text-xs text-purple-700">{data.label}</div>
          </div>
        </div>
        {data.config?.model && (
          <div className="text-xs text-purple-600 mt-2">
            Model: {data.config.model}
          </div>
        )}
        {data.config?.prompt && (
          <div className="text-xs text-purple-600 mt-1 truncate">
            Prompt: {data.config.prompt}
          </div>
        )}
      </div>
    </NodeWrapper>
  );
};