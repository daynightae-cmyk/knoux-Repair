import { Bell, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { ToolStatus } from '../../types';
import { FAMILIES } from '../../data/family-map';
import type { NavDestination } from '../../data/family-map';
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
  tools: BridgeTool[];
  onNavigate: (dest: NavDestination) => void;
}

function destinationForTool(tool: BridgeTool): NavDestination | null {
  for (const family of FAMILIES) {
    const service = family.services.find(candidate => candidate.id === tool.Category);
    if (service) return { family: family.id, service: service.id, toolId: tool.ToolId };
  }
  return null;
}

export default function ActionCenterPage({ lang, activeTasks, toolStatuses, tools, onNavigate }: ActionCenterPageProps) {
  const runningTasks = activeTasks.filter(t => t.status === 'running');
  const completedTasks = activeTasks.filter(t => t.status !== 'running');
  const attentionEntries = Object.entries(toolStatuses).filter(([, status]) => status === 'error' || status === 'inconclusive');
  const warningCount = attentionEntries.length;

  return (
    <div className="space-y-6">
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

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--knoux-text-secondary)' }}>
          {lang === 'ar' ? 'المهام النشطة' : 'Active Tasks'}
          {runningTasks.length > 0 && <span className="ml-2 knoux-badge knoux-badge-caution">{runningTasks.length}</span>}
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
                <div className="knoux-progress w-24" aria-label={lang === 'ar' ? 'قيد التشغيل' : 'Running'}>
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

      {warningCount > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--knoux-text-secondary)' }}>
            <AlertTriangle size={14} className="inline mr-1" style={{ color: 'var(--knoux-warning)' }} />
            {lang === 'ar' ? 'يحتاج الانتباه' : 'Needs Attention'}
          </h2>
          <div className="knoux-glass p-4">
            <p className="text-sm" style={{ color: 'var(--knoux-warning)' }}>
              {warningCount} {lang === 'ar' ? 'إجراء يحتاج مراجعة' : warningCount === 1 ? 'action needs review' : 'actions need review'}
            </p>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--knoux-text-secondary)' }}>
          {lang === 'ar' ? 'التوصيات والإجراءات المقترحة' : 'Recommendations & Actions'}
        </h2>
        {warningCount > 0 ? (
          <div className="space-y-2">
            {attentionEntries.map(([toolId, status]) => {
              const tool = tools.find(candidate => candidate.ToolId === toolId) ?? null;
              const destination = tool ? destinationForTool(tool) : null;
              return (
                <div key={toolId} className="knoux-glass p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-amber-300 truncate">
                      {tool
                        ? (lang === 'ar' ? tool.ArabicName : tool.EnglishName)
                        : (lang === 'ar' ? 'إجراء سابق يحتاج مراجعة' : 'A previous action needs review')}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {lang === 'ar' ? `الحالة السابقة: ${status}` : `Prior run status: ${status}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!destination}
                    onClick={() => { if (destination) onNavigate(destination); }}
                    className="knoux-btn knoux-btn-secondary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {destination
                      ? (lang === 'ar' ? 'فتح الإجراء' : 'Open Action')
                      : (lang === 'ar' ? 'غير متاح' : 'Unavailable')}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="knoux-glass p-6 text-center">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400/60" />
            <p className="text-sm font-medium" style={{ color: 'var(--knoux-text-muted)' }}>
              {lang === 'ar' ? 'لا توجد توصيات معلقة حالياً' : 'No recommendations yet'}
            </p>
            <p className="text-xs mt-1 text-slate-500">
              {lang === 'ar'
                ? 'شغّل الفحص الذكي أو أدوات التشخيص لإنشاء توصيات مبنية على أدلة حقيقية.'
                : 'Run the intelligent scan or diagnostics to generate evidence-backed recommendations.'}
            </p>
          </div>
        )}
      </section>

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
                  <AlertTriangle size={16} style={{ color: task.status === 'cancelled' ? 'var(--knoux-text-muted)' : 'var(--knoux-danger)' }} />
                )}
                <span className="text-sm flex-1 truncate" style={{ color: 'var(--knoux-text-secondary)' }}>
                  {lang === 'ar' ? task.tool.ArabicName : task.tool.EnglishName}
                </span>
                <span className="text-xs uppercase" style={{ color: 'var(--knoux-text-faint)' }}>{task.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
