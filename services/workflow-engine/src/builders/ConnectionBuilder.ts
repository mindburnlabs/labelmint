import { v4 as uuidv4 } from 'uuid';
import { WorkflowEdge, WorkflowNode } from '../types/workflow';

export class ConnectionBuilder {
  private edges: Map<string, WorkflowEdge> = new Map();

  /**
   * Create a connection between two nodes
   */
  connect(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    options: {
      sourceHandle?: string;
      targetHandle?: string;
      condition?: string;
      label?: string;
    } = {}
  ): WorkflowEdge {
    // Validate that the nodes exist
    if (!sourceNode || !targetNode) {
      throw new Error('Source and target nodes must be provided');
    }

    // Validate that the connection types are compatible
    this.validateConnection(sourceNode, targetNode, options);

    const edge: WorkflowEdge = {
      id: uuidv4(),
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: options.sourceHandle,
      targetHandle: options.targetHandle,
      condition: options.condition
    };

    this.edges.set(edge.id, edge);
    return edge;
  }

  /**
   * Create a conditional connection
   */
  connectConditional(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    condition: string,
    options: {
      sourceHandle?: string;
      targetHandle?: string;
      label?: string;
    } = {}
  ): WorkflowEdge {
    return this.connect(sourceNode, targetNode, {
      ...options,
      condition
    });
  }

  /**
   * Connect multiple nodes in sequence
   */
  connectSequence(nodes: WorkflowNode[]): WorkflowEdge[] {
    if (nodes.length < 2) {
      return [];
    }

    const edges: WorkflowEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const edge = this.connect(nodes[i], nodes[i + 1]);
      edges.push(edge);
    }

