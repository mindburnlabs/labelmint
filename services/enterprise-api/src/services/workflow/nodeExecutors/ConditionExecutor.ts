import { NodeExecutor, RuntimeContext, NodeResult } from '../../WorkflowEngine.js'

export class ConditionExecutor implements NodeExecutor {
  async execute(node: any, context: RuntimeContext): Promise<NodeResult> {
    const { conditionType, conditions, logicOperator = 'and' } = node.data.config

    await context.logger.info('Evaluating condition', {
      nodeType: 'condition',
      conditionType,
      logicOperator
    })

    let result: boolean

    switch (conditionType) {
      case 'expression':
        result = await this.evaluateExpression(node.data.config.expression, context)
        break
      case 'rules':
        result = await this.evaluateRules(conditions, logicOperator, context)
        break
      case 'javascript':
        result = await this.evaluateJavaScript(node.data.config.script, context)
        break
      default:
        throw new Error(`Unknown condition type: ${conditionType}`)
    }

    await context.logger.info('Condition evaluated', { result })

    // Store result in context
    context.execution.context.variables.conditionResult = result

    return {
      output: {
        conditionMet: result,
        conditionType,
        evaluatedAt: new Date().toISOString()
      }
    }
  }

  private async evaluateExpression(expression: string, context: RuntimeContext): Promise<boolean> {
    // Replace variables in expression
    const variables = context.execution.context.variables
    let processedExpression = expression

    // Simple variable replacement
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      processedExpression = processedExpression.replace(regex, JSON.stringify(value))
    }

    try {
      // Use Function constructor for safe evaluation
      // WARNING: In production, use a proper expression parser
      const result = new Function(`return ${processedExpression}`)()
      return Boolean(result)
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${error.message}`)
    }
  }

  private async evaluateRules(
    conditions: any[],
    logicOperator: 'and' | 'or',
    context: RuntimeContext
  ): Promise<boolean> {
    const results: boolean[] = []

    for (const condition of conditions) {
      const result = await this.evaluateSingleRule(condition, context)
      results.push(result)

      // Short-circuit evaluation
      if (logicOperator === 'and' && !result) {
        return false
      }
      if (logicOperator === 'or' && result) {
        return true
      }
    }

    // Apply logic operator
    if (logicOperator === 'and') {
      return results.every(r => r)
    } else {
      return results.some(r => r)
    }
  }

  private async evaluateSingleRule(rule: any, context: RuntimeContext): Promise<boolean> {
    const { field, operator, value, valueType = 'string' } = rule

    // Get field value from context
    const fieldValue = this.getFieldValue(field, context)

    // Convert value to appropriate type
    let expectedValue: any = value
    if (valueType === 'number') {
      expectedValue = Number(value)
    } else if (valueType === 'boolean') {
      expectedValue = value === 'true'
    } else if (valueType === 'date') {
      expectedValue = new Date(value)
    }

    // Apply operator
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue
      case 'not_equals':
        return fieldValue !== expectedValue
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue)
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue)
      case 'greater_equal':
        return Number(fieldValue) >= Number(expectedValue)
      case 'less_equal':
        return Number(fieldValue) <= Number(expectedValue)
      case 'contains':
        return String(fieldValue).includes(String(expectedValue))
      case 'not_contains':
        return !String(fieldValue).includes(String(expectedValue))
      case 'starts_with':
        return String(fieldValue).startsWith(String(expectedValue))
      case 'ends_with':
        return String(fieldValue).endsWith(String(expectedValue))
      case 'is_empty':
        return !fieldValue || fieldValue === ''
      case 'is_not_empty':
        return fieldValue && fieldValue !== ''
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue)
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue)
      case 'matches_regex':
        try {
          const regex = new RegExp(String(expectedValue))
          return regex.test(String(fieldValue))
        } catch (error) {
          throw new Error(`Invalid regex pattern: ${expectedValue}`)
        }
      default:
        throw new Error(`Unknown operator: ${operator}`)
    }
  }

  private getFieldValue(field: string, context: RuntimeContext): any {
    // Support dot notation for nested fields
    const keys = field.split('.')
    let value: any = context.execution.context.variables

    for (const key of keys) {
      if (value && typeof value === 'object') {
        // Handle array access
        const arrayMatch = key.match(/(\w+)\[(\d+)\]/)
        if (arrayMatch) {
          value = value[arrayMatch[1]]
          if (value && Array.isArray(value)) {
            value = value[parseInt(arrayMatch[2])]
          }
        } else {
          value = value[key]
        }
      } else {
        return undefined
      }
    }

    return value
  }

  private async evaluateJavaScript(script: string, context: RuntimeContext): Promise<boolean> {
    try {
      const { Script } = await import('vm')

      const sandbox = {
        context: context.execution.context.variables,
        input: context.execution.input,
        logger: context.logger
      }

      const scriptObj = new Script(`
        (function() {
          ${script}
        })()
      `)

      const result = scriptObj.runInNewContext(sandbox, {
        timeout: 5000
      })

      return Boolean(result)
    } catch (error) {
      throw new Error(`JavaScript evaluation failed: ${error.message}`)
    }
  }
}