import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskService } from '@labeling/services/TaskService';
import { TaskStateMachine } from '@shared/consensus/TaskStateMachine';
import { ConsensusService } from '@shared/consensus/ConsensusService';
import { TaskEventBus } from '@shared/consensus/TaskEventBus';
import { initializeTestDatabase, cleanDatabase, closeTestDatabase } from '@test/utils/database';
import { UserFactory } from '@test/factories/UserFactory';
import { TaskFactory } from '@test/factories/TaskFactory';
import { LabelFactory } from '@test/factories/LabelFactory';
import { createMockAIService } from '@test/utils/mocks';
import type { User, Task, Label } from '@shared/types/database';

describe('TaskService', () => {
  let taskService: TaskService;
  let eventBus: TaskEventBus;
  let consensusService: ConsensusService;
  let testUsers: User[];
  let testTasks: Task[];

  beforeAll(async () => {
    await initializeTestDatabase();
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();

    eventBus = new TaskEventBus();
    consensusService = new ConsensusService(eventBus);
    taskService = new TaskService(consensusService, eventBus, {
      aiService: createMockAIService(),
    });

    // Create test users
    testUsers = [
      UserFactory.createWorker({ reputation: 90 }),
      UserFactory.createWorker({ reputation: 70 }),
      UserFactory.createWorker({ reputation: 50 }),
      UserFactory.createRequester(),
    ];

    // Create test tasks
    testTasks = [
      TaskFactory.createPending({ type: 'image_classification' }),
      TaskFactory.createPending({ type: 'text_labeling' }),
      TaskFactory.createAssigned({
        assignedTo: testUsers[0].id,
        status: 'in_progress',
      }),
    ];
  });

  describe('Task Assignment', () => {
    it('should assign task to qualified worker', async () => {
      const worker = testUsers[0];
      const task = testTasks[0];

      const assignedTask = await taskService.assignTask(task.id, worker.id);

      expect(assignedTask).toBeDefined();
      expect(assignedTask.assignedTo).toBe(worker.id);
      expect(assignedTask.status).toBe('assigned');
      expect(assignedTask.assignedAt).toBeInstanceOf(Date);
    });

    it('should not assign task to worker with low reputation', async () => {
      const worker = testUsers[2]; // Low reputation worker
      const task = testTasks[0];

      await expect(taskService.assignTask(task.id, worker.id))
        .rejects.toThrow('Worker reputation too low');
    });

    it('should not assign already assigned task', async () => {
      const task = testTasks[2]; // Already assigned task
      const worker = testUsers[1];

      await expect(taskService.assignTask(task.id, worker.id))
        .rejects.toThrow('Task already assigned');
    });

    it('should auto-assign best matching worker', async () => {
      const task = testTasks[0];

      const assignedTask = await taskService.autoAssignTask(task.id);

      expect(assignedTask.assignedTo).toBe(testUsers[0].id); // Highest reputation
      expect(assignedTask.status).toBe('assigned');
    });
  });

  describe('Task Submission', () => {
    let worker: User;
    let task: Task;

    beforeEach(async () => {
      worker = testUsers[0];
      task = testTasks[0];
      await taskService.assignTask(task.id, worker.id);
    });

    it('should accept valid label submission', async () => {
      const submission = {
        taskId: task.id,
        userId: worker.id,
        value: 'cat',
        confidence: 0.95,
        timeSpent: 120,
      };

      const result = await taskService.submitLabel(submission);

      expect(result.reached).toBe(false); // Need 3 labels for consensus
      expect(result.totalLabels).toBe(1);
      expect(result.confidence).toBe(1);
    });

    it('should reject duplicate submission from same user', async () => {
      const submission = {
        taskId: task.id,
        userId: worker.id,
        value: 'cat',
        confidence: 0.95,
      };

      await taskService.submitLabel(submission);

      await expect(taskService.submitLabel(submission))
        .rejects.toThrow('User already submitted label');
    });

    it('should reject submission with invalid confidence', async () => {
      const submission = {
        taskId: task.id,
        userId: worker.id,
        value: 'cat',
        confidence: 1.5, // Invalid > 1
      };

      await expect(taskService.submitLabel(submission))
        .rejects.toThrow('Confidence must be between 0 and 1');
    });

    it('should complete task when consensus is reached', async () => {
      const workers = testUsers.slice(0, 3);
      const label = 'cat';

      // Submit 3 identical labels
      for (const worker of workers) {
        await taskService.assignTask(task.id, worker.id);
        await taskService.submitLabel({
          taskId: task.id,
          userId: worker.id,
          value: label,
          confidence: 0.9,
        });
      }

      // Check task is completed
      const updatedTask = await taskService.getTask(task.id);
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.finalLabel).toBe(label);
      expect(updatedTask.confidence).toBe(1);
    });
  });

  describe('Consensus Calculation', () => {
    it('should calculate consensus correctly with majority agreement', async () => {
      const workers = testUsers.slice(0, 3);
      const task = testTasks[0];

      // Submit 2 labels for 'cat', 1 for 'dog'
      await taskService.assignTask(task.id, workers[0].id);
      await taskService.submitLabel({
        taskId: task.id,
        userId: workers[0].id,
        value: 'cat',
        confidence: 0.95,
      });

      await taskService.assignTask(task.id, workers[1].id);
      await taskService.submitLabel({
        taskId: task.id,
        userId: workers[1].id,
        value: 'cat',
        confidence: 0.90,
      });

      await taskService.assignTask(task.id, workers[2].id);
      await taskService.submitLabel({
        taskId: task.id,
        userId: workers[2].id,
        value: 'dog',
        confidence: 0.85,
      });

      const consensus = await taskService.getConsensus(task.id);

      expect(consensus?.agreedLabel).toBe('cat');
      expect(consensus?.confidence).toBe(2/3); // 2 out of 3
      expect(consensus?.reached).toBe(true);
    });

    it('should detect conflict when no majority', async () => {
      const workers = testUsers.slice(0, 3);
      const task = testTasks[0];

      // Submit 3 different labels
      const labels = ['cat', 'dog', 'bird'];
      for (let i = 0; i < workers.length; i++) {
        await taskService.assignTask(task.id, workers[i].id);
        await taskService.submitLabel({
          taskId: task.id,
          userId: workers[i].id,
          value: labels[i],
          confidence: 0.9,
        });
      }

      const consensus = await taskService.getConsensus(task.id);

      expect(consensus?.reached).toBe(false);
      expect(consensus?.conflict).toBe(true);
    });

    it('should request additional reviewers on conflict', async () => {
      const workers = testUsers.slice(0, 3);
      const task = testTasks[0];

      // Create conflict scenario
      const labels = ['cat', 'dog', 'bird'];
      for (let i = 0; i < workers.length; i++) {
        await taskService.assignTask(task.id, workers[i].id);
        await taskService.submitLabel({
          taskId: task.id,
          userId: workers[i].id,
          value: labels[i],
          confidence: 0.9,
        });
      }

      const additionalReviewers = await taskService.getAdditionalReviewersNeeded(task.id);

      expect(additionalReviewers).toBeGreaterThan(0);
      expect(additionalReviewers).toBeLessThanOrEqual(2); // Max 5 total reviewers
    });
  });

  describe('Honeypot Tasks', () => {
    it('should process honeypot task correctly', async () => {
      const worker = testUsers[0];
      const honeypotTask = TaskFactory.createHoneypot({
        expectedLabel: 'cat',
      });

      const result = await taskService.submitHoneypotLabel({
        taskId: honeypotTask.id,
        userId: worker.id,
        value: 'cat', // Correct answer
        timeSpent: 30,
      });

      expect(result.isCorrect).toBe(true);
      expect(result.accuracyImpact).toBeGreaterThan(0);
    });

    it('should penalize incorrect honeypot submission', async () => {
      const worker = testUsers[2]; // Lower reputation
      const honeypotTask = TaskFactory.createHoneypot({
        expectedLabel: 'cat',
      });

      const result = await taskService.submitHoneypotLabel({
        taskId: honeypotTask.id,
        userId: worker.id,
        value: 'dog', // Incorrect answer
        timeSpent: 15,
      });

      expect(result.isCorrect).toBe(false);
      expect(result.accuracyImpact).toBeLessThan(0);
    });

    it('should update worker accuracy based on honeypot performance', async () => {
      const worker = testUsers[0];
      const initialAccuracy = worker.accuracy;

      // Submit correct honeypot
      const honeypotTask = TaskFactory.createHoneypot({
        expectedLabel: 'cat',
      });

      await taskService.submitHoneypotLabel({
        taskId: honeypotTask.id,
        userId: worker.id,
        value: 'cat',
        timeSpent: 30,
      });

      const updatedWorker = await taskService.getUser(worker.id);

      expect(updatedWorker.accuracy).toBeGreaterThan(initialAccuracy);
    });
  });

  describe('Task Expiration', () => {
    it('should expire overdue tasks', async () => {
      const task = TaskFactory.createAssigned({
        assignedTo: testUsers[0].id,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      await taskService.checkExpiredTasks();

      const updatedTask = await taskService.getTask(task.id);
      expect(updatedTask.status).toBe('expired');
    });

    it('should reassign expired tasks to new workers', async () => {
      const task = TaskFactory.create({
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000),
      });

      const reassignedTask = await taskService.reassignExpiredTask(task.id);

      expect(reassignedTask.status).toBe('assigned');
      expect(reassignedTask.assignedTo).not.toBeNull();
      expect(reassignedTask.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Task Statistics', () => {
    beforeEach(async () => {
      // Create tasks with various statuses for statistics
      const tasks = [
        TaskFactory.createCompleted(),
        TaskFactory.createCompleted(),
        TaskFactory.createInProgress(),
        TaskFactory.createPending(),
        TaskFactory.createPending(),
        TaskFactory.createAssigned(),
      ];

      for (const task of tasks) {
        testTasks.push(task);
      }
    });

    it('should calculate accurate task statistics', async () => {
      const stats = await taskService.getTaskStatistics();

      expect(stats.total).toBe(testTasks.length);
      expect(stats.completed).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.pending).toBe(2);
      expect(stats.assigned).toBe(1);
      expect(stats.expired).toBe(0);
      expect(stats.cancelled).toBe(0);
    });

    it('should calculate worker performance metrics', async () => {
      const worker = testUsers[0];
      const metrics = await taskService.getWorkerMetrics(worker.id);

      expect(metrics).toBeDefined();
      expect(metrics.completedTasks).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
      expect(metrics.averageTimePerTask).toBeGreaterThan(0);
      expect(metrics.earnings).toBeGreaterThanOrEqual(0);
    });

    it('should calculate project statistics', async () => {
      const project = await taskService.getProjectStatistics('project-001');

      expect(project).toBeDefined();
      expect(project.totalTasks).toBeGreaterThanOrEqual(0);
      expect(project.completedTasks).toBeGreaterThanOrEqual(0);
      expect(project.totalBudget).toBeGreaterThanOrEqual(0);
      expect(project.budgetSpent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Operations', () => {
    it('should assign multiple tasks in batch', async () => {
      const taskIds = testTasks.slice(0, 3).map(t => t.id);
      const workerId = testUsers[0].id;

      const results = await taskService.batchAssignTasks(taskIds, workerId);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.assignedTo).toBe(workerId);
        expect(result.status).toBe('assigned');
      });
    });

    it('should process multiple label submissions in batch', async () => {
      const submissions = [
        {
          taskId: testTasks[0].id,
          userId: testUsers[0].id,
          value: 'cat',
          confidence: 0.95,
        },
        {
          taskId: testTasks[1].id,
          userId: testUsers[1].id,
          value: 'dog',
          confidence: 0.90,
        },
      ];

      const results = await taskService.batchSubmitLabels(submissions);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.totalLabels).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task ID gracefully', async () => {
      await expect(taskService.getTask('invalid-id'))
        .rejects.toThrow('Task not found');
    });

    it('should handle database connection errors', async () => {
      // Mock database error
      vi.spyOn(taskService['taskRepo'], 'findById')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(taskService.getTask(testTasks[0].id))
        .rejects.toThrow('Database connection failed');
    });

    it('should validate task creation data', async () => {
      const invalidTask = {
        title: '', // Empty title
        type: 'invalid_type',
        reward: -1, // Negative reward
      };

      await expect(taskService.createTask(invalidTask))
        .rejects.toThrow();
    });
  });
});