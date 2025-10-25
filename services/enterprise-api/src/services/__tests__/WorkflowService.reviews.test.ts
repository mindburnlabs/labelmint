import { WorkflowService } from '../WorkflowService';
import { TemplateReview } from '../../types/workflow';

// Mock prisma
jest.mock('../../app', () => ({
  prisma: {
    workflowTemplate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn()
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123')
}));

// Mock AuditService
jest.mock('../AuditService', () => ({
  AuditService: {
    log: jest.fn()
  }
}));

describe('WorkflowService - Template Reviews', () => {
  const mockTemplateId = 'template-123';
  const mockUserId = 'user-456';
  const mockOrganizationId = 'org-789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTemplate with reviews', () => {
    it('should load template without reviews when includeReviews is false', async () => {
      const mockTemplate = {
        id: mockTemplateId,
        name: 'Test Template',
        description: 'Test Description',
        category: 'test',
        tags: ['test'],
        isPublic: true,
        usageCount: 10,
        rating: { toNumber: () => 4.5 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: { nodes: [], edges: [] },
        workflow: {
          organizationId: mockOrganizationId,
          definition: { nodes: [], edges: [] }
        }
      };

      (jest.requireMock('../../app').prisma.workflowTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const result = await WorkflowService.getTemplate(mockTemplateId, mockOrganizationId, false);

      expect(result.reviews).toEqual([]);
      expect(result.name).toBe('Test Template');
    });

    it('should load template with reviews when includeReviews is true', async () => {
      const mockTemplate = {
        id: mockTemplateId,
        name: 'Test Template',
        description: 'Test Description',
        category: 'test',
        tags: ['test'],
        isPublic: true,
        usageCount: 10,
        rating: { toNumber: () => 4.5 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: { nodes: [], edges: [] },
        workflow: {
          organizationId: mockOrganizationId,
          definition: { nodes: [], edges: [] }
        }
      };

      const mockReviews = [
        {
          id: 'review-1',
          userId: 'user-1',
          rating: 5,
          comment: 'Great template!',
          createdAt: new Date('2024-01-01')
        },
        {
          id: 'review-2',
          userId: 'user-2',
          rating: 4,
          comment: 'Good but could be better',
          createdAt: new Date('2024-01-02')
        }
      ];

      (jest.requireMock('../../app').prisma.workflowTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockReviews);

      const result = await WorkflowService.getTemplate(mockTemplateId, mockOrganizationId, true);

      expect(result.reviews).toHaveLength(2);
      expect(result.reviews[0].rating).toBe(5);
      expect(result.reviews[0].comment).toBe('Great template!');
      expect(result.reviews[1].rating).toBe(4);
      expect(result.reviews[1].comment).toBe('Good but could be better');
    });

    it('should handle missing reviews table gracefully', async () => {
      const mockTemplate = {
        id: mockTemplateId,
        name: 'Test Template',
        description: 'Test Description',
        category: 'test',
        tags: ['test'],
        isPublic: true,
        usageCount: 10,
        rating: { toNumber: () => 4.5 },
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        definition: { nodes: [], edges: [] },
        workflow: {
          organizationId: mockOrganizationId,
          definition: { nodes: [], edges: [] }
        }
      };

      (jest.requireMock('../../app').prisma.workflowTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(new Error('relation "TemplateReview" does not exist'));

      const result = await WorkflowService.getTemplate(mockTemplateId, mockOrganizationId, true);

      expect(result.reviews).toEqual([]);
      expect(jest.requireMock('../../utils/logger').logger.warn).toHaveBeenCalled();
    });
  });

  describe('addTemplateReview', () => {
    it('should add a new review successfully', async () => {
      const mockTemplate = {
        id: mockTemplateId,
        name: 'Test Template',
        workflow: { organizationId: mockOrganizationId }
      };

      (jest.requireMock('../../app').prisma.workflowTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // No existing review
        .mockResolvedValueOnce([]) // Insert successful
        .mockResolvedValueOnce([]); // Update rating successful

      const result = await WorkflowService.addTemplateReview(mockTemplateId, mockUserId, 5, 'Excellent!');

      expect(result).toEqual({
        id: 'test-uuid-123',
        userId: mockUserId,
        rating: 5,
        comment: 'Excellent!',
        createdAt: expect.any(Date)
      });

      expect(jest.requireMock('../../utils/logger').logger.info).toHaveBeenCalledWith('Template review added', {
        templateId: mockTemplateId,
        userId: mockUserId,
        rating: 5,
        isUpdate: false
      });
    });

    it('should update existing review', async () => {
      const mockTemplate = {
        id: mockTemplateId,
        name: 'Test Template',
        workflow: { organizationId: mockOrganizationId }
      };

      const existingReview = {
        id: 'existing-review-id',
        rating: 3
      };

      (jest.requireMock('../../app').prisma.workflowTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([existingReview]) // Existing review found
        .mockResolvedValueOnce([]) // Update successful
        .mockResolvedValueOnce([]); // Update rating successful

      const result = await WorkflowService.addTemplateReview(mockTemplateId, mockUserId, 4, 'Updated review');

      expect(result).toEqual({
        id: 'existing-review-id',
        userId: mockUserId,
        rating: 4,
        comment: 'Updated review',
        createdAt: expect.any(Date)
      });

      expect(jest.requireMock('../../utils/logger').logger.info).toHaveBeenCalledWith('Template review added', {
        templateId: mockTemplateId,
        userId: mockUserId,
        rating: 4,
        isUpdate: true
      });
    });

    it('should validate rating range', async () => {
      await expect(WorkflowService.addTemplateReview(mockTemplateId, mockUserId, 0))
        .rejects.toThrow('Rating must be between 1 and 5');

      await expect(WorkflowService.addTemplateReview(mockTemplateId, mockUserId, 6))
        .rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should throw error if template not found', async () => {
      (jest.requireMock('../../app').prisma.workflowTemplate.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(WorkflowService.addTemplateReview(mockTemplateId, mockUserId, 5))
        .rejects.toThrow('Template not found');
    });
  });

  describe('deleteTemplateReview', () => {
    it('should delete a review successfully', async () => {
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // Delete successful
        .mockResolvedValueOnce([]); // Update rating successful

      await WorkflowService.deleteTemplateReview(mockTemplateId, mockUserId);

      expect(jest.requireMock('../../utils/logger').logger.info).toHaveBeenCalledWith('Template review deleted', {
        templateId: mockTemplateId,
        userId: mockUserId
      });
    });

    it('should handle delete errors gracefully', async () => {
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(WorkflowService.deleteTemplateReview(mockTemplateId, mockUserId))
        .rejects.toThrow('Database error');

      expect(jest.requireMock('../../utils/logger').logger.error).toHaveBeenCalled();
    });
  });

  describe('getTemplateReviews', () => {
    it('should return reviews with pagination', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          userId: 'user-1',
          rating: 5,
          comment: 'Excellent!',
          createdAt: new Date('2024-01-01')
        },
        {
          id: 'review-2',
          userId: 'user-2',
          rating: 4,
          comment: 'Good',
          createdAt: new Date('2024-01-02')
        }
      ];

      const mockCount = [{ total: 2 }];

      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce(mockReviews) // Reviews query
        .mockResolvedValueOnce(mockCount); // Count query

      const result = await WorkflowService.getTemplateReviews(mockTemplateId, {
        limit: 10,
        offset: 0
      });

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.reviews[0].rating).toBe(5);
      expect(result.reviews[1].rating).toBe(4);
    });

    it('should filter by rating', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          userId: 'user-1',
          rating: 5,
          comment: 'Excellent!',
          createdAt: new Date('2024-01-01')
        }
      ];

      const mockCount = [{ total: 1 }];

      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce(mockReviews) // Reviews query
        .mockResolvedValueOnce(mockCount); // Count query

      const result = await WorkflowService.getTemplateReviews(mockTemplateId, {
        rating: 5
      });

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].rating).toBe(5);

      // Verify the WHERE clause was constructed correctly
      expect(jest.requireMock('../../app').prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('AND rating ='),
        mockTemplateId,
        5,
        20,
        0
      );
    });

    it('should handle database errors gracefully', async () => {
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await WorkflowService.getTemplateReviews(mockTemplateId);

      expect(result.reviews).toEqual([]);
      expect(result.total).toBe(0);
      expect(jest.requireMock('../../utils/logger').logger.error).toHaveBeenCalled();
    });
  });

  describe('listTemplates with reviews', () => {
    it('should list templates with optional reviews', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Template 1',
          rating: { toNumber: () => 4.5 },
          workflow: { organizationId: mockOrganizationId }
        },
        {
          id: 'template-2',
          name: 'Template 2',
          rating: { toNumber: () => 3.8 },
          workflow: { organizationId: mockOrganizationId }
        }
      ];

      (jest.requireMock('../../app').prisma.workflowTemplate.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (jest.requireMock('../../app').prisma.workflowTemplate.count as jest.Mock).mockResolvedValue(2);
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]); // Empty reviews

      const result = await WorkflowService.listTemplates(mockOrganizationId, {
        includeReviews: true,
        limit: 10,
        offset: 0
      });

      expect(result.templates).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.templates[0].reviews).toEqual([]);
      expect(result.templates[1].reviews).toEqual([]);
    });

    it('should filter by category and tags', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Template 1',
          category: 'data-processing',
          tags: ['automation', 'data'],
          rating: { toNumber: () => 4.5 },
          workflow: { organizationId: mockOrganizationId }
        }
      ];

      (jest.requireMock('../../app').prisma.workflowTemplate.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (jest.requireMock('../../app').prisma.workflowTemplate.count as jest.Mock).mockResolvedValue(1);
      (jest.requireMock('../../app').prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

      const result = await WorkflowService.listTemplates(mockOrganizationId, {
        category: 'data-processing',
        tags: ['automation'],
        includeReviews: false
      });

      expect(result.templates).toHaveLength(1);
      expect(jest.requireMock('../../app').prisma.workflowTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'data-processing',
            tags: { hasSome: ['automation'] }
          })
        })
      );
    });
  });
});