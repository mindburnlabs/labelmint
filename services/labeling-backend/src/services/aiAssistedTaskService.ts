import { query } from '../database/connection';
import ClaudeService from './claudeService';
import { ClaudeClassificationRequest, ClaudeValidationRequest, ClaudeExampleGenerationRequest } from '../config/claude';

const claudeService = new ClaudeService();

export interface AITask {
  id: number;
  title: string;
  type: string;
  data: any;
  options?: string[];
  aiPrelabel?: string;
  aiConfidence?: number;
  consensusTarget: number; // 2 or 3 based on AI confidence
  usesAIAssistance: boolean;
}

export interface LabelValidation {
  isValid: boolean;
  confidence: number;
  suspicious: boolean;
  issues: string[];
  suggestedLabel?: string;
  aiScore: number;
}

export interface AIAssistedConsensus {
  totalResponses: number;
  targetResponses: number;
  consensusLevel: string;
  aiAgreement: number; // How many workers agree with AI
  finalLabel?: string;
  needsMoreWorkers: boolean;
}

export async function prelabelTaskWithAI(taskId: number): Promise<{
  success: boolean;
  prelabel?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
}> {
  try {
    // Get task details
    const taskResult = await query(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return { success: false, error: 'Task not found' };
    }

    const task = taskResult.rows[0];

    // Skip if already prelabeled
    if (task.ai_prelabel) {
      return {
        success: true,
        prelabel: task.ai_prelabel,
        confidence: task.ai_confidence
      };
    }

    // Only process text-based tasks for now
    if (!task.type.includes('text') && !task.type.includes('sentiment') && !task.type.includes('moderation')) {
      return { success: false, error: 'Task type not supported for AI prelabeling' };
    }

    // Prepare classification request
    const classificationRequest: ClaudeClassificationRequest = {
      text: task.data?.text || task.data?.content || JSON.stringify(task.data),
      categories: task.options || [],
      instructions: task.description || task.title
    };

    // Get AI prediction
    const aiResponse = await claudeService.classifyText(classificationRequest);

    if (!aiResponse.success) {
      return { success: false, error: aiResponse.error };
    }

    // Save AI prelabel
    await query(`
      UPDATE tasks
      SET ai_prelabel = $1,
          ai_confidence = $2,
          ai_model_version = 'claude-3-haiku',
          uses_ai_assistance = true,
          consensus_target = CASE
            WHEN $2 > 0.9 THEN 2
            WHEN $2 > 0.7 THEN 2
            ELSE 3
          END
      WHERE id = $3
    `, [aiResponse.prediction, aiResponse.confidence, taskId]);

    // Log AI prelabel
    await query(`
      INSERT INTO ai_prelabels (task_id, ai_model, prediction, confidence, reasoning)
      VALUES ($1, 'claude-3-haiku', $2, $3, $4)
    `, [taskId, aiResponse.prediction, aiResponse.confidence, aiResponse.reasoning]);

    return {
      success: true,
      prelabel: aiResponse.prediction,
      confidence: aiResponse.confidence,
      reasoning: aiResponse.reasoning
    };

  } catch (error: any) {
    console.error('Error prelabeling task:', error);
    return { success: false, error: error.message };
  }
}

export async function validateLabelWithAI(
  responseId: number,
  taskId: number,
  workerLabel: string
): Promise<LabelValidation> {
  try {
    // Get task details and other responses
    const [taskResult, responsesResult] = await Promise.all([
      query('SELECT * FROM tasks WHERE id = $1', [taskId]),
      query(`
        SELECT answer, user_id
        FROM responses
        WHERE task_id = $1 AND id != $2
        ORDER BY created_at DESC
        LIMIT 2
      `, [taskId, responseId])
    ]);

    const task = taskResult.rows[0];
    const otherLabels = responsesResult.rows.map(r => r.answer);

    // Prepare validation request
    const validationRequest: ClaudeValidationRequest = {
      taskData: {
        title: task.title,
        type: task.type,
        data: task.data,
        options: task.options
      },
      workerLabel,
      otherLabels,
      taskType: task.type,
      categories: task.options
    };

    // Get AI validation
    const aiResponse = await claudeService.validateLabel(validationRequest);

    if (!aiResponse.success) {
      // Fallback validation
      return {
        isValid: true,
        confidence: 0.5,
        suspicious: false,
        issues: [],
        aiScore: 0.5
      };
    }

    const validation = aiResponse.validation!;

    // Update response with AI validation
    await query(`
      UPDATE responses
      SET ai_validated = true,
          ai_validation_score = $1,
          ai_validation_issues = $2,
          ai_flagged_as_suspicious = $3,
          ai_validation_at = NOW()
      WHERE id = $4
    `, [
      validation.confidence,
      validation.issues || [],
      validation.suspicious || false,
      responseId
    ]);

    // If suspicious, update worker behavior analysis
    if (validation.suspicious) {
      await updateWorkerBehaviorAnalysis(taskResult.rows[0].user_id, true);
    }

    return {
      isValid: validation.isValid,
      confidence: validation.confidence,
      suspicious: validation.suspicious || false,
      issues: validation.issues || [],
      suggestedLabel: validation.suggestedLabel,
      aiScore: validation.confidence
    };

  } catch (error: any) {
    console.error('Error validating label:', error);
    return {
      isValid: true,
      confidence: 0.5,
      suspicious: false,
      issues: [],
      aiScore: 0.5
    };
  }
}

