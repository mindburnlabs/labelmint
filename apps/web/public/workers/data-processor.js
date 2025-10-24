/**
 * Data Processing Web Worker for LabelMint PWA
 * Handles bulk data operations, analytics calculations, and data synchronization
 */

self.onmessage = async function(e) {
  const { type, data, options, id } = e.data;

  try {
    switch (type) {
      case 'PROCESS_LABEL_DATA':
        await processLabelData(data, options, id);
        break;
      case 'CALCULATE_ANALYTICS':
        await calculateAnalytics(data, options, id);
        break;
      case 'SYNC_DATA':
        await syncData(data, options, id);
        break;
      case 'AGGREGATE_RESULTS':
        await aggregateResults(data, options, id);
        break;
      case 'EXPORT_DATA':
        await exportData(data, options, id);
        break;
      case 'VALIDATE_LABELS':
        await validateLabels(data, options, id);
        break;
      case 'CALCULATE_QUALITY_METRICS':
        await calculateQualityMetrics(data, options, id);
        break;
      case 'PROCESS_QUEUE':
        await processOfflineQueue(data, id);
        break;
      default:
        throw new Error(`Unknown worker task type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: error.message
    });
  }
};

/**
 * Process labeling data
 */
async function processLabelData(data, options, id) {
  const results = {
    total: data.length,
    processed: 0,
    errors: [],
    statistics: {}
  };

  for (let i = 0; i < data.length; i++) {
    try {
      const item = data[i];
      const processed = await processLabelItem(item, options);

      // Update statistics
      if (!results.statistics[item.type]) {
        results.statistics[item.type] = 0;
      }
      results.statistics[item.type]++;

      results.processed++;

      // Report progress
      if (i % 100 === 0) {
        self.postMessage({
          type: 'PROGRESS',
          id,
          progress: Math.round((i / data.length) * 100)
        });
      }
    } catch (error) {
      results.errors.push({
        index: i,
        error: error.message
      });
    }
  }

  self.postMessage({
    type: 'LABEL_DATA_PROCESSED',
    id,
    results
  });
}

/**
 * Process individual label item
 */
async function processLabelItem(item, options) {
  const processed = {
    ...item,
    processedAt: Date.now(),
    confidence: 0
  };

  // Apply validation rules
  if (options.validation) {
    processed.validation = await validateItem(item, options.validation);
  }

  // Apply transformations
  if (options.transformations) {
    for (const transform of options.transformations) {
      processed = await applyTransformation(processed, transform);
    }
  }

  // Calculate confidence score
  if (options.calculateConfidence) {
    processed.confidence = calculateConfidence(processed);
  }

  return processed;
}

/**
 * Calculate analytics
 */
async function calculateAnalytics(data, options, id) {
  const analytics = {
    summary: {},
    trends: {},
    performance: {},
    quality: {}
  };

  // Calculate summary statistics
  analytics.summary = calculateSummaryStats(data);

  // Calculate trends
  if (options.includeTrends) {
    analytics.trends = calculateTrends(data, options.timeRange);
  }

  // Calculate performance metrics
  if (options.includePerformance) {
    analytics.performance = calculatePerformanceMetrics(data);
  }

  // Calculate quality metrics
  if (options.includeQuality) {
    analytics.quality = calculateQualityScore(data);
  }

  self.postMessage({
    type: 'ANALYTICS_CALCULATED',
    id,
    analytics
  });
}

/**
 * Calculate summary statistics
 */
function calculateSummaryStats(data) {
  const stats = {
    totalItems: data.length,
    completedItems: 0,
    pendingItems: 0,
    averageTime: 0,
    totalReward: 0,
    accuracy: 0
  };

  let totalTime = 0;
  let correctLabels = 0;

  data.forEach(item => {
    if (item.status === 'completed') {
      stats.completedItems++;
      totalTime += item.timeSpent || 0;
      stats.totalReward += item.reward || 0;

      if (item.correct) correctLabels++;
    } else {
      stats.pendingItems++;
    }
  });

  stats.averageTime = stats.completedItems > 0 ? totalTime / stats.completedItems : 0;
  stats.accuracy = stats.completedItems > 0 ? (correctLabels / stats.completedItems) * 100 : 0;

  return stats;
}

/**
 * Calculate trends
 */
function calculateTrends(data, timeRange) {
  const now = Date.now();
  const ranges = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000
  };

  const trends = {};

  Object.entries(ranges).forEach(([period, ms]) => {
    const periodStart = now - ms;
    const periodData = data.filter(item => item.timestamp > periodStart);

    trends[period] = {
      count: periodData.length,
      growth: calculateGrowth(periodData, ms),
      avgTime: periodData.reduce((sum, item) => sum + (item.timeSpent || 0), 0) / periodData.length || 0
    };
  });

  return trends;
}

/**
 * Calculate growth rate
 */
function calculateGrowth(data, period) {
  const halfPeriod = period / 2;
  const now = Date.now();
  const firstHalf = data.filter(item => item.timestamp > now - period && item.timestamp <= now - halfPeriod);
  const secondHalf = data.filter(item => item.timestamp > now - halfPeriod);

  if (firstHalf.length === 0) return 0;
  return ((secondHalf.length - firstHalf.length) / firstHalf.length) * 100;
}

/**
 * Calculate performance metrics
 */
function calculatePerformanceMetrics(data) {
  const metrics = {
    throughput: 0,
    efficiency: 0,
    errorRate: 0,
    reworkRate: 0
  };

  const completed = data.filter(item => item.status === 'completed');
  const errors = data.filter(item => item.status === 'error');
  const rework = data.filter(item => item.reworkCount > 0);

  metrics.throughput = completed.length;
  metrics.errorRate = (errors.length / data.length) * 100;
  metrics.reworkRate = (rework.length / data.length) * 100;
  metrics.efficiency = 100 - metrics.errorRate - metrics.reworkRate;

  return metrics;
}

/**
 * Calculate quality score
 */
function calculateQualityScore(data) {
  let totalScore = 0;
  let validItems = 0;

  data.forEach(item => {
    if (item.qualityScore) {
      totalScore += item.qualityScore;
      validItems++;
    } else if (item.confidence) {
      totalScore += item.confidence * 100;
      validItems++;
    }
  });

  return {
    averageScore: validItems > 0 ? totalScore / validItems : 0,
    totalItems: data.length,
    ratedItems: validItems
  };
}

/**
 * Sync data with server
 */
async function syncData(data, options, id) {
  const results = {
    success: [],
    failed: [],
    conflicts: []
  };

  for (const item of data) {
    try {
      const response = await fetch(`${options.endpoint}/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.token}`
        },
        body: JSON.stringify(item)
      });

      if (response.ok) {
        results.success.push(item.id);
      } else if (response.status === 409) {
        const serverData = await response.json();
        results.conflicts.push({
          id: item.id,
          local: item,
          server: serverData
        });
      } else {
        results.failed.push({
          id: item.id,
          error: response.statusText
        });
      }
    } catch (error) {
      results.failed.push({
        id: item.id,
        error: error.message
      });
    }
  }

  self.postMessage({
    type: 'DATA_SYNCED',
    id,
    results
  });
}

/**
 * Aggregate multiple labeling results
 */
async function aggregateResults(data, options, id) {
  const aggregation = {
    consensus: {},
    distribution: {},
    outliers: []
  };

  // Group by task ID
  const grouped = data.reduce((acc, item) => {
    if (!acc[item.taskId]) acc[item.taskId] = [];
    acc[item.taskId].push(item);
    return acc;
  }, {});

  // Calculate consensus for each task
  Object.entries(grouped).forEach(([taskId, items]) => {
    if (items.length >= options.minAgreements || 3) {
      aggregation.consensus[taskId] = calculateConsensus(items, options.algorithm);
      aggregation.distribution[taskId] = calculateDistribution(items);

      // Find outliers
      const outliers = findOutliers(items, aggregation.consensus[taskId]);
      if (outliers.length > 0) {
        aggregation.outliers.push(...outliers);
      }
    }
  });

  self.postMessage({
    type: 'RESULTS_AGGREGATED',
    id,
    aggregation
  });
}

/**
 * Calculate consensus
 */
function calculateConsensus(items, algorithm = 'majority') {
  const labels = items.map(item => item.label);
  const counts = {};

  labels.forEach(label => {
    const key = JSON.stringify(label);
    counts[key] = (counts[key] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const majority = JSON.parse(sorted[0][0]);

  return {
    label: majority,
    agreement: (sorted[0][1] / labels.length) * 100,
    total: labels.length,
    votes: counts
  };
}

/**
 * Calculate label distribution
 */
function calculateDistribution(items) {
  const distribution = {};

  items.forEach(item => {
    const key = JSON.stringify(item.label);
    distribution[key] = (distribution[key] || 0) + 1;
  });

  return distribution;
}

/**
 * Find outlier annotations
 */
function findOutliers(items, consensus) {
  const outliers = [];
  const threshold = 0.6; // 60% agreement threshold

  items.forEach(item => {
    const label = JSON.stringify(item.label);
    const agreement = consensus.votes[label] / consensus.total;

    if (agreement < threshold) {
      outliers.push({
        itemId: item.id,
        userId: item.userId,
        label: item.label,
        agreement
      });
    }
  });

  return outliers;
}

/**
 * Export data in various formats
 */
async function exportData(data, options, id) {
  let exportedData;
  let mimeType;
  let filename;

  switch (options.format) {
    case 'csv':
      exportedData = convertToCSV(data);
      mimeType = 'text/csv';
      filename = options.filename || 'export.csv';
      break;

    case 'json':
      exportedData = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      filename = options.filename || 'export.json';
      break;

    case 'xlsx':
      exportedData = await convertToXLSX(data);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = options.filename || 'export.xlsx';
      break;

    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }

  self.postMessage({
    type: 'DATA_EXPORTED',
    id,
    data: exportedData,
    mimeType,
    filename
  });
}

/**
 * Convert data to CSV
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      return typeof value === 'string' && value.includes(',')
        ? `"${value.replace(/"/g, '""')}"`
        : value;
    })
  );

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

