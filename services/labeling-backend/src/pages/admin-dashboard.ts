import express from 'express'
import path from 'path'

const router = express.Router()

// Serve the admin dashboard page
router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Data Labeling Platform</title>
  <script src="https://unpkg.com/htmx.org@2.0.3"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #334155;
    }

    .navbar {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .navbar h1 {
      font-size: 1.5rem;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .navbar .badge {
      background: #3b82f6;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem;
    }

    .controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-secondary {
      background: #64748b;
      color: white;
    }

    .btn-secondary:hover {
      background: #475569;
    }

    .btn-success {
      background: #10b981;
      color: white;
    }

    .btn-success:hover {
      background: #059669;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .card {
      background: white;
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1e293b;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #64748b;
    }

    .stat-change {
      font-size: 0.75rem;
      font-weight: 500;
      margin-top: 0.5rem;
    }

    .stat-change.positive {
      color: #10b981;
    }

    .stat-change.negative {
      color: #ef4444;
    }

    .progress-bar {
      width: 100%;
      height: 0.5rem;
      background: #e2e8f0;
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s ease;
    }

    .workers-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }

    .workers-table th {
      text-align: left;
      padding: 0.75rem;
      background: #f1f5f9;
      font-size: 0.875rem;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }

    .workers-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.875rem;
    }

    .worker-status {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .worker-status.active {
      background: #dcfce7;
      color: #166534;
    }

    .status-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: currentColor;
    }

    .chart-container {
      position: relative;
      height: 300px;
      margin-top: 1rem;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: #64748b;
    }

    .spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 0.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .quality-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .quality-item {
      text-align: center;
      padding: 1rem;
      background: #f8fafc;
      border-radius: 0.5rem;
    }

    .quality-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1e293b;
    }

    .quality-label {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <h1>
      <i data-lucide="bar-chart-3"></i>
      Admin Dashboard
      <span class="badge">LIVE</span>
    </h1>
    <div>
      <span id="lastUpdate" class="stat-label">Last updated: --</span>
    </div>
  </nav>

  <div class="container">
    <div class="controls">
      <button class="btn btn-primary" onclick="createTestProject()">
        <i data-lucide="plus"></i>
        Create Test Project
      </button>
      <button class="btn btn-secondary" onclick="simulateWorkers()">
        <i data-lucide="users"></i>
        Simulate Workers
      </button>
      <button class="btn btn-success" onclick="refreshData()">
        <i data-lucide="refresh-cw"></i>
        Refresh
      </button>
    </div>

    <div id="loading" class="loading">
      <div class="spinner"></div>
      Loading dashboard...
    </div>

    <div id="dashboard" style="display: none;">
      <!-- Metrics Grid -->
      <div class="grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Total Tasks</h3>
            <i data-lucide="clipboard-list"></i>
          </div>
          <div id="totalTasks" class="stat-value">--</div>
          <div class="stat-label">Tasks in project</div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Completed</h3>
            <i data-lucide="check-circle"></i>
          </div>
          <div id="completedTasks" class="stat-value">--</div>
          <div class="stat-label">Tasks completed</div>
          <div class="progress-bar">
            <div id="completedProgress" class="progress-fill"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Active Workers</h3>
            <i data-lucide="users"></i>
          </div>
          <div id="activeWorkers" class="stat-value">--</div>
          <div class="stat-label">Workers online</div>
          <div id="workersChange" class="stat-change positive">+0 from last hour</div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Tasks/Minute</h3>
            <i data-lucide="trending-up"></i>
          </div>
          <div id="tasksPerMinute" class="stat-value">--</div>
          <div class="stat-label">Average last 5 min</div>
          <div id="tpmChange" class="stat-change positive">+0% from yesterday</div>
        </div>
      </div>

      <!-- Quality and Earnings -->
      <div class="grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Quality Metrics</h3>
            <i data-lucide="award"></i>
          </div>
          <div id="qualityMetrics" class="quality-metrics">
            <div class="quality-item">
              <div id="consensusRate" class="quality-value">--%</div>
              <div class="quality-label">Consensus Rate</div>
            </div>
            <div class="quality-item">
              <div id="accuracy" class="quality-value">--%</div>
              <div class="quality-label">Avg Accuracy</div>
            </div>
            <div class="quality-item">
              <div id="perfectConsensus" class="quality-value">--</div>
              <div class="quality-label">Perfect Consensus</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Earnings Overview</h3>
            <i data-lucide="dollar-sign"></i>
          </div>
          <div class="quality-metrics">
            <div class="quality-item">
              <div id="totalSpent" class="quality-value">$--</div>
              <div class="quality-label">Total Spent</div>
            </div>
            <div class="quality-item">
              <div id="workerEarnings" class="quality-value">$--</div>
              <div class="quality-label">Worker Earnings</div>
            </div>
            <div class="quality-item">
              <div id="platformRevenue" class="quality-value">$--</div>
              <div class="quality-label">Platform Revenue</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress Chart -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Real-time Progress</h3>
          <i data-lucide="activity"></i>
        </div>
        <div class="chart-container">
          <canvas id="progressChart"></canvas>
        </div>
      </div>

      <!-- Active Workers Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Active Workers</h3>
          <i data-lucide="users"></i>
        </div>
        <div id="workersTableContainer">
          <table class="workers-table">
            <thead>
              <tr>
                <th>Worker ID</th>
                <th>Username</th>
                <th>Tasks Completed</th>
                <th>Accuracy</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody id="workersTableBody">
              <tr>
                <td colspan="6" style="text-align: center; color: #64748b;">
                  No active workers
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    let projectId = null
    let progressChart = null
    let eventSource = null

    // Initialize Lucide icons
    lucide.createIcons()

    // Create test project
    async function createTestProject() {
      try {
        const response = await fetch('/api/test-project/create', {
          method: 'POST'
        })
        const data = await response.json()

        if (data.success) {
          projectId = data.data.projectId
          alert('Test project created! Project ID: ' + projectId)
          refreshData()
          startRealTimeUpdates()
        } else {
          alert('Failed to create test project')
        }
      } catch (error) {
        console.error('Error creating test project:', error)
        alert('Error creating test project')
      }
    }

    // Simulate worker activity
    async function simulateWorkers() {
      if (!projectId) {
        alert('Please create a test project first')
        return
      }

      try {
        const response = await fetch(\`/api/test-project/\${projectId}/simulate\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            workerCount: 10,
            taskRate: 2
          })
        })
        const data = await response.json()

        if (data.success) {
          alert(\`Simulated \${data.data.simulatedWorkers} workers completing \${data.data.tasksSimulated} tasks\`)
          refreshData()
        } else {
          alert('Failed to simulate workers')
        }
      } catch (error) {
        console.error('Error simulating workers:', error)
        alert('Error simulating workers')
      }
    }

    // Refresh dashboard data
    async function refreshData() {
      if (!projectId) {
        document.getElementById('loading').style.display = 'none'
        document.getElementById('dashboard').style.display = 'block'
        return
      }

      try {
        const response = await fetch(\`/api/test-project/\${projectId}/progress\`)
        const data = await response.json()

        if (data.success) {
          updateDashboard(data.data)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    // Update dashboard with data
    function updateDashboard(data) {
      document.getElementById('loading').style.display = 'none'
      document.getElementById('dashboard').style.display = 'block'

      // Update metrics
      const metrics = data.metrics
      document.getElementById('totalTasks').textContent = metrics.totalTasks
      document.getElementById('completedTasks').textContent = metrics.completedTasks
      document.getElementById('activeWorkers').textContent = data.activeWorkers.length
      document.getElementById('tasksPerMinute').textContent = data.tasksPerMinute

      // Update progress bar
      const completedPercent = metrics.totalTasks > 0
        ? (metrics.completedTasks / metrics.totalTasks) * 100
        : 0
      document.getElementById('completedProgress').style.width = completedPercent + '%'

      // Update quality metrics
      document.getElementById('consensusRate').textContent = data.qualityMetrics.consensusRate + '%'
      document.getElementById('accuracy').textContent = Math.round(data.qualityMetrics.averageAccuracy) + '%'
      document.getElementById('perfectConsensus').textContent = data.qualityMetrics.perfectConsensus

      // Update earnings
      document.getElementById('totalSpent').textContent = '$' + data.earningsOverview.totalSpent.toFixed(2)
      document.getElementById('workerEarnings').textContent = '$' + data.earningsOverview.totalWorkerEarnings.toFixed(2)
      document.getElementById('platformRevenue').textContent = '$' + data.earningsOverview.platformRevenue.toFixed(2)

      // Update workers table
      updateWorkersTable(data.activeWorkers)

      // Update chart
      updateChart(metrics)

      // Update last update time
      document.getElementById('lastUpdate').textContent =
        'Last updated: ' + new Date(data.lastUpdated).toLocaleTimeString()

      // Re-create icons
      lucide.createIcons()
    }

    // Update workers table
    function updateWorkersTable(workers) {
      const tbody = document.getElementById('workersTableBody')

      if (workers.length === 0) {
        tbody.innerHTML = \`
          <tr>
            <td colspan="6" style="text-align: center; color: #64748b;">
              No active workers
            </td>
          </tr>
        \`
        return
      }

      tbody.innerHTML = workers.map(worker => \`
        <tr>
          <td>\${worker.id}</td>
          <td>\${worker.username}</td>
          <td>\${worker.tasksCompleted}</td>
          <td>\${Math.round(worker.accuracy * 100)}%</td>
          <td>
            <span class="worker-status active">
              <span class="status-dot"></span>
              Active
            </span>
          </td>
          <td>\${new Date(worker.lastSeen).toLocaleTimeString()}</td>
        </tr>
      \`).join('')
    }

    // Initialize and update chart
    function updateChart(metrics) {
      const ctx = document.getElementById('progressChart').getContext('2d')

      if (!progressChart) {
        progressChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: [],
            datasets: [{
              label: 'Completed Tasks',
              data: [],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }, {
              label: 'Pending Tasks',
              data: [],
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true
              }
            },
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        })
      }

      // Add new data point
      const now = new Date().toLocaleTimeString()
      progressChart.data.labels.push(now)
      progressChart.data.datasets[0].data.push(metrics.completedTasks)
      progressChart.data.datasets[1].data.push(metrics.pendingTasks)

      // Keep only last 20 data points
      if (progressChart.data.labels.length > 20) {
        progressChart.data.labels.shift()
        progressChart.data.datasets[0].data.shift()
        progressChart.data.datasets[1].data.shift()
      }

      progressChart.update()
    }

    // Start real-time updates
    function startRealTimeUpdates() {
      if (!projectId || eventSource) return

      eventSource = new EventSource(\`/api/test-project/\${projectId}/updates\`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        // Update metrics in real-time
        document.getElementById('completedTasks').textContent = data.metrics.completedTasks
        document.getElementById('pendingTasks').textContent = data.metrics.pendingTasks
        document.getElementById('activeWorkers').textContent = data.activeWorkersCount

        // Update progress bar
        const totalTasks = parseInt(document.getElementById('totalTasks').textContent)
        const completedPercent = totalTasks > 0
          ? (data.metrics.completedTasks / totalTasks) * 100
          : 0
        document.getElementById('completedProgress').style.width = completedPercent + '%'

        document.getElementById('lastUpdate').textContent =
          'Last updated: ' + new Date(data.timestamp).toLocaleTimeString()
      }

      eventSource.onerror = () => {
        console.error('EventSource failed')
        eventSource.close()
        eventSource = null
      }
    }

    // Initialize dashboard on load
    refreshData()
  </script>
</body>
</html>
  `)
})

export default router