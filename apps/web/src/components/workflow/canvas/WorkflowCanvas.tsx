import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  NodeTypes,
  Handle,
  Position,
  NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowNode as WorkflowNodeType, WorkflowDefinition } from '@/types/workflow';
import { TriggerNode } from '../nodes/TriggerNode';
import { TaskNode } from '../nodes/TaskNode';
import { ValidationNode } from '../nodes/ValidationNode';
import { IntegrationNode } from '../nodes/IntegrationNode';
import { AINode } from '../nodes/AINode';
import { ConditionNode } from '../nodes/ConditionNode';
import { WebhookNode } from '../nodes/WebhookNode';
import { EmailNode } from '../nodes/EmailNode';
import { DatabaseNode } from '../nodes/DatabaseNode';
import { DelayNode } from '../nodes/DelayNode';
import { TransformNode } from '../nodes/TransformNode';
import { NotificationNode } from '../nodes/NotificationNode';

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  task: TaskNode,
  validation: ValidationNode,
  integration: IntegrationNode,
  ai: AINode,
  condition: ConditionNode,
  webhook: WebhookNode,
  email: EmailNode,
  database: DatabaseNode,
  delay: DelayNode,
  transform: TransformNode,
  notification: NotificationNode,
};

interface WorkflowCanvasProps {
  workflow?: Partial<WorkflowDefinition>;
  onWorkflowChange?: (workflow: WorkflowDefinition) => void;
  readOnly?: boolean;
  onExecute?: (workflowId: string) => void;
  onSave?: (workflow: WorkflowDefinition) => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  onWorkflowChange,
  readOnly = false,
  onExecute,
  onSave
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || []);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (!readOnly) {
      setSelectedNode(node);
    }
  }, [readOnly]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      })
    );
  }, [setNodes]);

  const executeWorkflow = useCallback(async () => {
    if (!onExecute || isExecuting) return;

    setIsExecuting(true);
    try {
      // Convert to workflow definition
      const workflowDef: WorkflowDefinition = {
        id: workflow?.id || `workflow-${Date.now()}`,
        name: workflow?.name || 'Untitled Workflow',
        description: workflow?.description,
        version: workflow?.version || 1,
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type as any,
          position: n.position,
          data: n.data
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          condition: e.data?.condition
        })),
        variables: workflow?.variables || [],
        settings: workflow?.settings
      };

      await onExecute(workflowDef.id);
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [onExecute, isExecuting, nodes, edges, workflow]);

  const saveWorkflow = useCallback(() => {
    if (!onSave) return;

    const workflowDef: WorkflowDefinition = {
      id: workflow?.id || `workflow-${Date.now()}`,
      name: workflow?.name || 'Untitled Workflow',
      description: workflow?.description,
      version: workflow?.version || 1,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type as any,
        position: n.position,
        data: n.data
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        condition: e.data?.condition
      })),
      variables: workflow?.variables || [],
      settings: workflow?.settings
    };

    onSave(workflowDef);
  }, [onSave, nodes, edges, workflow]);

  // Notify parent of changes
  useEffect(() => {
    if (onWorkflowChange) {
      const workflowDef: WorkflowDefinition = {
        id: workflow?.id || `workflow-${Date.now()}`,
        name: workflow?.name || 'Untitled Workflow',
        description: workflow?.description,
        version: workflow?.version || 1,
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type as any,
          position: n.position,
          data: n.data
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          condition: e.data?.condition
        })),
        variables: workflow?.variables || [],
        settings: workflow?.settings
      };
      onWorkflowChange(workflowDef);
    }
  }, [nodes, edges, onWorkflowChange, workflow]);

  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'trigger': return '#10b981';
                case 'task': return '#3b82f6';
                case 'validation': return '#f59e0b';
                case 'integration': return '#8b5cf6';
                case 'ai': return '#ec4899';
                case 'condition': return '#06b6d4';
                default: return '#6b7280';
              }
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />

          <Panel position="top-right" className="flex gap-2">
            {!readOnly && (
              <>
                <button
                  onClick={saveWorkflow}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Workflow
                </button>
                <button
                  onClick={executeWorkflow}
                  disabled={isExecuting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? 'Executing...' : 'Execute Workflow'}
                </button>
              </>
            )}
          </Panel>

          <Panel position="bottom-center" className="bg-white/90 backdrop-blur rounded-lg p-2 shadow-lg">
            <div className="text-sm text-gray-600">
              {selectedNode ? (
                <span>Selected: {selectedNode.data.label}</span>
              ) : (
                <span>Click on a node to configure it</span>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

// Custom node wrapper for handles
export const NodeWrapper: React.FC<NodeProps> = ({ id, data, children, selected }) => {
  return (
    <div className={`relative ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
      {children}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
    </div>
  );
};