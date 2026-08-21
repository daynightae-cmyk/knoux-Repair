import { useCallback, useMemo, useState } from 'react';
import { ArchiveRestore, Check, CheckCircle2, ChevronDown, Copy, Download, FileSearch, FolderOpen, LoaderCircle, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
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

function GroupCard({ group, lang, selected, keepPath, onToggle, onKeep }: { group: DuplicatePreviewGroup; lang: Lang; selected: boolean; keepPath: string; onToggle: () => void; onKeep: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const primary = group.Files.find((file) => file.Path === keepPath) || group.Files[0];
  return <article className={`duplicate-group-card ${selected ? 'is-selected' : ''}`}>
    <button type="button" className="duplicate-group-main" onClick={onToggle}>
      <span className="duplicate-group-check">{selected ? <Check size={14} /> : null}</span>
      <span className="duplicate-group-copy-count">{group.Copies}</span>
      <div><strong>{primary?.Name || (lang === 'ar' ? 'مجموعة ملفات' : 'File group')}</strong><small>{lang === 'ar' ? `${group.DuplicateCopies} نسخة إضافية · ${formatBytes(group.RecoverableBytes, lang)} قابلة للاستعادة` : `${group.DuplicateCopies} extra copies · ${formatBytes(group.RecoverableBytes, lang)} recoverable`}</small></div>
      <ChevronDown size={16} className={expanded ? 'is-open' : ''} onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }} />
    </button>
    {expanded && <div className="duplicate-group-files">{group.Files.map((file) => <button type="button" key={file.Path} className={file.Path === keepPath ? 'is-keeper' : ''} onClick={() => onKeep(file.Path)}><span>{file.Path === keepPath ? <CheckCircle2 size={15} /> : <Copy size={14} />}</span><div><strong>{file.Name}</strong><small>{file.Path}</small></div><b>{formatBytes(file.SizeBytes, lang)}</b></button>)}</div>}
  </article>;
}

