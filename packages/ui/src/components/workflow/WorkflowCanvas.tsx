import React, { useCallback, useRef, useState, useEffect, memo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { WorkflowControls } from './WorkflowControls';
import { WorkflowInfo } from './WorkflowInfo';
import { WorkflowMiniMap } from './WorkflowMiniMap';
import { Card } from '../Card';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

// Define node types externally to avoid recreation
const defaultNodeTypes: NodeTypes = {};

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: any[];
  edges: any[];
  variables?: any[];
  settings?: any;
}

interface WorkflowCanvasProps extends ComponentProps {
  workflow?: Partial<WorkflowDefinition>;
  onWorkflowChange?: (workflow: WorkflowDefinition) => void;
  readOnly?: boolean;
  onExecute?: (workflowId: string) => void;
  onSave?: (workflow: WorkflowDefinition) => void;
  nodeTypes?: NodeTypes;
  showControls?: boolean;
  showInfo?: boolean;
  showMiniMap?: boolean;
  controlVariant?: 'default' | 'compact' | 'minimal';
}

const WorkflowCanvasComponent = memo<WorkflowCanvasProps>(({
  workflow,
  onWorkflowChange,
  readOnly = false,
  onExecute,
  onSave,
  nodeTypes = defaultNodeTypes,
  showControls = true,
  showInfo = true,
  showMiniMap = true,
  controlVariant = 'default',
  className,
  ...props
}) => {
  // State management
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || []);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Refs
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Memoized callbacks
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
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
  }, [setNodes]);

  // Memoized workflow definition creation
  const createWorkflowDefinition = useCallback((): WorkflowDefinition => ({
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
  }), [workflow, nodes, edges]);

  // Execute workflow
  const executeWorkflow = useCallback(async () => {
    if (!onExecute || isExecuting) return;

    setIsExecuting(true);
    try {
      const workflowDef = createWorkflowDefinition();
      await onExecute(workflowDef.id);
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [onExecute, isExecuting, createWorkflowDefinition]);

  // Save workflow
  const saveWorkflow = useCallback(() => {
    if (!onSave) return;

    const workflowDef = createWorkflowDefinition();
    onSave(workflowDef);
  }, [onSave, createWorkflowDefinition]);

  // Notify parent of changes
  useEffect(() => {
    if (onWorkflowChange) {
      const workflowDef = createWorkflowDefinition();
      onWorkflowChange(workflowDef);
    }
  }, [nodes, edges, onWorkflowChange, createWorkflowDefinition]);

  return (
    <div className={cn('h-full w-full', className)} {...props}>
      <ReactFlowProvider>
        <div className="h-full w-full" ref={reactFlowWrapper}>
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
            aria-label="Workflow canvas - drag to pan, scroll to zoom"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={12}
              size={1}
              color="#e5e7eb"
            />
            <Controls
              className="bg-white rounded-lg shadow-lg border border-gray-200"
              showInteractive={!readOnly}
              aria-label="Workflow zoom and pan controls"
            />

            {/* MiniMap */}
            {showMiniMap && (
              <Panel position="bottom-left">
                <WorkflowMiniMap />
              </Panel>
            )}

            {/* Controls */}
            {showControls && !readOnly && (
              <Panel position="top-right">
                <WorkflowControls
                  onSave={saveWorkflow}
                  onExecute={executeWorkflow}
                  isExecuting={isExecuting}
                  readOnly={readOnly}
                  variant={controlVariant}
                />
              </Panel>
            )}

            {/* Info Panel */}
            {showInfo && (
              <Panel position="bottom-center">
                <WorkflowInfo
                  selectedNode={selectedNode}
                  readOnly={readOnly}
                />
              </Panel>
            )}
          </ReactFlow>
        </div>
      </ReactFlowProvider>
    </div>
  );
});

WorkflowCanvasComponent.displayName = 'WorkflowCanvasComponent';

// Wrapper component with ReactFlowProvider
export const WorkflowCanvas = memo<WorkflowCanvasProps>((props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasComponent {...props} />
    </ReactFlowProvider>
  );
});

WorkflowCanvas.displayName = 'WorkflowCanvas';