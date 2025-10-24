import { NodeExecutor, RuntimeContext, NodeResult } from '../../WorkflowEngine.js'

export class DelayExecutor implements NodeExecutor {
  async execute(node: any, context: RuntimeContext): Promise<NodeResult> {
    const {
      delayType,
      duration,
      until,
      unit = 'seconds'
    } = node.data.config

    await context.logger.info('Starting delay', {
      nodeType: 'delay',
      delayType,
      duration,
      unit
    })

    let delayMs: number

    switch (delayType) {
      case 'fixed':
        delayMs = this.convertDuration(duration, unit)
        break
      case 'until_time':
        delayMs = this.calculateDelayUntil(until, context)
        break
      case 'until_condition':
        delayMs = await this.waitUntilCondition(until, context)
        break
      default:
        throw new Error(`Unknown delay type: ${delayType}`)
    }

    await context.logger.info(`Delaying for ${delayMs}ms`)

    // Check if aborted
    if (context.signal.aborted) {
      throw new Error('Delay aborted')
    }

    // Wait for the specified duration
    await this.sleep(delayMs, context.signal)

    await context.logger.info('Delay completed')

    return {
      output: {
        delayed: true,
        delayDuration: delayMs,
        completedAt: new Date().toISOString()
      }
    }
  }

  private convertDuration(duration: number, unit: string): number {
    switch (unit) {
      case 'milliseconds':
        return duration
      case 'seconds':
        return duration * 1000
      case 'minutes':
        return duration * 60 * 1000
      case 'hours':
        return duration * 60 * 60 * 1000
      case 'days':
        return duration * 24 * 60 * 60 * 1000
      default:
        throw new Error(`Unknown time unit: ${unit}`)
    }
  }

  private calculateDelayUntil(until: string, context: RuntimeContext): number {
    const untilDate = new Date(until)
    const now = new Date()

    if (untilDate <= now) {
      return 0
    }

    return untilDate.getTime() - now.getTime()
  }

  private async waitUntilCondition(condition: any, context: RuntimeContext): Promise<number> {
    const {
      expression,
      checkInterval = 5000, // 5 seconds default
      maxWaitTime = 300000  // 5 minutes default
    } = condition

    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      // Check if aborted
      if (context.signal.aborted) {
        throw new Error('Delay aborted')
      }

      // Evaluate condition
      const result = await this.evaluateCondition(expression, context)

      if (result) {
        return Date.now() - startTime
      }

      // Wait before next check
      await this.sleep(checkInterval, context.signal)
    }

    throw new Error(`Condition not met within max wait time of ${maxWaitTime}ms`)
  }

  private async evaluateCondition(expression: string, context: RuntimeContext): Promise<boolean> {
    try {
      const variables = context.execution.context.variables
      let processedExpression = expression

      // Replace variables
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g')
        processedExpression = processedExpression.replace(regex, JSON.stringify(value))
      }

      const result = new Function(`return ${processedExpression}`)()
      return Boolean(result)
    } catch (error) {
      await context.logger.warn('Failed to evaluate delay condition', {
        expression,
        error: error.message
      })
      return false
    }
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (signal.aborted) {
        reject(new Error('Sleep aborted'))
        return
      }

      const timeout = setTimeout(() => {
        resolve()
      }, ms)

      // Listen for abort signal
      const abortHandler = () => {
        clearTimeout(timeout)
        reject(new Error('Sleep aborted'))
      }

      signal.addEventListener('abort', abortHandler, { once: true })
    })
  }
}