import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileKey2, FolderOpen, ShieldCheck, X } from 'lucide-react';
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
    title: 'Review your request', close: 'Close', action: 'What will happen', impact: 'Expected impact',
    analyzeMode: 'Check only — your device will not be changed', previewMode: 'Show me the plan first — no changes yet', runMode: 'Apply the selected improvement',
    noChange: 'No settings or files will be changed', limitedChange: 'A selected device setting or service may be updated', importantChange: 'This step can make an important device change',
    recovery: 'Recovery option', selection: 'Selected items', selectionHint: 'Enter the item numbers you chose, separated with commas.',
    source: 'Recovery source', sourceHint: 'Choose the recovery file or folder you want this step to use.', workspace: 'Project folder', workspaceHint: 'Choose the project folder you want to check.',
    targetFolder: 'Folder to review', targetFolderHint: 'Choose the folder you want KNOUX to review.', lockedPlanFolder: 'This folder belongs to the review you already approved. Start a new review to choose another folder.',
    browse: 'Choose folder', sourceIndex: 'Recovery option number', app: 'Application identifier', appHint: 'Enter the application identifier shown in your application inventory.',
    quick: 'Use the faster supported option', acknowledge: 'I understand the recovery option shown above.', confirm: 'Type CONFIRM to continue', cancel: 'Go back', execute: 'Start now', continue: 'Continue',
    wait: 'Please wait {seconds}s before continuing.', protected: 'KNOUX will check permissions and recovery safeguards before starting.', duplicatePlan: 'Reviewed duplicate groups', restorePlan: 'Selected recovery items',
  },
  ar: {
    title: 'راجع طلبك', close: 'إغلاق', action: 'ما الذي سيحدث؟', impact: 'الأثر المتوقع',
    analyzeMode: 'فحص فقط — لن يتم تغيير جهازك', previewMode: 'عرض الخطة أولاً — لا توجد تغييرات الآن', runMode: 'تطبيق التحسين الذي اخترته',
    noChange: 'لن يتم تغيير الملفات أو الإعدادات', limitedChange: 'قد يتم تحديث إعداد أو خدمة اخترتها', importantChange: 'قد تؤثر هذه الخطوة في إعداد مهم بالجهاز',
    recovery: 'خيار الاستعادة', selection: 'العناصر المختارة', selectionHint: 'أدخل أرقام العناصر التي اخترتها مفصولة بفواصل.',
    source: 'مصدر الاستعادة', sourceHint: 'اختر ملف أو مجلد الاستعادة الذي تريد استخدامه.', workspace: 'مجلد المشروع', workspaceHint: 'اختر مجلد المشروع الذي تريد فحصه.',
    targetFolder: 'المجلد المطلوب مراجعته', targetFolderHint: 'اختر المجلد الذي تريد من KNOUX مراجعته.', lockedPlanFolder: 'هذا المجلد مرتبط بالمراجعة التي وافقت عليها. ابدأ مراجعة جديدة لاختيار مجلد آخر.',
    browse: 'اختيار مجلد', sourceIndex: 'رقم خيار الاستعادة', app: 'رمز التطبيق', appHint: 'أدخل رمز التطبيق الظاهر في جرد التطبيقات.',
    quick: 'استخدم الخيار الأسرع المدعوم', acknowledge: 'أفهم خيار الاستعادة الموضح أعلاه.', confirm: 'اكتب تأكيد للمتابعة', cancel: 'رجوع', execute: 'ابدأ الآن', continue: 'متابعة',
    wait: 'انتظر {seconds} ث قبل المتابعة.', protected: 'سيتحقق KNOUX من الأذونات وخيارات الاستعادة قبل البدء.', duplicatePlan: 'مجموعات التكرارات المراجعة', restorePlan: 'عناصر الاستعادة المختارة',
  },
};

function needsExtraConfirmation(tool: BridgeTool): boolean {
  return tool.RiskLevel === 'DESTRUCTIVE' || tool.RiskLevel === 'SYSTEM_REPAIR' || tool.RiskLevel === 'REBOOT_REQUIRED';
}

