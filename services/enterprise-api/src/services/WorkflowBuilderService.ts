import { WorkflowDefinition, WorkflowNode, WorkflowEdge, WorkflowNodeType } from '../types/workflow.js'
import { logger } from '../utils/logger.js'

export interface NodeDefinition {
  type: WorkflowNodeType
  category: string
  name: string
  description: string
  icon: string
  color: string
  inputs: NodePortDefinition[]
  outputs: NodePortDefinition[]
  config: Record<string, any>
  defaults: Record<string, any>
}

export interface NodePortDefinition {
  id: string
  name: string
  type: string
  required?: boolean
  description?: string
  defaultValue?: any
}

export interface BuilderConfig {
  snapToGrid: boolean
  gridSize: number
  showMinimap: boolean
  showGrid: boolean
  theme: 'light' | 'dark'
  shortcuts: Record<string, string>
}

export class WorkflowBuilderService {
  private static nodeDefinitions: Map<WorkflowNodeType, NodeDefinition> = new Map()

  /**
   * Initialize workflow builder with node definitions
   */
  static initialize(): void {
    this.registerCoreNodes()
    this.registerIntegrationNodes()
    this.registerDataNodes()
    this.registerControlNodes()
  }

  /**
   * Get all available node definitions
   */
  static getNodeDefinitions(): NodeDefinition[] {
    return Array.from(this.nodeDefinitions.values())
  }

  /**
   * Get node definition by type
   */
  static getNodeDefinition(type: WorkflowNodeType): NodeDefinition | undefined {
    return this.nodeDefinitions.get(type)
  }

  /**
   * Create a new workflow node
   */
  static createNode(
    type: WorkflowNodeType,
    position: { x: number; y: number },
    data?: Partial<any>
  ): WorkflowNode {
    const definition = this.getNodeDefinition(type)
    if (!definition) {
      throw new Error(`Unknown node type: ${type}`)
    }

    const node: WorkflowNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      position,
      data: {
        ...definition.defaults,
        ...data,
        label: definition.name
      },
      config: {
        label: definition.name,
        description: definition.description,
        inputs: definition.inputs,
        outputs: definition.outputs,
        settings: {}
      }
    }

