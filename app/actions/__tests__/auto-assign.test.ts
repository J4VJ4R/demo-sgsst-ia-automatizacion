
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Using relative imports for testing environment if aliases fail
import { createProjectActivity } from '../../actions';

// We need to define mocks before importing module that uses them if hoisting is an issue,
// but for hoisting to work with variables, they need to be hoisted too or defined inside the factory.
// The error says "Cannot access 'mockFindUniqueProject' before initialization" because vi.mock is hoisted above the variable declaration.

// Solution: Define mocks directly inside the factory or use a different pattern.

vi.mock('@/lib/prisma', () => {
  const mockFindUniqueProject = vi.fn();
  const mockFindUniqueUser = vi.fn();
  const mockFindManyUser = vi.fn();
  const mockCreateActivity = vi.fn();
  const mockTransaction = vi.fn((callback) => callback({
    project: { findUnique: mockFindUniqueProject },
    user: { findUnique: mockFindUniqueUser, findMany: mockFindManyUser },
    activity: { create: mockCreateActivity }
  }));

  return {
    default: {
      project: {
        findUnique: mockFindUniqueProject,
      },
      user: {
        findUnique: mockFindUniqueUser,
        findMany: mockFindManyUser,
      },
      activity: {
        create: mockCreateActivity,
      },
      $transaction: mockTransaction,
    },
    // Export mocks to be used in tests
    mockFindUniqueProject,
    mockFindUniqueUser,
    mockFindManyUser,
    mockCreateActivity
  };
});

vi.mock('@/app/auth-actions', () => ({
  getCurrentUser: vi.fn(),
}));

// We need to import the mocked function to use it in tests
import { getCurrentUser } from '@/app/auth-actions';

// Import mocked prisma to access mock functions in tests
// Note: We need to cast or access the specific exports we added to the mock
import prisma, { mockFindUniqueProject, mockFindUniqueUser, mockFindManyUser, mockCreateActivity } from '@/lib/prisma';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock modules that use aliases or are complex
vi.mock('@/lib/s3', () => ({
  uploadToS3: vi.fn(),
  deleteFromS3: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock('@/lib/priority-logic', () => ({
  calculatePriority: vi.fn(() => ({ isValid: true, priority: 'Media' })),
  isUploadAllowed: vi.fn(),
}));

vi.mock('@/lib/notification-logic', () => ({
  buildNotificationQuery: vi.fn(),
  validateNotificationCreation: vi.fn(),
}));

vi.mock('@/lib/activities-data', () => ({
  chapterActivities: {},
}));

vi.mock('@/lib/email-templates', () => ({
  getSupportTicketEmailTemplate: vi.fn(),
}));

describe('createProjectActivity Auto-Assignment', () => {
  const mockAdminUser = { id: 'admin-1', role: 'ADMIN_PMD' };
  const mockConsultantUser = { id: 'consultant-1', role: 'CONSULTANT', status: 'ACTIVE' };
  const mockProjectWithConsultant = {
    id: 'project-1',
    name: 'Project 1',
    consultantId: 'consultant-1',
  };
  const mockProjectWithoutConsultant = {
    id: 'project-2',
    name: 'Project 2',
    consultantId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation for findMany (admins)
    mockFindManyUser.mockResolvedValue([]);
  });

  it('should auto-assign to project consultant when admin creates activity', async () => {
    // Setup
    (getCurrentUser as any).mockResolvedValue(mockAdminUser);
    mockFindUniqueProject.mockResolvedValue(mockProjectWithConsultant);
    mockFindUniqueUser.mockResolvedValue(mockConsultantUser);
    mockCreateActivity.mockResolvedValue({ id: 'activity-1' });

    const formData = new FormData();
    formData.append('projectId', 'project-1');
    formData.append('title', 'New Activity');

    // Execute
    const result = await createProjectActivity(formData);

    // Verify
    expect(result.success).toBe(true);
    expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        assignedToId: 'consultant-1'
      })
    }));
  });

  it('should NOT assign if project has no consultant', async () => {
    // Setup
    (getCurrentUser as any).mockResolvedValue(mockAdminUser);
    mockFindUniqueProject.mockResolvedValue(mockProjectWithoutConsultant);
    mockCreateActivity.mockResolvedValue({ id: 'activity-2' });

    const formData = new FormData();
    formData.append('projectId', 'project-2');
    formData.append('title', 'Unassigned Activity');

    // Execute
    const result = await createProjectActivity(formData);

    // Verify
    expect(result.success).toBe(true);
    expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        assignedToId: undefined
      })
    }));
  });

  it('should assign to self if creator is the consultant', async () => {
    // Setup
    (getCurrentUser as any).mockResolvedValue(mockConsultantUser);
    mockFindUniqueProject.mockResolvedValue(mockProjectWithConsultant);
    mockCreateActivity.mockResolvedValue({ id: 'activity-3' });

    const formData = new FormData();
    formData.append('projectId', 'project-1');
    formData.append('title', 'Self Activity');

    // Execute
    const result = await createProjectActivity(formData);

    // Verify
    expect(result.success).toBe(true);
    expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        assignedToId: 'consultant-1'
      })
    }));
  });
  
  /*
  // Removed because User model does not have 'status' field currently.
  it('should NOT assign if consultant is INACTIVE', async () => {
     // Setup
    (getCurrentUser as any).mockResolvedValue(mockAdminUser);
    mockFindUniqueProject.mockResolvedValue(mockProjectWithConsultant);
    // Consultant is inactive
    mockFindUniqueUser.mockResolvedValue({ ...mockConsultantUser, status: 'INACTIVE' });
    mockCreateActivity.mockResolvedValue({ id: 'activity-4' });

    const formData = new FormData();
    formData.append('projectId', 'project-1');
    formData.append('title', 'Inactive Consultant Activity');

    // Execute
    const result = await createProjectActivity(formData);

    // Verify
    expect(result.success).toBe(true);
    expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        assignedToId: undefined
      })
    }));
  });
  */
});