export default function DuplicateOrganizerApp({ lang, tools, onPrepareRun }: DuplicateOrganizerAppProps) {
  const [folderPath, setFolderPath] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [types, setTypes] = useState<DuplicateFileType[]>([]);
  const [keeperPolicy, setKeeperPolicy] = useState<DuplicateKeeperPolicy>('OldestThenAlphabetical');
  const [preview, setPreview] = useState<DuplicatePreview | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [keepPaths, setKeepPaths] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quarantineCount, setQuarantineCount] = useState<number | null>(null);
  const cleanupTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DF02') || null, [tools]);
  const restoreTool = useMemo(() => tools.find((tool) => tool.ToolId === 'DF10') || null, [tools]);

  const scan = useCallback(async () => {
    if (!folderPath.trim()) { setError(lang === 'ar' ? 'اختر مجلداً قبل بدء الفحص.' : 'Choose a folder before starting the scan.'); return; }
    setLoading(true); setError(''); setPreview(null); setSelectedGroupIds(new Set()); setKeepPaths({});
    try {
      const { preview: next } = await api.duplicatePreview(folderPath, { types: types.length ? types : ['all'], keeperPolicy });
      setPreview(next);
      setKeepPaths(Object.fromEntries(next.Groups.map((group) => [group.Id, group.KeepPath])));
      api.duplicateQuarantine().then(({ quarantine }) => setQuarantineCount(quarantine.Entries.length)).catch(() => setQuarantineCount(null));
    } catch {
      setError(lang === 'ar' ? 'تعذر إكمال فحص التكرارات. تأكد من أن خدمة KNOUX المحلية تعمل وأن المجلد متاح.' : 'KNOUX could not finish the duplicate scan. Check that the local service is running and the folder is available.');
    } finally { setLoading(false); }
  }, [folderPath, keeperPolicy, lang, types]);

  const selectedGroups = preview?.Groups.filter((group) => selectedGroupIds.has(group.Id)) || [];
  const selectedBytes = selectedGroups.reduce((total, group) => total + group.RecoverableBytes, 0);
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

  return <div className="duplicate-organizer-app">
    <section className="duplicate-command-hero">
      <div className="duplicate-hero-icon"><Copy size={30} /></div>
      <div><p>{lang === 'ar' ? 'منظّم الملفات المكررة' : 'Duplicate file organizer'}</p><h2>{lang === 'ar' ? 'راجع النسخ المتشابهة قبل تحرير المساحة' : 'Review matching copies before freeing space'}</h2><span>{lang === 'ar' ? 'يستخدم الفحص بصمات المحتوى، ثم يضع الملفات المختارة في حجر قابل للاستعادة بدلاً من حذفها نهائياً.' : 'The scan uses content hashes, then places approved copies in recoverable quarantine instead of deleting them permanently.'}</span></div>
      <div className="duplicate-hero-status"><span><ShieldCheck size={14} />{lang === 'ar' ? 'استعادة محمية' : 'Protected recovery'}</span><strong>{quarantineCount === null ? '—' : quarantineCount.toLocaleString(lang)}</strong><small>{lang === 'ar' ? 'عنصراً في الحجر' : 'items in quarantine'}</small></div>
    </section>

    <section className="duplicate-scan-setup">
      <div className="app-section-title"><div><p>{lang === 'ar' ? 'إعداد الفحص' : 'Scan setup'}</p><h2>{lang === 'ar' ? 'اختر ما تريد مراجعته' : 'Choose what to review'}</h2></div>{preview && <button type="button" className="duplicate-export-button" onClick={() => exportPreview(preview)}><Download size={14} />{lang === 'ar' ? 'تصدير نتائج الفحص' : 'Export scan results'}</button>}</div>
      <div className="duplicate-folder-row"><FolderOpen size={18} /><div><small>{lang === 'ar' ? 'المجلد المختار' : 'Selected folder'}</small><strong>{folderPath || (lang === 'ar' ? 'لم يتم اختيار مجلد' : 'No folder selected')}</strong></div><button type="button" onClick={() => setPickerOpen(true)}>{lang === 'ar' ? 'اختيار مجلد' : 'Choose folder'}</button></div>
      <div className="duplicate-type-list">{TYPE_OPTIONS.map((item) => <button type="button" key={item.id} className={types.includes(item.id) ? 'is-active' : ''} onClick={() => toggleType(item.id)}>{types.includes(item.id) && <Check size={13} />}{lang === 'ar' ? item.ar : item.en}</button>)}</div>
      <div className="duplicate-policy-row"><span>{lang === 'ar' ? 'النسخة التي تُحفظ' : 'Keep policy'}</span><button type="button" className={keeperPolicy === 'OldestThenAlphabetical' ? 'is-active' : ''} onClick={() => setKeeperPolicy('OldestThenAlphabetical')}>{lang === 'ar' ? 'الأقدم أولاً' : 'Oldest first'}</button><button type="button" className={keeperPolicy === 'Newest' ? 'is-active' : ''} onClick={() => setKeeperPolicy('Newest')}>{lang === 'ar' ? 'الأحدث أولاً' : 'Newest first'}</button><button type="button" className="duplicate-scan-button" disabled={loading || !folderPath.trim()} onClick={scan}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : <FileSearch size={16} />}{loading ? (lang === 'ar' ? 'جارٍ الفحص...' : 'Scanning…') : (lang === 'ar' ? 'فحص المجلد' : 'Scan folder')}</button></div>
      {error && <p className="duplicate-error"><TriangleAlert size={15} />{error}</p>}
    </section>

    {preview && <>
      <section className="duplicate-results-summary"><article><span>{lang === 'ar' ? 'المجموعات المكتشفة' : 'Groups found'}</span><strong>{preview.GroupCount.toLocaleString(lang)}</strong></article><article><span>{lang === 'ar' ? 'النسخ الإضافية' : 'Extra copies'}</span><strong>{preview.DuplicateCopies.toLocaleString(lang)}</strong></article><article><span>{lang === 'ar' ? 'المساحة القابلة للاستعادة' : 'Recoverable space'}</span><strong>{formatBytes(preview.RecoverableBytes, lang)}</strong></article><article><span>{lang === 'ar' ? 'ينتهي الفحص' : 'Scan expires'}</span><strong>{new Date(preview.PreviewExpiresAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</strong></article></section>
      <section className="duplicate-review-board"><div className="app-section-title"><div><p>{lang === 'ar' ? 'مراجعة آمنة' : 'Safe review'}</p><h2>{lang === 'ar' ? 'اختر المجموعات ثم عيّن النسخة المحفوظة' : 'Select groups, then choose the kept copy'}</h2></div><span className="product-evidence-badge"><Sparkles size={13} />{lang === 'ar' ? 'بصمات محتوى فعلية' : 'Real content hashes'}</span></div><div className="duplicate-group-list">{preview.Groups.map((group) => <GroupCard key={group.Id} group={group} lang={lang} selected={selectedGroupIds.has(group.Id)} keepPath={keepPaths[group.Id] || group.KeepPath} onToggle={() => toggleGroup(group.Id)} onKeep={(path) => setKeepPaths((current) => ({ ...current, [group.Id]: path }))} />)}</div></section>
      <section className="duplicate-action-dock"><div><span>{lang === 'ar' ? 'خطة الحجر المختارة' : 'Selected quarantine plan'}</span><strong>{selectedGroups.length.toLocaleString(lang)} {lang === 'ar' ? 'مجموعة · ' : 'groups · '}{formatBytes(selectedBytes, lang)}</strong><small>{lang === 'ar' ? 'لن تُنقل الملفات قبل نافذة التأكيد. تستطيع استعادتها لاحقاً.' : 'No files move before confirmation. You can restore them later.'}</small></div><div><button type="button" onClick={reviewQuarantine} disabled={!restoreTool}><ArchiveRestore size={15} />{lang === 'ar' ? 'مراجعة الحجر' : 'Review quarantine'}</button><button type="button" className="duplicate-quarantine-button" onClick={prepareQuarantine} disabled={!cleanupTool || !selectedGroups.length}><ShieldCheck size={15} />{lang === 'ar' ? 'إرسال إلى الحجر الآمن' : 'Send to safe quarantine'}</button></div></section>
    </>}

    {pickerOpen && <WorkspaceFolderPicker lang={lang} initialPath={folderPath} onClose={() => setPickerOpen(false)} onSelect={(path) => { setFolderPath(path); setPickerOpen(false); }} />}
  </div>;
}