export async function getAIAssistedConsensus(taskId: number): Promise<AIAssistedConsensus> {
  try {
    const result = await query(`
      SELECT
        t.*,
        COUNT(r.id) as response_count,
        COUNT(CASE WHEN r.answer = t.ai_prelabel THEN 1 END) as ai_agreement_count,
        COUNT(CASE WHEN r.answer = t.consensus_label THEN 1 END) as consensus_count
      FROM tasks t
      LEFT JOIN responses r ON r.task_id = t.id
      WHERE t.id = $1
      GROUP BY t.id
    `, [taskId]);

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    const task = result.rows[0];

    // Calculate consensus status
    const totalResponses = task.response_count || 0;
    const targetResponses = task.consensus_target || 3;
    const aiAgreement = task.ai_agreement_count || 0;
    const needsMoreWorkers = totalResponses < targetResponses;

    // Determine consensus level
    let consensusLevel = 'pending';
    if (task.consensus_level) {
      consensusLevel = task.consensus_level;
    } else if (totalResponses >= targetResponses) {
      consensusLevel = 'review';
    }

    return {
      totalResponses,
      targetResponses,
      consensusLevel,
      aiAgreement,
      finalLabel: task.final_label,
      needsMoreWorkers
    };

  } catch (error: any) {
    console.error('Error getting AI consensus:', error);
    throw error;
  }
}

export async function generateTaskExamples(
  taskType: string,
  categories: string[],
  instructions: string,
  count: number = 3
): Promise<{
  success: boolean;
  examples?: any[];
  error?: string;
}> {
  try {
    // Check if examples already exist
    const existingResult = await query(`
      SELECT * FROM task_examples
      WHERE task_type = $1 AND approved = true
      LIMIT 10
    `, [taskType]);

    if (existingResult.rows.length >= categories.length * count) {
      return {
        success: true,
        examples: existingResult.rows
      };
    }

    // Generate new examples
    const generationRequest: ClaudeExampleGenerationRequest = {
      taskType,
      categories,
      instructions,
      count
    };

    const aiResponse = await claudeService.generateExamples(generationRequest);

    if (!aiResponse.success || !aiResponse.examples) {
      return { success: false, error: aiResponse.error };
    }

    // Save examples to database
    for (const categoryGroup of aiResponse.examples) {
      for (const example of categoryGroup.items || []) {
        await query(`
          INSERT INTO task_examples (task_type, category, example_input, example_output, explanation, ai_generated, ai_model)
          VALUES ($1, $2, $3, $4, $5, true, 'claude-3-haiku')
        `, [
          taskType,
          categoryGroup.category,
          example.input,
          example.output,
          example.explanation
        ]);
      }
    }

    return {
      success: true,
      examples: aiResponse.examples
    };

  } catch (error: any) {
    console.error('Error generating examples:', error);
    return { success: false, error: error.message };
  }
}

