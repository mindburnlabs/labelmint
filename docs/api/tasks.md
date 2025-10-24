# Tasks API

## Overview

The Tasks API allows you to manage labeling tasks, including creation, assignment, submission, and tracking.

## Base Endpoint

```
GET    /api/v1/tasks
POST   /api/v1/tasks
```

## Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer <your-jwt-token>
```

## Task Object

```typescript
interface Task {
  id: string                    // Unique task identifier
  projectId: string              // Parent project ID
  imageUrl: string                // Image URL for annotation
  categories: string[]           // Available label categories
  type: 'image_classification' | 'text_classification' | 'bounding_box' | 'text_transcription'
  status: 'available' | 'assigned' | 'in_progress' | 'completed' | 'disputed' | 'cancelled'
  requiredLabels: number         // Number of labels required (typically 3)
  assignedWorkers: string[]       // IDs of assigned workers
  labels: Label[]               // Submitted labels
  createdAt: string              // ISO timestamp of creation
  updatedAt?: string             // ISO timestamp of last update
  metadata?: Record<string, any> // Additional task data
}
```

### Label Interface

```typescript
interface Label {
  workerId: string
  label: string
  confidence?: number    // For bounding box annotations
  timestamp: string
}
```

## List Tasks

Retrieve a list of available tasks with filtering and pagination.

```http
GET /api/v1/tasks
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | 'available' | Filter by task status |
| `type` | string | - | Filter by task type |
| `projectId` | string | - | Filter by project ID |
| `limit` | number | 20 | Number of tasks per page |
| `offset` | number | 0 | Number of tasks to skip |
| `sortBy` | string | 'createdAt' | Sort field |
| `sortOrder` | 'asc' \| 'desc' | 'desc' | Sort order |

### Response

```json
{
  "success": true,
  "data": {
    "tasks": Task[],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Example

```bash
curl -X GET "https://api.labelmint.io/v1/tasks?status=available&limit=10&offset=0" \
  -H "Authorization: Bearer your-token"
```

## Create Task

Create a new labeling task.

```http
POST /api/v1/tasks
```

### Request Body

```typescript
interface CreateTaskRequest {
  projectId: string
  imageUrl: string
  categories: string[]
  type?: 'image_classification' | 'text_classification' | 'bounding_box' | 'text_transcription'
  requiredLabels?: number
  honeypot?: boolean
  metadata?: Record<string, any>
}
```

### Response

```json
{
  "success": true,
  "data": {
    "task": Task
  }
}
```

### Example

```bash
curl -X POST "https://api.labelmint.io/v1/tasks" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "imageUrl": "https://example.com/image.jpg",
    "categories": ["cat", "dog", "bird"],
    "type": "image_classification",
    "requiredLabels": 3,
    "honeypot": false
  }'
```

## Get Task

Retrieve details of a specific task.

```http
GET /api/v1/tasks/:id
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Task ID |

### Response

```json
{
  "success": true,
  "data": {
    "task": Task
  }
}
```

### Example

```bash
curl -X GET "https://api.labelmint.io/v1/tasks/task_123" \
  -H "Authorization: Bearer your-token"
```

## Update Task

Update an existing task.

```http
PUT /api/v1/tasks/:id
```

### Request Body

```typescript
interface UpdateTaskRequest {
  categories?: string[]
  status?: TaskStatus
  metadata?: Record<string, any>
}
```

### Response

```json
{
  "success": true,
  "data": {
    "task": Task
  }
}
```

### Example

```bash
curl -X PUT "https://api.labelmint.io/v1/tasks/task_123" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["cat", "dog", "bird", "car"],
    "metadata": {
      "priority": "high"
    }
  }'
```

## Delete Task

Delete a task and all associated data.

```http
DELETE /api/v1/tasks/:id
```

### Response

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### Example

```bash
curl -X DELETE "https://api.labelmint.io/v1/tasks/task_123" \
  -H "Authorization: Bearer your-token"
```

## Assign Task

Assign a task to a worker.

```http
POST /api/v1/tasks/:id/assign
```

### Response

```json
{
  "success": true,
  "data": {
    "assignment": {
      taskId: string,
      workerId: string,
      assignedAt: string
    }
  }
}
```

### Example

```bash
curl -X POST "https://api.labelmint.io/v1/tasks/task_123/assign" \
  -H "Authorization: Bearer your-token"
```

## Submit Label

Submit a label for a task.

```http
POST /api/v1/tasks/:id/submit
```

### Request Body

```typescript
interface SubmitLabelRequest {
  label: string
  confidence?: number    // For bounding box annotations
  annotation?: BoundingBox  // For bounding box type
}
```

### Bounding Box Interface

```typescript
interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  label: string
}
```

### Response

```json
{
  "success": true,
  "data": {
    "submission": {
      taskId: string,
      workerId: string,
      label: string,
      submittedAt: string,
      reward: number
    },
    "taskConsensus": {
      achieved: boolean,
      result?: string,
      confidence?: number
    }
  }
}
```

### Example

```bash
curl -X POST "https://api.labelmint.io/v1/tasks/task_123/submit" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "cat",
    "confidence": 0.95
  }'
```

