import { Bell, CheckCircle2, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import type { ToolStatus } from '../../types';
import type { NavDestination } from '../../data/family-map';
import { FAMILIES } from '../../data/family-map';
import type { BridgeTool, ExecutionMode } from '../../lib/api';

interface ActiveTask {
  runId: string;
  tool: BridgeTool;
  mode: ExecutionMode;
  status: 'running' | 'success' | 'error' | 'cancelled' | 'inconclusive';
}

interface ActionCenterPageProps {
  lang: 'en' | 'ar';
  activeTasks: ActiveTask[];
  toolStatuses: Record<string, ToolStatus>;
  onNavigate: (dest: NavDestination) => void;
}

export default function ActionCenterPage({ lang, activeTasks, toolStatuses, onNavigate }: ActionCenterPageProps) {
  const runningTasks = activeTasks.filter(t => t.status === 'running');
  const completedTasks = activeTasks.filter(t => t.status !== 'running');
  const warningCount = Object.values(toolStatuses).filter(s => s === 'error' || s === 'inconclusive').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="knoux-hero" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(var(--knoux-violet-rgb),0.06))' }}>
        <div className="knoux-hero-content">
          <div className="flex items-center gap-3 mb-2">
            <Bell size={28} style={{ color: 'var(--knoux-blue)' }} />
            <h1 className="knoux-hero-title" style={{ fontSize: '28px' }}>
              {lang === 'ar' ? 'مركز الإجراءات' : 'Action Center'}
            </h1>
          </div>
          <p className="knoux-hero-subtitle">
            {lang === 'ar'
              ? 'المهام النشطة والتحذيرات والتوصيات والنتائج الحديثة'
              : 'Active tasks, warnings, recommendations, and recent outcomes'}
          </p>
        </div>
      </div>

      {/* Active Tasks */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--knoux-text-secondary)' }}>
          {lang === 'ar' ? 'المهام النشطة' : 'Active Tasks'}
          {runningTasks.length > 0 && (
            <span className="ml-2 knoux-badge knoux-badge-caution">{runningTasks.length}</span>
          )}
        </h2>
        {runningTasks.length > 0 ? (
          <div className="space-y-2">
            {runningTasks.map(task => (
              <div key={task.runId} className="knoux-glass p-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--knoux-text)' }}>
                    {lang === 'ar' ? task.tool.ArabicName : task.tool.EnglishName}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--knoux-text-faint)' }}>
                    {task.mode === 'analyze' ? (lang === 'ar' ? 'تحليل...' : 'Analyzing...') :
                      task.mode === 'preview' ? (lang === 'ar' ? 'معاينة...' : 'Previewing...') :
                        (lang === 'ar' ? 'قيد التشغيل...' : 'Running...')}
                  </div>
                </div>
                <div className="knoux-progress w-24">
                  <div className="knoux-progress-bar knoux-progress-indeterminate" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="knoux-glass p-6 text-center">
            <Clock size={24} className="mx-auto mb-2" style={{ color: 'var(--knoux-text-disabled)' }} />
            <p className="text-sm" style={{ color: 'var(--knoux-text-muted)' }}>
              {lang === 'ar' ? 'لا توجد مهام نشطة' : 'No active tasks'}
            </p>
          </div>
        )}
      </section>

      {/* Needs Attention */}
      {warningCount > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--knoux-text-secondary)' }}>
            <AlertTriangle size={14} className="inline mr-1" style={{ color: 'var(--knoux-warning)' }} />
            {lang === 'ar' ? 'يحتاج الانتباه' : 'Needs Attention'}
          </h2>
          <div className="knoux-glass p-4">
            <p className="text-sm" style={{ color: 'var(--knoux-warning)' }}>
              {warningCount} {lang === 'ar' ? 'أداة واجهت مشكلات' : 'tool(s) encountered issues'}
            </p>
          </div>
        </section>
      )}

      {/* Recommendations */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--knoux-text-secondary)' }}>
          {lang === 'ar' ? 'التوصيات' : 'Recommendations'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FAMILIES.slice(0, 4).map(family => (
            <button
              key={family.id}
              type="button"
              className="knoux-glass p-4 text-left hover:bg-white/[0.03] transition-colors group"
              onClick={() => onNavigate({ family: family.id })}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium" style={{ color: 'var(--knoux-text)' }}>
                    {lang === 'ar' ? family.name.ar : family.name.en}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--knoux-text-faint)' }}>
                    {family.expectedTools} {lang === 'ar' ? 'أداة متاحة' : 'tools available'}
                  </p>
                </div>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--knoux-text-muted)' }} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recently Completed */}
      {completedTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--knoux-text-secondary)' }}>
            {lang === 'ar' ? 'مكتملة حديثاً' : 'Completed Recently'}
          </h2>
          <div className="space-y-2">
            {completedTasks.slice(0, 5).map(task => (
              <div key={task.runId} className="knoux-glass p-3 flex items-center gap-3">
                {task.status === 'success' ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--knoux-success)' }} />
                ) : (
                  <AlertTriangle size={16} style={{ color: 'var(--knoux-danger)' }} />
                )}
                <span className="text-sm flex-1 truncate" style={{ color: 'var(--knoux-text-secondary)' }}>
                  {lang === 'ar' ? task.tool.ArabicName : task.tool.EnglishName}
                </span>
                <span className="text-xs" style={{ color: 'var(--knoux-text-faint)' }}>
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
