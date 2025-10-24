import express from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import Redis from 'redis'
import testProjectRoutes from './api/projects/testProjectRoutes'
import adminDashboard from './pages/admin-dashboard'

const app = express()
const port = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files (uploads)
app.use('/uploads', express.static('uploads'))

// API Routes
app.use('/api/test-project', testProjectRoutes)

// Admin Dashboard
app.use('/admin', adminDashboard)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Database and Redis connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/telegram_labeling'
})

const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

// Initialize connections
async function initialize() {
  try {
    await pool.connect()
    console.log('✅ Connected to PostgreSQL')

    await redis.connect()
    console.log('✅ Connected to Redis')

    // Create uploads directory
    const fs = require('fs')
    const path = require('path')
    const uploadsDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
  } catch (error) {
    console.error('❌ Failed to initialize:', error)
    process.exit(1)
  }
}

// Start server
app.listen(port, async () => {
  await initialize()
  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log(`📊 Admin Dashboard: http://localhost:${port}/admin`)
  console.log(`🔗 API Endpoint: http://localhost:${port}/api/test-project`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down...')
  await pool.end()
  await redis.quit()
  process.exit(0)
})

export default app