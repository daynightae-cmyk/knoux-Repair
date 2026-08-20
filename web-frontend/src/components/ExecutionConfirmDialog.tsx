import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileKey2, FolderOpen, ShieldCheck, X } from 'lucide-react';
import type { BridgeTool, ExecutionMode, ToolRunOptions } from '../lib/api';
import type { Lang } from '../lib/i18n';
import WorkspaceFolderPicker from './WorkspaceFolderPicker';

interface ExecutionConfirmDialogProps {
  tool: BridgeTool;
  mode: ExecutionMode;
  lang: Lang;
  onConfirm: (options: ToolRunOptions) => void;
  onCancel: () => void;
  initialOptions?: ToolRunOptions;
}

const COPY = {
  en: {
    title: 'Confirm real execution',
    close: 'Close',
    risk: 'Risk level',
    mode: 'Requested action',
    analyzeMode: 'Analyze only — no changes',
    previewMode: 'Preview / what-if — no changes',
    runMode: 'Real execution',
    backup: 'Recovery safeguard',
    rollback: 'Rollback path',
    selection: 'Restore selection',
    selectionHint: 'Enter comma-separated item numbers exactly as listed by the Analyze result, for example: 1,3,5.',
    source: 'Local repair source',
    sourceHint: 'Optional absolute path to a valid WIM or ESD source. The script validates it before using it.',
    workspace: 'Project workspace',
    workspaceHint: 'Choose the local project folder. The selected path is passed only to this workspace-aware tool.',
    browse: 'Browse folders',
    sourceIndex: 'Source image index',
    packageId: 'Exact package identifier',
    packageIdHint: 'Use the exact Winget or Appx identifier shown by the inventory. This value is passed only to a script that declares PackageId.',
    quick: 'Use the script’s supported quick mode',
    confirm: 'Type the tool ID to enable real execution',
    cancel: 'Cancel',
    execute: 'Execute real service',
    recoveryAck: 'I reviewed the listed recovery safeguard and rollback path.',
    wait: 'Safety delay: wait {seconds}s before execution.',
    continue: 'Continue with confirmed action',
    protected: 'No simulated action is performed. The bridge invokes only the manifest-registered PowerShell script.',
  },
  ar: {
    title: 'تأكيد التنفيذ الفعلي',
    close: 'إغلاق',
    risk: 'مستوى المخاطر',
    mode: 'الإجراء المطلوب',
    analyzeMode: 'تحليل فقط — دون تغييرات',
    previewMode: 'معاينة / ماذا لو — دون تغييرات',
    runMode: 'تنفيذ فعلي',
    backup: 'ضمان الاسترداد',
    rollback: 'مسار التراجع',
    selection: 'اختيار عناصر الاستعادة',
    selectionHint: 'أدخل أرقام العناصر مفصولة بفواصل كما ظهرت حرفيًا في نتيجة التحليل، مثال: 1,3,5.',
    source: 'مصدر إصلاح محلي',
    sourceHint: 'مسار مطلق اختياري لملف WIM أو ESD صالح. يتحقق السكربت منه قبل استخدامه.',
    workspace: 'مساحة عمل المشروع',
    workspaceHint: 'اختر مجلد المشروع المحلي. لا يمرر المسار إلا إلى الأداة الحالية المرتبطة بمساحة العمل.',
    browse: 'تصفّح المجلدات',
    sourceIndex: 'فهرس صورة المصدر',
    packageId: 'معرّف الحزمة الدقيق',
    packageIdHint: 'استخدم معرّف Winget أو Appx الدقيق الظاهر في الجرد. لا يمرر إلا إلى سكربت يعلن دعم PackageId.',
    quick: 'استخدم الوضع السريع المدعوم من السكربت',
    confirm: 'اكتب معرّف الأداة لتفعيل التنفيذ الفعلي',
    cancel: 'إلغاء',
    execute: 'تنفيذ الخدمة الفعلية',
    recoveryAck: 'راجعت ضمان الاسترداد ومسار التراجع المذكورين.',
    wait: 'مهلة أمان: انتظر {seconds} ث قبل التنفيذ.',
    continue: 'المتابعة بالإجراء المؤكد',
    protected: 'لا يُنفذ أي إجراء محاكى. يستدعي الجسر سكربت PowerShell المسجل في ملف الأدوات فقط.',
  },
};

