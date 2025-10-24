import { NodeExecutor, RuntimeContext, NodeResult } from '../../WorkflowEngine.js';
import PythonExecutor from '../../executors/pythonExecutor.js';
import { logger } from '../../../utils/logger.js';

export class PythonScriptExecutor implements NodeExecutor {
  async execute(node: any, context: RuntimeContext): Promise<NodeResult> {
    const { script, input, validateSecurity = true } = node.data.config || {};

    await context.logger.info('Executing Python script', {
      nodeType: 'python_script',
      scriptLength: script?.length || 0
    });

    // Validate input
    if (!script) {
      throw new Error('Python script is required');
    }

    // Security validation
    if (validateSecurity) {
      const validation = PythonExecutor.validateCode(script);
      if (!validation.valid) {
        throw new Error(`Python code validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Prepare input for script
    const scriptInput = {
      ...context.execution.context.variables,
      ...context.execution.input,
      ...(input || {})
    };

    // Prepare context for script
    const scriptContext = {
      workflowId: context.execution.workflowId,
      executionId: context.execution.id,
      nodeId: node.id,
      organizationId: context.execution.context.metadata.organizationId,
      userId: context.execution.context.metadata.userId
    };

    try {
      // Execute Python script
      const result = await PythonExecutor.execute(script, scriptInput, scriptContext);

      if (result.success) {
        await context.logger.info('Python script executed successfully', {
          nodeId: node.id,
          outputSize: JSON.stringify(result.output || {}).length
        });

        // Handle different output types
        let output = result.output;
        if (typeof output === 'string') {
          try {
            // Try to parse as JSON
            output = JSON.parse(output);
          } catch {
            // Keep as string if not valid JSON
          }
        }

        return {
          output,
          nextNodes: node.data.nextNodes
        };
      } else {
        throw new Error(result.error || 'Python script execution failed');
      }
    } catch (error) {
      await context.logger.error('Python script execution failed', error as Error, {
        nodeId: node.id,
        logs: error.logs
      });
      throw error;
    }
  }
}