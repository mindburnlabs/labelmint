import React, { useState, useRef, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Node, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NodePalette } from './NodePalette';
import { PropertyPanel } from './PropertyPanel';
import { WorkflowPreview } from './WorkflowPreview';
import { ConnectionManager } from './ConnectionManager';
import {
  TriggerNode,
  TaskNode,
  ValidationNode,
  NotificationNode,
  IntegrationNode,
  ConditionNode,
  ActionNode,
  CustomNode
} from './nodes';

interface WorkflowCanvasProps {
  workflow: any;
  onWorkflowChange: (workflow: any) => void;
  onSave?: (workflow: any) => void;
  readOnly?: boolean;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflow,
  onWorkflowChange,
  onSave,
  readOnly = false
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [scale, setScale] = useState(1);
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialize canvas with workflow data
  React.useEffect(() => {
    if (workflow?.definition) {
      setNodes(workflow.definition.nodes || []);
      setEdges(workflow.definition.connections || []);
    }
  }, [workflow]);

  // Handle workflow changes
  const onNodesChange = useCallback((newNodes: Node[]) => {
    if (readOnly) return;

    setNodes(newNodes);
    updateWorkflowDefinition({
      nodes: newNodes,
      connections: edges
    });
  }, [edges, readOnly, onWorkflowChange]);

  const onEdgesChange = useCallback((newEdges: Connection[]) => {
    if (readOnly) return;

    setEdges(newEdges);
    updateWorkflowDefinition({
      nodes: nodes,
      connections: newEdges
    });
  }, [nodes, readOnly, onWorkflowChange]);

  // Update workflow definition
  const updateWorkflowDefinition = useCallback((definition: any) => {
    onWorkflowChange({
      ...workflow,
      definition,
      lastModified: new Date().toISOString()
    });
  }, [workflow, onWorkflowChange]);

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (readOnly) return;

