import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Copy, FileSearch, FolderOpen, Image, Radar, ScanSearch, ShieldCheck } from 'lucide-react';
import { api, type BridgeTool, type DuplicatePreview } from '../lib/api';
import type { Lang } from '../lib/i18n';
import WorkspaceFolderPicker from './WorkspaceFolderPicker';

interface DuplicateExplorerPanelProps {
  lang: Lang;
  tools: BridgeTool[];
  onRequestExecution: (tool: BridgeTool, options: { localSourcePath: string }) => void;
}

const COPY = {
  en: {
    kicker: 'Duplicate evidence laboratory', title: 'Scan the folder you choose — not a hidden default', body: 'The scanner hashes eligible files inside the selected folder, groups byte-identical copies, and shows the intended retained file before any quarantine workflow.', choose: 'Choose folder', scan: 'Scan selected folder', scanning: 'Hashing local evidence…', chooseFirst: 'Choose a folder first', files: 'files observed', groups: 'duplicate groups', copies: 'extra copies', reclaim: 'recoverable', clear: 'No duplicate groups were found in the bounded scan.', results: 'Evidence queue', retain: 'Keep', candidates: 'copies in this group', seeFiles: 'Show files', hideFiles: 'Hide files', preview: 'Read-only preview', safe: 'No files are moved or deleted during this scan.', next: 'Open confirmed quarantine', nextHint: 'Uses the selected folder and the existing mandatory confirmation flow.', truncated: 'Only the first visible groups are shown. The report retains the full bounded evidence set.', error: 'The duplicate preview could not complete.',
  },
  ar: {
    kicker: 'مختبر أدلة التكرار', title: 'افحص المجلد الذي تختاره — لا مسارًا افتراضيًا مخفيًا', body: 'يحسب الفاحص بصمات الملفات المؤهلة داخل المجلد المختار، ويجمع النسخ المتطابقة بالبايت، ويعرض الملف الذي سيُحتفظ به قبل أي مسار عزل.', choose: 'اختيار مجلد', scan: 'فحص المجلد المختار', scanning: 'يجري حساب بصمات الأدلة المحلية…', chooseFirst: 'اختر مجلدًا أولًا', files: 'ملف مرصود', groups: 'مجموعة مكررة', copies: 'نسخة زائدة', reclaim: 'قابل للاسترداد', clear: 'لم تُكتشف مجموعات مكررة ضمن نافذة الفحص المحددة.', results: 'طابور الأدلة', retain: 'يُحتفظ بـ', candidates: 'نسخ في هذه المجموعة', seeFiles: 'عرض الملفات', hideFiles: 'إخفاء الملفات', preview: 'معاينة للقراءة فقط', safe: 'لا يُنقل أو يُحذف أي ملف أثناء هذا الفحص.', next: 'فتح العزل المؤكد', nextHint: 'يستخدم المجلد المختار ومسار التأكيد الإلزامي الموجود.', truncated: 'يظهر أول مجموعات الأدلة فقط، بينما يحتفظ التقرير بمجموعة الأدلة المحددة كاملة.', error: 'تعذر إكمال معاينة التكرارات.',
  },
};

function formatBytes(value: number, lang: Lang) {
  if (!Number.isFinite(value) || value <= 0) return lang === 'ar' ? '0 بايت' : '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toLocaleString(lang === 'ar' ? 'ar' : 'en', { maximumFractionDigits: 1 })} ${units[index]}`;
}

