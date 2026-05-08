'use client'

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/app/auth-actions';
import { toast } from 'sonner';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'session_last_activity';

export function SessionTimeout() {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLogout = useCallback(async () => {
    // Double check time before logging out (in case another tab updated it)
    const storedLastActivity = localStorage.getItem(STORAGE_KEY);
    if (storedLastActivity) {
      const elapsed = Date.now() - parseInt(storedLastActivity, 10);
      if (elapsed < TIMEOUT_MS) {
        // False alarm, activity detected in another tab or just before timeout
        // Restart timer for remaining time
        startTimer(TIMEOUT_MS - elapsed);
        return;
      }
    }
    
    toast.info("Sesión cerrada por inactividad");
    // Clear storage to prevent immediate relogin loop issues (though login sets new cookie)
    localStorage.removeItem(STORAGE_KEY);
    
    try {
        await logout();
    } catch (error) {
        console.error("Logout failed", error);
        // Fallback redirect if server action fails
        router.push('/login');
    }
  }, [router]);

  const startTimer = useCallback((duration: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Safety check: don't set negative or extremely small timeouts
    const safeDuration = Math.max(1000, duration);
    timerRef.current = setTimeout(handleLogout, safeDuration);
  }, [handleLogout]);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    // Throttle updates to localStorage (e.g., once every 10 seconds) to avoid performance issues
    if (now - lastActivityRef.current > 10000) {
        lastActivityRef.current = now;
        localStorage.setItem(STORAGE_KEY, now.toString());
        startTimer(TIMEOUT_MS);
    }
  }, [startTimer]);

  useEffect(() => {
    // Check on mount
    const storedLastActivity = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    
    if (storedLastActivity) {
      const lastActivity = parseInt(storedLastActivity, 10);
      const elapsed = now - lastActivity;
      
      if (elapsed >= TIMEOUT_MS) {
        handleLogout();
        return;
      } else {
        // Resume timer with remaining time
        startTimer(TIMEOUT_MS - elapsed);
      }
    } else {
      // First load or no storage, set current time
      localStorage.setItem(STORAGE_KEY, now.toString());
      startTimer(TIMEOUT_MS);
    }

    // Events to track activity
    const events = ['mousedown', 'keydown', 'scroll', 'mousemove', 'touchstart', 'click'];
    
    // Attach listeners
    const onUserActivity = () => updateActivity();
    
    events.forEach(event => {
      window.addEventListener(event, onUserActivity);
    });

    // Also listen for storage events to sync across tabs
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newLastActivity = parseInt(e.newValue, 10);
        const elapsed = Date.now() - newLastActivity;
        if (elapsed < TIMEOUT_MS) {
           startTimer(TIMEOUT_MS - elapsed);
           lastActivityRef.current = newLastActivity; // Sync ref
        }
      }
    };
    window.addEventListener('storage', onStorageChange);

    // Cleanup
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, onUserActivity);
      });
      window.removeEventListener('storage', onStorageChange);
    };
  }, [handleLogout, startTimer, updateActivity]);

  return null;
}
