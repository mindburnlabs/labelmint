import { Router } from 'express'
import { TestProjectController } from './testProjectController'

const router = Router()
const controller = new TestProjectController()

// Create a test project with 100 ImageNet images
router.post('/create', controller.createTestProject.bind(controller))

// Get real-time project progress
router.get('/:projectId/progress', controller.getProjectProgress.bind(controller))

// Server-Sent Events for real-time updates
router.get('/:projectId/updates', controller.getRealTimeUpdates.bind(controller))

// Simulate worker activity for testing
router.post('/:projectId/simulate', controller.simulateWorkerActivity.bind(controller))

export default router