export async function batchPrelabelTasks(taskIds: number[]): Promise<{
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const taskId of taskIds) {
    results.processed++;
    const result = await prelabelTaskWithAI(taskId);

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push(`Task ${taskId}: ${result.error}`);
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

export async function updateWorkerBehaviorAnalysis(
  workerId: number,
  flaggedAsSuspicious: boolean = false
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get recent worker activity
    const recentActivity = await query(`
      SELECT
        r.id,
        r.task_id,
        r.answer as label,
        r.time_spent,
        r.created_at as timestamp
      FROM responses r
      WHERE r.user_id = $1
        AND r.created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [workerId]);

    if (recentActivity.rows.length < 5) {
      return; // Not enough data
    }

    // Detect patterns using Claude
    const patternResult = await claudeService.detectSuspiciousPattern(
      workerId,
      recentActivity.rows.map(r => ({
        taskId: r.task_id,
        label: r.label,
        timeSpent: r.time_spent || 0,
        timestamp: r.timestamp
      }))
    );

    // Update or insert behavior analysis
    await query(`
      INSERT INTO worker_behavior_analysis (
        worker_id, analysis_date, total_submissions, avg_time_per_task,
        unique_labels_used, pattern_detected, suspicious_score, auto_flagged
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      ON CONFLICT (worker_id, analysis_date)
      UPDATE SET
        total_submissions = EXCLUDED.total_submissions,
        avg_time_per_task = EXCLUDED.avg_time_per_task,
        unique_labels_used = EXCLUDED.unique_labels_used,
        pattern_detected = EXCLUDED.pattern_detected,
        suspicious_score = EXCLUDED.suspicious_score,
        auto_flagged = EXCLUDED.auto_flagged,
        updated_at = NOW()
    `, [
      workerId,
      today,
      recentActivity.rows.length,
      recentActivity.rows.reduce((sum, r) => sum + (r.time_spent || 0), 0) / recentActivity.rows.length,
      new Set(recentActivity.rows.map(r => r.label)).size,
      patternResult.patternType,
      patternResult.confidence,
      patternResult.isSuspicious || flaggedAsSuspicious
    ]);

  } catch (error) {
    console.error('Error updating worker behavior analysis:', error);
  }
}

export async function getWorkerSuspicionScore(workerId: number): Promise<{
  score: number;
  level: 'low' | 'medium' | 'high';
  reasons: string[];
  recentFlags: number;
}> {
  try {
    const result = await query(`
      SELECT
        COALESCE(wba.suspicious_score, 0) as behavior_score,
        COALESCE(
          COUNT(CASE WHEN r.ai_flagged_as_suspicious = true THEN 1 END)::DECIMAL / NULLIF(COUNT(r.id), 0),
          0
        ) as flagged_ratio,
        COUNT(CASE WHEN r.ai_flagged_as_suspicious = true THEN 1 END) as recent_flags
      FROM users u
      LEFT JOIN worker_behavior_analysis wba ON wba.worker_id = u.id
        AND wba.analysis_date >= CURRENT_DATE - INTERVAL '7 days'
      LEFT JOIN responses r ON r.user_id = u.id
        AND r.created_at >= CURRENT_DATE - INTERVAL '7 days'
      WHERE u.id = $1
      GROUP BY u.id, wba.suspicious_score
    `, [workerId]);

    if (result.rows.length === 0) {
      return { score: 0, level: 'low', reasons: [], recentFlags: 0 };
    }

    const data = result.rows[0];
    const score = Math.max(data.behavior_score, data.flagged_ratio);
    const reasons: string[] = [];

    if (data.behavior_score > 0.6) reasons.push('Suspicious behavior pattern detected');
    if (data.flagged_ratio > 0.1) reasons.push('High rate of flagged submissions');
    if (data.recent_flags > 5) reasons.push('Multiple suspicious submissions');

    let level: 'low' | 'medium' | 'high' = 'low';
    if (score > 0.7) level = 'high';
    else if (score > 0.4) level = 'medium';

    return {
      score,
      level,
      reasons,
      recentFlags: data.recent_flags || 0
    };

  } catch (error) {
    console.error('Error getting worker suspicion score:', error);
    return { score: 0, level: 'low', reasons: [], recentFlags: 0 };
  }
}

export async function getAIAssistedNextTask(workerId: number): Promise<AITask | null> {
  try {
    // Prioritize AI-assisted tasks
    const result = await query(`
      SELECT t.*
      FROM tasks t
      WHERE t.completion_status = 'pending'
        AND t.reserved_by IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM task_seen ts WHERE ts.task_id = t.id AND ts.worker_id = $1
        )
        AND (t.uses_ai_assistance = true OR t.ai_prelabel IS NOT NULL)
      ORDER BY
        CASE
          WHEN t.ai_confidence > 0.9 THEN 0
          WHEN t.ai_confidence > 0.7 THEN 1
          ELSE 2
        END,
        t.total_responses ASC,
        RANDOM()
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [workerId]);

    if (result.rows.length === 0) {
      return null;
    }

    const task = result.rows[0];

    return {
      id: task.id,
      title: task.title,
      type: task.type,
      data: task.data,
      options: task.options,
      aiPrelabel: task.ai_prelabel,
      aiConfidence: task.ai_confidence,
      consensusTarget: task.consensus_target || 3,
      usesAIAssistance: task.uses_ai_assistance
    };

  } catch (error) {
    console.error('Error getting AI-assisted task:', error);
    return null;
  }
}