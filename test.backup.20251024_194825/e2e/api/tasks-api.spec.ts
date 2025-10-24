import { test, expect } from '@playwright/test'

test.describe('Tasks API', () => {
  const API_BASE = 'http://localhost:3001/api'
  let authToken: string
  let taskId: string

  test.beforeAll(async ({ request }) => {
    // Authenticate and get token
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        username: 'testworker',
        password: 'testpassword123'
      }
    })

    const data = await response.json()
    authToken = data.token
  })

  test('POST /tasks - should create a new task', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        project_id: 1,
        type: 'IMAGE_CLASSIFICATION',
        data: {
          image_url: 'https://example.com/test-image.jpg',
          categories: ['cat', 'dog', 'bird']
        },
        required_labels: 3,
        reward_per_label: 0.10
      }
    })

    expect(response.status()).toBe(201)
    const data = await response.json()
    expect(data).toHaveProperty('id')
    expect(data.type).toBe('IMAGE_CLASSIFICATION')
    expect(data.status).toBe('CREATED')
    taskId = data.id
  })

  test('GET /tasks - should fetch available tasks', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        status: 'CREATED',
        limit: 10,
        offset: 0
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('tasks')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('page')
    expect(Array.isArray(data.tasks)).toBe(true)
  })

  test('GET /tasks/:id - should fetch specific task', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.id).toBe(taskId)
    expect(data).toHaveProperty('data')
    expect(data).toHaveProperty('required_labels')
  })

  test('POST /tasks/:id/assign - should assign task to worker', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks/${taskId}/assign`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('ASSIGNED')
    expect(data.assigned_workers).toContain(expect.any(Number))
  })

  test('POST /tasks/:id/submit - should submit task label', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks/${taskId}/submit`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        label: 'cat',
        confidence: 0.95,
        comment: 'Clearly a cat based on features'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('submission_id')
    expect(data.label).toBe('cat')
    expect(data.confidence).toBe(0.95)
  })

  test('GET /tasks/my - should fetch worker\'s tasks', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/my`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        status: 'COMPLETED',
        limit: 20
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('tasks')
    expect(data).toHaveProperty('stats')
    expect(data.stats).toHaveProperty('completed')
    expect(data.stats).toHaveProperty('earned')
    expect(data.stats).toHaveProperty('accuracy')
  })

  test('POST /tasks/bulk - should create multiple tasks', async ({ request }) => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      project_id: 1,
      type: 'TEXT_LABELING',
      data: {
        text: `Sample text ${i + 1} for labeling`,
        labels: ['positive', 'negative', 'neutral']
      },
      required_labels: 3,
      reward_per_label: 0.05
    }))

    const response = await request.post(`${API_BASE}/tasks/bulk`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: { tasks }
    })

    expect(response.status()).toBe(201)
    const data = await response.json()
    expect(data).toHaveProperty('created')
    expect(data).toHaveProperty('failed')
    expect(data.created).toBe(5)
  })

  test('GET /tasks/search - should search tasks', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/search`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        query: 'image',
        type: 'IMAGE_CLASSIFICATION',
        date_from: '2024-01-01',
        date_to: '2024-12-31'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('tasks')
    expect(data).toHaveProperty('filters')
    expect(Array.isArray(data.tasks)).toBe(true)
  })

  test('PUT /tasks/:id - should update task (admin only)', async ({ request }) => {
    // Admin login
    const adminResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        username: 'testadmin',
        password: 'testpassword123'
      }
    })
    const adminData = await adminResponse.json()
    const adminToken = adminData.token

    const response = await request.put(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        reward_per_label: 0.15,
        priority: 'high'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.reward_per_label).toBe(0.15)
    expect(data.priority).toBe('high')
  })

  test('DELETE /tasks/:id - should delete task (admin only)', async ({ request }) => {
    // Create a task to delete
    const createResponse = await request.post(`${API_BASE}/tasks`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        project_id: 1,
        type: 'IMAGE_CLASSIFICATION',
        data: { image_url: 'https://example.com/to-delete.jpg' },
        required_labels: 3
      }
    })
    const taskToDelete = (await createResponse.json()).id

    // Admin login
    const adminResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        username: 'testadmin',
        password: 'testpassword123'
      }
    })
    const adminData = await adminResponse.json()
    const adminToken = adminData.token

    const response = await request.delete(`${API_BASE}/tasks/${taskToDelete}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    })

    expect(response.status()).toBe(204)
  })

  test('GET /tasks/stats - should fetch task statistics', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/stats`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      params: {
        period: '7d',
        group_by: 'day'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('summary')
    expect(data).toHaveProperty('timeline')
    expect(data.summary).toHaveProperty('total')
    expect(data.summary).toHaveProperty('completed')
    expect(data.summary).toHaveProperty('pending')
  })

  test('POST /tasks/:id/skip - should skip difficult task', async ({ request }) => {
    // Create and assign a task
    const createResponse = await request.post(`${API_BASE}/tasks`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        project_id: 1,
        type: 'IMAGE_CLASSIFICATION',
        data: { image_url: 'https://example.com/difficult.jpg' },
        required_labels: 3
      }
    })
    const newTask = await createResponse.json()

    await request.post(`${API_BASE}/tasks/${newTask.id}/assign`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })

    // Skip the task
    const response = await request.post(`${API_BASE}/tasks/${newTask.id}/skip`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        reason: 'Image too blurry'
      }
    })

    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('CREATED')
    expect(data.assigned_workers).not.toContain(expect.any(Number))
  })
})