import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users2,
  FileText,
  Send,
  RefreshCw,
  AlertCircle,
  Zap,
  Layers,
  Info
} from 'lucide-react';

interface MonthData {
  month: string;
  count: number;
  completed: number;
  lateCount: number;
  avgCompletionDays: number | null;
}

interface ProposalMonthData {
  month: string;
  count: number;
}

interface AnalyticsData {
  summary: {
    total: number;
    completed: number;
    active: number;
    onTimeCount: number;
    lateCount: number;
    onTimeRate: number | null;
    avgCompletionDays: number | null;
  };
  byStep: Array<{
    stepId: string;
    label: string;
    isExternalTeam: boolean;
    avgDays: number | null;
    medianDays: number | null;
    count: number;
  }>;
  byMonth: MonthData[];
  byCategory: Array<{
    category: string;
    label: string;
    total: number;
    completed: number;
    lateCount: number;
  }>;
  proposals: {
    total: number;
    byStatus: Record<string, number>;
    byMonth: ProposalMonthData[];
  };
}

// ----------------------------------------------------------------------
// Helper Skeletons and Components
// ----------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-2xl" />
          <div className="space-y-2">
            <div className="h-6 w-32 bg-muted rounded" />
            <div className="h-3.5 w-48 bg-muted rounded" />
          </div>
        </div>
        <div className="h-10 w-24 bg-muted rounded-xl" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-3xl border-border/50">
            <CardContent className="p-5 space-y-3">
              <div className="w-9 h-9 bg-muted rounded-xl" />
              <div className="h-6 w-16 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insight Strip Skeleton */}
      <div className="h-16 bg-muted/40 rounded-2xl w-full" />

      {/* 2-Column charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-border/50 p-6 space-y-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-40 bg-muted/30 rounded-2xl" />
        </Card>
        <Card className="rounded-3xl border-border/50 p-6 space-y-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-40 bg-muted/30 rounded-2xl" />
        </Card>
      </div>

      {/* Categories & Steps Skeleton */}
      <Card className="rounded-3xl border-border/50 p-6 space-y-4">
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-xl" />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="rounded-3xl border-rose-200 dark:border-rose-900/50 bg-rose-50/5 dark:bg-rose-950/5 p-8 max-w-lg mx-auto text-center shadow-sm">
      <CardContent className="pt-6 space-y-4">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">Failed to Load Analytics</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <button
          type="button"
          aria-label="Retry loading analytics"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Circular Donut Progress Ring
// ----------------------------------------------------------------------
interface OperationalHealthRingProps {
  onTimeRate: number;
  size?: number;
  strokeWidth?: number;
}

