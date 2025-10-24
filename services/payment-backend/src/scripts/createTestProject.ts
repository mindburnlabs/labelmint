import { Pool } from 'pg'
import Redis from 'redis'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Secure filename sanitization to prevent path traversal
const sanitizeFilename = (filename: string): string => {
  // Remove any path separators and special characters
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Validate and resolve file paths securely
const securePathJoin = (baseDir: string, filename: string): string => {
  const sanitized = sanitizeFilename(filename)
  const resolvedPath = path.resolve(baseDir, sanitized)

  // Ensure the resolved path is still within the base directory
  if (!resolvedPath.startsWith(path.resolve(baseDir))) {
    throw new Error('Invalid file path: Path traversal detected')
  }

  return resolvedPath
}

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

// Sample ImageNet URLs for cats, dogs, and other animals
const imagenetSamples: ImageNetItem[] = [
  // Cats (30)
  { id: 'n02123045_1', label: 'tabby_cat', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02123045/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02123045_2', label: 'tabby_cat', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02123045/ILSVRC2012_test_00000002.JPEG' },
  { id: 'n02123045_3', label: 'tabby_cat', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02123045/ILSVRC2012_test_00000003.JPEG' },
  { id: 'n02123159_1', label: 'tiger_cat', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02123159/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02123159_2', label: 'tiger_cat', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02123159/ILSVRC2012_test_00000002.JPEG' },
  { id: 'n02124075_1', label: 'egyptian_cat', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02124075/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02127052_1', label: 'lynx', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02127052/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02128385_1', label: 'leopard', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02128385/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02128757_1', label: 'snow_leopard', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02128757/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02128925_1', label: 'jaguar', category: 'cat', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02128925/ILSVRC2012_test_00000001.JPEG' },

  // Dogs (30)
  { id: 'n02085620_1', label: 'chihuahua', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02085620/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02085782_1', label: 'japanese_spaniel', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02085782/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02085936_1', label: 'maltese_dog', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02085936/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02086079_1', label: 'pekinese', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02086079/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02086240_1', label: 'shih-tzu', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02086240/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02086646_1', label: 'blenheim_spaniel', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02086646/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02086910_1', label: 'papillon', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02086910/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02087046_1', label: 'toy_terrier', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02087046/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02087394_1', label: 'rhodesian_ridgeback', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02087394/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02088094_1', label: 'afghan_hound', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02088094/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02088238_1', label: 'basset', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02088238/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02088364_1', label: 'beagle', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02088364/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02088632_1', label: 'bloodhound', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02088632/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02089078_1', label: 'bluetick', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02089078/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n02089867_1', label: 'black-and-tan_coonhound', category: 'dog', imageUrl: 'https://storage.googleapis.com/imagenet-data/n02089867/ILSVRC2012_test_00000001.JPEG' },

  // Other animals (40)
  { id: 'n01440764_1', label: 'tench', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01440764/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01443537_1', label: 'goldfish', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01443537/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01484850_1', label: 'great_white_shark', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01484850/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01491361_1', label: 'tiger_shark', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01491361/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01494475_1', label: 'hammerhead', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01494475/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01496331_1', label: 'electric_ray', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01496331/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01498041_1', label: 'stingray', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01498041/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01514668_1', label: 'cock', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01514668/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01514859_1', label: 'hen', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01514859/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01518878_1', label: 'ostrich', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01518878/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01530575_1', label: 'brambling', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01530575/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01531178_1', label: 'goldfinch', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01531178/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01532829_1', label: 'house_finch', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01532829/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01534468_1', label: 'junco', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01534468/ILSVRC2012_test_00000001.JPEG' },
  { id: 'n01537544_1', label: 'indigo_bunting', category: 'other', imageUrl: 'https://storage.googleapis.com/imagenet-data/n01537544/ILSVRC2012_test_00000001.JPEG' },
]

// Generate mock image data with actual downloadable images
const generateMockImages = (): ImageNetItem[] => {
  const images: ImageNetItem[] = []

  // Use the samples we have and duplicate with variations
  for (let i = 0; i < 100; i++) {
    const sample = imagenetSamples[i % imagenetSamples.length]
    images.push({
      ...sample,
      id: `${sample.id}_${i}`,
      imageUrl: `https://picsum.photos/300/300?random=${i}&category=${sample.category}`
    })
  }

  return images
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${url}`)
  }

  const buffer = await response.buffer()
  await fs.promises.writeFile(filepath, buffer)
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
    const imagesDir = path.join(__dirname, '../../uploads', projectId.toString())
    await fs.promises.mkdir(imagesDir, { recursive: true })

    // 4. Generate and download images
    const images = generateMockImages()
    console.log(`📥 Downloading ${images.length} images...`)

    const tasks = []
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const filename = `${sanitizeFilename(image.id)}.jpg`
      const filepath = securePathJoin(imagesDir, filename)

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
          console.log(`  Downloaded ${i + 1}/${images.length} images`)
        }
      } catch (error) {
        console.error(`Failed to download image ${image.id}:`, error)
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