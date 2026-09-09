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
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingDown,
  TriangleAlert,
  X,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { api, type BridgeTool, type DuplicateFileType, type DuplicateKeeperPolicy, type DuplicatePreview, type DuplicatePreviewGroup, type ToolRunOptions } from '../lib/api';
import type { Lang } from '../lib/i18n';
import WorkspaceFolderPicker from './WorkspaceFolderPicker';

interface DuplicateOrganizerAppProps {
  lang: Lang;
  tools: BridgeTool[];
  onPrepareRun: (tool: BridgeTool, mode: 'run' | 'analyze' | 'preview', options: ToolRunOptions) => void;
}

const TYPE_OPTIONS: Array<{ id: DuplicateFileType; ar: string; en: string }> = [
  { id: 'images', ar: 'الصور', en: 'Images' },
  { id: 'video', ar: 'الفيديو', en: 'Video' },
  { id: 'documents', ar: 'المستندات', en: 'Documents' },
  { id: 'audio', ar: 'الصوتيات', en: 'Audio' },
  { id: 'archives', ar: 'الأرشيفات', en: 'Archives' },
  { id: 'other', ar: 'أخرى', en: 'Other' },
];

const EXCLUDE_PRESETS = ['node_modules', '.git', 'dist', 'build', 'temp', 'cache', '.cache', 'vendor'];