function OperationalHealthRing({ onTimeRate, size = 120, strokeWidth = 10 }: OperationalHealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (onTimeRate / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0 animate-fade-in" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted/30 fill-transparent"
          strokeWidth={strokeWidth}
        />
        {/* Active Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`fill-transparent transition-all duration-1000 ease-out ${onTimeRate >= 85
            ? 'stroke-indigo-500 dark:stroke-indigo-400'
            : onTimeRate >= 70
              ? 'stroke-amber-500 dark:stroke-amber-400'
              : 'stroke-rose-500 dark:stroke-rose-400'
            }`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground tracking-tight">{onTimeRate}%</span>
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">SLA Rate</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Responsive Inline SVG Line/Area Chart Component
// ----------------------------------------------------------------------
interface ChartPoint {
  label: string;
  value: number;
  completed?: number;
  lateCount?: number;
  avgCompletionDays?: number | null;
}

function InteractiveLineChart({ data, color = 'indigo' }: { data: ChartPoint[]; color?: 'indigo' | 'emerald' }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hasData = data && data.length > 0 && data.some(d => d.value > 0);

  if (!hasData) {
    return (
      <div className="h-44 flex flex-col items-center justify-center text-muted-foreground/60 text-xs border border-dashed border-border/80 rounded-3xl bg-muted/5 p-4">
        <Info size={20} className="mb-2 text-muted-foreground/40" />
        No historical records for this period
      </div>
    );
  }

  const width = 600;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
    const y = paddingTop + (1 - d.value / maxVal) * chartHeight;
    return {
      x,
      y,
      label: d.label,
      value: d.value,
      completed: d.completed,
      lateCount: d.lateCount,
      avgCompletionDays: d.avgCompletionDays
    };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  const colorMap = {
    indigo: {
      stroke: 'stroke-indigo-500 dark:stroke-indigo-400',
      fill: 'url(#gradient-indigo)',
      dot: 'fill-indigo-500 dark:fill-indigo-400',
      glow: 'shadow-indigo-500/20'
    },
    emerald: {
      stroke: 'stroke-emerald-500 dark:stroke-emerald-400',
      fill: 'url(#gradient-emerald)',
      dot: 'fill-emerald-500 dark:fill-emerald-400',
      glow: 'shadow-emerald-500/20'
    }
  };

  const selectedColor = colorMap[color] || colorMap.indigo;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none" role="img" aria-label="12-month Trend Chart">
        <defs>
          <linearGradient id="gradient-indigo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="gradient-emerald" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio, index) => {
          const y = paddingTop + ratio * chartHeight;
          const labelVal = Math.round(maxVal * (1 - ratio));
          return (
            <g key={index} className="opacity-50">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                className="stroke-border/80"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                className="text-[9px] font-bold fill-muted-foreground/80 text-right"
                textAnchor="end"
              >
                {labelVal}
              </text>
            </g>
          );
        })}

        {/* Filled Area */}
        <path d={areaPath} fill={selectedColor.fill} className="transition-all duration-300" />

        {/* Chart Line */}
        <path
          d={linePath}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${selectedColor.stroke} transition-all duration-300`}
        />

        {/* Highlight points on hover */}
        {points.map((p, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <g key={i} className="transition-all duration-200">
              {isHovered && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={7}
                  className="fill-primary/10 dark:fill-primary/20 animate-ping"
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 4.5 : 3}
                className={`${selectedColor.dot} stroke-background`}
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* X Axis Labels */}
        {points.map((p, i) => {
          const showLabel = i % 2 === 0 || i === points.length - 1;
          if (!showLabel) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={height - 8}
              className={`text-[9px] font-bold fill-muted-foreground/60 transition-all ${hoveredIndex === i ? 'fill-foreground font-black' : ''
                }`}
              textAnchor="middle"
            >
              {p.label}
            </text>
          );
        })}

        {/* Interactive Hover Columns */}
        {points.map((p, i) => {
          const colWidth = chartWidth / (data.length - 1);
          const startX = p.x - colWidth / 2;
          return (
            <rect
              key={i}
              x={startX}
              y={paddingTop}
              width={colWidth}
              height={chartHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
      </svg>

      {/* Interactive Tooltip popup */}
      {hoveredIndex !== null && (
        <div
          className="absolute z-30 bg-popover/95 backdrop-blur-md border border-border/50 px-3 py-2 rounded-2xl shadow-xl pointer-events-none transition-all duration-150 flex flex-col gap-1 text-left min-w-[130px] border-indigo-500/20 text-foreground"
          style={{
            left: `${(points[hoveredIndex].x / width) * 100}%`,
            top: `${(points[hoveredIndex].y / height) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <div className="text-[10px] font-black text-foreground border-b border-border/40 pb-1 text-center">
            {points[hoveredIndex].label}
          </div>
          <div className="flex justify-between gap-4 text-[9px] leading-none">
            <span className="text-muted-foreground/80 font-bold">Created:</span>
            <span className="font-extrabold">{points[hoveredIndex].value}</span>
          </div>
          {points[hoveredIndex].completed !== undefined && (
            <div className="flex justify-between gap-4 text-[9px] leading-none">
              <span className="text-muted-foreground/80 font-bold">Completed:</span>
              <span className="font-extrabold text-emerald-500">{points[hoveredIndex].completed}</span>
            </div>
          )}
          {points[hoveredIndex].lateCount !== undefined && points[hoveredIndex].lateCount > 0 && (
            <div className="flex justify-between gap-4 text-[9px] leading-none">
              <span className="text-muted-foreground/80 font-bold">Late:</span>
              <span className="font-extrabold text-rose-500">{points[hoveredIndex].lateCount}</span>
            </div>
          )}
          {points[hoveredIndex].avgCompletionDays !== undefined && points[hoveredIndex].avgCompletionDays !== null && (
            <div className="flex justify-between gap-4 text-[9px] border-t border-border/30 pt-1 mt-1 leading-none">
              <span className="text-muted-foreground/80 font-bold">Avg Time:</span>
              <span className="font-extrabold text-indigo-500">{points[hoveredIndex].avgCompletionDays}d</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Modern KPI Card with comparison trends
// ----------------------------------------------------------------------
interface StatCardProps {
  label: string;
  value: string | number;
  subText?: string;
  icon: React.ElementType;
  accentClass: string;
  trendText?: string;
  trendStatus?: 'up' | 'down' | 'neutral';
}

function StatCard({
  label,
  value,
  subText,
  icon: Icon,
  accentClass,
  trendText,
  trendStatus = 'neutral',
}: StatCardProps) {
  return (
    <Card className="rounded-3xl border-border/50 shadow-sm hover:shadow-md hover:border-indigo-500/20 transition-all duration-300 relative overflow-hidden group">
      {/* Decorative gradient corner indicator */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-bl-full pointer-events-none" />

      <CardContent className="p-5 flex flex-col h-full justify-between gap-3">
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentClass} group-hover:scale-105 transition-transform duration-300`}>
            <Icon size={18} />
          </div>
          {trendText && (
            <Badge
              variant="outline"
              className={`text-[9px] font-bold rounded-full px-2 py-0.5 border-none flex items-center gap-1 ${trendStatus === 'up'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : trendStatus === 'down'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  : 'bg-muted text-muted-foreground'
                }`}
            >
              {trendStatus === 'up' ? (
                <TrendingUp size={10} className="stroke-[3px]" />
              ) : trendStatus === 'down' ? (
                <TrendingDown size={10} className="stroke-[3px]" />
              ) : null}
              {trendText}
            </Badge>
          )}
        </div>

        <div>
          <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
          {subText && <p className="text-xs text-muted-foreground font-medium mt-0.5">{subText}</p>}
        </div>

        <div className="border-t border-border/30 pt-2 mt-1">
          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block">
            {label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Main AnalyticsView Redesign Component
// ----------------------------------------------------------------------

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonData = await response.json();
      setData(jsonData);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: unknown) {
      console.error('[Analytics Load Error]:', err);
      setError(err instanceof Error ? err.message : 'Failed to establish connection with server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => loadData()} />;
  }

  if (!data) return null;

  const { summary, byStep, byMonth, byCategory, proposals } = data;

  // Merge legacy 'rejected' counts into 'queried' for display
  const mergedByStatus = proposals
    ? {
      ...proposals.byStatus,
      queried: (proposals.byStatus['queried'] ?? 0) + (proposals.byStatus['rejected'] ?? 0),
      rejected: undefined,
    }
    : {};

  // Color mappings
  const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; colour: string }> = {
    draft: { label: 'Draft', colour: 'bg-slate-400' },
    pending_approval: { label: 'Pending Approval', colour: 'bg-amber-500' },
    approved: { label: 'Approved', colour: 'bg-indigo-500' },
    sent: { label: 'Sent to Client', colour: 'bg-emerald-500' },
    queried: { label: 'Queried', colour: 'bg-yellow-400' },
    declined: { label: 'Declined', colour: 'bg-rose-500' },
  };

  const CATEGORY_COLOURS: Record<string, string> = {
    device_management: 'bg-indigo-500',
    tech_product: 'bg-sky-500',
    sales: 'bg-emerald-500',
    training: 'bg-amber-500',
  };

  // Derive trends from last two monthly buckets
  const prevMonth = byMonth && byMonth.length >= 2 ? byMonth[byMonth.length - 2] : null;
  const currMonth = byMonth && byMonth.length >= 1 ? byMonth[byMonth.length - 1] : null;

  // 1. Total Workload Trend
  let workloadTrendText = "";
  let workloadTrendStatus: 'up' | 'down' | 'neutral' = 'neutral';
  if (prevMonth && currMonth) {
    const diff = currMonth.count - prevMonth.count;
    if (prevMonth.count > 0) {
      const pct = Math.round((diff / prevMonth.count) * 100);
      workloadTrendStatus = pct >= 0 ? 'up' : 'down';
      workloadTrendText = `${pct >= 0 ? '+' : ''}${pct}%`;
    } else if (diff > 0) {
      workloadTrendStatus = 'up';
      workloadTrendText = `+${diff}`;
    }
  }

  // 2. Completion rate trend
  let completionTrendText = "";
  let completionTrendStatus: 'up' | 'down' | 'neutral' = 'neutral';
  if (prevMonth && currMonth) {
    const currRate = currMonth.count > 0 ? (currMonth.completed / currMonth.count) * 100 : 0;
    const prevRate = prevMonth.count > 0 ? (prevMonth.completed / prevMonth.count) * 100 : 0;
    const diff = Math.round((currRate - prevRate) * 10) / 10;
    if (diff !== 0) {
      completionTrendStatus = diff > 0 ? 'up' : 'down';
      completionTrendText = `${diff > 0 ? '+' : ''}${diff}%`;
    } else {
      completionTrendText = "0%";
    }
  }

  // 3. SLA On-time rate trend
  let slaTrendText = "";
  let slaTrendStatus: 'up' | 'down' | 'neutral' = 'neutral';
  if (prevMonth && currMonth) {
    const currSla = currMonth.completed > 0 ? ((currMonth.completed - currMonth.lateCount) / currMonth.completed) * 100 : null;
    const prevSla = prevMonth.completed > 0 ? ((prevMonth.completed - prevMonth.lateCount) / prevMonth.completed) * 100 : null;
    if (currSla !== null && prevSla !== null) {
      const diff = Math.round((currSla - prevSla) * 10) / 10;
      if (diff !== 0) {
        slaTrendStatus = diff > 0 ? 'up' : 'down';
        slaTrendText = `${diff > 0 ? '+' : ''}${diff}%`;
      } else {
        slaTrendText = "0%";
      }
    }
  }

  // 4. Average completion days trend (Note: lower is better!)
  let avgDaysTrendText = "";
  let avgDaysTrendStatus: 'up' | 'down' | 'neutral' = 'neutral'; // 'up' = improved (faster), 'down' = worse (slower)
  if (prevMonth && currMonth) {
    const currDays = currMonth.avgCompletionDays;
    const prevDays = prevMonth.avgCompletionDays;
    if (currDays !== null && prevDays !== null) {
      const diff = Math.round((currDays - prevDays) * 10) / 10;
      if (diff < 0) {
        avgDaysTrendStatus = 'up';
        avgDaysTrendText = `-${Math.abs(diff)}d`;
      } else if (diff > 0) {
        avgDaysTrendStatus = 'down';
        avgDaysTrendText = `+${diff}d`;
      } else {
        avgDaysTrendText = "0d";
      }
    }
  }

  // 5. Primary Bottleneck Identification (exclude external teams)
  const internalSteps = byStep.filter(s => !s.isExternalTeam && s.avgDays !== null);
  const primaryBottleneck = internalSteps.length > 0
    ? internalSteps.reduce((max, s) => ((s.avgDays ?? 0) > (max.avgDays ?? 0) ? s : max), internalSteps[0])
    : null;

  // 6. Proposal metrics
  const proposalsTotal = proposals?.total ?? 0;
  const proposalApprovalRate = proposalsTotal > 0
    ? Math.round(((proposals.byStatus['approved'] ?? 0) + (proposals.byStatus['sent'] ?? 0)) / proposalsTotal * 100)
    : 0;

  // Stacked bar values
  const statusDistribution = Object.entries(PROPOSAL_STATUS_CONFIG).map(([status, cfg]) => {
    const count = mergedByStatus[status] ?? 0;
    const pct = proposalsTotal > 0 ? (count / proposalsTotal) * 100 : 0;
    return { status, label: cfg.label, colour: cfg.colour, count, pct };
  });

  return (
    <motion.div
      key="analytics"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="analytics-dashboard max-w-6xl mx-auto space-y-6 pb-12"
    >
      {/* Dynamic Header Hero Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-indigo-500/10 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
            <BarChart2 size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Performance Intelligence</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">All-time Scope</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>{summary.total} total orders tracked</span>
              {lastUpdated && (
                <>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <Badge variant="outline" className="text-[9px] font-bold py-0 h-4 border-indigo-500/10 bg-indigo-500/[0.02] text-indigo-600 dark:text-indigo-400 rounded-md">
                    Synced: {lastUpdated}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Refresh analytics data"
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-border bg-card hover:bg-muted/30 text-foreground font-bold text-xs rounded-xl shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer animate-fade-in"
        >
          <RefreshCw size={12} className={`${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Workload"
          value={summary.total}
          subText={`${summary.active} active in progress`}
          icon={Layers}
          accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          trendText={workloadTrendText || undefined}
          trendStatus={workloadTrendStatus}
        />

        <StatCard
          label="Completion Rate"
          value={summary.total > 0 ? `${Math.round((summary.completed / summary.total) * 100)}%` : '—'}
          subText={`${summary.completed} of ${summary.total} completed`}
          icon={CheckCircle2}
          accentClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          trendText={completionTrendText || undefined}
          trendStatus={completionTrendStatus}
        />

        <StatCard
          label="SLA On-Time Rate"
          value={summary.onTimeRate !== null ? `${summary.onTimeRate}%` : '—'}
          subText={`${summary.onTimeCount} on-time · ${summary.lateCount} late`}
          icon={summary.onTimeRate === null || summary.onTimeRate >= 80 ? CheckCircle2 : AlertTriangle}
          accentClass={
            summary.onTimeRate === null || summary.onTimeRate >= 80
              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }
          trendText={slaTrendText || undefined}
          trendStatus={slaTrendStatus}
        />

        <StatCard
          label="Avg Completion Time"
          value={summary.avgCompletionDays !== null ? `${summary.avgCompletionDays}d` : '—'}
          subText="average business days"
          icon={Clock}
          accentClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          trendText={avgDaysTrendText || undefined}
          trendStatus={avgDaysTrendStatus}
        />
      </div>

      {/* Executive Insight Strip */}
      <Card className="rounded-3xl border-border/50 shadow-sm bg-gradient-to-r from-indigo-500/[0.02] to-transparent overflow-hidden">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40 gap-4 md:gap-0">

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Zap size={14} className="fill-indigo-600/10" />
            </div>
            <div>
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block">Recent Momentum</span>
              <span className="text-xs font-bold text-foreground">
                {currMonth ? `${currMonth.count} new orders created this month` : 'No order momentum'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:pl-6 pt-4 md:pt-0">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <AlertTriangle size={14} />
            </div>
            <div>
              <span className="text-[9px] font-bold text-rose-500/70 uppercase tracking-widest block font-extrabold">Primary Bottleneck</span>
              <span className="text-xs font-bold text-foreground truncate max-w-[200px] block">
                {primaryBottleneck ? `"${primaryBottleneck.label}" (${primaryBottleneck.avgDays}d avg)` : 'No active bottleneck'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:pl-6 pt-4 md:pt-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileText size={14} />
            </div>
            <div>
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest block">Proposals Pipeline</span>
              <span className="text-xs font-bold text-foreground">
                {proposalApprovalRate}% approval rate · {proposals?.total || 0} total
              </span>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Primary Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Order volume SVG trend chart */}
        <Card className="rounded-3xl border-border/50 shadow-sm lg:col-span-2 flex flex-col justify-between p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">12-Month Order Volume</h3>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Historical order count trend</p>
            </div>
            {currMonth && prevMonth && (
              <Badge variant="outline" className="text-[9px] font-bold border-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                Latest: {currMonth.count} vs Prev: {prevMonth.count}
              </Badge>
            )}
          </div>
          <InteractiveLineChart
            data={byMonth.map(m => ({
              label: m.month,
              value: m.count,
              completed: m.completed,
              lateCount: m.lateCount,
              avgCompletionDays: m.avgCompletionDays
            }))}
            color="indigo"
          />
        </Card>

        {/* Operational Health Circular Visualization */}
        <Card className="rounded-3xl border-border/50 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Operational SLA Health</h3>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">SLA completion breakdown</p>
          </div>

          <div className="flex items-center justify-center py-4">
            <OperationalHealthRing onTimeRate={summary.onTimeRate ?? 0} size={130} strokeWidth={11} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 bg-muted/20 p-3 rounded-2xl border border-border/20">
            <div className="text-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase block">On-Time</span>
              <span className="text-base font-black text-emerald-500">{summary.onTimeCount}</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase block">Late</span>
              <span className="text-base font-black text-rose-500">{summary.lateCount}</span>
            </div>
            <div className="text-center border-t border-border/30 pt-1.5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase block">Completed</span>
              <span className="text-xs font-bold text-foreground">{summary.completed}</span>
            </div>
            <div className="text-center border-t border-border/30 pt-1.5">
              <span className="text-[9px] font-bold text-muted-foreground uppercase block">Active</span>
              <span className="text-xs font-bold text-foreground">{summary.active}</span>
            </div>
          </div>
        </Card>

      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Category Performance panel */}
        <Card className="rounded-3xl border-border/50 shadow-sm p-6 flex flex-col justify-between lg:col-span-1">
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Category Breakdown</h3>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Volume, Share & SLA by Category</p>
          </div>

          <div className="space-y-4">
            {byCategory.map(cat => {
              const pct = summary.total > 0 ? Math.round((cat.total / summary.total) * 100) : 0;
              const onTimePct = cat.completed > 0 ? Math.round(((cat.completed - cat.lateCount) / cat.completed) * 100) : null;
              return (
                <div key={cat.category} className="p-3.5 rounded-2xl bg-muted/20 border border-border/30 hover:border-indigo-500/20 transition-all flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate max-w-[130px]">{cat.label}</span>
                      <span className={`w-2 h-2 rounded-full ${CATEGORY_COLOURS[cat.category] || 'bg-slate-400'}`} />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">{pct}% share</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-background/50 py-1.5 px-3 rounded-xl border border-border/20">
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-medium">Total</span>
                      <span className="text-xs font-black text-foreground">{cat.total}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-rose-400 block font-medium">Late</span>
                      <span className="text-xs font-black text-rose-500">{cat.lateCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-medium">SLA</span>
                      <span className={`text-xs font-black ${onTimePct === null ? 'text-muted-foreground/40' : onTimePct >= 80 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {onTimePct !== null ? `${onTimePct}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Workflow steps ranked list */}
        <Card className="rounded-3xl border-border/50 shadow-sm p-6 lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Step Performance Ranking</h3>
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              Steps sorted from slowest to fastest average time spent
            </p>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {byStep.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 text-center py-8">No workflow step history recorded.</p>
            ) : (
              [...byStep]
                .sort((a, b) => {
                  if (a.avgDays === null) return 1;
                  if (b.avgDays === null) return -1;
                  return b.avgDays - a.avgDays;
                })
                .map((step, idx) => {
                  const isPrimary = primaryBottleneck && step.stepId === primaryBottleneck.stepId;
                  return (
                    <div
                      key={step.stepId}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all duration-300 ${isPrimary
                        ? 'border-rose-300 dark:border-rose-900/60 bg-rose-500/[0.03] shadow-sm'
                        : 'border-border/30 hover:border-indigo-500/20 bg-muted/10'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg ${isPrimary
                          ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-muted text-muted-foreground'
                          }`}>
                          #{idx + 1}
                        </span>

                        <div className="truncate min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold text-foreground truncate ${isPrimary ? 'text-rose-600 dark:text-rose-400 font-extrabold' : ''}`}>
                              {step.label}
                            </span>
                            {step.isExternalTeam && (
                              <Badge
                                variant="outline"
                                className="text-[8px] font-bold border-sky-300/40 text-sky-500 bg-sky-500/[0.04] rounded-full px-1.5 py-0 h-3.5"
                              >
                                External
                              </Badge>
                            )}
                            {isPrimary && (
                              <Badge
                                variant="outline"
                                className="text-[8px] font-extrabold border-rose-300 text-rose-500 bg-rose-500/[0.05] rounded-full px-1.5 py-0 h-3.5 uppercase tracking-wide animate-pulse"
                              >
                                Bottleneck
                              </Badge>
                            )}
                          </div>
                          <span className="text-[9px] text-muted-foreground/80 font-medium">
                            Based on {step.count} {step.count === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
                        {step.medianDays !== null && (
                          <div>
                            <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest block font-bold">Median</span>
                            <span className="text-xs font-bold text-foreground">{step.medianDays}d</span>
                          </div>
                        )}

                        <div className="text-right">
                          <span className="text-[8px] text-muted-foreground/60 uppercase tracking-widest block font-bold">Average</span>
                          {step.avgDays !== null ? (
                            <span className={`text-sm font-black ${isPrimary ? 'text-rose-500' : 'text-indigo-500 dark:text-indigo-400'}`}>
                              {step.avgDays} days
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground/40">No Data</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </Card>

      </div>

      {/* Proposals pipeline section */}
      {proposals && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-indigo-500/10 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
              <FileText size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-foreground">Proposals Pipeline</h3>
              <p className="text-xs text-muted-foreground">Proposal status distribution and creation volumes</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Proposals"
              value={proposals.total}
              icon={FileText}
              accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            />

            <StatCard
              label="Sent to Client"
              value={proposals.byStatus['sent'] ?? 0}
              icon={Send}
              accentClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            />

            <StatCard
              label="Approval Rate"
              value={proposals.total > 0 ? `${proposalApprovalRate}%` : '—'}
              subText="approved or active client proposals"
              icon={CheckCircle2}
              accentClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />

            <StatCard
              label="Pending Decision"
              value={(proposals.byStatus['pending_approval'] ?? 0) + (mergedByStatus['queried'] ?? 0)}
              subText={`${mergedByStatus['queried'] ?? 0} queried · ${proposals.byStatus['declined'] ?? 0} declined`}
              icon={Clock}
              accentClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Status stacked bar */}
            <Card className="rounded-3xl border-border/50 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Status Distribution</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">
                  Pipeline distribution of proposals
                </p>
              </div>

              <div className="space-y-4 my-auto">
                {/* Stacked Bar Visual */}
                <div className="w-full bg-muted/40 rounded-full overflow-hidden h-3.5 flex border border-border/10">
                  {statusDistribution.map(seg => {
                    if (seg.pct === 0) return null;
                    return (
                      <div
                        key={seg.status}
                        className={`${seg.colour} h-full transition-all duration-500`}
                        style={{ width: `${seg.pct}%` }}
                        title={`${seg.label}: ${seg.count} (${Math.round(seg.pct)}%)`}
                      />
                    );
                  })}
                </div>

                {/* Status Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 border-t border-border/30 pt-4">
                  {statusDistribution.map(seg => (
                    <div key={seg.status} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted/30 transition-all">
                      <span className={`w-2.5 h-2.5 rounded-full ${seg.colour} shrink-0`} />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-muted-foreground block truncate">{seg.label}</span>
                        <span className="text-xs font-black text-foreground">{seg.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Proposal 12-month Trend */}
            <Card className="rounded-3xl border-border/50 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Proposal Velocity</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">
                  12-Month creation counts
                </p>
              </div>
              <InteractiveLineChart
                data={proposals.byMonth.map(m => ({ label: m.month, value: m.count }))}
                color="indigo"
              />
            </Card>

          </div>
        </div>
      )}
    </motion.div>
  );
}
