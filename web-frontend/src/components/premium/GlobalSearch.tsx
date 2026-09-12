import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BridgeTool } from '../../lib/api';
import type { NavDestination, ServiceId } from '../../data/family-map';
import { FAMILIES, SERVICE_TO_FAMILY } from '../../data/family-map';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  onNavigate: (dest: NavDestination) => void;
}

interface SearchResult {
  type: 'family' | 'service' | 'tool';
  label: string;
  sublabel: string;
  destination: NavDestination;
}

export default function GlobalSearch({ open, onClose, tools, lang, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const matches: SearchResult[] = [];

    // Search families
    for (const family of FAMILIES) {
      const name = lang === 'ar' ? family.name.ar : family.name.en;
      if (name.toLowerCase().includes(q)) {
        matches.push({
          type: 'family',
          label: name,
          sublabel: `${family.expectedTools} ${lang === 'ar' ? 'أداة' : 'tools'}`,
          destination: { family: family.id },
        });
      }
    }

    // Search services
    for (const family of FAMILIES) {
      for (const service of family.services) {
        const name = lang === 'ar' ? service.name.ar : service.name.en;
        if (name.toLowerCase().includes(q)) {
          matches.push({
            type: 'service',
            label: name,
            sublabel: lang === 'ar' ? family.name.ar : family.name.en,
            destination: { family: family.id, service: service.id },
          });
        }
      }
    }

    // Search tools
    for (const tool of tools) {
      const name = lang === 'ar' ? tool.ArabicName : tool.EnglishName;
      const purpose = tool.Purpose?.toLowerCase() ?? '';
      if (name.toLowerCase().includes(q) || purpose.includes(q)) {
        const family = SERVICE_TO_FAMILY.get(tool.Category as ServiceId);
        if (family) {
          matches.push({
            type: 'tool',
            label: name,
            sublabel: tool.Purpose?.slice(0, 60) ?? '',
            destination: { family: family.id, service: tool.Category as ServiceId, toolId: tool.ToolId },
          });
        }
      }
    }

    return matches.slice(0, 12);
  }, [query, tools, lang]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActiveIndex(index => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      onNavigate(results[activeIndex].destination);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[15vh]"
      style={{ zIndex: 'var(--knoux-z-search)', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-xl knoux-glass-elevated overflow-hidden"
        style={{ borderRadius: 'var(--knoux-radius-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--knoux-border)' }}>
          <Search size={18} style={{ color: 'var(--knoux-text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === 'ar' ? 'ابحث عن أداة أو خدمة أو مشكلة...' : 'Search tools, services, or problems...'}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--knoux-text)', font: 'var(--knoux-text-body)' }}
          />
          <button type="button" onClick={onClose} className="knoux-btn-ghost p-1 rounded-md">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result, i) => (
                <button
                  key={`${result.type}-${i}`}
                  type="button"
                  className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.04] transition-colors ${i === activeIndex ? 'bg-cyan-400/[0.08]' : ''}`}
                  aria-selected={i === activeIndex}
                  onClick={() => onNavigate(result.destination)}
                >
                  <span
                    className="knoux-badge text-[9px] w-14 text-center flex-shrink-0"
                    style={{
                      background: result.type === 'family' ? 'rgba(var(--knoux-violet-rgb), 0.15)' :
                        result.type === 'service' ? 'rgba(var(--knoux-cyan-rgb), 0.15)' :
                          'rgba(var(--knoux-blue-rgb), 0.15)',
                      color: result.type === 'family' ? 'var(--knoux-purple)' :
                        result.type === 'service' ? 'var(--knoux-cyan)' : 'var(--knoux-blue)',
                    }}
                  >
                    {result.type === 'family' ? (lang === 'ar' ? 'عائلة' : 'Family') :
                      result.type === 'service' ? (lang === 'ar' ? 'خدمة' : 'Service') :
                        (lang === 'ar' ? 'أداة' : 'Tool')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--knoux-text)' }}>
                      {result.label}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--knoux-text-faint)' }}>
                      {result.sublabel}
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--knoux-text-disabled)' }} />
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--knoux-text-muted)' }}>
                {lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--knoux-text-faint)' }}>
                {lang === 'ar' ? 'جرّب كلمات مختلفة' : 'Try different keywords'}
              </p>
            </div>
          ) : (
            <div className="px-5 py-6">
              <p className="text-xs mb-3" style={{ color: 'var(--knoux-text-faint)' }}>
                {lang === 'ar' ? 'اقتراحات سريعة' : 'Quick suggestions'}
              </p>
              <div className="flex flex-wrap gap-2">
                {['disk full', 'internet slow', 'startup', 'cleanup', 'security', 'drivers'].map(s => (
                  <button
                    key={s}
                    type="button"
                    className="px-3 py-1.5 rounded-full text-xs knoux-btn-secondary"
                    onClick={() => setQuery(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 flex items-center justify-between text-[10px]" style={{ color: 'var(--knoux-text-disabled)', borderTop: '1px solid var(--knoux-border-subtle)' }}>
          <span>{lang === 'ar' ? 'اضغط Enter للتنقل' : 'Enter to navigate'}</span>
          <span>Esc {lang === 'ar' ? 'للإغلاق' : 'to close'}</span>
        </div>
      </motion.div>
    </div>
  );
}
