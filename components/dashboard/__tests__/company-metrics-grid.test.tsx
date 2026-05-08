import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CompanyMetricsGrid } from '../company-metrics-grid';
import * as dashboardActions from '@/app/dashboard-actions';

// Mock dependencies
vi.mock('@/app/dashboard-actions', () => ({
  getCompanyMetrics: vi.fn(),
}));

// Mock chart components to avoid canvas issues in tests
vi.mock('../company-chart', () => ({
  CompanyChart: ({ type, data }: any) => (
    <div data-testid="mock-chart">
      {type} chart: Pending {data.pending}, InReview {data.inReview}, Approved {data.approved}
    </div>
  ),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  PieChart: () => <div />,
  BarChart3: () => <div />,
  RefreshCw: () => <div />,
  Loader2: () => <div />,
  ChevronLeft: () => <div />,
  ChevronRight: () => <div />,
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div onClick={() => onValueChange('mockValue')}>{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <div>SelectValue</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

describe('CompanyMetricsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially when no metrics provided', () => {
    render(<CompanyMetricsGrid userRole="CONSULTANT" />);
    // Since we mocked Loader2, we check if the loading container exists (implicit)
    // Or check if getCompanyMetrics was called
    expect(dashboardActions.getCompanyMetrics).toHaveBeenCalled();
  });

  it('renders metrics when data is loaded', async () => {
    const mockMetrics = [
      {
        id: '1',
        name: 'Test Company',
        status: 'ACTIVE',
        totalActivities: 10,
        pending: 5,
        inReview: 3,
        approved: 2,
        updatedAt: new Date(),
      },
    ];

    (dashboardActions.getCompanyMetrics as any).mockResolvedValue({
      success: true,
      metrics: mockMetrics,
    });

    render(<CompanyMetricsGrid userRole="CONSULTANT" />);

    await waitFor(() => {
      expect(screen.getByText('Test Company')).toBeDefined();
      expect(screen.getByText('pie chart: Pending 5, InReview 3, Approved 2')).toBeDefined();
    });
  });

  it('renders empty state when no metrics found', async () => {
    (dashboardActions.getCompanyMetrics as any).mockResolvedValue({
      success: true,
      metrics: [],
    });

    render(<CompanyMetricsGrid userRole="CONSULTANT" />);

    await waitFor(() => {
      expect(screen.getByText('No se encontraron empresas con los filtros seleccionados.')).toBeDefined();
    });
  });
});
