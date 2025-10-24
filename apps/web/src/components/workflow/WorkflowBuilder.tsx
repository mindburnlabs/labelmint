import React, { useState, useCallback } from 'react';
import { Node, addEdge, Connection } from 'reactflow';
import { WorkflowDefinition } from '@/types/workflow';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';
import { NodePalette } from './panels/NodePalette';
import { PropertyPanel } from './panels/PropertyPanel';

interface WorkflowBuilderProps {
  workflow?: Partial<WorkflowDefinition>;
  onWorkflowChange?: (workflow: WorkflowDefinition) => void;
  onExecute?: (workflowId: string) => void;
  onSave?: (workflow: WorkflowDefinition) => void;
  readOnly?: boolean;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflow,
  onWorkflowChange,
  onExecute,
  onSave,
  readOnly = false
}) => {
  const [nodes, setNodes] = useState(workflow?.nodes || []);
  const [edges, setEdges] = useState(workflow?.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onAddNode = useCallback((template: any) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: template.type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { ...template.initialData }
    };

    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const onUpdateNode = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      })
    );
  }, [setNodes]);

  const onWorkflowUpdate = useCallback((workflowDef: WorkflowDefinition) => {
    setNodes(workflowDef.nodes.map(n => ({
      ...n,
      position: n.position
    })));
    setEdges(workflowDef.edges.map(e => ({
      ...e,
      data: { condition: e.condition }
    })));
    onWorkflowChange?.(workflowDef);
  }, [onWorkflowChange, setNodes, setEdges]);

  return (
    <div className="flex h-full bg-gray-50">
      {!readOnly && (
        <NodePalette onAddNode={onAddNode} />
      )}

      <div className="flex-1">
        <WorkflowCanvas
          workflow={workflow}
          onWorkflowChange={onWorkflowUpdate}
          readOnly={readOnly}
          onExecute={onExecute}
          onSave={onSave}
        />
      </div>

      {!readOnly && (
        <PropertyPanel
          selectedNode={selectedNode}
          onUpdateNode={onUpdateNode}
        />
      )}
    </div>
  );
};