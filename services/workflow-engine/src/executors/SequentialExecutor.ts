import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowNode,
  WorkflowEdge,
  WorkflowContext,
  NodeExecutionResult,
  NodeExecutionStatus,
  NodeExecutor
} from '../types/workflow';

export class SequentialExecutor extends EventEmitter {
  private nodeExecutors: Map<string, NodeExecutor>;

  constructor(nodeExecutors: Map<string, NodeExecutor>) {
    super();
    this.nodeExecutors = nodeExecutors;
  }

  /**
   * Execute workflow sequentially
   */
  async execute(
    workflow: WorkflowDefinition,
    input: any,
    context: Partial<WorkflowContext> = {}
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: workflow.id,
      workflowId: workflow.id,
      status: NodeExecutionStatus.RUNNING,
      input,
      output: null,
      startTime: new Date(),
      context: {
        variables: new Map(Object.entries(input)),
        secrets: new Map(),
        environment: process.env,
        metadata: {},
        ...context
      }
    };

    try {
      // Build execution graph
      const graph = this.buildExecutionGraph(workflow);

      // Find trigger nodes
      const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger');
      if (triggerNodes.length === 0) {
        throw new Error('Workflow must have at least one trigger node');
      }

      // Start with trigger nodes
      for (const triggerNode of triggerNodes) {
        await this.executeNode(triggerNode, execution, graph);
      }

      execution.status = NodeExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.emit('workflow:completed', execution);
      return execution;
    } catch (error) {
      execution.status = NodeExecutionStatus.FAILED;
      execution.error = error.message;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      this.emit('workflow:failed', execution, error);
      throw error;
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: WorkflowNode,
    execution: WorkflowExecution,
    graph: ExecutionGraph
  ): Promise<NodeExecutionResult> {
    execution.nodeId = node.id;
    this.emit('node:started', node, execution);

    const executor = this.nodeExecutors.get(node.type);
    if (!executor) {
      throw new Error(`No executor found for node type: ${node.type}`);
    }

    let result: NodeExecutionResult;

    try {
      // Validate node before execution
      const validation = await executor.validate?.(node);
      if (validation && !validation.valid) {
        throw new Error(`Node validation failed: ${validation.errors?.join(', ')}`);
      }

      // Execute node
      result = await executor.execute(node, execution.context);

      // Update context with node output
      if (result.output) {
        execution.context.variables.set(`node_${node.id}_output`, result.output);
        execution.context.variables.set('last_output', result.output);
      }

      this.emit('node:completed', node, execution, result);
    } catch (error) {
      result = {
        status: NodeExecutionStatus.FAILED,
        error: error.message
      };

      this.emit('node:failed', node, execution, error);
      throw error;
    }

    // Execute next nodes based on result
    const nextNodes = this.getNextNodes(node, result, graph);
    for (const nextNode of nextNodes) {
      await this.executeNode(nextNode, execution, graph);
    }

    return result;
  }

  /**
   * Build execution graph from workflow definition
   */
  private buildExecutionGraph(workflow: WorkflowDefinition): ExecutionGraph {
    const outgoingEdges = new Map<string, WorkflowEdge[]>();
    const incomingEdges = new Map<string, WorkflowEdge[]>();
    const nodeMap = new Map<string, WorkflowNode>();

    // Build node map
    workflow.nodes.forEach(node => {
      nodeMap.set(node.id, node);
    });

    // Build edge maps
    workflow.edges.forEach(edge => {
      if (!outgoingEdges.has(edge.source)) {
        outgoingEdges.set(edge.source, []);
      }
      outgoingEdges.get(edge.source)!.push(edge);

      if (!incomingEdges.has(edge.target)) {
        incomingEdges.set(edge.target, []);
      }
      incomingEdges.get(edge.target)!.push(edge);
    });

    return {
      nodes: nodeMap,
      outgoingEdges,
      incomingEdges
    };
  }

  /**
   * Get next nodes to execute based on current node and result
   */
  private getNextNodes(
    currentNode: WorkflowNode,
    result: NodeExecutionResult,
    graph: ExecutionGraph
  ): WorkflowNode[] {
    const edges = graph.outgoingEdges.get(currentNode.id) || [];
    const nextNodes: WorkflowNode[] = [];

    for (const edge of edges) {
      // Check condition if present
      if (edge.condition) {
        const conditionMet = this.evaluateCondition(edge.condition, result.output, graph);
        if (!conditionMet) {
          continue;
        }
      }

      const nextNode = graph.nodes.get(edge.target);
      if (nextNode) {
        nextNodes.push(nextNode);
      }
    }

    return nextNodes;
  }

  /**
   * Evaluate edge condition
   */
  private evaluateCondition(
    condition: string,
    output: any,
    graph: ExecutionGraph
  ): boolean {
    try {
      // Simple condition evaluation (in production, use a proper expression engine)
      if (condition.startsWith('{{') && condition.endsWith('}}')) {
        const path = condition.slice(2, -2).trim();
        return this.getNestedValue(output, path) != null;
      }

      // Handle boolean expressions
      if (condition.includes('==')) {
        const [left, right] = condition.split('==').map(s => s.trim());
        const leftValue = this.resolveValue(left, output);
        const rightValue = this.resolveValue(right, output);
        return leftValue == rightValue;
      }

      if (condition.includes('!=')) {
        const [left, right] = condition.split('!=').map(s => s.trim());
        const leftValue = this.resolveValue(left, output);
        const rightValue = this.resolveValue(right, output);
        return leftValue != rightValue;
      }

      // Default to true if no condition
      return true;
    } catch (error) {
      console.error('Error evaluating condition:', condition, error);
      return false;
    }
  }

  /**
   * Resolve value from path or literal
   */
  private resolveValue(path: string, output: any): any {
    // Check if it's a string literal
    if (path.startsWith('"') && path.endsWith('"')) {
      return path.slice(1, -1);
    }

    if (path.startsWith("'") && path.endsWith("'")) {
      return path.slice(1, -1);
    }

    // Check if it's a number
    if (!isNaN(Number(path))) {
      return Number(path);
    }

    // Check if it's a boolean
    if (path === 'true') return true;
    if (path === 'false') return false;

    // Otherwise treat as path
    return this.getNestedValue(output, path);
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Execute workflow with timeout
   */
  async executeWithTimeout(
    workflow: WorkflowDefinition,
    input: any,
    timeoutMs: number = 30000
  ): Promise<WorkflowExecution> {
    return Promise.race([
      this.execute(workflow, input),
      new Promise<WorkflowExecution>((_, reject) => {
        setTimeout(() => reject(new Error(`Workflow execution timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }

  /**
   * Execute workflow with retry policy
   */
  async executeWithRetry(
    workflow: WorkflowDefinition,
    input: any,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<WorkflowExecution> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.execute(workflow, input);
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          this.emit('workflow:retry', workflow, attempt, error);
        }
      }
    }

    throw lastError;
  }
}

interface ExecutionGraph {
  nodes: Map<string, WorkflowNode>;
  outgoingEdges: Map<string, WorkflowEdge[]>;
  incomingEdges: Map<string, WorkflowEdge[]>;
}