/**
 * Convert to XLSX (simplified)
 */
async function convertToXLSX(data) {
  // This would require a library like xlsx
  // For now, return JSON as placeholder
  return JSON.stringify(data);
}

/**
 * Validate labels against schema
 */
async function validateLabels(data, options, id) {
  const validation = {
    valid: [],
    invalid: [],
    statistics: {}
  };

  data.forEach(item => {
    const errors = validateLabel(item, options.schema);

    if (errors.length === 0) {
      validation.valid.push(item.id);
    } else {
      validation.invalid.push({
        id: item.id,
        errors
      });
    }
  });

  validation.statistics = {
    total: data.length,
    valid: validation.valid.length,
    invalid: validation.invalid.length,
    validityRate: (validation.valid.length / data.length) * 100
  };

  self.postMessage({
    type: 'LABELS_VALIDATED',
    id,
    validation
  });
}

/**
 * Validate single label
 */
function validateLabel(item, schema) {
  const errors = [];

  if (!schema) return errors;

  Object.entries(schema).forEach(([field, rules]) => {
    const value = item[field];

    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${field} is required`);
    }

    if (rules.type && value !== undefined && typeof value !== rules.type) {
      errors.push(`${field} must be of type ${rules.type}`);
    }

    if (rules.minLength && value && value.length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters`);
    }

    if (rules.maxLength && value && value.length > rules.maxLength) {
      errors.push(`${field} must be no more than ${rules.maxLength} characters`);
    }

    if (rules.enum && value && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
  });

  return errors;
}

