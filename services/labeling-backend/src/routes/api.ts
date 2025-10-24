import { Router } from 'express';
import { authenticateApiKey } from '../middleware/apiAuth.js';
import { ProjectsController } from '../controllers/api/projectsController.js';
import { KeysController } from '../controllers/api/keysController.js';

const router = Router();

// Apply API authentication to all routes
router.use(authenticateApiKey);

/**
 * @swagger
 * /keys:
 *   post:
 *     summary: Create a new API key
 *     tags: [API Keys]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: Name for the API key
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Permissions array
 *                 default: ["projects:read", "projects:write"]
 *               rateLimit:
 *                 type: object
 *                 properties:
 *                   requests:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 100000
 *                     default: 1000
 *                   window:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 1440
 *                     default: 60
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Description of the API key
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 api_key:
 *                   $ref: '#/components/schemas/ApiKey'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/keys', KeysController.createKey);

/**
 * @swagger
 * /keys:
 *   get:
 *     summary: List all API keys
 *     tags: [API Keys]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 api_keys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *                 total:
 *                   type: integer
 *                   description: Total number of API keys
 */
router.get('/keys', KeysController.listKeys);

/**
 * @swagger
 * /keys/{id}:
 *   put:
 *     summary: Update an API key
 *     tags: [API Keys]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               rateLimit:
 *                 type: object
 *                 properties:
 *                   requests:
 *                     type: integer
 *                   window:
 *                     type: integer
 *               isActive:
 *                 type: boolean
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: API key updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 api_key:
 *                   $ref: '#/components/schemas/ApiKey'
 *                 message:
 *                   type: string
 *       404:
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/keys/:id', KeysController.updateKey);

/**
 * @swagger
 * /keys/{id}:
 *   delete:
 *     summary: Deactivate an API key
 *     tags: [API Keys]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/keys/:id', KeysController.deleteKey);

/**
 * @swagger
 * /keys/{id}/usage:
 *   get:
 *     summary: Get API key usage statistics
 *     tags: [API Keys]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 api_key:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     last_used:
 *                       type: string
 *                       format: date-time
 *                     request_count:
 *                       type: integer
 *                     rate_limit:
 *                       type: object
 *                 usage:
 *                   type: object
 *                   properties:
 *                     requests_today:
 *                       type: integer
 *                     requests_this_month:
 *                       type: integer
 *                     recent_activity:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: string
 *                             format: date-time
 *                           requests:
 *                             type: integer
 *                           unique_endpoints:
 *                             type: integer
 */
router.get('/keys/:id/usage', KeysController.getKeyUsage);

// Projects endpoints
/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new labeling project
 *     tags: [Projects]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - categories
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: Project name
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Project description
 *               type:
 *                 type: string
 *                 enum: [image, text]
 *                 description: Type of labeling task
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 maxItems: 10
 *                 description: Available labeling categories
 *               config:
 *                 type: object
 *                 properties:
 *                   instruction:
 *                     type: string
 *                   guidelines:
 *                     type: array
 *                     items:
 *                       type: string
 *                   required_accuracy:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                   quality_check:
 *                     type: boolean
 *               webhooks:
 *                 type: object
 *                 properties:
 *                   task_completed:
 *                     type: string
 *                     format: uri
 *                   project_completed:
 *                     type: string
 *                     format: uri
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 project:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Project'
 *                     - type: object
 *                       properties:
 *                         pricing:
 *                           $ref: '#/components/schemas/Pricing'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/projects', ProjectsController.createProject);

/**
 * @swagger
 * /projects/{id}/upload:
 *   post:
 *     summary: Upload data for labeling
 *     tags: [Projects]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Optional item ID
 *                     data:
 *                       oneOf:
 *                         - type: string
 *                           description: Image URL or text content
 *                         - type: object
 *                           description: Structured data
 *                     label:
 *                       type: string
 *                       description: Pre-existing label (optional)
 *                 description: Array of data items to label
 *               format:
 *                 type: string
 *                 enum: [json, csv, txt]
 *                 default: json
 *                 description: Data format
 *     responses:
 *       200:
 *         description: Data uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     project_id:
 *                       type: integer
 *                     tasks_created:
 *                       type: integer
 *                     total_cost:
 *                       type: number
 *                     cost_per_label:
 *                       type: number
 *                     status:
 *                       type: string
 *       402:
 *         description: Insufficient balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/projects/:id/upload', ProjectsController.uploadData);

/**
 * @swagger
 * /projects/{id}/status:
 *   get:
 *     summary: Get project status and statistics
 *     tags: [Projects]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     total_tasks:
 *                       type: integer
 *                     completed_tasks:
 *                       type: integer
 *                     in_progress_tasks:
 *                       type: integer
 *                     responses_count:
 *                       type: integer
 *                     correct_responses:
 *                       type: integer
 *                     accuracy:
 *                       type: integer
 *                     progress:
 *                       type: integer
 *                 pricing:
 *                   type: object
 *                   properties:
 *                     cost_per_label:
 *                       type: number
 *                     total_paid:
 *                       type: number
 *                     potential_earnings:
 *                       type: number
 */
router.get('/projects/:id/status', ProjectsController.getProjectStatus);

/**
 * @swagger
 * /projects/{id}/results:
 *   get:
 *     summary: Get project results
 *     tags: [Projects]
 *     security:
 *       - apiKeyAuth: []
 *       - timestampAuth: []
 *       - signatureAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Response format
 *       - in: query
 *         name: include_metadata
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include original metadata
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10000
 *           minimum: 1
 *           maximum: 100000
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of results to skip
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, in_progress]
 *         description: Filter by task status
 *     responses:
 *       200:
 *         description: Project results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *                 format:
 *                   type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     returned:
 *                       type: integer
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     total_labels:
 *                       type: integer
 *                     labeled_count:
 *                       type: integer
 *                     correct_count:
 *                       type: integer
 *                     accuracy:
 *                       type: number
 *                     avg_time_spent:
 *                       type: number
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TaskResult'
 *       400:
 *         description: Unsupported format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/projects/:id/results', ProjectsController.getResults);

export default router;