function requiresTypedConfirmation(tool: BridgeTool): boolean {
  return tool.RiskLevel === 'DESTRUCTIVE' || tool.RiskLevel === 'SYSTEM_REPAIR' || tool.RiskLevel === 'REBOOT_REQUIRED';
}

export default function ExecutionConfirmDialog({ tool, mode, lang, onConfirm, onCancel, initialOptions = {} }: ExecutionConfirmDialogProps) {
  const text = COPY[lang];
  const [confirmation, setConfirmation] = useState('');
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const safetyDelay = mode === 'run' && tool.RiskLevel === 'DESTRUCTIVE' ? 5 : 0;
  const [secondsRemaining, setSecondsRemaining] = useState(safetyDelay);
  const [selection, setSelection] = useState(initialOptions.selection || '');
  const [localSourcePath, setLocalSourcePath] = useState(initialOptions.localSourcePath || '');
  const [localSourceIndex, setLocalSourceIndex] = useState(initialOptions.localSourceIndex === undefined ? '' : String(initialOptions.localSourceIndex));
  const [packageId, setPackageId] = useState(initialOptions.packageId || '');
  const [quick, setQuick] = useState(Boolean(initialOptions.quick));
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  const params = useMemo(() => new Set(tool.Parameters || []), [tool.Parameters]);
  const needsSelection = params.has('Selection');
  const needsSource = params.has('LocalSourcePath');
  const needsSourceIndex = params.has('LocalSourceIndex');
  const needsPackageId = params.has('PackageId');
  const supportsQuick = params.has('Quick');
  const isDeveloperWorkspace = ['12-Developer-Tools', '18-Project-Sonar'].includes(tool.Category) && needsSource;
  const typedConfirmation = mode === 'run' && requiresTypedConfirmation(tool);
  const hasRecovery = Boolean(tool.BackupMethod && !/^none(?:\b|\s)/i.test(tool.BackupMethod.trim()));
  const requiresRecoveryAcknowledgement = mode === 'run' && tool.RiskLevel !== 'READ_ONLY' && hasRecovery;
  const actionLabel = mode === 'analyze' ? text.analyzeMode : mode === 'preview' ? text.previewMode : text.runMode;
  const validSelection = mode !== 'run' || !needsSelection || /^\d+(\s*,\s*\d+)*$/.test(selection.trim());
  const validSourceIndex = !localSourceIndex.trim() || /^\d+$/.test(localSourceIndex.trim());
  const validPackageId = mode !== 'run' || !needsPackageId || /^[A-Za-z0-9._-]+$/.test(packageId.trim());
  const canConfirm = validSelection && validPackageId && validSourceIndex && secondsRemaining === 0 && (!requiresRecoveryAcknowledgement || recoveryAcknowledged) && (!typedConfirmation || confirmation.trim().toUpperCase() === tool.ToolId.toUpperCase());

  useEffect(() => {
    if (safetyDelay === 0) return;
    const timer = window.setInterval(() => setSecondsRemaining((value) => value <= 1 ? (window.clearInterval(timer), 0) : value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [safetyDelay]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm({
      selection: selection.trim() || undefined,
      localSourcePath: localSourcePath.trim() || undefined,
      localSourceIndex: localSourceIndex.trim() ? Number(localSourceIndex) : undefined,
      packageId: packageId.trim() || undefined,
      quick: supportsQuick ? quick : undefined,
    });
  };

  return (
    <div className="execution-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="execution-dialog-title"
        className="execution-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="execution-dialog-close" onClick={onCancel} aria-label={text.close}><X size={17} /></button>
        <div className="execution-dialog-icon"><AlertTriangle size={22} /></div>
        <p className="execution-dialog-kicker">{tool.ToolId}</p>
        <h2 id="execution-dialog-title">{text.title}</h2>
        <p className="execution-dialog-name">{lang === 'ar' ? tool.ArabicName || tool.EnglishName : tool.EnglishName}</p>
        <p className="execution-dialog-purpose">{tool.Purpose}</p>

        <dl className="execution-dialog-facts">
          <div><dt>{text.mode}</dt><dd>{actionLabel}</dd></div>
          <div><dt>{text.risk}</dt><dd>{tool.RiskLevel.replace(/_/g, ' ')}</dd></div>
          <div><dt>{text.backup}</dt><dd>{tool.BackupMethod || '—'}</dd></div>
          <div><dt>{text.rollback}</dt><dd>{tool.RollbackMethod || '—'}</dd></div>
        </dl>

        {needsSelection && (
          <label className="execution-dialog-field">
            <span><FileKey2 size={14} /> {text.selection}</span>
            <input value={selection} onChange={(event) => setSelection(event.target.value)} placeholder="1,3,5" autoFocus />
            <small>{text.selectionHint}</small>
          </label>
        )}

        {needsSource && (
          <label className="execution-dialog-field">
            <span><FolderOpen size={14} /> {isDeveloperWorkspace ? text.workspace : text.source}</span>
            {isDeveloperWorkspace ? (
              <div className="execution-dialog-path-control">
                <input value={localSourcePath} onChange={(event) => setLocalSourcePath(event.target.value)} placeholder="D:\\Projects\\my-app" />
                <button type="button" onClick={() => setFolderPickerOpen(true)}>{text.browse}</button>
              </div>
            ) : <input value={localSourcePath} onChange={(event) => setLocalSourcePath(event.target.value)} placeholder="D:\\sources\\install.wim" />}
            <small>{isDeveloperWorkspace ? text.workspaceHint : text.sourceHint}</small>
          </label>
        )}

        {needsSourceIndex && (
          <label className="execution-dialog-field">
            <span>{text.sourceIndex}</span>
            <input inputMode="numeric" value={localSourceIndex} onChange={(event) => setLocalSourceIndex(event.target.value)} placeholder="1" />
          </label>
        )}

        {needsPackageId && (
          <label className="execution-dialog-field">
            <span><FileKey2 size={14} /> {text.packageId}</span>
            <input value={packageId} onChange={(event) => setPackageId(event.target.value)} placeholder="Vendor.Package" autoFocus={!needsSelection && !needsSource} />
            <small>{text.packageIdHint}</small>
          </label>
        )}

        {supportsQuick && (
          <label className="execution-dialog-check">
            <input type="checkbox" checked={quick} onChange={(event) => setQuick(event.target.checked)} />
            <span>{text.quick}</span>
          </label>
        )}

        {requiresRecoveryAcknowledgement && (
          <label className="execution-dialog-check">
            <input type="checkbox" checked={recoveryAcknowledged} onChange={(event) => setRecoveryAcknowledged(event.target.checked)} />
            <span>{text.recoveryAck}</span>
          </label>
        )}

        {typedConfirmation && (
          <label className="execution-dialog-field">
            <span><ShieldCheck size={14} /> {text.confirm}</span>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={tool.ToolId} autoFocus={!needsSelection} />
          </label>
        )}

        {secondsRemaining > 0 && <p className="execution-dialog-delay"><AlertTriangle size={14} /> {text.wait.replace('{seconds}', String(secondsRemaining))}</p>}
        <p className="execution-dialog-contract"><ShieldCheck size={14} /> {text.protected}</p>
        {folderPickerOpen && isDeveloperWorkspace && (
          <WorkspaceFolderPicker
            lang={lang}
            initialPath={localSourcePath}
            onClose={() => setFolderPickerOpen(false)}
            onSelect={(folderPath) => { setLocalSourcePath(folderPath); setFolderPickerOpen(false); }}
          />
        )}

        <div className="execution-dialog-actions">
          <button type="button" className="execution-dialog-cancel" onClick={onCancel}>{text.cancel}</button>
          <button type="button" className="execution-dialog-confirm" onClick={confirm} disabled={!canConfirm}>{mode === 'run' ? text.execute : text.continue}</button>
        </div>
      </section>
    </div>
  );
}