function formatLastModified(utcStr?: string, lang: Lang = 'en'): string {
  if (!utcStr) return '—';
  try {
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatBytes(value: number, lang: Lang) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toLocaleString(lang, { maximumFractionDigits: 2 })} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toLocaleString(lang, { maximumFractionDigits: 1 })} MB`;
  if (value >= 1024) return `${(value / 1024).toLocaleString(lang, { maximumFractionDigits: 1 })} KB`;
  return `${value.toLocaleString(lang)} B`;
}

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

  // If it is an image and hasn't failed, render the image thumbnail
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

  // Purpose-built placeholder when the file type is not an image
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

function ReclaimedSpaceChart({
  selectedBytes,
  totalBytes,
  selectedCount,
  totalCount,
  lang,
}: {
  selectedBytes: number;
  totalBytes: number;
  selectedCount: number;
  totalCount: number;
  lang: Lang;
}) {
  const unselectedBytes = Math.max(0, totalBytes - selectedBytes);
  const percent = totalBytes > 0 ? Math.min(100, Math.round((selectedBytes / totalBytes) * 100)) : 0;

  const data = [
    {
      name: 'Space',
      reclaimed: selectedBytes,
      unselected: unselectedBytes,
    },
  ];

  return (
    <div className="duplicate-reclaim-chart-card">
      <div className="duplicate-reclaim-header">
        <div className="duplicate-reclaim-title">
          <HardDriveDownload size={16} />
          <div>
            <strong>{lang === 'ar' ? 'توقّع تحرير المساحة التخزينية' : 'Projected Storage Reclaimed'}</strong>
            <span>
              {lang === 'ar'
                ? `استناداً إلى الملفات المحددة حالياً (${selectedCount} من ${totalCount} مجموعة)`
                : `Based on currently selected duplicate groups (${selectedCount} of ${totalCount} groups)`}
            </span>
          </div>
        </div>
        <div className="duplicate-reclaim-badges">
          <span className="duplicate-reclaim-ratio-badge">
            <TrendingDown size={13} />
            {percent}% {lang === 'ar' ? 'مستعاد' : 'Reclaimed'}
          </span>
        </div>
      </div>

      <div className="duplicate-reclaim-chart-wrap">
        <ResponsiveContainer width="100%" height={32}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={0}
          >
            <XAxis type="number" hide domain={[0, Math.max(totalBytes, 1)]} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="duplicate-chart-tooltip">
                    <strong>{lang === 'ar' ? 'تفاصيل المساحة' : 'Space Reclamation Breakdown'}</strong>
                    <div style={{ color: '#10b981' }}>
                      <span className="duplicate-legend-dot is-reclaimed" />
                      {lang === 'ar' ? 'مساحة محررة:' : 'Reclaimed:'} {formatBytes(selectedBytes, lang)} ({percent}%)
                    </div>
                    <div style={{ color: '#94a3b8' }}>
                      <span className="duplicate-legend-dot is-remaining" />
                      {lang === 'ar' ? 'مساحة متبقية:' : 'Remaining:'} {formatBytes(unselectedBytes, lang)} ({100 - percent}%)
                    </div>
                    <div style={{ color: '#38bdf8', marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.2rem' }}>
                      {lang === 'ar' ? 'إجمالي المساحة المكررة:' : 'Total Recoverable:'} {formatBytes(totalBytes, lang)}
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="reclaimed"
              stackId="a"
              fill="#10b981"
              radius={percent === 100 ? [4, 4, 4, 4] : [4, 0, 0, 4]}
              isAnimationActive={true}
            />
            <Bar
              dataKey="unselected"
              stackId="a"
              fill="#1e293b"
              radius={percent === 0 ? [4, 4, 4, 4] : [0, 4, 4, 0]}
              isAnimationActive={true}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="duplicate-reclaim-legend">
        <div className="duplicate-reclaim-legend-items">
          <span className="duplicate-reclaim-legend-item">
            <span className="duplicate-legend-dot is-reclaimed" />
            <span>
              {lang === 'ar' ? 'المساحة المحررة: ' : 'To Reclaim: '}
              <strong style={{ color: '#10b981' }}>{formatBytes(selectedBytes, lang)}</strong>
            </span>
          </span>
          <span className="duplicate-reclaim-legend-item">
            <span className="duplicate-legend-dot is-remaining" />
            <span>
              {lang === 'ar' ? 'المتبقي: ' : 'Remaining: '}
              <span>{formatBytes(unselectedBytes, lang)}</span>
            </span>
          </span>
        </div>
        <span className="duplicate-reclaim-target">
          {lang === 'ar' ? 'الهدف الأقصى: ' : 'Max Potential: '}
          <strong>{formatBytes(totalBytes, lang)}</strong>
        </span>
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

  // Determine chronological timestamps for files to aid user decision-making
  const chronology = useMemo(() => {
    const dates = group.Files.map((file) => {
      const raw = file.LastWriteUtc || file.ModifiedTime;
      const time = raw ? new Date(raw).getTime() : NaN;
      return { path: file.Path, time, isValid: !isNaN(time) && time > 0 };
    });
    const validTimes = dates.filter((d) => d.isValid).map((d) => d.time);
    const maxTime = validTimes.length > 0 ? Math.max(...validTimes) : null;
    const minTime = validTimes.length > 1 ? Math.min(...validTimes) : null;
    return { dates, maxTime, minTime };
  }, [group.Files]);

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
                      {lang === 'ar' ? 'المحتفظ به' : 'Preserved'}
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

export default function DuplicateOrganizerApp({ lang, tools, onPrepareRun }: DuplicateOrganizerAppProps) {
  const [folderPath, setFolderPath] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [types, setTypes] = useState<DuplicateFileType[]>([]);
  const [keeperPolicy, setKeeperPolicy] = useState<DuplicateKeeperPolicy>('OldestThenAlphabetical');
  const [excludedSubfolders, setExcludedSubfolders] = useState<string[]>(['node_modules', '.git']);
  const [excludeInput, setExcludeInput] = useState('');
  const [preview, setPreview] = useState<DuplicatePreview | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [keepPaths, setKeepPaths] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quarantineCount, setQuarantineCount] = useState<number | null>(null);
  const cleanupTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DF02') || null, [tools]);
  const restoreTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DF10') || null, [tools]);

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

  const scan = useCallback(async () => {
    if (!folderPath.trim()) {
      setError(lang === 'ar' ? 'اختر مجلداً قبل بدء الفحص.' : 'Choose a folder before starting the scan.');
      return;
    }
    setLoading(true);
    setError('');
    setPreview(null);
    setSelectedGroupIds(new Set());
    setKeepPaths({});
    setSearchQuery('');
    try {
      const { preview: next } = await api.duplicatePreview(folderPath, {
        types: types.length ? types : ['all'],
        keeperPolicy,
        excludeSubfolders: excludedSubfolders,
      });

      // Filter groups client-side as defense in depth against excluded subfolders
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
      // Default to selecting all groups so users immediately see the full reclaimed potential
      setSelectedGroupIds(new Set(sanitizedPreview.Groups.map((group) => group.Id)));
      api.duplicateQuarantine().then(({ quarantine }) => setQuarantineCount(quarantine.Entries.length)).catch(() => setQuarantineCount(null));
    } catch {
      setError(lang === 'ar' ? 'تعذر إكمال فحص التكرارات. تأكد من أن خدمة KNOUX المحلية تعمل وأن المجلد متاح.' : 'KNOUX could not finish the duplicate scan. Check that the local service is running and the folder is available.');
    } finally {
      setLoading(false);
    }
  }, [excludedSubfolders, folderPath, keeperPolicy, lang, types]);

  // Filter groups by file name based on search query
  const filteredGroups = useMemo(() => {
    if (!preview) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return preview.Groups;
    return preview.Groups.filter((group) =>
      group.Files.some(
        (file) =>
          file.Name.toLowerCase().includes(query) ||
          file.Path.toLowerCase().includes(query)
      )
    );
  }, [preview, searchQuery]);

  const selectedGroups = preview?.Groups.filter((group) => selectedGroupIds.has(group.Id)) || [];
  const selectedBytes = selectedGroups.reduce((total, group) => total + group.RecoverableBytes, 0);

  // Selection states specifically scoped to filtered groups
  const matchedSelectedCount = useMemo(() => {
    return filteredGroups.filter((g) => selectedGroupIds.has(g.Id)).length;
  }, [filteredGroups, selectedGroupIds]);

  const allFilteredSelected = filteredGroups.length > 0 && matchedSelectedCount === filteredGroups.length;
  const noneFilteredSelected = matchedSelectedCount === 0;
  const someFilteredSelected = !allFilteredSelected && !noneFilteredSelected;

  // Toggle that allows users to quickly select or deselect all items currently matched by the search filter
  const toggleFilteredSelection = () => {
    if (filteredGroups.length === 0) return;
    setSelectedGroupIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        // Deselect only the items currently matched by the search filter
        filteredGroups.forEach((group) => next.delete(group.Id));
      } else {
        // Select all items currently matched by the search filter
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

  const toggleType = (id: DuplicateFileType) => setTypes((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleGroup = (id: string) => setSelectedGroupIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  
  const prepareQuarantine = () => {
    if (!preview || !cleanupTool || !selectedGroups.length) return;
    onPrepareRun(cleanupTool, 'run', { duplicatePreviewId: preview.PreviewId, duplicateKeepPaths: selectedGroups.map((group) => ({ groupId: group.Id, keepPath: keepPaths[group.Id] || group.KeepPath })) });
  };

  const reviewQuarantine = async () => {
    try { const { quarantine } = await api.duplicateQuarantine(); setQuarantineCount(quarantine.Entries.length); } catch { setQuarantineCount(null); }
    if (restoreTool) onPrepareRun(restoreTool, 'analyze', {});
  };

  return (
    <div className="duplicate-organizer-app">
      <section className="duplicate-command-hero">
        <div className="duplicate-hero-icon"><Copy size={30} /></div>
        <div>
          <p>{lang === 'ar' ? 'منظّم الملفات المكررة' : 'Duplicate file organizer'}</p>
          <h2>{lang === 'ar' ? 'راجع النسخ المتشابهة قبل تحرير المساحة' : 'Review matching copies before freeing space'}</h2>
          <span>{lang === 'ar' ? 'يستخدم الفحص بصمات المحتوى، ثم يضع الملفات المختارة في حجر قابل للاستعادة بدلاً من حذفها نهائياً.' : 'The scan uses content hashes, then places approved copies in recoverable quarantine instead of deleting them permanently.'}</span>
        </div>
        <div className="duplicate-hero-status">
          <span><ShieldCheck size={14} />{lang === 'ar' ? 'استعادة محمية' : 'Protected recovery'}</span>
          <strong>{quarantineCount === null ? '—' : quarantineCount.toLocaleString(lang)}</strong>
          <small>{lang === 'ar' ? 'عنصراً في الحجر' : 'items in quarantine'}</small>
        </div>
      </section>

      <section className="duplicate-scan-setup">
        <div className="app-section-title">
          <div>
            <p>{lang === 'ar' ? 'إعداد الفحص' : 'Scan setup'}</p>
            <h2>{lang === 'ar' ? 'اختر ما تريد مراجعته' : 'Choose what to review'}</h2>
          </div>
          {preview && (
            <button type="button" className="duplicate-export-button" onClick={() => exportPreview(preview)}>
              <Download size={14} />{lang === 'ar' ? 'تصدير نتائج الفحص' : 'Export scan results'}
            </button>
          )}
        </div>
        <div className="duplicate-folder-row">
          <FolderOpen size={18} />
          <div>
            <small>{lang === 'ar' ? 'المجلد المختار' : 'Selected folder'}</small>
            <strong>{folderPath || (lang === 'ar' ? 'لم يتم اختيار مجلد' : 'No folder selected')}</strong>
          </div>
          <button type="button" onClick={() => setPickerOpen(true)}>
            {lang === 'ar' ? 'اختيار مجلد' : 'Choose folder'}
          </button>
        </div>
        <div className="duplicate-type-list">
          {TYPE_OPTIONS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={types.includes(item.id) ? 'is-active' : ''}
              onClick={() => toggleType(item.id)}
            >
              {types.includes(item.id) && <Check size={13} />}
              {lang === 'ar' ? item.ar : item.en}
            </button>
          ))}
        </div>

        {/* Sub-Folders Exclusion Section */}
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

          <p className="duplicate-exclude-hint">
            {lang === 'ar'
              ? 'حدد المجلدات أو المسارات الفرعية لتخطيها أثناء فحص التكرارات (مثل حزم المشروعات ومجلدات التخزين المؤقت):'
              : 'Specify sub-folder names or paths to ignore during duplicate analysis (e.g., project dependencies or caches):'}
          </p>

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
              title={lang === 'ar' ? 'إضافة المجلد إلى قائمة الاستبعاد' : 'Add folder to exclusion list'}
            >
              <Plus size={14} />
              {lang === 'ar' ? 'إضافة استبعاد' : 'Add Exclude'}
            </button>
          </div>

          {/* Active Excluded Sub-Folders Chips */}
          {excludedSubfolders.length > 0 && (
            <div className="duplicate-exclude-tags">
              {excludedSubfolders.map((folder) => (
                <span key={folder} className="duplicate-exclude-tag">
                  <FolderMinus size={12} />
                  <code>{folder}</code>
                  <button
                    type="button"
                    onClick={() => handleRemoveExclude(folder)}
                    title={lang === 'ar' ? `إزالة ${folder} من الاستبعاد` : `Remove ${folder} from exclusion`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="duplicate-exclude-clear-all"
                onClick={() => setExcludedSubfolders([])}
                title={lang === 'ar' ? 'مسح كافة الاستبعادات' : 'Clear all exclusions'}
              >
                {lang === 'ar' ? 'مسح الكل' : 'Clear all'}
              </button>
            </div>
          )}

          {/* Quick Presets */}
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

        <div className="duplicate-policy-row">
          <span>{lang === 'ar' ? 'النسخة التي تُحفظ' : 'Keep policy'}</span>
          <button
            type="button"
            className={keeperPolicy === 'OldestThenAlphabetical' ? 'is-active' : ''}
            onClick={() => setKeeperPolicy('OldestThenAlphabetical')}
          >
            {lang === 'ar' ? 'الأقدم أولاً' : 'Oldest first'}
          </button>
          <button
            type="button"
            className={keeperPolicy === 'Newest' ? 'is-active' : ''}
            onClick={() => setKeeperPolicy('Newest')}
          >
            {lang === 'ar' ? 'الأحدث أولاً' : 'Newest first'}
          </button>
          <button
            type="button"
            className="duplicate-scan-button"
            disabled={loading || !folderPath.trim()}
            onClick={scan}
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <FileSearch size={16} />}
            {loading ? (lang === 'ar' ? 'جارٍ الفحص...' : 'Scanning…') : (lang === 'ar' ? 'فحص المجلد' : 'Scan folder')}
          </button>
        </div>
        {error && <p className="duplicate-error"><TriangleAlert size={15} />{error}</p>}
      </section>

      {preview && (
        <>
          <section className="duplicate-results-summary">
            <article>
              <span>{lang === 'ar' ? 'المجموعات المكتشفة' : 'Groups found'}</span>
              <strong>{preview.GroupCount.toLocaleString(lang)}</strong>
            </article>
            <article>
              <span>{lang === 'ar' ? 'النسخ الإضافية' : 'Extra copies'}</span>
              <strong>{preview.DuplicateCopies.toLocaleString(lang)}</strong>
            </article>
            <article>
              <span>{lang === 'ar' ? 'المساحة القابلة للاستعادة' : 'Recoverable space'}</span>
              <strong>{formatBytes(preview.RecoverableBytes, lang)}</strong>
            </article>
            <article>
              <span>{lang === 'ar' ? 'ينتهي الفحص' : 'Scan expires'}</span>
              <strong>{new Date(preview.PreviewExpiresAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</strong>
            </article>
          </section>

          {/* Recharts Reclaimed Space Progress Bar & Chart */}
          <ReclaimedSpaceChart
            selectedBytes={selectedBytes}
            totalBytes={preview.RecoverableBytes}
            selectedCount={selectedGroups.length}
            totalCount={preview.Groups.length}
            lang={lang}
          />

          <section className="duplicate-review-board">
            <div className="app-section-title">
              <div>
                <p>{lang === 'ar' ? 'مراجعة آمنة' : 'Safe review'}</p>
                <h2>{lang === 'ar' ? 'اختر المجموعات ثم عيّن النسخة المحفوظة' : 'Select groups, then choose the kept copy'}</h2>
              </div>
              <span className="product-evidence-badge">
                <Sparkles size={13} />
                {lang === 'ar' ? 'بصمات محتوى فعلية' : 'Real content hashes'}
              </span>
            </div>

            {/* Search Bar & Select All / Deselect All Toolbar */}
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
                    title={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="duplicate-batch-actions">
                {/* Search Filter Quick Toggle: Select or deselect all items currently matched by search filter */}
                <button
                  type="button"
                  className={`duplicate-filter-toggle-btn ${
                    allFilteredSelected
                      ? 'is-all-selected'
                      : someFilteredSelected
                      ? 'is-some-selected'
                      : ''
                  }`}
                  onClick={toggleFilteredSelection}
                  disabled={filteredGroups.length === 0}
                  title={
                    allFilteredSelected
                      ? (lang === 'ar'
                          ? 'إلغاء تحديد كافة المجموعات المطابقة لفلتر البحث'
                          : 'Deselect all groups matched by search filter')
                      : (lang === 'ar'
                          ? 'تحديد كافة المجموعات المطابقة لفلتر البحث'
                          : 'Select all groups matched by search filter')
                  }
                >
                  {allFilteredSelected ? (
                    <CheckSquare size={14} className="duplicate-toggle-icon is-checked" />
                  ) : someFilteredSelected ? (
                    <MinusSquare size={14} className="duplicate-toggle-icon is-partial" />
                  ) : (
                    <Square size={14} className="duplicate-toggle-icon is-unchecked" />
                  )}
                  <span>
                    {searchQuery.trim()
                      ? (allFilteredSelected
                          ? (lang === 'ar' ? 'إلغاء تحديد المطابق' : 'Deselect Matches')
                          : (lang === 'ar' ? 'تحديد نتائج البحث' : 'Select Matches'))
                      : (allFilteredSelected
                          ? (lang === 'ar' ? 'إلغاء تحديد المعروض' : 'Deselect Displayed')
                          : (lang === 'ar' ? 'تحديد المعروض' : 'Select Displayed'))
                    }
                  </span>
                  <span className="duplicate-filter-toggle-count">
                    {matchedSelectedCount} / {filteredGroups.length}
                  </span>
                </button>

                <button
                  type="button"
                  className={`duplicate-batch-btn ${allFilteredSelected ? 'is-active' : ''}`}
                  onClick={selectAll}
                  disabled={allFilteredSelected || filteredGroups.length === 0}
                  title={lang === 'ar' ? 'تحديد كافة المجموعات المطابقة للفلتر' : 'Select all groups matched by search filter'}
                >
                  <CheckCheck size={14} />
                  {searchQuery.trim() ? (lang === 'ar' ? 'تحديد المطابق' : 'Select Matches') : (lang === 'ar' ? 'تحديد الكل' : 'Select All')}
                </button>

                <button
                  type="button"
                  className="duplicate-batch-btn"
                  onClick={deselectAll}
                  disabled={noneFilteredSelected}
                  title={lang === 'ar' ? 'إلغاء تحديد المجموعات المطابقة للفلتر' : 'Deselect groups matched by search filter'}
                >
                  <MinusSquare size={14} />
                  {searchQuery.trim() ? (lang === 'ar' ? 'إلغاء تحديد المطابق' : 'Deselect Matches') : (lang === 'ar' ? 'إلغاء الكل' : 'Deselect All')}
                </button>

                <span className="duplicate-selection-count">
                  <CheckSquare size={12} />
                  {selectedGroups.length} / {preview.Groups.length} {lang === 'ar' ? 'محدد كلياً' : 'total selected'}
                </span>
              </div>
            </div>

            {/* Display duplicate groups or empty state */}
            {filteredGroups.length === 0 ? (
              <div className="duplicate-empty-search">
                <Search size={24} />
                <strong>{lang === 'ar' ? 'لم يتم العثور على ملفات مطابقة' : 'No matching duplicate files found'}</strong>
                <p>
                  {lang === 'ar'
                    ? `لا توجد نتائج مطابقة لعبارة "${searchQuery}". جرب البحث باسم ملف آخر.`
                    : `No duplicate files match "${searchQuery}". Try searching with a different keyword.`}
                </p>
                <button type="button" onClick={() => setSearchQuery('')}>
                  {lang === 'ar' ? 'إعادة ضبط البحث' : 'Reset search filter'}
                </button>
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

          <section className="duplicate-action-dock">
            <div>
              <span>{lang === 'ar' ? 'خطة الحجر المختارة' : 'Selected quarantine plan'}</span>
              <strong>
                {selectedGroups.length.toLocaleString(lang)} {lang === 'ar' ? 'مجموعة · ' : 'groups · '}
                {formatBytes(selectedBytes, lang)}
              </strong>
              <small>{lang === 'ar' ? 'لن تُنقل الملفات قبل نافذة التأكيد. تستطيع استعادتها لاحقاً.' : 'No files move before confirmation. You can restore them later.'}</small>
            </div>
            <div>
              <button type="button" onClick={reviewQuarantine} disabled={!restoreTool}>
                <ArchiveRestore size={15} />
                {lang === 'ar' ? 'مراجعة الحجر' : 'Review quarantine'}
              </button>
              <button
                type="button"
                className="duplicate-quarantine-button"
                onClick={prepareQuarantine}
                disabled={!cleanupTool || !selectedGroups.length}
              >
                <ShieldCheck size={15} />
                {lang === 'ar' ? 'إرسال إلى الحجر الآمن' : 'Send to safe quarantine'}
              </button>
            </div>
          </section>
        </>
      )}

      {pickerOpen && (
        <WorkspaceFolderPicker
          lang={lang}
          initialPath={folderPath}
          onClose={() => setPickerOpen(false)}
          onSelect={(path) => {
            setFolderPath(path);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
