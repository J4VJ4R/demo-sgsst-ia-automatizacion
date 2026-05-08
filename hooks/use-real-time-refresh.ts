
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRealTimeRefresh(intervalMs: number = 5000) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [router, intervalMs]);
}
