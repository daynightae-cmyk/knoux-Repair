import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUp, Check, ChevronRight, Folder, HardDrive, Home, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { api, type LocalFolderListing, type LocalFolderRoot } from '../lib/api';
import type { Lang } from '../lib/i18n';

interface WorkspaceFolderPickerProps {
  lang: Lang;
  initialPath?: string;
  onSelect: (folderPath: string) => void;
  onClose: () => void;
}

const COPY = {
  en: {
    title: 'Choose project workspace',
    description: 'Browse local drives and folders. This dialog reads folder names only; it does not read or modify project files.',
    current: 'Current folder',
    directPath: 'Open direct path',
    go: 'Open',
    up: 'Parent folder',
    refresh: 'Refresh',
    choose: 'Use this folder',
    roots: 'Locations',
    noFolders: 'No readable subfolders here.',
    truncated: 'Only the first 320 folders are shown. Navigate deeper or use a direct path.',
    close: 'Close',
  },
  ar: {
    title: 'اختيار مساحة عمل المشروع',
    description: 'تصفّح الأقراص والمجلدات المحلية. تقرأ هذه النافذة أسماء المجلدات فقط ولا تقرأ ملفات المشروع أو تعدّلها.',
    current: 'المجلد الحالي',
    directPath: 'فتح مسار مباشر',
    go: 'فتح',
    up: 'المجلد الأب',
    refresh: 'تحديث',
    choose: 'استخدم هذا المجلد',
    roots: 'المواقع',
    noFolders: 'لا توجد مجلدات فرعية قابلة للقراءة هنا.',
    truncated: 'يظهر أول 320 مجلدًا فقط. انتقل إلى مجلد أعمق أو استخدم مسارًا مباشرًا.',
    close: 'إغلاق',
  },
};

export default function WorkspaceFolderPicker({ lang, initialPath, onSelect, onClose }: WorkspaceFolderPickerProps) {
  const text = COPY[lang];
  const [roots, setRoots] = useState<LocalFolderRoot[]>([]);
  const [listing, setListing] = useState<LocalFolderListing | null>(null);
  const [pathInput, setPathInput] = useState(initialPath || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (targetPath?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.folders(targetPath);
      setListing(data);
      setPathInput(data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.folderRoots().then(({ roots: data }) => setRoots(data)).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    load(initialPath);
  }, [initialPath, load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const folderItems = useMemo(() => listing?.folders || [], [listing]);
  const rootIcon = (root: LocalFolderRoot) => root.kind === 'home' ? <Home size={14} /> : <HardDrive size={14} />;

  return (
    <div className="workspace-picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="workspace-picker" role="dialog" aria-modal="true" aria-labelledby="workspace-picker-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="workspace-picker-header">
          <div><p className="eyebrow">{text.roots}</p><h2 id="workspace-picker-title">{text.title}</h2><p>{text.description}</p></div>
          <button type="button" className="workspace-picker-close" onClick={onClose} aria-label={text.close}><X size={17} /></button>
        </header>

        <div className="workspace-picker-roots" aria-label={text.roots}>
          {roots.map((root) => <button type="button" key={root.path} onClick={() => load(root.path)}>{rootIcon(root)} <span>{root.name}</span></button>)}
        </div>

        <form className="workspace-picker-direct" onSubmit={(event) => { event.preventDefault(); load(pathInput); }}>
          <label><span>{text.directPath}</span><input value={pathInput} onChange={(event) => setPathInput(event.target.value)} placeholder="D:\\Projects\\my-app" /></label>
          <button type="submit" disabled={!pathInput.trim() || loading}>{text.go}</button>
        </form>

        <div className="workspace-picker-location">
          <div><Folder size={15} /><span>{listing?.path || text.current}</span></div>
          <div className="workspace-picker-location-actions">
            <button type="button" onClick={() => listing?.parentPath && load(listing.parentPath)} disabled={!listing?.parentPath || loading} title={text.up}><ArrowUp size={15} /></button>
            <button type="button" onClick={() => load(listing?.path)} disabled={loading} title={text.refresh}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} /></button>
          </div>
        </div>

        <div className="workspace-picker-list" aria-live="polite">
          {loading && <div className="workspace-picker-state"><LoaderCircle size={19} className="is-spinning" /></div>}
          {!loading && error && <div className="workspace-picker-state is-error">{error}</div>}
          {!loading && !error && folderItems.length === 0 && <div className="workspace-picker-state">{text.noFolders}</div>}
          {!loading && !error && folderItems.map((folder) => (
            <button type="button" className="workspace-folder-row" key={folder.path} onClick={() => load(folder.path)}>
              <Folder size={17} /><span>{folder.name}</span><ChevronRight size={15} />
            </button>
          ))}
        </div>

        {!loading && !error && listing?.truncated && <p className="workspace-picker-note">{text.truncated}</p>}
        <footer className="workspace-picker-footer">
          <button type="button" className="workspace-picker-cancel" onClick={onClose}>{text.close}</button>
          <button type="button" className="workspace-picker-select" disabled={!listing?.path || loading || Boolean(error)} onClick={() => listing && onSelect(listing.path)}><Check size={15} /> {text.choose}</button>
        </footer>
      </section>
    </div>
  );
}
