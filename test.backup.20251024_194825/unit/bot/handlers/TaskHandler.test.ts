import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskHandler } from '@bot/handlers/TaskHandler';
import { Bot } from 'grammy';
import { createMockTelegramBot } from '@test/utils/mocks';
import { UserFactory } from '@test/factories/UserFactory';
import { TaskFactory } from '@test/factories/TaskFactory';
import type { Context } from 'grammy';

describe('TaskHandler', () => {
  let bot: Bot;
  let taskHandler: TaskHandler;
  let mockContext: any;

  beforeEach(() => {
    bot = createMockTelegramBot().bot as any;
    taskHandler = new TaskHandler(bot);

    mockContext = {
      reply: vi.fn(),
      editMessageText: vi.fn(),
      editMessageReplyMarkup: vi.fn(),
      answerCallbackQuery: vi.fn(),
      chat: {
        id: 123456789,
        type: 'private',
      },
      from: {
        id: 987654321,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      },
      callbackQuery: {
        data: '',
        message: {
          message_id: 123,
          text: 'Test message',
        },
      },
      session: {},
    };
  });

  describe('Handle Start Command', () => {
    it('should show welcome message with tasks', async () => {
      // Mock API calls
      vi.spyOn(taskHandler['api'], 'getAvailableTasks')
        .mockResolvedValue([
          TaskFactory.createPending({ title: 'Classify Images', reward: 0.5 }),
          TaskFactory.createPending({ title: 'Label Text', reward: 0.3 }),
        ]);

      await taskHandler.handleStart(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to Labelmint!'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '📋 View Available Tasks',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should show no tasks message for new user', async () => {
      vi.spyOn(taskHandler['api'], 'getAvailableTasks')
        .mockResolvedValue([]);

      await taskHandler.handleStart(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('No tasks available at the moment'),
        expect.objectContaining({
          parse_mode: 'HTML',
        })
      );
    });
  });

  describe('Handle Task List', () => {
    beforeEach(() => {
      vi.spyOn(taskHandler['api'], 'getAvailableTasks')
        .mockResolvedValue([
          TaskFactory.createPending({
            title: 'Classify Vehicle Images',
            description: 'Identify vehicle types in images',
            reward: 0.5,
            estimatedTime: 60,
          }),
          TaskFactory.createPending({
            title: 'Sentiment Analysis',
            description: 'Analyze text sentiment',
            reward: 0.3,
            estimatedTime: 30,
          }),
        ]);
    });

    it('should display available tasks', async () => {
      await taskHandler.handleTaskList(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Available Tasks'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🚗 Classify Vehicle Images',
                }),
                expect.objectContaining({
                  text: '💰 $0.50 • 1 min',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should handle empty task list', async () => {
      vi.spyOn(taskHandler['api'], 'getAvailableTasks')
        .mockResolvedValue([]);

      await taskHandler.handleTaskList(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('No tasks available'),
        expect.any(Object)
      );
    });

    it('should paginate tasks if more than 10', async () => {
      const tasks = Array.from({ length: 15 }, (_, i) =>
        TaskFactory.createPending({
          title: `Task ${i + 1}`,
          reward: 0.1 + i * 0.01,
        })
      );

      vi.spyOn(taskHandler['api'], 'getAvailableTasks')
        .mockResolvedValue(tasks);

      await taskHandler.handleTaskList(mockContext);

      // Should show pagination buttons
      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '▶️ Next',
                }),
              ]),
            ]),
          }),
        })
      );
    });
  });

  describe('Handle Task Selection', () => {
    const taskId = 'task-123';

    beforeEach(() => {
      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createPending({
            id: taskId,
            title: 'Classify Vehicle Images',
            description: 'Identify the type of vehicle',
            instructions: 'Look at the image and select the correct category',
            metadata: {
              imageUrl: 'https://example.com/image.jpg',
              categories: ['car', 'truck', 'motorcycle', 'bus'],
            },
          })
        );

      vi.spyOn(taskHandler['api'], 'assignTask')
        .mockResolvedValue(
          TaskFactory.createAssigned({
            id: taskId,
            assignedTo: mockContext.from.id.toString(),
          })
        );
    });

    it('should show task details and accept button', async () => {
      mockContext.callbackQuery.data = `task_select_${taskId}`;

      await taskHandler.handleTaskSelect(mockContext);

      expect(mockContext.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Classify Vehicle Images'),
        expect.stringContaining('Identify the type of vehicle'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '✅ Accept Task',
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: '❌ Decline',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should handle task not found', async () => {
      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(null);

      mockContext.callbackQuery.data = 'task_select_invalid';

      await taskHandler.handleTaskSelect(mockContext);

      expect(mockContext.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'Task not found',
        show_alert: true,
      });
    });
  });

  describe('Handle Task Accept', () => {
    const taskId = 'task-123';

    beforeEach(() => {
      vi.spyOn(taskHandler['api'], 'assignTask')
        .mockResolvedValue(
          TaskFactory.createAssigned({
            id: taskId,
            assignedTo: mockContext.from.id.toString(),
            timeLimit: 300,
          })
        );

      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createAssigned({
            id: taskId,
            metadata: {
              imageUrl: 'https://example.com/image.jpg',
              categories: ['cat', 'dog', 'bird'],
            },
          })
        );
    });

    it('should assign task and show task interface', async () => {
      mockContext.callbackQuery.data = `task_accept_${taskId}`;

      await taskHandler.handleTaskAccept(mockContext);

      expect(mockContext.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Task Assigned!'),
        expect.stringContaining('Time Limit: 5 minutes'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '📷 View Image',
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🏷️ Submit Label',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should handle task already assigned', async () => {
      vi.spyOn(taskHandler['api'], 'assignTask')
        .mockRejectedValue(new Error('Task already assigned'));

      mockContext.callbackQuery.data = `task_accept_${taskId}`;

      await taskHandler.handleTaskAccept(mockContext);

      expect(mockContext.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'This task is no longer available',
        show_alert: true,
      });
    });
  });

  describe('Handle Label Submission', () => {
    const taskId = 'task-123';
    const label = 'cat';

    beforeEach(() => {
      vi.spyOn(taskHandler['api'], 'submitLabel')
        .mockResolvedValue({
          reached: false,
          confidence: 0.33,
          totalLabels: 1,
          requiredLabels: 3,
        });

      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createInProgress({
            id: taskId,
            metadata: {
              categories: ['cat', 'dog', 'bird'],
            },
          })
        );
    });

    it('should show label selection options', async () => {
      mockContext.callbackQuery.data = `task_label_${taskId}`;

      await taskHandler.handleTaskLabel(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Select the correct label:'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🐱 Cat',
                  callback_data: `label_submit_${taskId}_cat`,
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should submit label and show confirmation', async () => {
      mockContext.callbackQuery.data = `label_submit_${taskId}_${label}`;

      await taskHandler.handleLabelSubmit(mockContext);

      expect(mockContext.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Label submitted!'),
        expect.stringContaining('Your answer: Cat'),
        expect.any(Object)
      );
    });

    it('should handle consensus reached', async () => {
      vi.spyOn(taskHandler['api'], 'submitLabel')
        .mockResolvedValue({
          reached: true,
          confidence: 1,
          agreedLabel: 'cat',
          totalLabels: 3,
          reward: 0.5,
        });

      mockContext.callbackQuery.data = `label_submit_${taskId}_${label}`;

      await taskHandler.handleLabelSubmit(mockContext);

      expect(mockContext.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('✅ Consensus Reached!'),
        expect.stringContaining('Final Answer: Cat'),
        expect.stringContaining('Earned: $0.50'),
        expect.any(Object)
      );
    });

    it('should handle duplicate submission', async () => {
      vi.spyOn(taskHandler['api'], 'submitLabel')
        .mockRejectedValue(new Error('User already submitted label'));

      mockContext.callbackQuery.data = `label_submit_${taskId}_${label}`;

      await taskHandler.handleLabelSubmit(mockContext);

      expect(mockContext.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'You have already submitted a label for this task',
        show_alert: true,
      });
    });
  });

  describe('Handle Task Image', () => {
    const taskId = 'task-123';
    const imageUrl = 'https://example.com/image.jpg';

    beforeEach(() => {
      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createInProgress({
            id: taskId,
            metadata: { imageUrl },
          })
        );
    });

    it('should send task image', async () => {
      mockContext.callbackQuery.data = `task_image_${taskId}`;

      await taskHandler.handleTaskImage(mockContext);

      expect(mockContext.replyWithPhoto).toHaveBeenCalledWith(
        imageUrl,
        expect.objectContaining({
          caption: expect.stringContaining('Task Image'),
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🔙 Back to Task',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should handle missing image', async () => {
      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createInProgress({
            id: taskId,
            metadata: {},
          })
        );

      mockContext.callbackQuery.data = `task_image_${taskId}`;

      await taskHandler.handleTaskImage(mockContext);

      expect(mockContext.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'No image available for this task',
        show_alert: true,
      });
    });
  });

  describe('Handle Task Timer', () => {
    it('should send warning when time is running out', async () => {
      const taskId = 'task-123';

      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createInProgress({
            id: taskId,
            timeLimit: 300,
            startedAt: new Date(Date.now() - 240000), // 4 minutes ago
          })
        );

      await taskHandler.checkTaskTimers();

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('⏰ Time Warning!'),
        expect.stringContaining('1 minute remaining'),
        expect.any(Object)
      );
    });

    it('should expire task when time limit exceeded', async () => {
      const taskId = 'task-123';

      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createInProgress({
            id: taskId,
            assignedTo: mockContext.from.id.toString(),
            timeLimit: 300,
            startedAt: new Date(Date.now() - 360000), // 6 minutes ago
          })
        );

      vi.spyOn(taskHandler['api'], 'expireTask')
        .mockResolvedValue(undefined);

      await taskHandler.checkTaskTimers();

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('⏰ Time Expired!'),
        expect.stringContaining('Task has been expired'),
        expect.any(Object)
      );
    });
  });

  describe('Handle Task Instructions', () => {
    const taskId = 'task-123';
    const instructions = 'Carefully examine the image and select the most accurate category. Consider the lighting and angle.';

    beforeEach(() => {
      vi.spyOn(taskHandler['api'], 'getTask')
        .mockResolvedValue(
          TaskFactory.createInProgress({
            id: taskId,
            instructions,
          })
        );
    });

    it('should show task instructions', async () => {
      mockContext.callbackQuery.data = `task_instructions_${taskId}`;

      await taskHandler.handleTaskInstructions(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('📋 Task Instructions'),
        expect.stringContaining(instructions),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🔙 Back to Task',
                }),
              ]),
            ]),
          }),
        })
      );
    });
  });

  describe('Handle Skip Task', () => {
    const taskId = 'task-123';

    beforeEach(() => {
      vi.spyOn(taskHandler['api'], 'unassignTask')
        .mockResolvedValue(undefined);
    });

    it('should unassign task and return to list', async () => {
      mockContext.callbackQuery.data = `task_skip_${taskId}`;

      await taskHandler.handleTaskSkip(mockContext);

      expect(mockContext.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Task skipped'),
        expect.stringContaining('You can return to this task later if available'),
        expect.any(Object)
      );
    });

    it('should limit skip attempts', async () => {
      // Mock session with skip count
      mockContext.session = {
        skipCount: 4,
        lastSkipTime: new Date(Date.now() - 30000),
      };

      mockContext.callbackQuery.data = `task_skip_${taskId}`;

      await taskHandler.handleTaskSkip(mockContext);

      expect(mockContext.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'You have reached the maximum number of skips. Please complete a task before skipping again.',
        show_alert: true,
      });
    });
  });

  describe('Handle Report Issue', () => {
    const taskId = 'task-123';

    it('should show issue reporting options', async () => {
      mockContext.callbackQuery.data = `task_report_${taskId}`;

      await taskHandler.handleTaskReport(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('What issue are you experiencing?'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🖼️ Image not loading',
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: '📝 Unclear instructions',
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: '🏷️ Labels not applicable',
                }),
              ]),
              expect.arrayContaining([
                expect.objectContaining({
                  text: '⚙️ Technical issue',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should submit issue report', async () => {
      vi.spyOn(taskHandler['api'], 'reportIssue')
        .mockResolvedValue(undefined);

      mockContext.callbackQuery.data = `report_submit_${taskId}_image_not_loading`;

      await taskHandler.handleReportSubmit(mockContext);

      expect(mockContext.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('✅ Issue reported'),
        expect.stringContaining('Thank you for your feedback'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.spyOn(taskHandler['api'], 'getAvailableTasks')
        .mockRejectedValue(new Error('API Error'));

      await taskHandler.handleStart(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Sorry, there was an error'),
        expect.any(Object)
      );
    });

    it('should handle network timeouts', async () => {
      vi.spyOn(taskHandler['api'], 'assignTask')
        .mockRejectedValue(new Error('Network timeout'));

      mockContext.callbackQuery.data = 'task_accept_task123';

      await taskHandler.handleTaskAccept(mockContext);

      expect(mockContext.answerCallbackQuery).toHaveBeenCalledWith({
        text: 'Request timed out. Please try again.',
        show_alert: true,
      });
    });
  });

  describe('User Stats', () => {
    it('should display user statistics', async () => {
      vi.spyOn(taskHandler['api'], 'getUserStats')
        .mockResolvedValue({
          completedTasks: 25,
          accuracy: 0.92,
          reputation: 85,
          earnings: 12.50,
          rank: 'Silver',
        });

      await taskHandler.handleUserStats(mockContext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('📊 Your Statistics'),
        expect.stringContaining('Completed Tasks: 25'),
        expect.stringContaining('Accuracy: 92%'),
        expect.stringContaining('Reputation: 85'),
        expect.stringContaining('Total Earnings: $12.50'),
        expect.stringContaining('Rank: Silver'),
        expect.objectContaining({
          parse_mode: 'HTML',
        })
      );
    });
  });
});