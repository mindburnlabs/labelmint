import { Router } from 'express'
import rateLimit from 'express-rate-limit'

const router = Router()

/**
 * @swagger
 * /api-docs:
 *   get:
 *     summary: API Documentation
 *     tags: [Documentation]
 *     description: |
 *       Interactive API documentation powered by Swagger UI.
 *
 *       This documentation provides detailed information about all available endpoints,
 *       including request/response formats, authentication methods, and examples.
 *
 *       ## Authentication
 *       Most endpoints require authentication using either:
 *       - **Bearer Token**: Include your JWT in the Authorization header
 *       - **API Key**: Include your API key in the X-API-Key header
 *
 *       ## SDKs and Examples
 *       We provide SDKs for:
 *       - JavaScript/TypeScript
 *       - Python
 *       - Java
 *       - Go
 *
 *       ## Support
 *       For API support, contact enterprise-support@labelmint.io
 *     responses:
 *       200:
 *         description: API documentation page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               format: html
 */

/**
 * @swagger
 * /api-docs.json:
 *   get:
 *     summary: OpenAPI Specification
 *     tags: [Documentation]
 *     description: |
 *       Returns the OpenAPI 3.0 specification in JSON format.
 *
 *       This can be used with API documentation generators, testing tools,
 *       or for programmatic access to the API schema.
 *
 *       ## Usage Examples
 *
 *       ### Generate client SDKs:
 *       ```bash
 *       openapi-generator-cli generate -i https://api.labelmint.io/api-docs.json -g typescript-axios -o ./generated-client
 *       ```
 *
 *       ### Load into Postman:
 *       1. Open Postman
 *       2. Click Import
 *       3. Select Link tab
 *       4. Paste: https://api.labelmint.io/api-docs.json
 *
 *       ### Use with Swagger Codegen:
 *       ```bash
 *       swagger-codegen generate -i https://api.labelmint.io/api-docs.json -l python -o ./python-client
 *       ```
 *
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: OpenAPI specification in JSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example: {
 *               "openapi": "3.0.0",
 *               "info": {
 *                 "title": "LabelMint Enterprise API",
 *                 "version": "1.0.0"
 *               }
 *             }
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

// Rate limiting for documentation endpoint
const docsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many documentation requests, please try again later.'
  }
})

router.use(docsLimiter)

export default router