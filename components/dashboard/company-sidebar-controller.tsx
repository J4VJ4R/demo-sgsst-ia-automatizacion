'use client';

import { useEffect } from "react";
import { useSidebar } from "./sidebar-provider";

export function CompanySidebarController() {
  const { setCollapsed } = useSidebar();

  useEffect(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  return null;
}