export default function DuplicateExplorerPanel({ lang, tools, onRequestExecution }: DuplicateExplorerPanelProps) {
  const text = COPY[lang];
  const [folder, setFolder] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<DuplicatePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const quarantineTool = tools.find((tool) => tool.ToolId === 'DF02') || tools.find((tool) => tool.ToolId === 'DF03');
  const groups = useMemo(() => preview?.Groups || [], [preview]);

  const scan = async () => {
    if (!folder || loading) return;
    setLoading(true); setError(''); setPreview(null); setOpenGroup(null);
    try { setPreview((await api.duplicatePreview(folder)).preview); }
    catch (e) { setError(e instanceof Error ? e.message : text.error); }
    finally { setLoading(false); }
  };

  return (
    <aside className="duplicate-explorer" aria-label={text.title}>
      <div className="duplicate-explorer-glow" />
      <header className="duplicate-explorer-head">
        <div className="duplicate-explorer-radar"><Radar size={24} className={loading ? 'is-scanning' : ''} /></div>
        <div><p className="eyebrow">{text.kicker}</p><h3>{text.title}</h3><p>{text.body}</p></div>
        <span className="duplicate-explorer-safe"><ShieldCheck size={13} />{text.preview}</span>
      </header>

      <div className="duplicate-explorer-controls">
        <div className="duplicate-explorer-path"><FolderOpen size={16} /><span>{folder || text.chooseFirst}</span></div>
        <button type="button" onClick={() => setPickerOpen(true)}><FolderOpen size={15} />{text.choose}</button>
        <button type="button" className="is-primary" onClick={scan} disabled={!folder || loading}><ScanSearch size={15} className={loading ? 'is-spinning' : ''} />{loading ? text.scanning : text.scan}</button>
      </div>

      <div className="duplicate-explorer-live" aria-live="polite">
        <span><FileSearch size={14} /><b>{preview?.FilesObserved?.toLocaleString() || '—'}</b>{text.files}</span>
        <span><Copy size={14} /><b>{preview?.GroupCount ?? '—'}</b>{text.groups}</span>
        <span><Image size={14} /><b>{preview?.DuplicateCopies ?? '—'}</b>{text.copies}</span>
        <span><CheckCircle2 size={14} /><b>{preview ? formatBytes(preview.RecoverableBytes, lang) : '—'}</b>{text.reclaim}</span>
      </div>

      {error && <p className="duplicate-explorer-error"><AlertTriangle size={15} />{error}</p>}
      {preview && <>
        <div className="duplicate-explorer-safety"><ShieldCheck size={15} />{text.safe}</div>
        <div className="duplicate-explorer-results"><div className="duplicate-explorer-results-head"><strong>{text.results}</strong><span>{preview.Folder}</span></div>
          {!groups.length && <div className="duplicate-explorer-empty"><CheckCircle2 size={19} />{text.clear}</div>}
          {groups.map((group, index) => {
            const expanded = openGroup === group.Id;
            return <article className="duplicate-group" key={group.Id}>
              <div className="duplicate-group-main"><span className="duplicate-group-index">{index + 1}</span><div><b>{group.Copies} {text.candidates}</b><p>{formatBytes(group.RecoverableBytes, lang)} {text.reclaim}</p></div><button type="button" onClick={() => setOpenGroup(expanded ? null : group.Id)}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{expanded ? text.hideFiles : text.seeFiles}</button></div>
              <p className="duplicate-group-keep"><ShieldCheck size={13} /><span>{text.retain}</span><code>{group.KeepPath}</code></p>
              {expanded && <div className="duplicate-group-files">{group.Files.map((file) => <div key={file.Path} className={file.Path === group.KeepPath ? 'is-retained' : ''}><span>{file.Path === group.KeepPath ? text.retain : file.Name}</span><code>{file.Path}</code><small>{formatBytes(file.SizeBytes, lang)}</small></div>)}</div>}
            </article>;
          })}
        </div>
        {preview.Truncated && <p className="duplicate-explorer-note">{text.truncated}</p>}
        {quarantineTool && groups.length > 0 && <div className="duplicate-explorer-next"><div><strong>{text.next}</strong><p>{text.nextHint}</p></div><button type="button" onClick={() => onRequestExecution(quarantineTool, { localSourcePath: folder })}><ShieldCheck size={15} />{text.next}</button></div>}
      </>}
      {pickerOpen && <WorkspaceFolderPicker lang={lang} initialPath={folder} onClose={() => setPickerOpen(false)} onSelect={(path) => { setFolder(path); setPickerOpen(false); setPreview(null); setError(''); }} />}
    </aside>
  );
}
