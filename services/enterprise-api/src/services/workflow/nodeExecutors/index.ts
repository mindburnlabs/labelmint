import { TaskExecutor } from './TaskExecutor.js'
import { ApiCallExecutor } from './ApiCallExecutor.js'
import { ConditionExecutor } from './ConditionExecutor.js'
import { DelayExecutor } from './DelayExecutor.js'
import { DataTransformExecutor } from './DataTransformExecutor.js'
import { NotificationExecutor } from './NotificationExecutor.js'
import { WebhookExecutor } from './WebhookExecutor.js'
import { ValidationExecutor } from './ValidationExecutor.js'
import { PythonScriptExecutor } from './PythonExecutor.js'

export {
  TaskExecutor,
  ApiCallExecutor,
  ConditionExecutor,
  DelayExecutor,
  DataTransformExecutor,
  NotificationExecutor,
  WebhookExecutor,
  ValidationExecutor,
  PythonScriptExecutor
}

export function registerAllExecutors(engine: any): void {
  engine.registerNodeExecutor('task', new TaskExecutor())
  engine.registerNodeExecutor('api_call', new ApiCallExecutor())
  engine.registerNodeExecutor('condition', new ConditionExecutor())
  engine.registerNodeExecutor('delay', new DelayExecutor())
  engine.registerNodeExecutor('data_transform', new DataTransformExecutor())
  engine.registerNodeExecutor('notification', new NotificationExecutor())
  engine.registerNodeExecutor('webhook', new WebhookExecutor())
  engine.registerNodeExecutor('validation', new ValidationExecutor())
  engine.registerNodeExecutor('python_script', new PythonScriptExecutor())
}