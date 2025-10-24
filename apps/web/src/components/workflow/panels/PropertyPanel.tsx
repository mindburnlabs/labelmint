import React, { useState } from 'react';
import { Node } from 'reactflow';

interface PropertyPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, data: any) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedNode,
  onUpdateNode
}) => {
  const [formData, setFormData] = useState(selectedNode?.data || {});

  React.useEffect(() => {
    setFormData(selectedNode?.data || {});
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 h-full p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Properties</h3>
        <p className="text-gray-500 text-sm">Select a node to configure its properties</p>
      </div>
    );
  }

  const handleInputChange = (path: string, value: any) => {
    const newData = { ...formData };
    setNestedProperty(newData, path, value);
    setFormData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const setNestedProperty = (obj: any, path: string, value: any) => {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  };

  const renderTriggerConfig = () => {
    const triggerType = formData.config?.triggerType;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trigger Type
          </label>
          <select
            value={triggerType || ''}
            onChange={(e) => handleInputChange('config.triggerType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type</option>
            <option value="manual">Manual</option>
            <option value="schedule">Schedule</option>
            <option value="webhook">Webhook</option>
            <option value="event">Event</option>
          </select>
        </div>

        {triggerType === 'schedule' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cron Expression
              </label>
              <input
                type="text"
                value={formData.config?.schedule?.cron || ''}
                onChange={(e) => handleInputChange('config.schedule.cron', e.target.value)}
                placeholder="0 9 * * 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <input
                type="text"
                value={formData.config?.schedule?.timezone || ''}
                onChange={(e) => handleInputChange('config.schedule.timezone', e.target.value)}
                placeholder="UTC"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        {triggerType === 'webhook' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Path
              </label>
              <input
                type="text"
                value={formData.config?.webhook?.path || ''}
                onChange={(e) => handleInputChange('config.webhook.path', e.target.value)}
                placeholder="/webhook"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Method
              </label>
              <select
                value={formData.config?.webhook?.method || ''}
                onChange={(e) => handleInputChange('config.webhook.method', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderTaskConfig = () => {
    const taskType = formData.config?.taskType;

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Type
          </label>
          <select
            value={taskType || ''}
            onChange={(e) => handleInputChange('config.taskType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type</option>
            <option value="labeling">Labeling</option>
            <option value="review">Review</option>
            <option value="validation">Validation</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {taskType === 'labeling' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project ID
              </label>
              <input
                type="text"
                value={formData.config?.projectId || ''}
                onChange={(e) => handleInputChange('config.projectId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignment Type
              </label>
              <select
                value={formData.config?.assignment?.type || ''}
                onChange={(e) => handleInputChange('config.assignment.type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
                <option value="skill_based">Skill Based</option>
              </select>
            </div>
          </>
        )}

        {taskType === 'review' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consensus Level
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.config?.quality?.consensusLevel || 2}
              onChange={(e) => handleInputChange('config.quality.consensusLevel', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
    );
  };

  const renderAIConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Operation
          </label>
          <select
            value={formData.config?.operation || ''}
            onChange={(e) => handleInputChange('config.operation', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select operation</option>
            <option value="classify">Classify</option>
            <option value="extract">Extract</option>
            <option value="analyze">Analyze</option>
            <option value="predict">Predict</option>
            <option value="generate">Generate</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Model
          </label>
          <select
            value={formData.config?.model || ''}
            onChange={(e) => handleInputChange('config.model', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select model</option>
            <option value="gpt-4-vision">GPT-4 Vision</option>
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prompt
          </label>
          <textarea
            value={formData.config?.prompt || ''}
            onChange={(e) => handleInputChange('config.prompt', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter AI prompt..."
          />
        </div>
      </div>
    );
  };

  const renderConditionConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Condition Expression
          </label>
          <textarea
            value={formData.config?.condition || ''}
            onChange={(e) => handleInputChange('config.condition', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., {{output.confidence}} > 0.9"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logic
          </label>
          <select
            value={formData.config?.logic || 'and'}
            onChange={(e) => handleInputChange('config.logic', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </div>
      </div>
    );
  };

  const renderConfig = () => {
    switch (selectedNode.type) {
      case 'trigger':
        return renderTriggerConfig();
      case 'task':
        return renderTaskConfig();
      case 'ai':
        return renderAIConfig();
      case 'condition':
        return renderConditionConfig();
      default:
        return (
          <div className="text-gray-500 text-sm">
            Configuration for {selectedNode.type} nodes coming soon...
          </div>
        );
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Properties</h3>
        <p className="text-sm text-gray-600 mt-1">{selectedNode.data.label}</p>
      </div>

      <div className="p-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Node Label
          </label>
          <input
            type="text"
            value={formData.label || ''}
            onChange={(e) => handleInputChange('label', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Configuration</h4>
          {renderConfig()}
        </div>
      </div>
    </div>
  );
};