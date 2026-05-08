'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isCollapsed: boolean;
  onToggle: () => void;
  side?: 'left' | 'right'; // Side of the panel the button is attached to (e.g., panel is on right, button is on left edge)
  className?: string;
}

export function ToggleButton({
  isCollapsed,
  onToggle,
  side = 'left',
  className,
  ...props
}: ToggleButtonProps) {
  
  // Determine icon rotation based on side and collapsed state
  // If panel is on right (button on left edge):
  //   Collapsed: Panel is small strip on right. Arrow should point Left (<) to expand? Or Left (<) to show "pull this way"?
  //   Actually, if panel is on right:
  //     Collapsed: Hidden/Small. We want to Expand (move Left). Icon: ChevronLeft (<).
  //     Expanded: Visible. We want to Collapse (move Right). Icon: ChevronRight (>).
  //
  // Logic in component:
  //   Icon defaults to ChevronLeft/Right based on logic below.
  
  const Icon = side === 'left' 
    ? (isCollapsed ? ChevronLeft : ChevronRight) // Panel on Right (button on left): Collapsed->(<), Expanded->(>)
    : (isCollapsed ? ChevronRight : ChevronLeft); // Panel on Left (button on right): Collapsed->(>), Expanded->(<)

  return (
    <button
      onClick={onToggle}
      type="button"
      className={cn(
        // Layout & Size
        "flex items-center justify-center w-6 h-10", // Slightly narrower to match "tab" look
        "z-[9999]", // Highest priority visibility
        
        // Visual Style (Dark Theme Reference)
        "bg-[#1e293b] text-white", // Dark slate background, white text
        // "bg-[#0f172a] text-white", // Alternative darker slate if needed
        "shadow-md hover:bg-[#334155] transition-all duration-300 ease-in-out",
        
        // Border style to match image (white border)
        "border border-white/20",
        
        // Shape - Tab Style based on side
        side === 'left' 
          ? "rounded-l-lg border-r-0" // Attached to right panel
          : "rounded-r-lg border-l-0", // Attached to left panel
          
        // Accessibility & Interaction
        "cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2",
        "active:scale-95 hover:w-7", // Micro-interaction: expands width slightly on hover
        
        className
      )}
      aria-label={isCollapsed ? "Expandir panel" : "Colapsar panel"}
      title={isCollapsed ? "Expandir resumen" : "Ocultar resumen"}
      {...props}
    >
      <Icon 
        size={16} 
        strokeWidth={3}
        className={cn(
          "transition-transform duration-300",
          "opacity-100"
        )} 
      />
    </button>
  );
}
