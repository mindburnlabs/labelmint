import React from 'react';
import { Node } from 'reactflow';

interface NodeTemplate {
  type: string;
  label: string;
  icon: string;
  description: string;
  category: string;
  initialData: any;
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'trigger',
    label: 'Manual Trigger',
    icon: '👆',
    description: 'Start workflow manually',
    category: 'Triggers',
    initialData: {
      label: 'Manual Trigger',
      config: {
        triggerType: 'manual'
      }
    }
  },
  {
    type: 'trigger',
    label: 'Schedule Trigger',
    icon: '⏰',
    description: 'Start on a schedule',
    category: 'Triggers',
    initialData: {
      label: 'Schedule Trigger',
      config: {
        triggerType: 'schedule',
        schedule: {
          cron: '0 9 * * 1',
          timezone: 'UTC'
        }
      }
    }
  },
  {
    type: 'trigger',
    label: 'Webhook Trigger',
    icon: '🔗',
    description: 'Start via webhook',
    category: 'Triggers',
    initialData: {
      label: 'Webhook Trigger',
      config: {
        triggerType: 'webhook',
        webhook: {
          path: '/webhook',
          method: 'POST'
        }
      }
    }
  },
  {
    type: 'task',
    label: 'Labeling Task',
    icon: '📝',
    description: 'Create labeling tasks',
    category: 'Tasks',
    initialData: {
      label: 'Labeling Task',
      config: {
        taskType: 'labeling',
        assignment: {
          type: 'auto'
        }
      }
    }
  },
  {
    type: 'task',
    label: 'Review Task',
    icon: '👀',
    description: 'Create review tasks',
    category: 'Tasks',
    initialData: {
      label: 'Review Task',
      config: {
        taskType: 'review',
        assignment: {
          type: 'skill_based'
        }
      }
    }
  },
  {
    type: 'validation',
    label: 'Quality Check',
    icon: '✅',
    description: 'Validate data quality',
    category: 'Validation',
    initialData: {
      label: 'Quality Check',
      config: {
        validationType: 'quality',
        rules: []
      }
    }
  },
  {
    type: 'validation',
    label: 'Consensus Check',
    icon: '👥',
    description: 'Check consensus level',
    category: 'Validation',
    initialData: {
      label: 'Consensus Check',
      config: {
        validationType: 'consensus',
        rules: []
      }
    }
  },
  {
    type: 'ai',
    label: 'AI Classification',
    icon: '🏷️',
    description: 'Classify with AI',
    category: 'AI',
    initialData: {
      label: 'AI Classification',
      config: {
        operation: 'classify',
        model: 'gpt-4-vision'
      }
    }
  },
  {
    type: 'ai',
    label: 'AI Extraction',
    icon: '🔍',
    description: 'Extract data with AI',
    category: 'AI',
    initialData: {
      label: 'AI Extraction',
      config: {
        operation: 'extract',
        model: 'gpt-4-vision'
      }
    }
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: '🔀',
    description: 'Branch based on conditions',
    category: 'Logic',
    initialData: {
      label: 'Condition',
      config: {
        condition: '',
        rules: []
      }
    }
  },
  {
    type: 'integration',
    label: 'AWS S3',
    icon: '☁️',
    description: 'Connect to AWS S3',
    category: 'Integrations',
    initialData: {
      label: 'AWS S3',
      config: {
        provider: 'aws',
        service: 's3',
        action: 'upload'
      }
    }
  },
  {
    type: 'integration',
    label: 'Google Storage',
    icon: '☁️',
    description: 'Connect to Google Storage',
    category: 'Integrations',
    initialData: {
      label: 'Google Storage',
      config: {
        provider: 'gcp',
        service: 'storage',
        action: 'upload'
      }
    }
  },
  {
    type: 'webhook',
    label: 'HTTP Request',
    icon: '🌐',
    description: 'Make HTTP request',
    category: 'Actions',
    initialData: {
      label: 'HTTP Request',
      config: {
        url: 'https://api.example.com',
        method: 'POST'
      }
    }
  },
  {
    type: 'email',
    label: 'Send Email',
    icon: '📧',
    description: 'Send email notification',
    category: 'Actions',
    initialData: {
      label: 'Send Email',
      config: {
        to: [],
        subject: 'Workflow Notification'
      }
    }
  },
  {
    type: 'database',
    label: 'Database Query',
    icon: '🗄️',
    description: 'Query database',
    category: 'Actions',
    initialData: {
      label: 'Database Query',
      config: {
        query: 'SELECT * FROM table'
      }
    }
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: '⏳',
    description: 'Wait before continuing',
    category: 'Actions',
    initialData: {
      label: 'Delay',
      config: {
        delay: 5,
        unit: 'seconds'
      }
    }
  },
  {
    type: 'transform',
    label: 'Transform Data',
    icon: '🔄',
    description: 'Transform data format',
    category: 'Actions',
    initialData: {
      label: 'Transform Data',
      config: {
        transformation: ''
      }
    }
  },
  {
    type: 'notification',
    label: 'Send Notification',
    icon: '🔔',
    description: 'Send notification',
    category: 'Actions',
    initialData: {
      label: 'Send Notification',
      config: {
        type: 'in_app'
      }
    }
  }
];

interface NodePaletteProps {
  onAddNode: (template: NodeTemplate) => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const categories = [...new Set(nodeTemplates.map(t => t.category))];
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredTemplates = nodeTemplates.filter(template => {
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesSearch = template.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Node Palette</h2>

        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="p-4 border-b border-gray-200">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <div className="p-2">
        {filteredTemplates.map((template, index) => (
          <div
            key={`${template.type}-${index}`}
            onClick={() => onAddNode(template)}
            className="mb-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{template.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">{template.label}</div>
                <div className="text-xs text-gray-600">{template.description}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};