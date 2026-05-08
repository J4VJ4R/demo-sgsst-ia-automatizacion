/**
 * @vitest-environment jsdom
 */
import { render, act, fireEvent } from '@testing-library/react';
import { SessionTimeout } from '../session-timeout';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as navigation from 'next/navigation';
import * as authActions from '@/app/auth-actions';
import { toast } from 'sonner';

// Mocks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/app/auth-actions', () => ({
  logout: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

describe('SessionTimeout', () => {
  const mockPush = vi.fn();
  const mockLogout = vi.fn();
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigation, 'useRouter').mockReturnValue({ push: mockPush } as any);
    (authActions.logout as any).mockImplementation(mockLogout);
    
    // Mock localStorage
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { for (const key in store) delete store[key]; }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('sets initial activity timestamp on mount', () => {
    render(<SessionTimeout />);
    expect(window.localStorage.setItem).toHaveBeenCalledWith('session_last_activity', expect.any(String));
  });

  it('logs out after 30 minutes of inactivity', () => {
    render(<SessionTimeout />);
    
    // Fast-forward time by 30 minutes + 1 second
    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000 + 1000);
    });

    expect(toast.info).toHaveBeenCalledWith("Sesión cerrada por inactividad");
    expect(mockLogout).toHaveBeenCalled();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('session_last_activity');
  });

  it('resets timer on user activity', () => {
    render(<SessionTimeout />);
    
    // Advance time by 15 minutes
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });

    // Simulate user activity (click)
    fireEvent.click(window);

    // Advance time by another 20 minutes (total 35 mins from start, but only 20 from click)
    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    // Should NOT have logged out yet because timer was reset
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance remaining time (10 minutes + buffer)
    act(() => {
      vi.advanceTimersByTime(11 * 60 * 1000);
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  it('throttles localStorage updates', () => {
    render(<SessionTimeout />);
    
    // Clear initial setItem call
    vi.clearAllMocks();

    // Trigger multiple events rapidly
    fireEvent.mouseMove(window);
    fireEvent.mouseMove(window);
    fireEvent.scroll(window);

    // Should not update immediately due to throttle (10s)
    expect(window.localStorage.setItem).not.toHaveBeenCalled();

    // Advance time by 11 seconds
    act(() => {
      vi.setSystemTime(Date.now() + 11000);
      fireEvent.mouseMove(window);
    });

    expect(window.localStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('redirects to login if logout action fails', async () => {
    (authActions.logout as any).mockRejectedValue(new Error('Network error'));
    render(<SessionTimeout />);
    
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000 + 1000);
    });

    expect(mockPush).toHaveBeenCalledWith('/login');
  });
  
  it('syncs across tabs via storage event', () => {
    render(<SessionTimeout />);
    
    // Simulate activity in another tab updating localStorage
    const newTime = Date.now();
    
    act(() => {
      const event = new StorageEvent('storage', {
        key: 'session_last_activity',
        newValue: newTime.toString(),
      });
      window.dispatchEvent(event);
    });

    // Advance time by 29 minutes from the NEW time
    act(() => {
      vi.advanceTimersByTime(29 * 60 * 1000);
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });
});
