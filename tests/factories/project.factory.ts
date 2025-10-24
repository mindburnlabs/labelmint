import { faker } from '@faker-js/faker'
import { TaskType } from './task.factory'

export interface ProjectFactoryData {
  id?: number
  name?: string
  description?: string
  task_type?: TaskType
  status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  total_tasks?: number
  completed_tasks?: number
  payment_per_task?: number
  total_budget?: number
  client_id?: number
  requirements?: Record<string, any>
  created_at?: Date
  updated_at?: Date
}

export const ProjectFactory = {
  create: (overrides: ProjectFactoryData = {}) => {
    const totalTasks = overrides.total_tasks ?? faker.number.int({ min: 10, max: 1000 })
    const paymentPerTask = overrides.payment_per_task ?? faker.number.int({ min: 1, max: 100 })

    return {
      id: faker.number.int({ min: 1, max: 1000 }),
      name: faker.lorem.words(3),
      description: faker.lorem.paragraph(),
      task_type: faker.helpers.arrayElement(Object.values(TaskType)),
      status: faker.helpers.arrayElement(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']),
      total_tasks: totalTasks,
      completed_tasks: faker.number.int({ min: 0, max: totalTasks }),
      payment_per_task: paymentPerTask,
      total_budget: totalTasks * paymentPerTask,
      client_id: faker.number.int({ min: 1, max: 10000 }),
      requirements: {
        min_trust_score: 0.7,
        max_workers_per_task: 3,
        consensus_threshold: 0.66,
        ...overrides.requirements
      },
      created_at: faker.date.past(),
      updated_at: faker.date.recent(),
      ...overrides
    }
  },

  createMany: (count: number, overrides: ProjectFactoryData = {}) =>
    Array.from({ length: count }, () => ProjectFactory.create(overrides)),

  createActive: (overrides: ProjectFactoryData = {}) =>
    ProjectFactory.create({
      status: 'ACTIVE',
      ...overrides
    }),

  createImageClassification: (overrides: ProjectFactoryData = {}) =>
    ProjectFactory.create({
      task_type: TaskType.IMAGE_CLASSIFICATION,
      requirements: {
        min_trust_score: 0.8,
        categories: ['cat', 'dog', 'bird', 'car', 'person'],
        min_image_resolution: '224x224'
      },
      ...overrides
    }),

  createWithBudget: (budget: number, overrides: ProjectFactoryData = {}) => {
    const paymentPerTask = overrides.payment_per_task ?? faker.number.int({ min: 1, max: 50 })
    const totalTasks = Math.floor(budget / paymentPerTask)

    return ProjectFactory.create({
      total_budget: budget,
      payment_per_task: paymentPerTask,
      total_tasks: totalTasks,
      ...overrides
    })
  }
}