import { Pool } from 'pg'
import Redis from 'redis'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/telegram_labeling'
})

const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

interface ImageNetItem {
  id: string
  label: string
  category: 'cat' | 'dog' | 'other'
  imageUrl: string
}

// Generate mock image data with actual downloadable images
const generateMockImages = (): ImageNetItem[] => {
  const images: ImageNetItem[] = []

  for (let i = 0; i < 100; i++) {
    const categories = ['cat', 'dog', 'other']
    const category = categories[i % 3] as 'cat' | 'dog' | 'other'

    images.push({
      id: `img_${i}`,
      label: category,
      category: category,
      imageUrl: `https://picsum.photos/300/300?random=${i}&category=${category}`
    })
  }

  return images
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${url}`)
    }

    const buffer = await response.buffer()
    await fs.promises.writeFile(filepath, buffer)
  } catch (error) {
    // Create a placeholder image if download fails
    const svgPlaceholder = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="20" fill="#999" text-anchor="middle" dy=".3em">
        Image ${url.split('random=')[1]?.split('&')[0] || 'N/A'}
      </text>
    </svg>`
    await fs.promises.writeFile(filepath.replace('.jpg', '.svg'), svgPlaceholder)
  }
}

async function createTestProject() {
  console.log('🚀 Creating test project: ImageNet Cat/Dog/Other Classification')

  await pool.connect()
  await redis.connect()

  try {
    // 1. Create test user (client)
    const clientResult = await pool.query(
      `INSERT INTO users (telegram_id, username, role, balance, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (telegram_id) DO UPDATE SET
       username = EXCLUDED.username,
       role = EXCLUDED.role,
       updated_at = NOW()
       RETURNING id`,
      [123456789, 'test_client', 'client', 10.00]
    )

    const clientId = clientResult.rows[0].id
    console.log(`✅ Created/updated client user: ${clientId}`)

    // 2. Create the project
    const projectResult = await pool.query(
      `INSERT INTO projects (owner_id, name, description, task_type, categories, price_per_label, total_tasks, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      [
        clientId,
        'ImageNet Cat/Dog/Other Classification',
        'Classify 100 ImageNet images into cat, dog, or other categories',
        'image_classification',
        JSON.stringify(['cat', 'dog', 'other']),
        0.05,
        100,
        'funded'
      ]
    )

    const projectId = projectResult.rows[0].id
    console.log(`✅ Created project: ${projectId}`)

    // 3. Create images directory
    const imagesDir = path.join(__dirname, '../../../uploads', projectId.toString())
    await fs.promises.mkdir(imagesDir, { recursive: true })

    // 4. Generate and download images
    const images = generateMockImages()
    console.log(`📥 Downloading ${images.length} images...`)

    const tasks = []
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const filename = `${image.id}.svg`
      const filepath = path.join(imagesDir, filename)

      try {
        await downloadImage(image.imageUrl, filepath)

        tasks.push({
          project_id: projectId,
          image_url: `/uploads/${projectId}/${filename}`,
          ground_truth: image.category,
          metadata: JSON.stringify({
            imagenet_id: image.id,
            label: image.label,
            original_url: image.imageUrl
          }),
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        })

        if ((i + 1) % 10 === 0) {
          console.log(`  Generated ${i + 1}/${images.length} images`)
        }
      } catch (error) {
        console.error(`Failed to generate image ${image.id}:`, error)
      }
    }

    // 5. Insert tasks into database
    if (tasks.length > 0) {
      const insertQuery = `
        INSERT INTO tasks (project_id, image_url, ground_truth, metadata, status, created_at, updated_at)
        VALUES ${tasks.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
      `

      const values = tasks.flatMap(task => [
        task.project_id,
        task.image_url,
        task.ground_truth,
        task.metadata,
        task.status,
        task.created_at,
        task.updated_at
      ])

      await pool.query(insertQuery, values)
      console.log(`✅ Created ${tasks.length} tasks`)
    }

    // 6. Update project funding (deduct from client balance)
    const totalCost = 100 * 0.05
    await pool.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2`,
      [totalCost, clientId]
    )

    // 7. Create funding record
    await pool.query(
      `INSERT INTO project_funding (project_id, amount, funding_method, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [projectId, totalCost, 'balance', 'completed']
    )

    // 8. Initialize project metrics in Redis
    await redis.hSet(`project:${projectId}:metrics`, {
      totalTasks: '100',
      completedTasks: '0',
      pendingTasks: '100',
      inProgressTasks: '0',
      consensusReached: '0',
      qualityScore: '0.00'
    })

    console.log(`\n✅ Test project created successfully!`)
    console.log(`📊 Project ID: ${projectId}`)
    console.log(`💰 Total Cost: $${totalCost}`)
    console.log(`📁 Images saved to: ${imagesDir}`)
    console.log(`🏷️  Categories: cat (33%), dog (33%), other (34%)`)

    return projectId

  } catch (error) {
    console.error('❌ Error creating test project:', error)
    throw error
  } finally {
    await pool.end()
    await redis.quit()
  }
}

// Run the script
if (require.main === module) {
  createTestProject()
    .then(() => {
      console.log('\n🎉 Test project setup complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Failed to create test project:', error)
      process.exit(1)
    })
}

export default createTestProject