    return node
  }

  /**
   * Validate workflow structure
   */
  static validateWorkflow(workflow: Partial<WorkflowDefinition>): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if workflow has nodes
    if (!workflow.nodes || workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node')
      return { isValid: false, errors, warnings }
    }

    // Check for trigger node
    const hasTrigger = workflow.nodes.some(node => node.type === 'trigger')
    if (!hasTrigger) {
      errors.push('Workflow must have at least one trigger node')
    }

    // Check for disconnected nodes
    const connectedNodes = new Set<string>()
    workflow.edges?.forEach(edge => {
      connectedNodes.add(edge.source)
      connectedNodes.add(edge.target)
    })

    const disconnectedNodes = workflow.nodes.filter(
      node => !connectedNodes.has(node.id) && node.type !== 'trigger'
    )

    if (disconnectedNodes.length > 0) {
      warnings.push(
        `${disconnectedNodes.length} node(s) are not connected to the workflow`
      )
    }

    // Check for cycles
    if (workflow.edges && workflow.edges.length > 0) {
      const hasCycle = this.detectCycle(workflow.nodes, workflow.edges)
      if (hasCycle) {
        errors.push('Workflow contains cycles which are not allowed')
      }
    }

    // Validate individual nodes
    workflow.nodes?.forEach(node => {
      const nodeErrors = this.validateNode(node, workflow)
      errors.push(...nodeErrors)
    })

    // Check for required inputs
    workflow.edges?.forEach(edge => {
      const targetNode = workflow.nodes?.find(n => n.id === edge.target)
      if (targetNode) {
        const inputPort = targetNode.config.inputs.find(
          (input: any) => input.id === edge.targetHandle
        )
        if (inputPort && inputPort.required) {
          // Mark this input as connected
          if (!targetNode.data.connectedInputs) {
            targetNode.data.connectedInputs = []
          }
          targetNode.data.connectedInputs.push(edge.targetHandle)
        }
      }
    })

    // Check for missing required inputs
    workflow.nodes?.forEach(node => {
      if (node.type !== 'trigger') {
        const requiredInputs = node.config.inputs.filter(
          (input: any) => input.required
        )
        const connectedInputs = node.data.connectedInputs || []

        requiredInputs.forEach((input: any) => {
          if (!connectedInputs.includes(input.id)) {
            errors.push(
              `Node "${node.data.label}" is missing required input: ${input.name}`
            )
          }
        })
      }
    })

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Auto-layout workflow nodes
   */
  static autoLayout(workflow: Partial<WorkflowDefinition>): {
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
  } {
    const nodes = workflow.nodes || []
    const edges = workflow.edges || []

    if (nodes.length === 0) {
      return { nodes, edges }
    }

    // Find trigger node
    const triggerNode = nodes.find(n => n.type === 'trigger')
    if (!triggerNode) {
      return { nodes, edges }
    }

    // Build graph
    const graph = this.buildGraph(nodes, edges)

    // Perform topological sort
    const sorted = this.topologicalSort(graph, triggerNode.id)

    // Position nodes
    const levels = this.calculateLevels(sorted, edges)
    const positionedNodes = nodes.map(node => {
      const level = levels.get(node.id) || 0
      const nodesInLevel = Array.from(levels.entries())
        .filter(([_, l]) => l === level).length

      return {
        ...node,
        position: {
          x: 200 + level * 250,
          y: 100 + (sorted.indexOf(node.id) % nodesInLevel) * 100
        }
      }
    })

    return {
      nodes: positionedNodes,
      edges
    }
  }

  /**
   * Generate workflow from template
   */
  static generateFromTemplate(
    template: string,
    variables: Record<string, any> = {}
  ): Partial<WorkflowDefinition> {
    const templates = this.getWorkflowTemplates()
    const workflowTemplate = templates.find(t => t.id === template)

    if (!workflowTemplate) {
      throw new Error(`Template not found: ${template}`)
    }

    // Interpolate variables
    const nodes = workflowTemplate.nodes.map(node => ({
      ...node,
      data: this.interpolateObject(node.data, variables),
      config: {
        ...node.config,
        label: this.interpolateString(node.config.label, variables)
      }
    }))

    return {
      ...workflowTemplate,
      nodes,
      variables: workflowTemplate.variables.map(v => ({
        ...v,
        defaultValue: variables[v.name] || v.defaultValue
      }))
    }
  }

  /**
   * Export workflow
   */
  static export(workflow: WorkflowDefinition): string {
    return JSON.stringify({
      version: '1.0',
      workflow,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  /**
   * Import workflow
   */
  static import(json: string): WorkflowDefinition {
    try {
      const data = JSON.parse(json)

      if (!data.workflow) {
        throw new Error('Invalid workflow export format')
      }

      // Generate new IDs for imported workflow
      const idMap = new Map<string, string>()

      const nodes = data.workflow.nodes.map((node: WorkflowNode) => {
        const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        idMap.set(node.id, newId)

        return {
          ...node,
          id: newId
        }
      })

      const edges = data.workflow.edges.map((edge: WorkflowEdge) => ({
        ...edge,
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target
      }))

      return {
        ...data.workflow,
        nodes,
        edges,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } catch (error) {
      throw new Error(`Failed to import workflow: ${error.message}`)
    }
  }

  /**
   * Private helper methods
   */
  private static registerCoreNodes(): void {
    // Trigger node
    this.nodeDefinitions.set('trigger', {
      type: 'trigger',
      category: 'Core',
      name: 'Manual Trigger',
      description: 'Starts the workflow when manually triggered',
      icon: 'play',
      color: '#10b981',
      inputs: [],
      outputs: [
        { id: 'output', name: 'Output', type: 'any', description: 'Passes input data to the workflow' }
      ],
      config: {},
      defaults: {}
    })

    // Task node
    this.nodeDefinitions.set('task', {
      type: 'task',
      category: 'Core',
      name: 'Task',
      description: 'Execute a task or operation',
      icon: 'check-square',
      color: '#3b82f6',
      inputs: [
        { id: 'input', name: 'Input', type: 'any', required: true, description: 'Input data for the task' }
      ],
      outputs: [
        { id: 'output', name: 'Output', type: 'any', description: 'Result of the task execution' },
        { id: 'error', name: 'Error', type: 'string', description: 'Error message if task fails' }
      ],
      config: {
        taskType: 'string',
        config: 'object'
      },
      defaults: {
        taskType: 'data_annotation',
        config: {}
      }
    })

    // API Call node
    this.nodeDefinitions.set('api_call', {
      type: 'api_call',
      category: 'Integration',
      name: 'API Call',
      description: 'Make HTTP requests to external APIs',
      icon: 'globe',
      color: '#8b5cf6',
      inputs: [
        { id: 'url', name: 'URL', type: 'string', required: true },
        { id: 'body', name: 'Body', type: 'object' }
      ],
      outputs: [
        { id: 'response', name: 'Response', type: 'object' },
        { id: 'status', name: 'Status Code', type: 'number' }
      ],
      config: {
        method: 'string',
        headers: 'object',
        authentication: 'object'
      },
      defaults: {
        method: 'GET',
        headers: {},
        authentication: {}
      }
    })

    // Condition node
    this.nodeDefinitions.set('condition', {
      type: 'condition',
      category: 'Control',
      name: 'Condition',
      description: 'Branch workflow based on conditions',
      icon: 'fork',
      color: '#f59e0b',
      inputs: [
        { id: 'input', name: 'Input', type: 'any', required: true }
      ],
      outputs: [
        { id: 'true', name: 'True', type: 'any' },
        { id: 'false', name: 'False', type: 'any' }
      ],
      config: {
        conditionType: 'string',
        expression: 'string',
        rules: 'array'
      },
      defaults: {
        conditionType: 'expression',
        expression: 'true'
      }
    })

    // Delay node
    this.nodeDefinitions.set('delay', {
      type: 'delay',
      category: 'Control',
      name: 'Delay',
      description: 'Pause workflow execution',
      icon: 'clock',
      color: '#6b7280',
      inputs: [
        { id: 'input', name: 'Input', type: 'any' }
      ],
      outputs: [
        { id: 'output', name: 'Output', type: 'any' }
      ],
      config: {
        delayType: 'string',
        duration: 'number',
        unit: 'string'
      },
      defaults: {
        delayType: 'fixed',
        duration: 1,
        unit: 'seconds'
      }
    })
  }

  private static registerIntegrationNodes(): void {
    // Webhook node
    this.nodeDefinitions.set('webhook', {
      type: 'webhook',
      category: 'Integration',
      name: 'Webhook',
      description: 'Receive data from external systems',
      icon: 'link',
      color: '#06b6d4',
      inputs: [],
      outputs: [
        { id: 'payload', name: 'Payload', type: 'object' }
      ],
      config: {
        path: 'string',
        method: 'string'
      },
      defaults: {
        path: '/webhook',
        method: 'POST'
      }
    })

    // Notification node
    this.nodeDefinitions.set('notification', {
      type: 'notification',
      category: 'Integration',
      name: 'Notification',
      description: 'Send notifications via email, Slack, etc.',
      icon: 'bell',
      color: '#ec4899',
      inputs: [
        { id: 'message', name: 'Message', type: 'string', required: true },
        { id: 'recipients', name: 'Recipients', type: 'array', required: true }
      ],
      outputs: [
        { id: 'sent', name: 'Sent', type: 'boolean' }
      ],
      config: {
        type: 'string',
        template: 'string'
      },
      defaults: {
        type: 'email',
        template: 'default'
      }
    })
  }

  private static registerDataNodes(): void {
    // Data Transform node
    this.nodeDefinitions.set('data_transform', {
      type: 'data_transform',
      category: 'Data',
      name: 'Transform',
      description: 'Transform and manipulate data',
      icon: 'shuffle',
      color: '#14b8a6',
      inputs: [
        { id: 'data', name: 'Data', type: 'any', required: true }
      ],
      outputs: [
        { id: 'output', name: 'Output', type: 'any' }
      ],
      config: {
        operation: 'string',
        mapping: 'object'
      },
      defaults: {
        operation: 'map',
        mapping: {}
      }
    })

    // Validation node
    this.nodeDefinitions.set('validation', {
      type: 'validation',
      category: 'Data',
      name: 'Validation',
      description: 'Validate data against rules',
      icon: 'check-circle',
      color: '#0ea5e9',
      inputs: [
        { id: 'data', name: 'Data', type: 'any', required: true }
      ],
      outputs: [
        { id: 'valid', name: 'Valid', type: 'boolean' },
        { id: 'errors', name: 'Errors', type: 'array' }
      ],
      config: {
        rules: 'array'
      },
      defaults: {
        rules: []
      }
    })
  }

  private static registerControlNodes(): void {
    // Add more control flow nodes as needed
  }

  private static validateNode(node: WorkflowNode, workflow: Partial<WorkflowDefinition>): string[] {
    const errors: string[] = []
    const definition = this.getNodeDefinition(node.type)

    if (!definition) {
      errors.push(`Unknown node type: ${node.type}`)
      return errors
    }

    // Validate required configuration
    for (const [key, value] of Object.entries(definition.config)) {
      if (definition.defaults[key] === undefined && !node.data.config?.[key]) {
        errors.push(`Node "${node.data.label}" is missing required configuration: ${key}`)
      }
    }

    return errors
  }

  private static detectCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true
      }
      if (visited.has(nodeId)) {
        return false
      }

      visited.add(nodeId)
      recursionStack.add(nodeId)

      const outgoingEdges = edges.filter(e => e.source === nodeId)
      for (const edge of outgoingEdges) {
        if (hasCycle(edge.target)) {
          return true
        }
      }

      recursionStack.delete(nodeId)
      return false
    }

    // Check from each node
    for (const node of nodes) {
      if (hasCycle(node.id)) {
        return true
      }
    }

    return false
  }

  private static buildGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): Map<string, string[]> {
    const graph = new Map<string, string[]>()

    nodes.forEach(node => {
      graph.set(node.id, [])
    })

    edges.forEach(edge => {
      const connections = graph.get(edge.source) || []
      connections.push(edge.target)
      graph.set(edge.source, connections)
    })

    return graph
  }

  private static topologicalSort(graph: Map<string, string[]>, startId: string): string[] {
    const visited = new Set<string>()
    const result: string[] = []

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return
      }
      visited.add(nodeId)

      const neighbors = graph.get(nodeId) || []
      for (const neighbor of neighbors) {
        dfs(neighbor)
      }

      result.push(nodeId)
    }

    dfs(startId)
    return result
  }

  private static calculateLevels(sorted: string[], edges: WorkflowEdge[]): Map<string, number> {
    const levels = new Map<string, number>()
    levels.set(sorted[0], 0)

    for (let i = 1; i < sorted.length; i++) {
      const nodeId = sorted[i]
      const incomingEdges = edges.filter(e => e.target === nodeId)

      if (incomingEdges.length > 0) {
        const maxSourceLevel = Math.max(
          ...incomingEdges.map(e => levels.get(e.source) || 0)
        )
        levels.set(nodeId, maxSourceLevel + 1)
      } else {
        levels.set(nodeId, 0)
      }
    }

    return levels
  }

  private static getWorkflowTemplates(): any[] {
    // Return predefined workflow templates
    return [
      {
        id: 'data_annotation_pipeline',
        name: 'Data Annotation Pipeline',
        description: 'Automated data annotation workflow',
        nodes: [],
        edges: [],
        variables: []
      }
    ]
  }

  private static interpolateString(template: string, variables: Record<string, any>): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path)
      return value !== undefined ? String(value) : match
    })
  }

  private static interpolateObject(obj: any, variables: Record<string, any>): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item, variables))
    } else if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value, variables)
      }
      return result
    } else if (typeof obj === 'string') {
      return this.interpolateString(obj, variables)
    }
    return obj
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((value, key) => value?.[key], obj)
  }
}