function impactFor(tool: BridgeTool, lang: Lang): string {
  const text = COPY[lang];
  if (tool.RiskLevel === 'READ_ONLY') return text.noChange;
  if (tool.RiskLevel === 'SAFE_CLEANUP') return text.limitedChange;
  return text.importantChange;
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
  const lockedDuplicatePlan = Boolean(initialOptions.duplicatePreviewId);
  const isProjectWorkspace = ['12-Developer-Tools', '18-Project-Sonar'].includes(tool.Category) && needsSource;
  const isFolderTarget = (isProjectWorkspace || ['05-Duplicate-Files', '11-Backup-Recovery'].includes(tool.Category)) && needsSource;
  const requiresPhrase = mode === 'run' && needsExtraConfirmation(tool);
  const hasRecovery = Boolean(tool.BackupMethod && !/^none(?:\b|\s)/i.test(tool.BackupMethod.trim()));
  const requiresRecoveryAcknowledgement = mode === 'run' && tool.RiskLevel !== 'READ_ONLY' && hasRecovery;
  const actionLabel = mode === 'analyze' ? text.analyzeMode : mode === 'preview' ? text.previewMode : text.runMode;
  const validSelection = mode !== 'run' || !needsSelection || /^\d+(\s*,\s*\d+)*$/.test(selection.trim());
  const validSourceIndex = !localSourceIndex.trim() || /^\d+$/.test(localSourceIndex.trim());
  const validPackageId = mode !== 'run' || !needsPackageId || /^[A-Za-z0-9._-]+$/.test(packageId.trim());
  const expectedPhrase = lang === 'ar' ? 'تأكيد' : 'CONFIRM';
  const hasCorrectPhrase = confirmation.trim().toLocaleUpperCase() === expectedPhrase.toLocaleUpperCase();
  const canConfirm = validSelection && validPackageId && validSourceIndex && secondsRemaining === 0 && (!requiresRecoveryAcknowledgement || recoveryAcknowledged) && (!requiresPhrase || hasCorrectPhrase);

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
      ...initialOptions,
      selection: selection.trim() || undefined,
      localSourcePath: localSourcePath.trim() || undefined,
      localSourceIndex: localSourceIndex.trim() ? Number(localSourceIndex) : undefined,
      packageId: packageId.trim() || undefined,
      quick: supportsQuick ? quick : undefined,
    });
  };

  return (
    <div className="execution-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="execution-dialog-title" className="execution-dialog platform-confirmation" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="execution-dialog-close" onClick={onCancel} aria-label={text.close}><X size={17} /></button>
        <div className="execution-dialog-icon"><ShieldCheck size={22} /></div>
        <h2 id="execution-dialog-title">{text.title}</h2>
        <p className="execution-dialog-name">{lang === 'ar' ? tool.ArabicName || tool.EnglishName : tool.EnglishName}</p>
        <p className="execution-dialog-purpose">{tool.Purpose}</p>

        <dl className="execution-dialog-facts platform-confirmation-facts">
          <div><dt>{text.action}</dt><dd>{actionLabel}</dd></div>
          <div><dt>{text.impact}</dt><dd>{impactFor(tool, lang)}</dd></div>
          {hasRecovery && <div><dt>{text.recovery}</dt><dd><CheckCircle2 size={13} /> {lang === 'ar' ? 'خيار استعادة متاح قبل التغيير' : 'A recovery option is available before changes'}</dd></div>}
        </dl>

        {initialOptions.duplicateKeepPaths?.length ? <p className="execution-dialog-contract"><ShieldCheck size={14} /> {text.duplicatePlan}: {initialOptions.duplicateKeepPaths.length}</p> : null}
        {initialOptions.quarantineIds?.length ? <p className="execution-dialog-contract"><ShieldCheck size={14} /> {text.restorePlan}: {initialOptions.quarantineIds.length}</p> : null}

        {needsSelection && <label className="execution-dialog-field"><span><FileKey2 size={14} /> {text.selection}</span><input value={selection} onChange={(event) => setSelection(event.target.value)} placeholder="1, 2, 3" autoFocus /><small>{text.selectionHint}</small></label>}
        {needsSource && <label className="execution-dialog-field"><span><FolderOpen size={14} /> {isProjectWorkspace ? text.workspace : isFolderTarget ? text.targetFolder : text.source}</span>{isFolderTarget ? <div className="execution-dialog-path-control"><input value={localSourcePath} readOnly={lockedDuplicatePlan} onChange={(event) => setLocalSourcePath(event.target.value)} placeholder={lang === 'ar' ? 'اختر مجلداً' : 'Choose a folder'} />{!lockedDuplicatePlan && <button type="button" onClick={() => setFolderPickerOpen(true)}>{text.browse}</button>}</div> : <input value={localSourcePath} onChange={(event) => setLocalSourcePath(event.target.value)} placeholder={lang === 'ar' ? 'اختر ملف الاستعادة' : 'Choose a recovery file'} />}<small>{lockedDuplicatePlan ? text.lockedPlanFolder : isProjectWorkspace ? text.workspaceHint : isFolderTarget ? text.targetFolderHint : text.sourceHint}</small></label>}
        {needsSourceIndex && <label className="execution-dialog-field"><span>{text.sourceIndex}</span><input inputMode="numeric" value={localSourceIndex} onChange={(event) => setLocalSourceIndex(event.target.value)} placeholder="1" /></label>}
        {needsPackageId && <label className="execution-dialog-field"><span><FileKey2 size={14} /> {text.app}</span><input value={packageId} onChange={(event) => setPackageId(event.target.value)} placeholder={lang === 'ar' ? 'رمز التطبيق' : 'Application identifier'} autoFocus={!needsSelection && !needsSource} /><small>{text.appHint}</small></label>}
        {supportsQuick && <label className="execution-dialog-check"><input type="checkbox" checked={quick} onChange={(event) => setQuick(event.target.checked)} /><span>{text.quick}</span></label>}
        {requiresRecoveryAcknowledgement && <label className="execution-dialog-check"><input type="checkbox" checked={recoveryAcknowledged} onChange={(event) => setRecoveryAcknowledged(event.target.checked)} /><span>{text.acknowledge}</span></label>}
        {requiresPhrase && <label className="execution-dialog-field"><span><AlertTriangle size={14} /> {text.confirm}</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={expectedPhrase} autoFocus={!needsSelection} /></label>}
        {secondsRemaining > 0 && <p className="execution-dialog-delay"><AlertTriangle size={14} /> {text.wait.replace('{seconds}', String(secondsRemaining))}</p>}
        <p className="execution-dialog-contract"><ShieldCheck size={14} /> {text.protected}</p>
        {folderPickerOpen && isFolderTarget && <WorkspaceFolderPicker lang={lang} initialPath={localSourcePath} onClose={() => setFolderPickerOpen(false)} onSelect={(folderPath) => { setLocalSourcePath(folderPath); setFolderPickerOpen(false); }} />}
        <div className="execution-dialog-actions"><button type="button" className="execution-dialog-cancel" onClick={onCancel}>{text.cancel}</button><button type="button" className="execution-dialog-confirm" onClick={confirm} disabled={!canConfirm}>{mode === 'run' ? text.execute : text.continue}</button></div>
      </section>
    </div>
  );
}