    event.stopPropagation();
    setSelectedNode(node);
    setSelectedConnection(null);
  }, [readOnly]);

  // Handle edge selection
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Connection) => {
    if (readOnly) return;

    event.stopPropagation();
    setSelectedConnection(edge);
    setSelectedNode(null);
  }, [readOnly]);

  // Handle canvas click (deselect)
  const onCanvasClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedConnection(null);
  }, []);

  // Handle connection creation
  const onConnect = useCallback((params: any) => {
    const newEdge = {
      id: `${params.source}-${params.target}`,
      source: params.source,
      target: params.target,
      sourceHandle: params.sourceHandle,
      targetHandle: params.targetHandle,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      animated: true,
      label: params.data?.label || ''
    };

    setEdges(prev => [...prev, newEdge]);
    updateWorkflowDefinition({
      nodes,
      connections: [...edges, newEdge]
    });
  }, [nodes, edges, updateWorkflowDefinition]);

  // Handle node drag from palette
  const [{ isOver }, dropRef] = useDrop({
    accept: 'workflow-node',
    drop: (item: any, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = canvasRef.current?.getBoundingClientRect();

      if (!offset || !canvasRect) return;

      const x = (offset.x - canvasRect.left - viewport.x) / scale;
      const y = (offset.y - canvasRect.top - viewport.y) / scale;

      // Snap to grid if enabled
      const finalX = snapToGrid ? Math.round(x / 20) * 20 : x;
      const finalY = snapToGrid ? Math.round(y / 20) * 20 : y;

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: item.nodeType,
        position: { x: finalX, y: finalY },
        data: {
          label: item.label,
          nodeType: item.nodeType,
          config: item.defaultConfig || {},
          critical: item.critical || false
        }
      };

      setNodes(prev => [...prev, newNode]);
      return;
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  });

  // Custom node components
  const nodeTypes = {
    trigger: TriggerNode,
    task: TaskNode,
    validation: ValidationNode,
    notification: NotificationNode,
    integration: IntegrationNode,
    condition: ConditionNode,
    action: ActionNode,
    custom: CustomNode
  };

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (readOnly) return;

    // Delete selected node or edge
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedNode) {
        setNodes(prev => prev.filter(n => n.id !== selectedNode.id));
        setSelectedNode(null);
      }
      if (selectedConnection) {
        setEdges(prev => prev.filter(e => e.id !== selectedConnection.id));
        setSelectedConnection(null);
      }
    }

    // Copy/Cut/Paste
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'c') {
        // Copy selected node
        if (selectedNode) {
          navigator.clipboard.writeText(JSON.stringify(selectedNode));
        }
      }
      if (event.key === 'v') {
        // Paste node
        navigator.clipboard.readText().then(text => {
          try {
            const node = JSON.parse(text);
            const newNode = {
              ...node,
              id: `node-${Date.now()}`,
              position: {
                x: node.position.x + 50,
                y: node.position.y + 50
              }
            };
            setNodes(prev => [...prev, newNode]);
          } catch (e) {
            console.error('Failed to paste node:', e);
          }
        });
      }
    }

    // Zoom in/out
    if (event.ctrlKey || event.metaKey) {
      if (event.key === '=') {
        setScale(prev => Math.min(prev * 1.1, 3));
      }
      if (event.key === '-') {
        setScale(prev => Math.max(prev / 1.1, 0.3));
      }
    }

    // Reset zoom
    if (event.key === '0') {
      setScale(1);
      setViewport({ x: 0, y: 0 });
    }

    // Toggle grid
    if (event.key === 'g') {
      setShowGrid(prev => !prev);
    }

    // Toggle snap to grid
    if (event.key === 's') {
      setSnapToGrid(prev => !prev);
    }

    // Toggle preview mode
    if (event.key === 'p') {
      setIsPreviewMode(prev => !prev);
    }

    // Save workflow
    if (event.key === 'S' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSave?.({
        ...workflow,
        definition: {
          nodes,
          connections: edges
        }
      });
    }

    // Undo/Redo (simplified)
    if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
      // Implement undo functionality
    }
  }, [selectedNode, selectedConnection, nodes, edges, workflow, onSave]);

  // Register keyboard listeners
  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-save
  React.useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (nodes.length > 0 || edges.length > 0) {
        onWorkflowChange({
          ...workflow,
          definition: {
            nodes,
            connections: edges
          },
          autoSave: true
        });
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [nodes, edges, workflow, onWorkflowChange]);

  return (
    <div className="workflow-builder flex h-full">
      {/* Left Sidebar - Node Palette */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
        <NodePalette />
      </div>

      {/* Main Canvas */}
      <div
        ref={dropRef}
        className={`flex-1 relative overflow-hidden ${isOver ? 'bg-blue-50' : ''}`}
        onClick={onCanvasClick}
      >
        <div
          ref={canvasRef}
          className={`w-full h-full ${showGrid ? 'workflow-grid' : ''}`}
          style={{
            transform: `scale(${scale}) translate(${viewport.x}px, ${viewport.y}px)`,
            transformOrigin: '0 0'
          }}
        >
          {!isPreviewMode ? (
            <React.Fragment>
              <Node
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                connectable={true}
                connectionLineStyle={{ stroke: '#4F46E5', strokeWidth: 2 }}
                connectionLineType="smoothstep"
                draggable={!readOnly}
                selectable={!readOnly}
                deletable={!readOnly}
                snapToGrid={snapToGrid}
                snapGrid={[20, 20]}
                minZoom={0.3}
                maxZoom={3}
                defaultViewport={viewport}
                onViewportChange={setViewport}
                attributionPosition="bottom-right"
              />
              <ConnectionManager
                nodes={nodes}
                edges={edges}
                onConnect={onConnect}
                readOnly={readOnly}
              />
            </React.Fragment>
          ) : (
            <WorkflowPreview
              workflow={{
                ...workflow,
                definition: {
                  nodes,
                  connections: edges
                }
              }}
              onExit={() => setIsPreviewMode(false)}
            />
          )}
        </div>

        {/* Canvas Controls */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-2 space-x-2">
          <button
            onClick={() => setScale(prev => Math.max(prev / 1.1, 0.3))}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            -
          </button>
          <span className="px-2 text-sm text-gray-600">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(prev => Math.min(prev * 1.1, 3))}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            +
          </button>
          <button
            onClick={() => setScale(1)}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded ml-2"
          >
            Reset
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-1">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-3 py-1 text-sm rounded ${
              isPreviewMode
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {isPreviewMode ? 'Exit Preview' : 'Preview'}
          </button>
        </div>

        {/* Status Bar */}
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-3 py-1">
          <span className="text-sm text-gray-600">
            Nodes: {nodes.length} | Connections: {edges.length}
          </span>
          {workflow.lastModified && (
            <span className="text-sm text-gray-500 ml-2">
              Last saved: {new Date(workflow.lastModified).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Right Sidebar - Property Panel */}
      <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
        <PropertyPanel
          node={selectedNode}
          connection={selectedConnection}
          onChange={(property, value) => {
            if (selectedNode) {
              const updatedNode = {
                ...selectedNode,
                data: {
                  ...selectedNode.data,
                  config: {
                    ...selectedNode.data.config,
                    [property]: value
                  }
                }
              };
              setNodes(prev => prev.map(n => n.id === selectedNode.id ? updatedNode : n));
            }
            if (selectedConnection) {
              const updatedEdge = {
                ...selectedConnection,
                data: {
                  ...selectedConnection.data,
                  [property]: value
                }
              };
              setEdges(prev => prev.map(e => e.id === selectedConnection.id ? updatedEdge : e));
            }
          }}
        />
      </div>

      {/* Grid overlay CSS */}
      <style jsx>{`
        .workflow-grid {
          background-image:
            linear-gradient(rgba(229, 231, 235, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(229, 231, 235, 0.5) 1px, transparent 1px);
          background-size: 20px 20px;
          background-position: -1px -1px;
        }
      `}</style>
    </div>
  );
};