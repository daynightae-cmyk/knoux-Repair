import { useState, useMemo } from 'react';
import {
  Lock,
  Play,
  Search,
  Terminal,
  X,
} from 'lucide-react';
import type { ActiveSection, ToolStatus } from '../types';
import type { BridgeTool, ExecutionMode, ToolRunOptions } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { CATEGORIES } from '../data/categories';
import ExecutionConfirmDialog from './ExecutionConfirmDialog';

interface AllToolsCatalogProps {
  tools: BridgeTool[];
  toolStatuses: Record<string, ToolStatus>;
  lang: Lang;
  bridgeElevated: boolean;
  onRunTool: (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions) => void;
  onCancelTool: () => void;
  onOpenSection: (section: ActiveSection) => void;
}

export default function AllToolsCatalog({
  tools,
  lang,
  bridgeElevated,
  onRunTool,
}: AllToolsCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [adminOnly, setAdminOnly] = useState<boolean>(false);
  const [confirmTool, setConfirmTool] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);

  // Category ID to metadata lookup
  const categoryMap = useMemo(() => {
    const map: Record<string, (typeof CATEGORIES)[number]> = {};
    for (const cat of CATEGORIES) {
      map[cat.id] = cat;
    }
    return map;
  }, []);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      // Category filter
      if (selectedCategory !== 'all' && tool.Category !== selectedCategory) {
        return false;
      }
      // Risk filter
      if (selectedRisk !== 'all' && tool.RiskLevel !== selectedRisk) {
        return false;
      }
      // Admin filter
      if (adminOnly && !tool.RequiresAdmin) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = tool.EnglishName.toLowerCase().includes(q) || tool.ArabicName.includes(q);
        const matchesId = tool.ToolId.toLowerCase().includes(q);
        const matchesPurpose = tool.Purpose.toLowerCase().includes(q);
        return matchesName || matchesId || matchesPurpose;
      }
      return true;
    });
  }, [tools, selectedCategory, selectedRisk, adminOnly, searchQuery]);

  const handleExecuteClick = (tool: BridgeTool, mode: ExecutionMode) => {
    if (tool.RequiresConfirmation) {
      setConfirmTool({ tool, mode });
    } else {
      onRunTool(tool, mode);
    }
  };

  const getRiskBadge = (risk: BridgeTool['RiskLevel']) => {
    switch (risk) {
      case 'READ_ONLY':
        return {
          label: lang === 'ar' ? 'للقراءة فقط' : 'READ ONLY',
          classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      case 'SAFE_CLEANUP':
        return {
          label: lang === 'ar' ? 'تنظيف آمن' : 'SAFE CLEANUP',
          classes: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        };
      case 'SYSTEM_REPAIR':
        return {
          label: lang === 'ar' ? 'إصلاح نظام' : 'SYSTEM REPAIR',
          classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        };
      case 'REBOOT_REQUIRED':
        return {
          label: lang === 'ar' ? 'يتطلب إعادة تشغيل' : 'REBOOT REQUIRED',
          classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'DESTRUCTIVE':
        return {
          label: lang === 'ar' ? 'إجراء حرج' : 'DESTRUCTIVE',
          classes: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        };
      default:
        return {
          label: risk,
          classes: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
        };
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 pr-1 overflow-hidden">
      {/* ── Catalog Header & Search Strip ── */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Terminal size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>{lang === 'ar' ? 'كتالوج جميع الأدوات' : 'Master Tools Catalog'}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {filteredTools.length} / {tools.length}
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'بحث وتشغيل مباشر في كامل مكتبة الأدوات البالغ عددها 158 أداة مع معايير الأمان الشفافة.'
                  : 'Search and launch directly across the full 158 verified Windows repair and diagnostic tools.'}
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setAdminOnly(!adminOnly)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                adminOnly
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-slate-900/50 border-white/[0.08] text-slate-400 hover:text-white'
              }`}
            >
              <Lock size={12} />
              <span>{lang === 'ar' ? 'يتطلب مسؤول' : 'Requires Admin'}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-900/60 p-2 rounded-xl border border-white/[0.08]">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث بالاسم، المعرّف (SM01)، أو الغرض...' : 'Search by name, ID (e.g., SM01), or purpose...'}
              className="w-full bg-slate-950/60 text-slate-200 placeholder-slate-500 text-xs rounded-lg ps-9 pe-8 py-2 border border-white/[0.06] focus:outline-none focus:border-blue-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950/60 text-slate-300 text-xs rounded-lg px-2.5 py-2 border border-white/[0.06] focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">{lang === 'ar' ? 'جميع الفئات (18)' : 'All Categories (18)'}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name[lang]}
                </option>
              ))}
            </select>

            {/* Risk Dropdown */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-slate-950/60 text-slate-300 text-xs rounded-lg px-2.5 py-2 border border-white/[0.06] focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">{lang === 'ar' ? 'كافة مستويات الخطورة' : 'All Risk Levels'}</option>
              <option value="READ_ONLY">READ_ONLY</option>
              <option value="SAFE_CLEANUP">SAFE_CLEANUP</option>
              <option value="SYSTEM_REPAIR">SYSTEM_REPAIR</option>
              <option value="REBOOT_REQUIRED">REBOOT_REQUIRED</option>
              <option value="DESTRUCTIVE">DESTRUCTIVE</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Scrollable Tools Table/Grid ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5">
        {filteredTools.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-white/[0.08]">
            <Search size={32} className="text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-400">
              {lang === 'ar' ? 'لم يتم العثور على أدوات تطابق البحث' : 'No repair tools match your query'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'ar' ? 'جرب البحث بكلمات أخرى أو إعادة تعيين الفلاتر' : 'Try searching for other keywords or reset your active filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTools.map((tool) => {
              const riskInfo = getRiskBadge(tool.RiskLevel);
              const cat = categoryMap[tool.Category];

              return (
                <div
                  key={tool.ToolId}
                  className="p-4 rounded-xl bg-slate-900/50 border border-white/[0.07] hover:border-white/[0.14] transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-2">
                    {/* Top line: ID + Category + Risk Badge */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          {tool.ToolId}
                        </span>
                        {cat && (
                          <span className="text-[11px] font-medium text-slate-400 truncate max-w-[140px]">
                            {cat.name[lang]}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {tool.RequiresAdmin && (
                          <span
                            title={lang === 'ar' ? 'يتطلب صلاحيات مسؤول' : 'Requires Administrator Privileges'}
                            className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          >
                            <Lock size={10} />
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${riskInfo.classes}`}
                        >
                          {riskInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Tool Name */}
                    <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                      {lang === 'ar' && tool.ArabicName ? tool.ArabicName : tool.EnglishName}
                    </h3>

                    {/* Tool Purpose */}
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {tool.Purpose}
                    </p>
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="pt-2.5 border-t border-white/[0.05] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {tool.AnalyzeOnlySupported && (
                        <button
                          type="button"
                          onClick={() => handleExecuteClick(tool, 'analyze')}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          {lang === 'ar' ? 'فحص فقط' : 'Analyze'}
                        </button>
                      )}
                      {tool.WhatIfSupported && (
                        <button
                          type="button"
                          onClick={() => handleExecuteClick(tool, 'preview')}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          {lang === 'ar' ? 'معاينة' : 'What-If'}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExecuteClick(tool, 'run')}
                      disabled={tool.RequiresAdmin && !bridgeElevated}
                      className={`
                        px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                        ${
                          tool.RequiresAdmin && !bridgeElevated
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                        }
                      `}
                    >
                      <Play size={11} fill="currentColor" />
                      <span>{lang === 'ar' ? 'تشغيل' : 'Run'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmTool && (
        <ExecutionConfirmDialog
          tool={confirmTool.tool}
          mode={confirmTool.mode}
          lang={lang}
          onConfirm={(options) => {
            const { tool, mode } = confirmTool;
            setConfirmTool(null);
            onRunTool(tool, mode, options);
          }}
          onCancel={() => setConfirmTool(null)}
        />
      )}
    </div>
  );
}
