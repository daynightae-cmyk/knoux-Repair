import { useCallback, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  Check,
  CheckCircle2,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Download,
  File,
  FileArchive,
  FileCode,
  FileSearch,
  FileText,
  Film,
  FolderMinus,
  FolderOpen,
  FolderX,
  HardDriveDownload,
  Image as ImageIcon,
  LoaderCircle,
  MinusSquare,
  Music,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  TrendingDown,
  TriangleAlert,
  X,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import {
  api,
  type BridgeTool,
  type DuplicateFileType,
  type DuplicateKeeperPolicy,
  type DuplicatePreview,
  type DuplicatePreviewGroup,
  type DuplicateQuarantineEntry,
  type ToolRunOptions,
} from '../../../lib/api';
import type { Lang } from '../../../lib/i18n';
import WorkspaceFolderPicker from '../../../components/WorkspaceFolderPicker';
import { DuplicateHeroVisual } from './DuplicateHeroVisual';
import {
  computeGroupChronology,
  filterGroupsByQuery,
  formatBytes,
  formatLastModified,
  type DuplicateWorkflowTab,
  type DuplicateAppState,
} from './duplicateModel';

interface DuplicateStationProps {
  lang: Lang;
  tools: BridgeTool[];
  onPrepareRun: (tool: BridgeTool, mode: 'run' | 'analyze' | 'preview', options: ToolRunOptions) => void;
}

const TYPE_OPTIONS: Array<{ id: DuplicateFileType; ar: string; en: string }> = [
  { id: 'all', ar: 'الكل', en: 'All' },
  { id: 'images', ar: 'الصور', en: 'Images' },
  { id: 'video', ar: 'الفيديو', en: 'Video' },
  { id: 'documents', ar: 'المستندات', en: 'Documents' },
  { id: 'audio', ar: 'الصوتيات', en: 'Audio' },
  { id: 'archives', ar: 'الأرشيفات', en: 'Archives' },
];

const EXCLUDE_PRESETS = ['node_modules', '.git', 'dist', 'build', 'temp', 'cache', '.cache', 'vendor'];

function exportPreview(preview: DuplicatePreview) {
  const blob = new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `knoux-duplicates-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function getFileTypeInfo(fileName: string) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'].includes(ext);
  const isPdf = ext === 'pdf';
  const isArchive = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso'].includes(ext);
  const isVideo = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'].includes(ext);
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext);
  const isCode = ['ts', 'tsx', 'js', 'jsx', 'json', 'cs', 'ps1', 'py', 'html', 'css', 'sh', 'sql', 'xml'].includes(ext);
  return { ext: ext.toUpperCase() || 'FILE', isImage, isPdf, isArchive, isVideo, isAudio, isCode };
}

function FileThumbnailPreview({
  name,
  path,
  size = 'md',
}: {
  name: string;
  path: string;
  size?: 'sm' | 'md';
}) {
  const { ext, isImage, isPdf, isArchive, isVideo, isAudio, isCode } = useMemo(() => getFileTypeInfo(name), [name]);
  const [imgError, setImgError] = useState(false);

  if (isImage && !imgError) {
    const thumbUrl = `/api/duplicates/thumbnail?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`;
    return (
      <div className={`duplicate-thumb-box size-${size} is-image`} title={name}>
        <img
          src={thumbUrl}
          alt={name}
          className="duplicate-thumb-img"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  let placeholderClass = 'type-doc';
  let IconComponent = File;

  if (isImage) {
    placeholderClass = 'type-image';
    IconComponent = ImageIcon;
  } else if (isPdf) {
    placeholderClass = 'type-pdf';
    IconComponent = FileText;
  } else if (isArchive) {
    placeholderClass = 'type-archive';
    IconComponent = FileArchive;
  } else if (isVideo) {
    placeholderClass = 'type-video';
    IconComponent = Film;
  } else if (isAudio) {
    placeholderClass = 'type-audio';
    IconComponent = Music;
  } else if (isCode) {
    placeholderClass = 'type-code';
    IconComponent = FileCode;
  }

  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <div className={`duplicate-thumb-box size-${size}`} title={name}>
      <div className={`duplicate-thumb-placeholder ${placeholderClass}`}>
        <IconComponent size={iconSize} />
        <span className="duplicate-thumb-badge">{ext.slice(0, 4)}</span>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  lang,
  selected,
  keepPath,
  onToggle,
  onKeep,
}: {
  group: DuplicatePreviewGroup;
  lang: Lang;
  selected: boolean;
  keepPath: string;
  onToggle: () => void;
  onKeep: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const primary = group.Files.find((file) => file.Path === keepPath) || group.Files[0];
  const chronology = useMemo(() => computeGroupChronology(group), [group]);

  return (
    <article className={`duplicate-group-card ${selected ? 'is-selected' : ''}`}>
      <button type="button" className="duplicate-group-main" onClick={onToggle}>
        <span className="duplicate-group-check">{selected ? <Check size={14} /> : null}</span>
        <FileThumbnailPreview name={primary?.Name || ''} path={primary?.Path || ''} size="md" />
        <span className="duplicate-group-copy-count">{group.Copies}</span>
        <div>
          <strong>{primary?.Name || (lang === 'ar' ? 'مجموعة ملفات' : 'File group')}</strong>
          <small>
            {lang === 'ar'
              ? `${group.DuplicateCopies} نسخة إضافية · ${formatBytes(group.RecoverableBytes, lang)} قابلة للاستعادة`
              : `${group.DuplicateCopies} extra copies · ${formatBytes(group.RecoverableBytes, lang)} recoverable`}
          </small>
        </div>
        {group.HardLinkInvolved && (
          <span
            className="duplicate-hardlink-warning"
            title={
              lang === 'ar'
                ? 'تحذير ارتباط فيزيائي: قد تشترك هذه الملفات في نفس المساحة على القرص'
                : 'Hard-link detected: files share storage pointers'
            }
          >
            <ShieldAlert size={12} />
            {lang === 'ar' ? 'ارتباط فيزيائي' : 'Hard-link'}
          </span>
        )}
        <ChevronDown
          size={16}
          className={expanded ? 'is-open' : ''}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        />
      </button>
      {expanded && (
        <div className="duplicate-group-files">
          {group.Files.map((file) => {
            const fileTime = chronology.dates.find((d) => d.path === file.Path)?.time;
            const isNewest = chronology.maxTime !== null && fileTime === chronology.maxTime;
            const isOldest = chronology.minTime !== null && chronology.maxTime !== chronology.minTime && fileTime === chronology.minTime;
            const isPreserved = file.Path === keepPath;

            return (
              <button
                type="button"
                key={file.Path}
                className={`duplicate-file-entry-row ${isPreserved ? 'is-keeper' : ''}`}
                onClick={() => onKeep(file.Path)}
                title={
                  isPreserved
                    ? (lang === 'ar' ? 'الملف المحتفظ به حالياً (انقر على نسخة أخرى للاحتفاظ بها بدلاً منه)' : 'Currently preserved file (click another to keep it instead)')
                    : (lang === 'ar' ? 'انقر للاحتفاظ بهذه النسخة' : 'Click to keep this copy instead')
                }
              >
                <span className="duplicate-keeper-icon">
                  {isPreserved ? <CheckCircle2 size={15} /> : <Copy size={14} />}
                </span>
                <FileThumbnailPreview name={file.Name} path={file.Path} size="sm" />
                <div className="duplicate-file-details">
                  <strong>{file.Name}</strong>
                  <small className="duplicate-file-path">{file.Path}</small>
                  <div className="duplicate-file-timestamp-row">
                    <Clock size={11} className="duplicate-file-clock-icon" />
                    <span className="duplicate-file-timestamp-label">
                      {lang === 'ar' ? 'آخر تعديل: ' : 'Last Modified: '}
                    </span>
                    <span className="duplicate-file-timestamp-val">
                      {formatLastModified(file.LastWriteUtc || file.ModifiedTime, lang)}
                    </span>
                    {isNewest && (
                      <span className="duplicate-tag-chronology is-newest">
                        {lang === 'ar' ? 'الأحدث' : 'Newest'}
                      </span>
                    )}
                    {isOldest && (
                      <span className="duplicate-tag-chronology is-oldest">
                        {lang === 'ar' ? 'الأقدم' : 'Oldest'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="duplicate-file-meta-col">
                  <b>{formatBytes(file.SizeBytes, lang)}</b>
                  {isPreserved && (
                    <span className="duplicate-keeper-pill">
                      <ShieldCheck size={11} />
                      {lang === 'ar' ? 'سيتم الاحتفاظ بها' : 'Preserved'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default function DuplicateStation({
  lang,
  tools,
  onPrepareRun,
}: DuplicateStationProps) {
  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<DuplicateWorkflowTab>('scan');

  // Application lifecycle flow
  const [appState, setAppState] = useState<DuplicateAppState>('LANDING');

  // Core scan parameters
  const [folderPath, setFolderPath] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [types, setTypes] = useState<DuplicateFileType[]>([]);
  const [keeperPolicy, setKeeperPolicy] = useState<DuplicateKeeperPolicy>('OldestThenAlphabetical');
  const [excludedSubfolders, setExcludedSubfolders] = useState<string[]>(['node_modules', '.git']);
  const [excludeInput, setExcludeInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Scan and analysis results
  const [preview, setPreview] = useState<DuplicatePreview | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [keepPaths, setKeepPaths] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quarantineEntries, setQuarantineEntries] = useState<DuplicateQuarantineEntry[]>([]);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [quarantineCount, setQuarantineCount] = useState<number | null>(null);

  // Tools mapping from manifest
  const cleanupTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DF02') || null, [tools]);
  const restoreTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DF10') || null, [tools]);

  const loadQuarantine = useCallback(async () => {
    setQuarantineLoading(true);
    try {
      const { quarantine } = await api.duplicateQuarantine();
      setQuarantineEntries(quarantine.Entries || []);
      setQuarantineCount(quarantine.Entries?.length ?? 0);
    } catch {
      setQuarantineEntries([]);
      setQuarantineCount(null);
    } finally {
      setQuarantineLoading(false);
    }
  }, []);

  const handleAddExclude = () => {
    const trimmed = excludeInput.trim();
    if (!trimmed) return;
    const clean = trimmed.replace(/^[\\/]+|[\\/]+$/g, '');
    if (!clean) return;
    if (!excludedSubfolders.includes(clean)) {
      setExcludedSubfolders((prev) => [...prev, clean]);
    }
    setExcludeInput('');
  };

  const handleRemoveExclude = (folderToRemove: string) => {
    setExcludedSubfolders((prev) => prev.filter((f) => f !== folderToRemove));
  };

  const handleTogglePreset = (preset: string) => {
    setExcludedSubfolders((prev) =>
      prev.includes(preset) ? prev.filter((f) => f !== preset) : [...prev, preset]
    );
  };

  const triggerScan = useCallback(async (targetFolder?: string) => {
    const folderToScan = targetFolder || folderPath;
    if (!folderToScan.trim()) {
      setPickerOpen(true);
      return;
    }
    setLoading(true);
    setAppState('SCANNING');
    setError('');
    setPreview(null);
    setSelectedGroupIds(new Set());
    setKeepPaths({});
    setSearchQuery('');

    try {
      const { preview: next } = await api.duplicatePreview(folderToScan, {
        types: types.length ? types : ['all'],
        keeperPolicy,
        excludeSubfolders: excludedSubfolders,
      });

      const sanitizedGroups = next.Groups.map((grp) => {
        const remainingFiles = grp.Files.filter((f) => {
          const lowerPath = f.Path.toLowerCase().replace(/\\/g, '/');
          return !excludedSubfolders.some((ex) => {
            const cleanEx = ex.toLowerCase().replace(/^[\\/]+|[\\/]+$/g, '');
            return (
              lowerPath.split('/').includes(cleanEx) ||
              lowerPath.includes(`/${cleanEx}/`) ||
              lowerPath.includes(`\\${cleanEx}\\`)
            );
          });
        });
        if (remainingFiles.length < 2) return null;
        const duplicateCopies = remainingFiles.length - 1;
        const recoverableBytes = duplicateCopies * (remainingFiles[0]?.SizeBytes || 0);
        return {
          ...grp,
          Files: remainingFiles,
          Copies: remainingFiles.length,
          DuplicateCopies: duplicateCopies,
          RecoverableBytes: recoverableBytes,
          KeepPath: remainingFiles.some((f) => f.Path === grp.KeepPath) ? grp.KeepPath : remainingFiles[0].Path,
        };
      }).filter((g): g is NonNullable<typeof g> => g !== null);

      const sanitizedPreview: DuplicatePreview = {
        ...next,
        GroupCount: sanitizedGroups.length,
        DuplicateCopies: sanitizedGroups.reduce((acc, g) => acc + g.DuplicateCopies, 0),
        RecoverableBytes: sanitizedGroups.reduce((acc, g) => acc + g.RecoverableBytes, 0),
        Groups: sanitizedGroups,
      };

      setPreview(sanitizedPreview);
      setKeepPaths(Object.fromEntries(sanitizedPreview.Groups.map((group) => [group.Id, group.KeepPath])));
      setSelectedGroupIds(new Set(sanitizedPreview.Groups.map((group) => group.Id)));
      setAppState('RESULTS');
      void loadQuarantine();
    } catch {
      setError(
        lang === 'ar'
          ? 'تعذر إكمال فحص التكرارات. تأكد من أن خدمة KNOUX المحلية تعمل وأن المجلد متاح.'
          : 'KNOUX could not finish the duplicate scan. Check that the local service is running and the folder is available.'
      );
      setAppState('ERROR');
    } finally {
      setLoading(false);
    }
  }, [excludedSubfolders, folderPath, keeperPolicy, lang, loadQuarantine, types]);

  const filteredGroups = useMemo(() => {
    if (!preview) return [];
    return filterGroupsByQuery(preview.Groups, searchQuery);
  }, [preview, searchQuery]);

  const selectedGroups = preview?.Groups.filter((group) => selectedGroupIds.has(group.Id)) || [];
  const selectedBytes = selectedGroups.reduce((total, group) => total + group.RecoverableBytes, 0);

  const matchedSelectedCount = useMemo(() => {
    return filteredGroups.filter((g) => selectedGroupIds.has(g.Id)).length;
  }, [filteredGroups, selectedGroupIds]);

  const allFilteredSelected = filteredGroups.length > 0 && matchedSelectedCount === filteredGroups.length;
  const noneFilteredSelected = matchedSelectedCount === 0;
  const someFilteredSelected = !allFilteredSelected && !noneFilteredSelected;

  const toggleFilteredSelection = () => {
    if (filteredGroups.length === 0) return;
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredGroups.forEach((group) => next.delete(group.Id));
      } else {
        filteredGroups.forEach((group) => next.add(group.Id));
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      filteredGroups.forEach((group) => next.add(group.Id));
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      filteredGroups.forEach((group) => next.delete(group.Id));
      return next;
    });
  };

  const toggleType = (id: DuplicateFileType) => {
    if (id === 'all') {
      setTypes([]);
      return;
    }
    setTypes((current) =>
      current.includes(id) ? current.filter((val) => val !== id) : [...current, id]
    );
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prepareQuarantine = () => {
    if (!preview || !cleanupTool || !selectedGroups.length) return;
    onPrepareRun(cleanupTool, 'run', {
      duplicatePreviewId: preview.PreviewId,
      duplicateKeepPaths: selectedGroups.map((group) => ({
        groupId: group.Id,
        keepPath: keepPaths[group.Id] || group.KeepPath,
      })),
    });
  };

  return (
    <div className="duplicate-studio-root" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* ── Mini Navigation Rail ── */}
      <nav className="duplicate-mini-nav" aria-label={lang === 'ar' ? 'تنقل ذكاء الملفات المكررة' : 'Duplicate Studio navigation'}>
        <button
          type="button"
          className={`duplicate-mini-nav-btn ${currentTab === 'scan' ? 'is-active' : ''}`}
          onClick={() => setCurrentTab('scan')}
        >
          <FileSearch size={15} />
          <span>{lang === 'ar' ? 'فحص التكرارات' : 'Duplicate Scan'}</span>
        </button>

        <button
          type="button"
          className={`duplicate-mini-nav-btn ${currentTab === 'duplicates' ? 'is-active' : ''}`}
          onClick={() => {
            setCurrentTab('duplicates');
            if (!preview && folderPath) void triggerScan();
          }}
        >
          <Copy size={15} />
          <span>{lang === 'ar' ? 'النسخ المكررة' : 'Review Copies'}</span>
          {preview && preview.GroupCount > 0 && (
            <span className="duplicate-mini-nav-badge">{preview.GroupCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`duplicate-mini-nav-btn ${currentTab === 'quarantine' ? 'is-active' : ''}`}
          onClick={() => {
            setCurrentTab('quarantine');
            void loadQuarantine();
          }}
        >
          <ShieldCheck size={15} />
          <span>{lang === 'ar' ? 'العزل الآمن' : 'Quarantine'}</span>
          {quarantineCount !== null && quarantineCount > 0 && (
            <span className="duplicate-mini-nav-badge">{quarantineCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`duplicate-mini-nav-btn ${currentTab === 'recovery' ? 'is-active' : ''}`}
          onClick={() => {
            setCurrentTab('recovery');
            void loadQuarantine();
          }}
        >
          <ArchiveRestore size={15} />
          <span>{lang === 'ar' ? 'الاستعادة' : 'Recovery'}</span>
        </button>

        <button
          type="button"
          className={`duplicate-mini-nav-btn ${currentTab === 'system-review' ? 'is-active' : ''}`}
          onClick={() => setCurrentTab('system-review')}
        >
          <HardDriveDownload size={15} />
          <span>{lang === 'ar' ? 'مراجعة النظام' : 'System Review'}</span>
        </button>
      </nav>

      {/* ── Main Studio Workspace ── */}
      <div className="duplicate-studio-workspace">
        {/* TAB: SYSTEM REVIEW (DF09 isolated view) */}
        {currentTab === 'system-review' && (
          <div className="duplicate-system-review-card">
            <ShieldAlert size={26} />
            <div>
              <strong>{lang === 'ar' ? 'مراجعة ملفات النظام المحمية (DF09)' : 'System Files Duplicate Review (DF09)'}</strong>
              <p>
                {lang === 'ar'
                  ? 'يقوم نظام Windows بإدارة مكونات وملفات نظام مكررة بشكل مقصود (مثل ملفات WinSxS وملفات تعريف الحزم). لا يُسمح بإجراء تنظيف أو عزل مباشر لملفات النظام لحماية استقرار الجهاز.'
                  : 'Windows intentionally manages duplicate system components and binaries (e.g. WinSxS and side-by-side package manifests). To maintain OS stability, direct deletion of system duplicates is strictly restricted to read-only review.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB: QUARANTINE & RECOVERY */}
        {(currentTab === 'quarantine' || currentTab === 'recovery') && (
          <div className="duplicate-quarantine-page">
            <div className="app-section-title">
              <div>
                <p>{lang === 'ar' ? 'مركز الحجر' : 'Safe Vault'}</p>
                <h2>
                  {currentTab === 'recovery'
                    ? (lang === 'ar' ? 'استعادة الملفات من العزل' : 'Restore Quarantined Files')
                    : (lang === 'ar' ? 'الملفات المعزولة بأمان' : 'Quarantined Duplicate Files')}
                </h2>
              </div>
              <button type="button" className="duplicate-export-button" onClick={() => void loadQuarantine()}>
                <RotateCcw size={13} className={quarantineLoading ? 'animate-spin' : ''} />
                {lang === 'ar' ? 'تحديث السجل' : 'Refresh list'}
              </button>
            </div>

            {quarantineLoading ? (
              <div className="duplicate-scanning-canvas" style={{ minHeight: '16rem' }}>
                <LoaderCircle size={28} className="animate-spin text-sky-400" />
                <p style={{ marginTop: '0.8rem', color: '#94a9ba', fontSize: '0.72rem' }}>
                  {lang === 'ar' ? 'جارٍ قراءة عناصر العزل الآمن...' : 'Reading safe quarantine entries…'}
                </p>
              </div>
            ) : quarantineEntries.length === 0 ? (
              <div className="duplicate-empty-search" style={{ minHeight: '16rem' }}>
                <ShieldCheck size={32} />
                <strong>{lang === 'ar' ? 'لا توجد ملفات في العزل حالياً' : 'No items currently in quarantine'}</strong>
                <p>
                  {lang === 'ar'
                    ? 'عند عزل أي نسخ مكررة، يتم نقلها إلى مجلد العزل الآمن وتظهر هنا فوراً مع إمكانية استعادتها.'
                    : 'When duplicate copies are quarantined, they are moved safely into the quarantine vault and will appear here with full restoration support.'}
                </p>
              </div>
            ) : (
              <div className="duplicate-group-list">
                {quarantineEntries.map((entry) => (
                  <article key={entry.QuarantineId} className="duplicate-group-card" style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FileThumbnailPreview name={entry.OriginalPath.split(/\\|\//).pop() || ''} path={entry.OriginalPath} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ color: '#f1f8fc', fontSize: '0.64rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.OriginalPath.split(/\\|\//).pop()}
                        </strong>
                        <small style={{ color: '#768d9d', fontSize: '0.51rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                          {entry.OriginalPath}
                        </small>
                        <small style={{ color: '#38bdf8', fontSize: '0.48rem' }}>
                          {entry.QuarantinedAt ? formatLastModified(entry.QuarantinedAt, lang) : ''}
                        </small>
                      </div>
                      <div style={{ textAlign: 'end' }}>
                        <b style={{ color: '#a5b9c7', fontSize: '0.55rem', display: 'block' }}>
                          {formatBytes(entry.OriginalSize, lang)}
                        </b>
                        {restoreTool && (
                          <button
                            type="button"
                            className="duplicate-batch-btn is-active"
                            style={{ marginTop: '0.2rem' }}
                            onClick={() => onPrepareRun(restoreTool, 'run', { quarantineIds: [entry.QuarantineId] })}
                          >
                            <ArchiveRestore size={12} />
                            {lang === 'ar' ? 'استعادة' : 'Restore'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: DUPLICATE SCAN WORKFLOW */}
        {currentTab === 'scan' && appState === 'LANDING' && (
          <div className="duplicate-landing-canvas">
            <DuplicateHeroVisual lang={lang} stage="idle" />

            <div className="duplicate-landing-title-block">
              <span className="duplicate-landing-eyebrow">
                <Sparkles size={13} />
                {lang === 'ar' ? 'ذكاء الملفات المكررة' : 'DUPLICATE INTELLIGENCE'}
              </span>
              <h1 className="duplicate-landing-heading">
                {lang === 'ar' ? 'اعثر على النسخ المتطابقة بأمان' : 'Find identical files safely'}
              </h1>
              <p className="duplicate-landing-desc">
                {lang === 'ar'
                  ? 'يتحقق KNOUX من بصمات المحتوى SHA-256 قبل نقل أي ملف، ويحفظ النسخة الأصلية دائماً في حجر قابل للاستعادة دون حذف متسرع.'
                  : 'KNOUX verifies SHA-256 content signatures before moving anything. The original copy is preserved, and redundant files are safely placed into restorable quarantine.'}
              </p>
            </div>

            <div className="duplicate-landing-actions">
              <button
                type="button"
                className="duplicate-primary-cta"
                onClick={() => {
                  if (!folderPath.trim()) {
                    setPickerOpen(true);
                  } else {
                    void triggerScan();
                  }
                }}
              >
                <FileSearch size={16} />
                <span>{lang === 'ar' ? 'بدء الفحص' : 'START SCAN'}</span>
              </button>

              <button
                type="button"
                className="duplicate-secondary-cta"
                onClick={() => setAppState('CONFIG')}
              >
                <Sliders size={14} />
                <span>
                  {folderPath
                    ? (lang === 'ar' ? 'خيارات الفحص والمجلد' : 'Scan options & folder')
                    : (lang === 'ar' ? 'اختيار مجلد' : 'Choose folder')}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* CONFIGURATION STAGE */}
        {currentTab === 'scan' && appState === 'CONFIG' && (
          <div className="duplicate-scan-setup">
            <div className="app-section-title">
              <div>
                <p>{lang === 'ar' ? 'إعداد الفحص' : 'Scan setup'}</p>
                <h2>{lang === 'ar' ? 'تخصيص نطاق فحص الملفات المكررة' : 'Configure Duplicate Analysis Scope'}</h2>
              </div>
              <button
                type="button"
                className="duplicate-export-button"
                onClick={() => setAppState('LANDING')}
              >
                <X size={13} />
                {lang === 'ar' ? 'إلغاء' : 'Close'}
              </button>
            </div>

            {/* Folder Field */}
            <div className="duplicate-folder-row">
              <FolderOpen size={18} />
              <div>
                <small>{lang === 'ar' ? 'المجلد المستهدف' : 'Target folder'}</small>
                <strong>{folderPath || (lang === 'ar' ? 'لم يتم اختيار مجلد بعد' : 'No folder selected')}</strong>
              </div>
              <button type="button" onClick={() => setPickerOpen(true)}>
                {lang === 'ar' ? 'اختيار مجلد' : 'Browse'}
              </button>
            </div>

            {/* File Type Filters */}
            <div className="duplicate-type-list">
              {TYPE_OPTIONS.map((item) => {
                const isActive = item.id === 'all' ? types.length === 0 : types.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={isActive ? 'is-active' : ''}
                    onClick={() => toggleType(item.id)}
                  >
                    {isActive && <Check size={13} />}
                    {lang === 'ar' ? item.ar : item.en}
                  </button>
                );
              })}
            </div>

            {/* Keeper policy buttons */}
            <div className="duplicate-policy-row">
              <span>{lang === 'ar' ? 'قاعدة تفضيل النسخة الأصلية:' : 'Keeper preference:'}</span>
              <button
                type="button"
                className={keeperPolicy === 'OldestThenAlphabetical' ? 'is-active' : ''}
                onClick={() => setKeeperPolicy('OldestThenAlphabetical')}
              >
                {lang === 'ar' ? 'النسخة الأقدم (الموصى بها)' : 'Oldest first (Safest)'}
              </button>
              <button
                type="button"
                className={keeperPolicy === 'Newest' ? 'is-active' : ''}
                onClick={() => setKeeperPolicy('Newest')}
              >
                {lang === 'ar' ? 'النسخة الأحدث' : 'Newest copy'}
              </button>
            </div>

            {/* Advanced toggle */}
            <div style={{ marginTop: '0.4rem' }}>
              <button
                type="button"
                className="duplicate-secondary-cta"
                style={{ padding: '0.35rem 0.75rem', minHeight: '1.9rem', fontSize: '0.62rem' }}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <Sliders size={12} />
                <span>
                  {showAdvanced
                    ? (lang === 'ar' ? 'إخفاء الخيارات المتقدمة' : 'Hide advanced options')
                    : (lang === 'ar' ? 'خيارات الفحص المتقدمة (استبعاد مجلدات)' : 'Advanced scan options (Exclusions)')}
                </span>
                <ChevronDown size={13} className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
            </div>

            {/* Sub-Folders Exclusion Section */}
            {showAdvanced && (
              <div className="duplicate-exclude-section">
                <div className="duplicate-exclude-header">
                  <div className="duplicate-exclude-title">
                    <FolderX size={15} />
                    <span>{lang === 'ar' ? 'استبعاد مجلدات فرعية من الفحص' : 'Exclude sub-folders from duplicate scan'}</span>
                  </div>
                  {excludedSubfolders.length > 0 && (
                    <span className="duplicate-exclude-count-pill">
                      {excludedSubfolders.length} {lang === 'ar' ? 'مجلدات مستبعدة' : 'excluded'}
                    </span>
                  )}
                </div>

                <div className="duplicate-exclude-input-row">
                  <div className="duplicate-exclude-input-box">
                    <FolderMinus size={14} className="duplicate-exclude-icon" />
                    <input
                      type="text"
                      className="duplicate-exclude-input"
                      placeholder={
                        lang === 'ar'
                          ? 'اكتب اسم المجلد واضغط إضافة (مثل node_modules, .git, temp)...'
                          : 'Type sub-folder name (e.g., node_modules, .git, temp)...'
                      }
                      value={excludeInput}
                      onChange={(e) => setExcludeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExclude();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="duplicate-exclude-add-btn"
                    onClick={handleAddExclude}
                    disabled={!excludeInput.trim()}
                  >
                    <Plus size={14} />
                    {lang === 'ar' ? 'إضافة استبعاد' : 'Add Exclude'}
                  </button>
                </div>

                {excludedSubfolders.length > 0 && (
                  <div className="duplicate-exclude-tags">
                    {excludedSubfolders.map((folder) => (
                      <span key={folder} className="duplicate-exclude-tag">
                        <FolderMinus size={12} />
                        <code>{folder}</code>
                        <button
                          type="button"
                          onClick={() => handleRemoveExclude(folder)}
                          title={lang === 'ar' ? `إزالة ${folder}` : `Remove ${folder}`}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="duplicate-exclude-clear-all"
                      onClick={() => setExcludedSubfolders([])}
                    >
                      {lang === 'ar' ? 'مسح الكل' : 'Clear all'}
                    </button>
                  </div>
                )}

                <div className="duplicate-exclude-presets">
                  <span className="duplicate-presets-label">
                    {lang === 'ar' ? 'اقتراحات شائعة:' : 'Quick presets:'}
                  </span>
                  {EXCLUDE_PRESETS.map((preset) => {
                    const isExcluded = excludedSubfolders.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`duplicate-preset-chip ${isExcluded ? 'is-active' : ''}`}
                        onClick={() => handleTogglePreset(preset)}
                      >
                        {isExcluded ? <Check size={11} /> : <Plus size={10} />}
                        <span>{preset}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="duplicate-secondary-cta"
                onClick={() => setAppState('LANDING')}
              >
                {lang === 'ar' ? 'رجوع' : 'Back'}
              </button>
              <button
                type="button"
                className="duplicate-primary-cta"
                disabled={loading || !folderPath.trim()}
                onClick={() => void triggerScan()}
              >
                <FileSearch size={15} />
                <span>{lang === 'ar' ? 'تشغيل الفحص الآن' : 'RUN SCAN NOW'}</span>
              </button>
            </div>
          </div>
        )}

        {/* SCANNING STATE */}
        {currentTab === 'scan' && appState === 'SCANNING' && (
          <div className="duplicate-scanning-canvas">
            <DuplicateHeroVisual lang={lang} stage="scanning" />
            <div className="duplicate-scanning-msg">
              <strong>{lang === 'ar' ? 'جارٍ التحقق من محتوى الملفات' : 'Verifying file contents'}</strong>
              <span>
                {lang === 'ar'
                  ? 'يقارن KNOUX أحجام الملفات وبصمات المحتوى الرقمية SHA-256. لا يتم تغيير أو حذف أي ملف أثناء هذا الفحص.'
                  : 'KNOUX compares exact file sizes and SHA-256 content signatures. No files are moved or changed during this analysis.'}
              </span>
            </div>
          </div>
        )}

        {/* RESULTS & WORKSPACE STAGE */}
        {(appState === 'RESULTS' || currentTab === 'duplicates') && preview && (
          <>
            {/* Compact Header */}
            <div className="duplicate-command-hero" style={{ minHeight: 'auto', padding: '0.85rem 1.15rem' }}>
              <DuplicateHeroVisual lang={lang} stage="results" className="compact" />
              <div>
                <p>{lang === 'ar' ? 'نتائج الفحص التكراري' : 'Duplicate Scan Workspace'}</p>
                <h2>
                  {lang === 'ar'
                    ? `${preview.GroupCount} مجموعة مكررة مكتشفة`
                    : `${preview.GroupCount} Duplicate Groups Found`}
                </h2>
                <span>
                  {lang === 'ar'
                    ? `المجلد: ${preview.Folder} · المساحة المحتمل استردادها: ${formatBytes(preview.RecoverableBytes, lang)}`
                    : `Target: ${preview.Folder} · Potentially recoverable: ${formatBytes(preview.RecoverableBytes, lang)}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginInlineStart: 'auto' }}>
                <button
                  type="button"
                  className="duplicate-export-button"
                  onClick={() => exportPreview(preview)}
                >
                  <Download size={13} />
                  {lang === 'ar' ? 'تصدير النتائج' : 'Export'}
                </button>
                <button
                  type="button"
                  className="duplicate-secondary-cta"
                  style={{ minHeight: '2rem', padding: '0.35rem 0.75rem', fontSize: '0.62rem' }}
                  onClick={() => void triggerScan()}
                >
                  <RotateCcw size={13} />
                  {lang === 'ar' ? 'إعادة الفحص' : 'Rescan'}
                </button>
              </div>
            </div>

            {/* Recharts Reclaimed Space Visual */}
            <div className="duplicate-reclaim-chart-card">
              <div className="duplicate-reclaim-header">
                <div className="duplicate-reclaim-title">
                  <HardDriveDownload size={16} />
                  <div>
                    <strong>{lang === 'ar' ? 'توقّع تحرير المساحة التخزينية' : 'Projected Storage Reclaimed'}</strong>
                    <span>
                      {lang === 'ar'
                        ? `استناداً إلى المجموعات المحددة حالياً (${selectedGroups.length} من ${preview.GroupCount} مجموعة)`
                        : `Based on currently selected duplicate groups (${selectedGroups.length} of ${preview.GroupCount} groups)`}
                    </span>
                  </div>
                </div>
                <div className="duplicate-reclaim-badges">
                  <span className="duplicate-reclaim-ratio-badge">
                    <TrendingDown size={13} />
                    {preview.RecoverableBytes > 0
                      ? Math.round((selectedBytes / preview.RecoverableBytes) * 100)
                      : 0}% {lang === 'ar' ? 'محدد' : 'Selected'}
                  </span>
                </div>
              </div>

              <div className="duplicate-reclaim-chart-wrap">
                <ResponsiveContainer width="100%" height={32}>
                  <BarChart
                    layout="vertical"
                    data={[
                      {
                        name: 'Space',
                        reclaimed: selectedBytes,
                        unselected: Math.max(0, preview.RecoverableBytes - selectedBytes),
                      },
                    ]}
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    barCategoryGap={0}
                  >
                    <XAxis type="number" hide domain={[0, Math.max(preview.RecoverableBytes, 1)]} />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="duplicate-chart-tooltip">
                            <strong>{lang === 'ar' ? 'تفاصيل المساحة' : 'Space Reclamation'}</strong>
                            <div style={{ color: '#10b981' }}>
                              {lang === 'ar' ? 'مساحة محددة للعزل:' : 'Selected for Quarantine:'} {formatBytes(selectedBytes, lang)}
                            </div>
                            <div style={{ color: '#38bdf8', marginTop: '0.2rem' }}>
                              {lang === 'ar' ? 'إجمالي المساحة القابلة للاسترداد:' : 'Total Recoverable:'} {formatBytes(preview.RecoverableBytes, lang)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="reclaimed" stackId="a" fill="#10b981" radius={[4, 0, 0, 4]} />
                    <Bar dataKey="unselected" stackId="a" fill="#1e293b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Results Review Board */}
            <section className="duplicate-review-board">
              <div className="duplicate-toolbar-row">
                <div className="duplicate-search-box">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    className="duplicate-search-input"
                    placeholder={lang === 'ar' ? 'البحث عن ملف في المجموعات المكررة...' : 'Search duplicates by file name or path...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="duplicate-search-clear"
                      onClick={() => setSearchQuery('')}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="duplicate-batch-actions">
                  <button
                    type="button"
                    className={`duplicate-filter-toggle-btn ${
                      allFilteredSelected ? 'is-all-selected' : someFilteredSelected ? 'is-some-selected' : ''
                    }`}
                    onClick={toggleFilteredSelection}
                    disabled={filteredGroups.length === 0}
                  >
                    {allFilteredSelected ? (
                      <CheckSquare size={14} className="duplicate-toggle-icon is-checked" />
                    ) : someFilteredSelected ? (
                      <MinusSquare size={14} className="duplicate-toggle-icon is-partial" />
                    ) : (
                      <Square size={14} className="duplicate-toggle-icon is-unchecked" />
                    )}
                    <span>{allFilteredSelected ? (lang === 'ar' ? 'إلغاء تحديد المعروض' : 'Deselect') : (lang === 'ar' ? 'تحديد المعروض' : 'Select Displayed')}</span>
                    <span className="duplicate-filter-toggle-count">{matchedSelectedCount} / {filteredGroups.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`duplicate-batch-btn ${allFilteredSelected ? 'is-active' : ''}`}
                    onClick={selectAll}
                    disabled={allFilteredSelected || filteredGroups.length === 0}
                  >
                    <CheckCheck size={14} />
                    {lang === 'ar' ? 'تحديد الكل' : 'Select All'}
                  </button>

                  <button
                    type="button"
                    className="duplicate-batch-btn"
                    onClick={deselectAll}
                    disabled={noneFilteredSelected}
                  >
                    <MinusSquare size={14} />
                    {lang === 'ar' ? 'إلغاء الكل' : 'Deselect All'}
                  </button>
                </div>
              </div>

              {filteredGroups.length === 0 ? (
                <div className="duplicate-empty-search">
                  <Search size={24} />
                  <strong>{lang === 'ar' ? 'لم يتم العثور على ملفات مطابقة' : 'No matching duplicate files'}</strong>
                  <p>{lang === 'ar' ? 'جرب تغيير كلمة البحث أو فحص مجلد آخر.' : 'Try changing search keywords or scanning another folder.'}</p>
                </div>
              ) : (
                <div className="duplicate-group-list">
                  {filteredGroups.map((group) => (
                    <GroupCard
                      key={group.Id}
                      group={group}
                      lang={lang}
                      selected={selectedGroupIds.has(group.Id)}
                      keepPath={keepPaths[group.Id] || group.KeepPath}
                      onToggle={() => toggleGroup(group.Id)}
                      onKeep={(path) => setKeepPaths((current) => ({ ...current, [group.Id]: path }))}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Bottom Floating Action Bar */}
            <section className="duplicate-action-dock">
              <div>
                <span>{lang === 'ar' ? 'خطة العزل الآمن المختارة' : 'Selected Safe Quarantine Plan'}</span>
                <strong>
                  {selectedGroups.length.toLocaleString(lang)} {lang === 'ar' ? 'مجموعة محددة · ' : 'groups selected · '}
                  {formatBytes(selectedBytes, lang)}
                </strong>
                <small>
                  {lang === 'ar'
                    ? 'يتم دائماً الاحتفاظ بنسخة أصلية واحدة من كل مجموعة. تُنقل النسخ الإضافية إلى العزل الآمن وقابلة للاستعادة.'
                    : '1 original copy is always preserved per group. Redundant copies are moved into safe quarantine and remain fully restorable.'}
                </small>
              </div>
              <div>
                <button
                  type="button"
                  className="duplicate-quarantine-button"
                  onClick={prepareQuarantine}
                  disabled={!cleanupTool || !selectedGroups.length}
                >
                  <ShieldCheck size={15} />
                  <span>{lang === 'ar' ? 'مراجعة العزل الآمن' : 'REVIEW CLEANUP'}</span>
                </button>
              </div>
            </section>
          </>
        )}

        {/* ERROR STATE */}
        {appState === 'ERROR' && (
          <div className="duplicate-empty-search">
            <TriangleAlert size={30} style={{ color: '#f43f5e' }} />
            <strong style={{ color: '#f43f5e' }}>
              {lang === 'ar' ? 'تعذر إكمال فحص التكرارات' : 'Scan could not be completed'}
            </strong>
            <p>{error}</p>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem' }}>
              <button type="button" onClick={() => void triggerScan()}>
                {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </button>
              <button type="button" onClick={() => setPickerOpen(true)}>
                {lang === 'ar' ? 'اختيار مجلد آخر' : 'Choose another folder'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workspace Folder Picker Modal */}
      {pickerOpen && (
        <WorkspaceFolderPicker
          lang={lang}
          initialPath={folderPath}
          onClose={() => setPickerOpen(false)}
          onSelect={(path) => {
            setFolderPath(path);
            setPickerOpen(false);
            if (appState === 'LANDING') {
              setAppState('CONFIG');
            }
          }}
        />
      )}
    </div>
  );
}
