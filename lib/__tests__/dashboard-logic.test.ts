
import { describe, it, expect } from 'vitest';
import { getFilteredActivities, ActivitySummary, FilterState } from '../dashboard-logic';

describe('getFilteredActivities', () => {
  const mockActivities: ActivitySummary[] = [
    {
      id: '1',
      status: 'PENDING',
      priority: 'High',
      updatedAt: new Date().toISOString(),
      projectId: 'company-a',
      projectName: 'Company A',
      department: 'SST',
      municipality: 'Bogota',
      riskLevel: 'High',
      assignedToId: 'consultant-1',
      assignedToName: 'Consultant 1',
      assignedToRole: 'CONSULTANT',
      consultantId: 'consultant-1', // Consultant 1 is project owner
      consultantName: 'Consultant 1',
    },
    {
      id: '2',
      status: 'APPROVED',
      priority: 'Medium',
      updatedAt: new Date().toISOString(),
      projectId: 'company-b',
      projectName: 'Company B',
      department: 'HR',
      municipality: 'Medellin',
      riskLevel: 'Medium',
      assignedToId: 'consultant-2',
      assignedToName: 'Consultant 2',
      assignedToRole: 'CONSULTANT',
      consultantId: 'consultant-2',
      consultantName: 'Consultant 2',
    },
    {
      id: '3',
      status: 'IN_REVIEW',
      priority: 'Low',
      updatedAt: new Date().toISOString(),
      projectId: 'company-a',
      projectName: 'Company A',
      department: 'SST',
      municipality: 'Bogota',
      riskLevel: 'High',
      assignedToId: null,
      assignedToName: null,
      assignedToRole: null,
      consultantId: 'consultant-1', // Unassigned but project belongs to Consultant 1
      consultantName: 'Consultant 1',
    },
  ];

  const defaultFilters: FilterState = {
    companyId: 'all',
    consultantId: 'all',
    department: 'all',
    risk: 'all',
    dateFrom: '',
    dateTo: '',
  };

  it('should return all activities when no filters are applied', () => {
    const result = getFilteredActivities(mockActivities, defaultFilters);
    expect(result).toHaveLength(3);
  });

  it('should filter by company', () => {
    const result = getFilteredActivities(mockActivities, { ...defaultFilters, companyId: 'company-a' });
    expect(result).toHaveLength(2);
    expect(result.map(a => a.id)).toContain('1');
    expect(result.map(a => a.id)).toContain('3');
  });

  it('should filter by consultant (direct assignment)', () => {
    const result = getFilteredActivities(mockActivities, { ...defaultFilters, consultantId: 'consultant-2' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should filter by consultant (project ownership)', () => {
    // Consultant 1 owns Company A, so should see both act 1 and 3
    const result = getFilteredActivities(mockActivities, { ...defaultFilters, consultantId: 'consultant-1' });
    expect(result).toHaveLength(2);
    expect(result.map(a => a.id)).toContain('1');
    expect(result.map(a => a.id)).toContain('3');
  });

  it('should filter by BOTH company AND consultant', () => {
    // This reproduces the user scenario
    // Consultant: Consultant 1 (Carlos)
    // Company: Company A (Los Andes)
    const result = getFilteredActivities(mockActivities, { 
      ...defaultFilters, 
      consultantId: 'consultant-1',
      companyId: 'company-a'
    });
    expect(result).toHaveLength(2);
  });

  it('should return empty if consultant does not belong to company', () => {
    // Consultant 2 (Company B) filtered with Company A -> Should be 0
    const result = getFilteredActivities(mockActivities, { 
      ...defaultFilters, 
      consultantId: 'consultant-2',
      companyId: 'company-a'
    });
    expect(result).toHaveLength(0);
  });
});
