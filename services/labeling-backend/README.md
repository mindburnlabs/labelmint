# Labeling Platform Backend

Backend API for the Telegram labeling platform with enhanced task distribution and quality control system.

## Features

### Core System
- **Task Distribution**: Intelligent task assignment with reservation system
- **Honeypot System**: Quality control with pre-labeled tasks (every 10th task)
- **Enhanced Consensus**: 2/3 or 3/3 agreement mechanisms
- **Worker Trust Scoring**: Dynamic trust score based on accuracy
- **Telegram Authentication**: Secure authentication via Telegram WebApp
- **PostgreSQL + Redis**: Reliable data storage and caching

### Quality Control Features
- **Consensus System**:
  - Tasks require 3 labels for consensus
  - 2/3 agreement marks task as partially complete
  - All different labels go to 2 more workers (total 5)
  - 3+ matching labels complete the task immediately

- **Accuracy-Based Payments**:
  - >90% accuracy: 20% bonus on all earnings
  - <70% accuracy: Warning issued
  - <50% accuracy: Account blocked
  - Real-time accuracy tracking

- **Worker Management**:
  - Warning system for poor performance
  - Automatic blocking for low accuracy
  - Performance levels (Beginner → Novice → Intermediate → Advanced → Expert)
  - Comprehensive statistics and history tracking

## API Endpoints

### Tasks

#### `GET /api/tasks/next` (Enhanced)
Get the next available task with enhanced quality control information.

**Headers:**
- `X-Telegram-Init-Data`: Telegram WebApp initialization data (required)

**Response:**
```json
{
  "success": true,
  "task": {
    "id": 123,
    "title": "Classify this image",
    "type": "image_classification",
    "data": { "image_url": "..." },
    "options": ["cat", "dog", "bird"],
    "points": 1,
    "consensus_info": {
      "level": "pending",
      "totalResponses": 0,
      "uniqueLabels": 0
    },
    "reserved_until": "2024-01-01T12:00:30.000Z"
  },
  "worker_info": {
    "accuracy": 92.5,
    "trustScore": 0.98,
    "warnings": 0,
    "bonusEligible": true
  }
}
```

#### `POST /api/tasks/:id/label` (Enhanced)
Submit a label with enhanced consensus and accuracy tracking.

**Headers:**
- `X-Telegram-Init-Data`: Telegram WebApp initialization data (required)

**Body:**
```json
{
  "answer": "cat",
  "time_spent": 15
}
```

**Response:**
```json
{
  "success": true,
  "isHoneypot": false,
  "isCorrect": null,
  "basePoints": 1,
  "bonusMultiplier": 1.2,
  "finalPoints": 1,
  "accuracyAtTime": 92.5,
  "newBalance": 6.70,
  "message": "Label submitted! You earned 1 points (includes 20% accuracy bonus).",
  "consensusStatus": {
    "totalResponses": 2,
    "consensusLevel": "partial",
    "needsMoreLabels": true
  },
  "workerStatus": "OK",
  "stats": {
    "accuracy": 92.5,
    "tasksCompleted": 43,
    "totalEarned": 6.70,
    "bonusEarned": 0.20,
    "level": "Advanced"
  }
}
```

#### `POST /api/tasks/:id/skip` (Enhanced)
Skip a task with rate limiting (5 skips per hour).

### Worker Statistics

#### `GET /api/worker/stats`
Get comprehensive worker statistics and performance metrics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "worker_id": 123,
    "total_labels": 150,
    "correct_labels": 138,
    "accuracy_rate": 92.0,
    "trust_score": 0.98,
    "tasks_completed": 147,
    "total_earned": 15.50,
    "bonus_earned": 2.60,
    "current_balance": 12.30,
    "warning_count": 0,
    "is_blocked": false,
    "rank": 15,
    "level": "Advanced",
    "recentActivity": [...],
    "accuracyHistory": [...],
    "warnings": [],
    "performance": {
      "level": "Advanced",
      "rank": 15,
      "bonusEligible": true,
      "needsImprovement": false,
      "atRisk": false
    }
  }
}
```

#### `GET /api/worker/history`
Get paginated task submission history.

**Query Parameters:**
- `limit`: Number of items to return (default: 20)
- `offset`: Number of items to skip (default: 0)

#### `GET /api/worker/leaderboard`
Get top workers leaderboard.

**Query Parameters:**
- `limit`: Number of workers to return (default: 10)
- `period`: Time period - 'all', 'week', 'month' (default: 'all')

## Task Distribution Logic

1. **Reservation System**: Tasks are reserved for 30 seconds when assigned
2. **Honeypot Tasks**: Every 10th task is a pre-labeled quality check
3. **Consensus**: Tasks complete after 3 workers submit the same label
4. **Trust Scoring**:
   - Starts at 1.0
   - Decreases by 0.1 for each failed honeypot
   - Workers with trust score < 0.3 are blocked

## Database Schema

### Key Tables

**tasks**
- `reserved_by`: Worker ID who has reserved the task
- `reserved_at`: Reservation timestamp
- `is_honeypot`: Quality control flag
- `consensus_label`: Final agreed label
- `consensus_count`: Number of matching labels
- `completion_status`: pending/in_progress/completed/review

**users**
- `trust_score`: Worker reliability score (0-1)
- `tasks_completed`: Total tasks completed
- `honeypot_failed`: Number of failed honeypots
- `total_earned`: Total earnings

**task_seen**
- Tracks which workers have seen which tasks
- Prevents duplicate assignments

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Running

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Test endpoints
npm test
```

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL config
- `REDIS_HOST`, `REDIS_PORT`: Redis config
- `ALLOWED_ORIGINS`: CORS allowed origins

## Testing

The test scripts will verify:
- Health check endpoint
- Authentication requirements
- Task retrieval (requires valid Telegram auth)
- Label submission
- Enhanced quality control features

Run tests:
```bash
# Basic endpoint tests
npm test

# Enhanced features tests
npm run test:enhanced

# Run all tests
npm run test:all
```

Note: Full testing requires a valid Telegram bot token and running PostgreSQL/Redis instances.

## Quality Control Logic

### Consensus System
1. **Initial Phase**: Tasks sent to 3 workers
2. **2/3 Agreement**: Task marked as partially complete, stays in queue
3. **All Different**: Task sent to 2 more workers (total 5)
4. **Final Decision**: Majority label wins, task completed

### Accuracy Tracking
- Real-time accuracy calculation based on honeypot performance
- Bonus multipliers applied automatically
- Warnings issued at 70% threshold
- Automatic blocking at 50% threshold

### Performance Levels
- **Beginner**: 0-9 tasks completed
- **Novice**: 10-19 tasks with 80%+ accuracy
- **Intermediate**: 20-49 tasks with 85%+ accuracy
- **Advanced**: 50-99 tasks with 90%+ accuracy
- **Expert**: 100+ tasks with 95%+ accuracy

## Security

- All endpoints require Telegram WebApp authentication
- HMAC hash validation for Telegram data
- 24-hour authentication token expiration
- SQL injection protection via parameterized queries
- Rate limiting recommended for production