### Bounding Box Example

```bash
curl -X POST "https://api.labelmint.io/v1/tasks/task_123/submit" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "person",
    "annotation": {
      "x": 100,
      "y": 150,
      "width": 80,
      "height": 120
    }
  }'
```

## Skip Task

Allow a worker to skip a task.

```http
POST /api/v1/tasks/:id/skip
```

### Request Body

```typescript
interface SkipTaskRequest {
  reason: string  // Optional skip reason
}
```

### Response

```json
{
  "success": true,
  "data": {
    "taskId": string,
    skippedAt: string,
    reason?: string
  }
}
```

### Example

```bash
curl -X POST "https://api.labelmint.io/v1/tasks/task_123/skip" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Image quality is too poor"
  }'
```

## Batch Create Tasks

Create multiple tasks at once.

```http
POST /api/v1/tasks/batch
```

### Request Body

```typescript
interface BatchCreateTasksRequest {
  projectId: string
  tasks: Omit<CreateTaskRequest, 'projectId'>[]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "created": number,
    "failed": number,
    "tasks": Task[]
  }
}
```

### Example

```bash
curl -X POST "https://api.labelmint.io/v1/tasks/batch" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "tasks": [
      {
        "imageUrl": "https://example.com/image1.jpg",
        "categories": ["cat", "dog"]
      },
      {
        "imageUrl": "https://example.com/image2.jpg",
        "categories": ["cat", "dog"]
      }
    ]
  }'
```

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `TASK_NOT_FOUND` | 404 | Task does not exist |
| `TASK_ALREADY_ASSIGNED` | 400 | Task is already assigned to worker |
| `TASK_NOT_AVAILABLE` | 400 | Task cannot be assigned in current state |
| `INVALID_LABEL` | 400 | Submitted label is not in allowed categories |
| `DUPLICATE_SUBMISSION` | 400 | Worker has already submitted a label |
| `INSUFFICIENT_LABELS` | 400 | Not enough labels to determine consensus |
| `PROJECT_NOT_FOUND` | 404 | Project does not exist |
| `METADATA_INVALID` | 422 | Task metadata is invalid |

## Webhook Events

Tasks API triggers the following webhook events:

### task.completed
Emitted when a task reaches consensus and is marked complete.

```json
{
  "event": "task.completed",
  "data": {
    "taskId": string,
    "projectId": string,
    "result": string,
    "confidence": number,
    "labels": Label[]
  }
}
```

### task.disputed
Emitted when consensus cannot be reached.

```json
{
  "event": "task.disputed",
  "data": {
    "taskId": string,
    "projectId": string,
    "labels": Label[]
  }
}
```

## Rate Limiting

Tasks API has the following rate limits:
- List tasks: 100 requests per minute
- Create task: 20 requests per minute
- Submit label: 10 requests per minute
- Batch create: 5 requests per minute

## Best Practices

1. **Use pagination** when listing tasks to avoid large responses
2. **Handle consensus asynchronously** - task may not complete immediately after submission
3. **Validate labels** against task categories before submission
4. **Implement retry logic** for failed submissions with appropriate backoff
5. **Use batch creation** for uploading large datasets
6. **Monitor task status** through webhooks for real-time updates
7. **Handle missing categories** gracefully - may indicate task configuration errors
8. **Use honeypot tasks** to monitor worker quality and detect automation

## Examples

### Complete Task Lifecycle

```javascript
// 1. Create a task
const createResponse = await fetch('/api/v1/tasks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    projectId: 'proj_123',
    imageUrl: 'https://example.com/image.jpg',
    categories: ['cat', 'dog', 'bird']
  })
})

const { taskId } = await createResponse.json()

// 2. Monitor for completion (using webhook or polling)
const checkStatus = async () => {
  const response = await fetch(`/api/v1/tasks/${taskId}`, {
    headers: { 'Authorization': 'Bearer token' }
  })
  const { task } = await response.json()

  if (task.status === 'completed') {
    console.log('Task completed with result:', task.result)
  } else if (task.status === 'disputed') {
    console.log('Task could not reach consensus')
  } else {
    setTimeout(checkStatus, 5000) // Check again in 5 seconds
  }
}

checkStatus()
```

### Batch Upload with Progress Tracking

```javascript
// Upload in batches of 100 tasks
const batchCreate = async (projectId, tasks) => {
  const results = {
    created: 0,
    failed: 0,
    errors: []
  }

  for (let i = 0; i < tasks.length; i += 100) {
    const batch = tasks.slice(i, i + 100)

    try {
      const response = await fetch('/api/v1/tasks/batch', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          tasks: batch
        })
      })

      const data = await response.json()
      results.created += data.created
      results.failed += data.failed
      results.errors.push(...data.errors)

      console.log(`Processed batch ${Math.floor(i/100) + 1}: ${data.created} created, ${data.failed} failed`)
    } catch (error) {
      results.failed += batch.length
      results.errors.push(`Batch ${Math.floor(i/100) + 1}: ${error.message}`)
    }
  }

  return results
}
```