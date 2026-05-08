'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getGlobalActivitySummary, type ActivitySummaryStats } from '@/app/actions/summary-actions';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Loader2, 
  AlertCircle,
  Menu,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { ToggleButton } from '@/components/ui/toggle-button';

import { useSearchParams } from 'next/navigation';

export function ClientActivitySummary() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyIdParam = searchParams.get("companyId") || "";
  const [stats, setStats] = useState<ActivitySummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Load persisted state
    const savedState =
      localStorage.getItem('globalSummaryCollapsed') ??
      localStorage.getItem('clientSummaryCollapsed');
    if (savedState) {
      setIsCollapsed(savedState === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('globalSummaryCollapsed', String(newState));
  };

  const fetchStats = useCallback(async () => {
    try {
      const data = await getGlobalActivitySummary({
        companyId: companyIdParam || null,
      });
      if (data) {
        setStats(data);
        setError(false);
      } else {
        // Handle case where user is not client or other error
        setError(true); 
      }
    } catch (err) {
      console.error("Failed to fetch activity summary", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [companyIdParam]);

  useEffect(() => {
    fetchStats();

    // Listen for real-time updates via the existing event system
    const handleUpdate = () => {
      fetchStats();
    };

    window.addEventListener("notification-update", handleUpdate);
    
    // Fallback polling
    const interval = setInterval(fetchStats, 60000);

    return () => {
      window.removeEventListener("notification-update", handleUpdate);
      clearInterval(interval);
    };
  }, [fetchStats]);

  const handleNavigation = (filterType: string, value: string) => {
    // Construct query params based on filter, preserving other params if needed
    // or replacing them for clear filtering behavior.
    // For this use case, we want to replace the current filter with the new one.
    const params = new URLSearchParams(searchParams.toString());
    
    // Check if the filter is already active to toggle it off
    const currentStatus = params.get('status');
    const currentPriority = params.get('priority');
    
    // Clear conflicting filters if switching types, or just set the new one?
    // If I click "Vencido", I probably want to clear "status=PENDING".
    // So let's clear main filters first.
    params.delete('status');
    params.delete('priority');
    
    // If clicking the same filter that is already active, we just cleared it above, so it effectively toggles off.
    // If it's a different filter, we set it now.
    
    let isTogglingOff = false;
    if (filterType === 'status' && currentStatus === value) {
        isTogglingOff = true;
    } else if (filterType === 'priority' && currentPriority === value) {
        isTogglingOff = true;
    }

    if (!isTogglingOff) {
        if (filterType === 'status') {
          params.set('status', value);
        } else if (filterType === 'priority') {
          params.set('priority', value);
        }
    }
    
    router.push(`/activities?${params.toString()}`);
  };

  if (error) return null; // Don't show if not applicable or error

  if (loading) {
    return <SummarySkeleton />;
  }

  if (!stats) return null;

  const totalActivities = 
    stats.status.approved + 
    stats.status.inReview + 
    stats.status.pending + 
    stats.status.rejected;

  if (isCollapsed) {
    return (
      <aside className="hidden xl:flex h-full w-14 flex-col border-l border-border/50 bg-slate-50/80 backdrop-blur-md shadow-inner relative z-50 transition-all duration-300 ease-in-out">
        <ToggleButton 
          isCollapsed={true} 
          onToggle={toggleCollapse} 
          side="left"
          className="absolute -left-6 top-6 z-[9999]" 
        />
        
        {/* Visual indicators for collapsed state */}
        <div className="flex flex-col gap-6 items-center w-full px-2 pt-20 overflow-y-auto custom-scrollbar no-scrollbar">
           <div className="group relative flex items-center justify-center">
             <div className="w-3 h-3 rounded-full bg-[#22c55e] shadow-md ring-2 ring-white/50" />
             <span className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[70] pointer-events-none shadow-xl">
               Aprobadas: {stats.status.approved}
             </span>
           </div>
           
           <div className="group relative flex items-center justify-center">
             <div className="w-3 h-3 rounded-full bg-[#f59e0b] shadow-md ring-2 ring-white/50" />
             <span className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[70] pointer-events-none shadow-xl">
               Pendientes: {stats.status.pending}
             </span>
           </div>
           
           <div className="group relative flex items-center justify-center">
             <div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-md ring-2 ring-white/50" />
             <span className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[70] pointer-events-none shadow-xl">
               En Revisión: {stats.status.inReview}
             </span>
           </div>
           
           <div className="group relative flex items-center justify-center">
             <div className="w-3 h-3 rounded-full bg-[#ef4444] shadow-md ring-2 ring-white/50" />
             <span className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[70] pointer-events-none shadow-xl">
               Rechazadas: {stats.status.rejected}
             </span>
           </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden xl:flex w-80 flex-col border-l border-border/50 bg-slate-50/30 backdrop-blur-sm relative h-full transition-all duration-300 ease-in-out z-40">
      
      {/* Toggle Button */}
      <ToggleButton 
        isCollapsed={false} 
        onToggle={toggleCollapse} 
        side="left"
        className="absolute -left-6 top-6 z-[9999]" 
      />

      {/* Scrollable Content Container */}
      <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 pl-4">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent">
            Resumen Global
          </h2>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            {totalActivities} Actividades
          </span>
        </div>

        {/* Section 1: Estados (Status) */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium ml-1 mb-2">
            Estado Actual
          </h3>
          
          <StatusCard 
            label="Aprobadas" 
            count={stats.status.approved}
            color="success"
            icon={CheckCircle2}
            onClick={() => handleNavigation('status', 'APPROVED')}
            isActive={searchParams.get('status') === 'APPROVED'}
          />
          
          <StatusCard 
            label="Pendientes" 
            count={stats.status.pending}
            color="warning"
            icon={Clock}
            onClick={() => handleNavigation('status', 'PENDING')}
            isActive={searchParams.get('status') === 'PENDING'}
          />

          <StatusCard 
            label="En Revisión" 
            count={stats.status.inReview}
            color="info"
            icon={FileText}
            isLoading={false} 
            onClick={() => handleNavigation('status', 'IN_REVIEW')}
            isActive={searchParams.get('status') === 'IN_REVIEW'}
          />

          <StatusCard 
            label="Rechazadas" 
            count={stats.status.rejected}
            color="danger"
            icon={XCircle}
            onClick={() => handleNavigation('status', 'REJECTED')}
            isActive={searchParams.get('status') === 'REJECTED'}
          />
        </div>

        {/* Section 2: Prioridades (Chronological) */}
        <div className="space-y-3 mt-2">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium ml-1 mb-2">
            Prioridad y Vencimientos
          </h3>

          <PriorityCard 
            label="Vencidos"
            count={stats.priority.overdue}
            type="overdue"
            onClick={() => handleNavigation('priority', 'Vencido')}
            isActive={searchParams.get('priority') === 'Vencido'}
          />

          <PriorityCard 
            label="Por Vencer"
            count={stats.priority.dueSoon}
            type="due-soon"
            onClick={() => handleNavigation('priority', 'Por vencer')}
            isActive={searchParams.get('priority') === 'Por vencer'}
          />

          <PriorityCard 
            label="Cumplido"
            count={stats.priority.completed}
            type="completed"
            onClick={() => handleNavigation('priority', 'Cumplido')}
            isActive={searchParams.get('priority') === 'Cumplido'}
          />
        </div>
      </div>
    </aside>
  );
}

// --- Subcomponents ---

interface StatusCardProps {
  label: string;
  count: number;
  color: 'success' | 'warning' | 'info' | 'danger';
  icon: any;
  isLoading?: boolean;
  onClick: () => void;
  isActive?: boolean;
}

function StatusCard({ label, count, color, icon: Icon, isLoading, onClick, isActive }: StatusCardProps) {
  // Matching colors from dashboard charts:
  // Approved: #22c55e (green-500) / Emerald
  // Pending: #f59e0b (amber-500) - Changed from Teal to match "Pendientes" (Yellow/Orange)
  // In Review: #3b82f6 (blue-500)
  // Rejected: #ef4444 (red-500)
  
  const colorStyles = {
    success: "bg-[#22c55e] text-white shadow-green-200/50 hover:shadow-green-300/60",
    warning: "bg-[#f59e0b] text-white shadow-amber-200/50 hover:shadow-amber-300/60", // Updated to Amber/Orange
    info: "bg-[#3b82f6] text-white shadow-blue-200/50 hover:shadow-blue-300/60",
    danger: "bg-[#ef4444] text-white shadow-red-200/50 hover:shadow-red-300/60",
  };

  const bgStyle = colorStyles[color];

  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative group cursor-pointer overflow-hidden rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] shadow-lg",
        bgStyle,
        isActive && "ring-2 ring-offset-2 ring-slate-400 scale-[1.02]"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className={cn("w-5 h-5", isLoading && "animate-spin")} />
          </div>
          <span className="font-medium text-sm tracking-wide">{label}</span>
        </div>
        
        <span className="text-2xl font-bold font-numeric tabular-nums tracking-tight">
          {count}
        </span>
      </div>
    </div>
  );
}

interface PriorityCardProps {
  label: string;
  count: number;
  type: 'overdue' | 'due-soon' | 'completed';
  onClick: () => void;
  isActive?: boolean;
}

function PriorityCard({ label, count, type, onClick, isActive }: PriorityCardProps) {
  // Matching colors from dashboard priority charts:
  // Overdue (Vencido): Red (#ef4444)
  // Due Soon (Por vencer): Orange/Amber (#f59e0b)
  // Completed (Cumplido): Green (#22c55e) - Changed from Slate to Green
  
  const styles = {
    overdue: "border-l-4 border-l-[#ef4444] bg-red-50/50 hover:bg-red-100/50 text-[#ef4444]",
    'due-soon': "border-l-4 border-l-[#f59e0b] bg-amber-50/50 hover:bg-amber-100/50 text-[#f59e0b]",
    completed: "border-l-4 border-l-[#22c55e] bg-green-50/50 hover:bg-green-100/50 text-[#22c55e]", // Updated to Green
  };

  const icons = {
    overdue: XCircle,
    'due-soon': AlertTriangle,
    completed: CheckCircle2, // or NoIcon
  };

  const Icon = icons[type];

  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-3 rounded-r-lg border border-transparent hover:border-slate-200 transition-all duration-200 cursor-pointer group",
        styles[type],
        isActive && "bg-opacity-100 shadow-md translate-x-1"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 opacity-80 group-hover:scale-110 transition-transform" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      
      {type === 'due-soon' && count > 0 ? (
        <span className="animate-pulse px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/50 text-amber-800">
          {count}
        </span>
      ) : (
        <span className="font-bold text-sm">{count}</span>
      )}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-6 w-full mt-4">
      <div className="h-6 w-1/2 bg-slate-200 rounded animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 w-full bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