    return edges;
  }

  /**
   * Connect nodes in parallel (split)
   */
  connectParallel(
    sourceNode: WorkflowNode,
    targetNodes: WorkflowNode[],
    options: {
      sourceHandle?: string;
      conditions?: string[];
    } = {}
  ): WorkflowEdge[] {
    if (targetNodes.length === 0) {
      return [];
    }

    const edges: WorkflowEdge[] = [];
    targetNodes.forEach((target, index) => {
      const edge = this.connect(sourceNode, target, {
        sourceHandle: options.sourceHandle,
        condition: options.conditions?.[index]
      });
      edges.push(edge);
    });

    return edges;
  }

  /**
   * Join multiple nodes into one (merge)
   */
  joinParallel(
    sourceNodes: WorkflowNode[],
    targetNode: WorkflowNode,
    options: {
      targetHandle?: string;
      conditions?: string[];
    } = {}
  ): WorkflowEdge[] {
    if (sourceNodes.length === 0) {
      return [];
    }

    const edges: WorkflowEdge[] = [];
    sourceNodes.forEach((source, index) => {
      const edge = this.connect(source, targetNode, {
        targetHandle: options.targetHandle,
        condition: options.conditions?.[index]
      });
      edges.push(edge);
    });

    return edges;
  }

  /**
   * Create a branch connection (for conditions)
   */
  createBranch(
    sourceNode: WorkflowNode,
    trueNode: WorkflowNode,
    falseNode: WorkflowNode,
    options: {
      trueHandle?: string;
      falseHandle?: string;
    } = {}
  ): { trueEdge: WorkflowEdge; falseEdge: WorkflowEdge } {
    const trueEdge = this.connect(sourceNode, trueNode, {
      sourceHandle: 'true',
      targetHandle: options.trueHandle
    });

    const falseEdge = this.connect(sourceNode, falseNode, {
      sourceHandle: 'false',
      targetHandle: options.falseHandle
    });

    return { trueEdge, falseEdge };
  }

  /**
   * Remove a connection
   */
  disconnect(edgeId: string): boolean {
    return this.edges.delete(edgeId);
  }

  /**
   * Remove all connections from a node
   */
  disconnectNode(nodeId: string): WorkflowEdge[] {
    const removedEdges: WorkflowEdge[] = [];

    for (const [edgeId, edge] of this.edges) {
      if (edge.source === nodeId || edge.target === nodeId) {
        this.edges.delete(edgeId);
        removedEdges.push(edge);
      }
    }

    return removedEdges;
  }

  /**
   * Update a connection condition
   */
  updateCondition(edgeId: string, condition: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) {
      return false;
    }

    edge.condition = condition;
    return true;
  }

  /**
   * Get all connections
   */
  getEdges(): WorkflowEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get outgoing connections from a node
   */
  getOutgoingEdges(nodeId: string): WorkflowEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.source === nodeId);
  }

  /**
   * Get incoming connections to a node
   */
  getIncomingEdges(nodeId: string): WorkflowEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.target === nodeId);
  }

  /**
   * Check if a path exists between two nodes
   */
  hasPath(fromNodeId: string, toNodeId: string): boolean {
    const visited = new Set<string>();
    const queue = [fromNodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === toNodeId) {
        return true;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const outgoing = this.getOutgoingEdges(current);
      for (const edge of outgoing) {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    return false;
  }

  /**
   * Find cycles in the workflow
   */
  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push([...path.slice(cycleStart), nodeId]);
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoing = this.getOutgoingEdges(nodeId);
      for (const edge of outgoing) {
        if (dfs(edge.target)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    // Check all nodes for cycles
    for (const edge of this.edges) {
      if (!visited.has(edge.source)) {
        dfs(edge.source);
      }
    }

    return cycles;
  }

  /**
   * Validate that the workflow has no cycles
   */
  validateNoCycles(): boolean {
    const cycles = this.findCycles();
    if (cycles.length > 0) {
      throw new Error(`Workflow contains cycles: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }
    return true;
  }

  /**
   * Get all nodes in topological order
   */
  getTopologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    const nodes = new Set<string>();

    // Calculate in-degrees
    for (const edge of this.edges) {
      nodes.add(edge.source);
      nodes.add(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      if (!inDegree.has(edge.source)) {
        inDegree.set(edge.source, 0);
      }
    }

    // Queue for nodes with no incoming edges
    const queue: string[] = [];
    for (const node of nodes) {
      if ((inDegree.get(node) || 0) === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const outgoing = this.getOutgoingEdges(current);
      for (const edge of outgoing) {
        const newDegree = (inDegree.get(edge.target) || 0) - 1;
        inDegree.set(edge.target, newDegree);

        if (newDegree === 0) {
          queue.push(edge.target);
        }
      }
    }

    // Check if topological sort is possible (no cycles)
    if (result.length !== nodes.size) {
      throw new Error('Workflow contains cycles, cannot determine topological order');
    }

    return result;
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.edges.clear();
  }

  /**
   * Validate connection between nodes
   */
  private validateConnection(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    options: {
      sourceHandle?: string;
      targetHandle?: string;
    }
  ): void {
    // Check if source and target are the same
    if (sourceNode.id === targetNode.id) {
      throw new Error('Cannot connect a node to itself');
    }

    // Validate source handle if specified
    if (options.sourceHandle) {
      const sourceOutput = sourceNode.data.outputs?.find(o => o.id === options.sourceHandle);
      if (!sourceOutput) {
        throw new Error(`Source handle '${options.sourceHandle}' not found in node ${sourceNode.id}`);
      }
    }

    // Validate target handle if specified
    if (options.targetHandle) {
      const targetInput = targetNode.data.inputs?.find(i => i.id === options.targetHandle);
      if (!targetInput) {
        throw new Error(`Target handle '${options.targetHandle}' not found in node ${targetNode.id}`);
      }
    }

    // Check if connection already exists
    const existingConnection = Array.from(this.edges.values()).find(
      e => e.source === sourceNode.id &&
           e.target === targetNode.id &&
           e.sourceHandle === options.sourceHandle &&
           e.targetHandle === options.targetHandle
    );

    if (existingConnection) {
      throw new Error('Connection already exists between these nodes');
    }
  }
}