/**
 * Calculate quality metrics
 */
async function calculateQualityMetrics(data, options, id) {
  const metrics = {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    iou: 0 // Intersection over Union for bounding boxes
  };

  // Calculate metrics based on ground truth
  let totalAccuracy = 0;
  let totalPrecision = 0;
  let totalRecall = 0;
  let totalF1 = 0;
  let totalIoU = 0;
  let validCount = 0;

  data.forEach(item => {
    if (item.groundTruth && item.prediction) {
      const itemMetrics = calculateItemMetrics(item.groundTruth, item.prediction);

      totalAccuracy += itemMetrics.accuracy;
      totalPrecision += itemMetrics.precision;
      totalRecall += itemMetrics.recall;
      totalF1 += itemMetrics.f1Score;
      totalIoU += itemMetrics.iou;
      validCount++;
    }
  });

  if (validCount > 0) {
    metrics.accuracy = totalAccuracy / validCount;
    metrics.precision = totalPrecision / validCount;
    metrics.recall = totalRecall / validCount;
    metrics.f1Score = totalF1 / validCount;
    metrics.iou = totalIoU / validCount;
  }

  self.postMessage({
    type: 'QUALITY_METRICS_CALCULATED',
    id,
    metrics
  });
}

/**
 * Calculate metrics for single item
 */
function calculateItemMetrics(groundTruth, prediction) {
  const metrics = {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    iou: 0
  };

  // Simple accuracy calculation
  const matches = JSON.stringify(groundTruth) === JSON.stringify(prediction);
  metrics.accuracy = matches ? 1 : 0;

  // For more complex metrics like IoU for bounding boxes:
  if (groundTruth.bbox && prediction.bbox) {
    metrics.iou = calculateIoU(groundTruth.bbox, prediction.bbox);
  }

  // For classification tasks:
  if (groundTruth.label && prediction.label) {
    const tp = groundTruth.label === prediction.label ? 1 : 0;
    const fp = groundTruth.label !== prediction.label ? 1 : 0;
    const fn = 0; // Would need ground truth set

    metrics.precision = tp / (tp + fp) || 0;
    metrics.recall = tp / (tp + fn) || 0;
    metrics.f1Score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall) || 0;
  }

  return metrics;
}

/**
 * Calculate Intersection over Union for bounding boxes
 */
function calculateIoU(box1, box2) {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;

  return intersection / union || 0;
}

/**
 * Process offline queue
 */
async function processOfflineQueue(queue, id) {
  const results = {
    processed: 0,
    failed: 0,
    errors: []
  };

  for (const action of queue) {
    try {
      const response = await fetch(action.endpoint, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${action.token}`
        },
        body: JSON.stringify(action.data)
      });

      if (response.ok) {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push({
          id: action.id,
          error: response.statusText
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        id: action.id,
        error: error.message
      });
    }
  }

  self.postMessage({
    type: 'QUEUE_PROCESSED',
    id,
    results
  });
}