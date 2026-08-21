import { useMemo, useState } from 'react';
import {
  Activity, AppWindow, ArchiveRestore, ArrowRight, BadgeCheck, CheckCircle2, ChevronRight, CircleAlert,
  Copy, FolderCog, Gauge, HardDrive, HeartPulse, Network, PackageCheck, Radar, RefreshCw, ShieldCheck,
  Sparkles, Stethoscope, Trash2, UserRoundCheck, Wrench,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { ActiveSection, ToolStatus } from '../types';
import type { BridgeTool, ExecutionMode, ToolRunOptions } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { pickName } from '../lib/i18n';
import ExecutionConfirmDialog from './ExecutionConfirmDialog';

interface ServicePlatformProps {
  activeSection: ActiveSection;
  tools: BridgeTool[];
  toolStatuses: Record<string, ToolStatus>;
  lang: Lang;
  bridgeElevated: boolean;
  onRunTool: (tool: BridgeTool, mode: ExecutionMode, options?: ToolRunOptions) => void;
  onCancelTool: () => void;
}

type Localized = Record<Lang, string>;
interface ServiceExperience {
  title: Localized;
  headline: Localized;
  description: Localized;
  outcome: Localized;
  steps: [Localized, Localized, Localized];
  accent: string;
  icon: ElementType;
}

const EXPERIENCES: Record<ActiveSection, ServiceExperience> = {
  dashboard: { title: { en: 'Device care', ar: 'عناية الجهاز' }, headline: { en: 'A calmer way to care for your device', ar: 'طريقة أبسط للعناية بجهازك' }, description: { en: 'Choose a service to get started.', ar: 'اختر خدمة للبدء.' }, outcome: { en: 'Guided support for your device', ar: 'مساعدة موجهة لجهازك' }, steps: [{ en: 'Choose', ar: 'اختر' }, { en: 'Review', ar: 'راجع' }, { en: 'Finish', ar: 'أكمل' }], accent: '#25c8dd', icon: HeartPulse },
  maintenance: { title: { en: 'Device Health', ar: 'صحة الجهاز' }, headline: { en: 'Keep Windows healthy and reliable', ar: 'حافظ على ويندوز سليماً وموثوقاً' }, description: { en: 'Check the core parts of Windows and resolve common health issues with guided steps.', ar: 'افحص المكونات الأساسية لويندوز وعالج مشكلات الصحة الشائعة بخطوات موجهة.' }, outcome: { en: 'A healthier, more reliable device', ar: 'جهاز أكثر صحة وموثوقية' }, steps: [{ en: 'Check your device', ar: 'افحص جهازك' }, { en: 'Review the result', ar: 'راجع النتيجة' }, { en: 'Apply a safe fix', ar: 'طبّق إصلاحاً آمناً' }], accent: '#5d8dff', icon: HeartPulse },
  cleanup: { title: { en: 'Space Cleaner', ar: 'تنظيف المساحة' }, headline: { en: 'Make room without touching your important files', ar: 'وفّر مساحة دون المساس بملفاتك المهمة' }, description: { en: 'Find temporary and maintenance files that can be reviewed and cleaned safely.', ar: 'اعثر على الملفات المؤقتة وملفات الصيانة التي يمكن مراجعتها وتنظيفها بأمان.' }, outcome: { en: 'More available storage space', ar: 'مساحة تخزين أكبر متاحة' }, steps: [{ en: 'See recoverable space', ar: 'اعرف المساحة القابلة للاستعادة' }, { en: 'Choose what to clean', ar: 'اختر ما تريد تنظيفه' }, { en: 'Confirm and finish', ar: 'أكد وأنهِ العملية' }], accent: '#38c980', icon: Trash2 },
  network: { title: { en: 'Connection Helper', ar: 'مساعد الاتصال' }, headline: { en: 'Understand and improve your connection', ar: 'افهم اتصالك وحسّنه' }, description: { en: 'Review your active connection and use guided repairs when the internet is not behaving as expected.', ar: 'راجع اتصالك النشط واستخدم إصلاحات موجهة عندما لا يعمل الإنترنت كما تتوقع.' }, outcome: { en: 'A clearer, more reliable connection', ar: 'اتصال أوضح وأكثر موثوقية' }, steps: [{ en: 'Check the connection', ar: 'افحص الاتصال' }, { en: 'Find the issue', ar: 'حدّد المشكلة' }, { en: 'Apply a repair', ar: 'طبّق إصلاحاً' }], accent: '#32c4d7', icon: Network },
  programs: { title: { en: 'App Center', ar: 'مركز التطبيقات' }, headline: { en: 'Keep the apps you depend on ready to use', ar: 'حافظ على جاهزية التطبيقات التي تعتمد عليها' }, description: { en: 'Review applications, startup behavior, and the repair options available for this device.', ar: 'راجع التطبيقات وسلوك بدء التشغيل وخيارات الإصلاح المتاحة لهذا الجهاز.' }, outcome: { en: 'A better organized app experience', ar: 'تجربة تطبيقات أكثر ترتيباً' }, steps: [{ en: 'Review your apps', ar: 'راجع تطبيقاتك' }, { en: 'Choose an action', ar: 'اختر إجراءً' }, { en: 'Confirm changes', ar: 'أكد التغييرات' }], accent: '#f49a53', icon: AppWindow },
  duplicates: { title: { en: 'Duplicate Organizer', ar: 'منظّم الملفات المكررة' }, headline: { en: 'Find extra copies while keeping your originals safe', ar: 'اعثر على النسخ الزائدة مع الحفاظ على ملفاتك الأصلية' }, description: { en: 'Scan a chosen folder, review duplicate groups, and place selected copies in a recoverable area.', ar: 'افحص مجلداً مختاراً وراجع مجموعات التكرارات وضع النسخ المحددة في منطقة يمكن استعادتها.' }, outcome: { en: 'A tidier library with safe recovery options', ar: 'مكتبة أكثر ترتيباً مع خيارات استعادة آمنة' }, steps: [{ en: 'Choose a folder', ar: 'اختر مجلداً' }, { en: 'Review copies', ar: 'راجع النسخ' }, { en: 'Keep what matters', ar: 'احتفظ بما يهمك' }], accent: '#e46e9d', icon: Copy },
  disk: { title: { en: 'Storage Space', ar: 'مساحة التخزين' }, headline: { en: 'See what is using space on your device', ar: 'اعرف ما الذي يستهلك مساحة جهازك' }, description: { en: 'Review storage use and identify safe ways to recover capacity.', ar: 'راجع استخدام التخزين وحدد الطرق الآمنة لاستعادة السعة.' }, outcome: { en: 'A clearer view of your storage', ar: 'صورة أوضح لمساحة التخزين' }, steps: [{ en: 'Check storage', ar: 'افحص التخزين' }, { en: 'Find large items', ar: 'اعثر على العناصر الكبيرة' }, { en: 'Recover space', ar: 'استعد مساحة' }], accent: '#a66cff', icon: HardDrive },
  services: { title: { en: 'Device Activity', ar: 'نشاط الجهاز' }, headline: { en: 'See what is keeping your device busy', ar: 'اعرف ما الذي يبقي جهازك مشغولاً' }, description: { en: 'Review demanding apps and background activity, then choose a supported recovery step.', ar: 'راجع التطبيقات المستهلكة للنظام والنشاط في الخلفية ثم اختر خطوة استرداد مدعومة.' }, outcome: { en: 'A more responsive device session', ar: 'جلسة جهاز أكثر استجابة' }, steps: [{ en: 'Check activity', ar: 'افحص النشاط' }, { en: 'Review what needs attention', ar: 'راجع ما يحتاج انتباهاً' }, { en: 'Choose a supported step', ar: 'اختر خطوة مدعومة' }], accent: '#efb161', icon: Activity },
  performance: { title: { en: 'Speed Up', ar: 'تسريع الجهاز' }, headline: { en: 'Find the reason your device feels slow', ar: 'اعرف سبب بطء جهازك' }, description: { en: 'Understand memory use, startup behavior, and power settings before choosing an improvement.', ar: 'افهم استخدام الذاكرة وسلوك بدء التشغيل وإعدادات الطاقة قبل اختيار تحسين.' }, outcome: { en: 'A practical path to better performance', ar: 'مسار عملي لأداء أفضل' }, steps: [{ en: 'Measure performance', ar: 'قِس الأداء' }, { en: 'See recommendations', ar: 'اطلع على التوصيات' }, { en: 'Apply an improvement', ar: 'طبّق تحسينا' }], accent: '#f27662', icon: Gauge },
  security: { title: { en: 'Protection', ar: 'الحماية' }, headline: { en: 'Make sure your Windows protection is ready', ar: 'تأكد من جاهزية حماية ويندوز' }, description: { en: 'Review protection, firewall, and update status, then resolve supported protection issues.', ar: 'راجع الحماية والجدار الناري وحالة التحديثات ثم عالج مشكلات الحماية المدعومة.' }, outcome: { en: 'A clearer view of your device protection', ar: 'صورة أوضح لحماية جهازك' }, steps: [{ en: 'Check protection', ar: 'افحص الحماية' }, { en: 'Review alerts', ar: 'راجع التنبيهات' }, { en: 'Restore protection', ar: 'استعد الحماية' }], accent: '#4cc6b2', icon: ShieldCheck },
  diagnostics: { title: { en: 'Device Checkup', ar: 'فحص الجهاز' }, headline: { en: 'Understand the health of your device', ar: 'افهم حالة جهازك الصحية' }, description: { en: 'Bring together useful device information, recent warnings, and a simple report.', ar: 'اجمع معلومات مفيدة عن الجهاز والتحذيرات الأخيرة وتقريراً مبسطاً.' }, outcome: { en: 'A clear picture of device health', ar: 'صورة واضحة لصحة الجهاز' }, steps: [{ en: 'Run a checkup', ar: 'أجرِ فحصاً' }, { en: 'Review findings', ar: 'راجع النتائج' }, { en: 'Save a report', ar: 'احفظ تقريراً' }], accent: '#8d7aff', icon: Stethoscope },
  backupRecovery: { title: { en: 'Protect & Recover', ar: 'الحماية والاستعادة' }, headline: { en: 'Keep a safe way back for important work', ar: 'احتفظ بطريق آمن للعودة إلى أعمالك المهمة' }, description: { en: 'Review recovery points and local backups before creating, checking, or restoring data.', ar: 'راجع نقاط الاستعادة والنسخ المحلية قبل إنشاء البيانات أو التحقق منها أو استعادتها.' }, outcome: { en: 'More confidence in recovery options', ar: 'ثقة أكبر بخيارات الاستعادة' }, steps: [{ en: 'Check protection', ar: 'افحص الحماية' }, { en: 'Choose a safe option', ar: 'اختر خياراً آمناً' }, { en: 'Confirm recovery', ar: 'أكد الاستعادة' }], accent: '#48bfe3', icon: ArchiveRestore },
  developerTools: { title: { en: 'Development Environments', ar: 'بيئات التطوير' }, headline: { en: 'Keep your local development work ready', ar: 'حافظ على جاهزية عملك التطويري المحلي' }, description: { en: 'Review local tools, projects, and supported workspace maintenance steps.', ar: 'راجع الأدوات والمشاريع المحلية وخطوات صيانة مساحة العمل المدعومة.' }, outcome: { en: 'A better prepared local work environment', ar: 'بيئة عمل محلية أكثر استعداداً' }, steps: [{ en: 'Check your setup', ar: 'افحص إعدادك' }, { en: 'Review the result', ar: 'راجع النتيجة' }, { en: 'Choose a safe step', ar: 'اختر خطوة آمنة' }], accent: '#a980ff', icon: FolderCog },
  privacy: { title: { en: 'Privacy', ar: 'الخصوصية' }, headline: { en: 'Choose how your device keeps local activity', ar: 'اختر كيف يحفظ جهازك النشاط المحلي' }, description: { en: 'Review privacy choices and manage the supported local activity and connection history options.', ar: 'راجع خيارات الخصوصية وأدر إعدادات النشاط المحلي وسجل الاتصال المدعومة.' }, outcome: { en: 'More control over local privacy choices', ar: 'تحكم أكبر في خيارات الخصوصية المحلية' }, steps: [{ en: 'Review settings', ar: 'راجع الإعدادات' }, { en: 'Choose what matters', ar: 'اختر ما يهمك' }, { en: 'Confirm your choice', ar: 'أكد اختيارك' }], accent: '#e46e9d', icon: UserRoundCheck },
  drivers: { title: { en: 'Drivers & Devices', ar: 'التعريفات والأجهزة' }, headline: { en: 'Check the software that connects your devices', ar: 'افحص البرنامج الذي يربط أجهزتك بويندوز' }, description: { en: 'Review device driver health, identify items that need attention, and preserve a copy when needed.', ar: 'راجع صحة تعريفات الأجهزة وحدد العناصر التي تحتاج انتباهاً واحتفظ بنسخة عند الحاجة.' }, outcome: { en: 'A safer view of device connections', ar: 'صورة أكثر أماناً لاتصالات الأجهزة' }, steps: [{ en: 'Check drivers', ar: 'افحص التعريفات' }, { en: 'Review attention items', ar: 'راجع العناصر المهمة' }, { en: 'Save a recovery copy', ar: 'احفظ نسخة للاستعادة' }], accent: '#efb161', icon: Wrench },
  monitoring: { title: { en: 'Device Monitor', ar: 'مراقبة الجهاز' }, headline: { en: 'See how your device is doing right now', ar: 'اعرف كيف يعمل جهازك الآن' }, description: { en: 'Capture a simple picture of resources, busy apps, and recent alerts.', ar: 'التقط صورة مبسطة للموارد والتطبيقات المشغولة والتنبيهات الأخيرة.' }, outcome: { en: 'A useful current device snapshot', ar: 'لقطة مفيدة لحالة الجهاز الحالية' }, steps: [{ en: 'Capture a snapshot', ar: 'التقط لقطة' }, { en: 'Review activity', ar: 'راجع النشاط' }, { en: 'Follow up if needed', ar: 'تابع عند الحاجة' }], accent: '#52c596', icon: Activity },
  softwareEnvironment: { title: { en: 'Software Library', ar: 'مكتبة البرامج' }, headline: { en: 'Understand the software on your device', ar: 'افهم البرامج الموجودة على جهازك' }, description: { en: 'Review installed apps and available maintenance choices in one place.', ar: 'راجع التطبيقات المثبتة وخيارات الصيانة المتاحة في مكان واحد.' }, outcome: { en: 'A cleaner, easier software overview', ar: 'نظرة برامج أنظف وأسهل' }, steps: [{ en: 'Review your library', ar: 'راجع مكتبتك' }, { en: 'Choose an app action', ar: 'اختر إجراء للتطبيق' }, { en: 'Confirm changes', ar: 'أكد التغييرات' }], accent: '#5d8dff', icon: PackageCheck },
  postInstall: { title: { en: 'New Device Setup', ar: 'إعداد جهاز جديد' }, headline: { en: 'Get a new Windows installation ready', ar: 'جهّز تثبيت ويندوز جديداً' }, description: { en: 'Review driver offers and useful applications, then install only the selections you approve.', ar: 'راجع عروض التعريفات والتطبيقات المفيدة ثم ثبّت الاختيارات التي توافق عليها فقط.' }, outcome: { en: 'A device ready for everyday work', ar: 'جهاز جاهز للاستخدام اليومي' }, steps: [{ en: 'Check what is needed', ar: 'اعرف ما المطلوب' }, { en: 'Choose your essentials', ar: 'اختر أساسياتك' }, { en: 'Confirm setup', ar: 'أكد الإعداد' }], accent: '#b26cf5', icon: Sparkles },
  projectSonar: { title: { en: 'Project Center', ar: 'مركز المشاريع' }, headline: { en: 'Understand your project before the next step', ar: 'افهم مشروعك قبل الخطوة التالية' }, description: { en: 'Choose a project folder to get a clear summary, practical priorities, and a shareable handoff.', ar: 'اختر مجلد مشروع للحصول على ملخص واضح وأولويات عملية وتسليم قابل للمشاركة.' }, outcome: { en: 'A clearer next step for your project', ar: 'خطوة تالية أوضح لمشروعك' }, steps: [{ en: 'Choose a project', ar: 'اختر مشروعاً' }, { en: 'Review priorities', ar: 'راجع الأولويات' }, { en: 'Create a handoff', ar: 'أنشئ تسليماً' }], accent: '#36d4e7', icon: Radar },
  reports: { title: { en: 'Reports', ar: 'التقارير' }, headline: { en: 'Your device reports', ar: 'تقارير جهازك' }, description: { en: 'Choose a service to create a report.', ar: 'اختر خدمة لإنشاء تقرير.' }, outcome: { en: 'Helpful records', ar: 'سجلات مفيدة' }, steps: [{ en: 'Choose', ar: 'اختر' }, { en: 'Review', ar: 'راجع' }, { en: 'Save', ar: 'احفظ' }], accent: '#8d7aff', icon: Stethoscope },
  quarantine: { title: { en: 'Safe storage', ar: 'تخزين آمن' }, headline: { en: 'Review protected items', ar: 'راجع العناصر المحمية' }, description: { en: 'Choose a service to continue.', ar: 'اختر خدمة للمتابعة.' }, outcome: { en: 'Safe recovery', ar: 'استعادة آمنة' }, steps: [{ en: 'Review', ar: 'راجع' }, { en: 'Choose', ar: 'اختر' }, { en: 'Recover', ar: 'استعد' }], accent: '#efb161', icon: ArchiveRestore },
  backups: { title: { en: 'Recovery', ar: 'الاستعادة' }, headline: { en: 'Keep your work protected', ar: 'حافظ على حماية عملك' }, description: { en: 'Choose a service to continue.', ar: 'اختر خدمة للمتابعة.' }, outcome: { en: 'Protected work', ar: 'عمل محمي' }, steps: [{ en: 'Check', ar: 'افحص' }, { en: 'Choose', ar: 'اختر' }, { en: 'Protect', ar: 'احمِ' }], accent: '#48bfe3', icon: ArchiveRestore },
  settings: { title: { en: 'Settings', ar: 'الإعدادات' }, headline: { en: 'Personalize KNOUX', ar: 'خصص KNOUX' }, description: { en: 'Open settings to continue.', ar: 'افتح الإعدادات للمتابعة.' }, outcome: { en: 'A better experience', ar: 'تجربة أفضل' }, steps: [{ en: 'Choose', ar: 'اختر' }, { en: 'Review', ar: 'راجع' }, { en: 'Save', ar: 'احفظ' }], accent: '#718096', icon: FolderCog },
  about: { title: { en: 'About KNOUX', ar: 'حول KNOUX' }, headline: { en: 'Device care made simple', ar: 'عناية مبسطة بالجهاز' }, description: { en: 'Choose a service to get started.', ar: 'اختر خدمة للبدء.' }, outcome: { en: 'A clear next step', ar: 'خطوة تالية واضحة' }, steps: [{ en: 'Choose', ar: 'اختر' }, { en: 'Review', ar: 'راجع' }, { en: 'Finish', ar: 'أكمل' }], accent: '#25c8dd', icon: HeartPulse },
};

const COPY = {
  en: { welcome: 'KNOUX SERVICE', ready: 'Ready to help', offline: 'Connect the local service to use live checks', quick: 'Recommended actions', more: 'More ways to help', journey: 'How this works', start: 'Start', review: 'Review first', stop: 'Stop', needsAccess: 'Needs device permission', noActions: 'No actions are available until the local service is connected.', safe: 'Your choices stay in your control', safeBody: 'KNOUX explains a step before it makes a change and asks for confirmation when needed.', statusReady: 'No action in progress', statusWorking: 'A request is in progress', statusComplete: 'A recent request was completed', statusAttention: 'A request needs attention' },
  ar: { welcome: 'خدمة KNOUX', ready: 'جاهز للمساعدة', offline: 'اتصل بالخدمة المحلية لاستخدام الفحوصات الحية', quick: 'إجراءات مقترحة', more: 'طرق أخرى للمساعدة', journey: 'كيف تعمل هذه الخدمة؟', start: 'ابدأ', review: 'راجع أولاً', stop: 'إيقاف', needsAccess: 'تحتاج إذن الجهاز', noActions: 'لا توجد إجراءات متاحة حتى تتصل بالخدمة المحلية.', safe: 'اختياراتك تبقى تحت سيطرتك', safeBody: 'يشرح KNOUX الخطوة قبل تغيير أي شيء ويطلب التأكيد عند الحاجة.', statusReady: 'لا يوجد إجراء قيد التنفيذ', statusWorking: 'يوجد طلب قيد التنفيذ', statusComplete: 'اكتمل طلب حديثاً', statusAttention: 'يحتاج طلب إلى انتباه' },
};

function actionMode(tool: BridgeTool): ExecutionMode { return tool.AnalyzeOnlySupported ? 'analyze' : tool.RiskLevel === 'READ_ONLY' ? 'run' : tool.WhatIfSupported ? 'preview' : 'run'; }
function actionVerb(tool: BridgeTool, lang: Lang): string { const text = COPY[lang]; return actionMode(tool) === 'analyze' || actionMode(tool) === 'preview' ? text.review : text.start; }
function actionSummary(tool: BridgeTool, lang: Lang): string { if (tool.RiskLevel === 'READ_ONLY') return lang === 'ar' ? 'فحص فقط — لن يتم تغيير جهازك' : 'Check only — your device will not be changed'; if (tool.RiskLevel === 'SAFE_CLEANUP') return lang === 'ar' ? 'ستراجع التغيير قبل تطبيقه' : 'You will review the change before it is applied'; return lang === 'ar' ? 'سوف يطلب منك KNOUX التأكيد قبل التغيير' : 'KNOUX will ask for confirmation before changes'; }

export default function ServicePlatform({ activeSection, tools, toolStatuses, lang, bridgeElevated, onRunTool, onCancelTool }: ServicePlatformProps) {
  const experience = EXPERIENCES[activeSection] || EXPERIENCES.dashboard;
  const copy = COPY[lang];
  const [pending, setPending] = useState<{ tool: BridgeTool; mode: ExecutionMode } | null>(null);
  const Icon = experience.icon;
  const runningTool = tools.find((tool) => toolStatuses[tool.ToolId] === 'running');
  const latestStatus = useMemo(() => {
    if (runningTool) return { label: copy.statusWorking, tone: 'is-working' };
    if (tools.some((tool) => toolStatuses[tool.ToolId] === 'error')) return { label: copy.statusAttention, tone: 'is-attention' };
    if (tools.some((tool) => toolStatuses[tool.ToolId] === 'success')) return { label: copy.statusComplete, tone: 'is-complete' };
    return { label: copy.statusReady, tone: 'is-ready' };
  }, [copy.statusAttention, copy.statusComplete, copy.statusReady, copy.statusWorking, runningTool, tools, toolStatuses]);
  const recommended = tools.filter((tool) => tool.RiskLevel === 'READ_ONLY' || tool.AnalyzeOnlySupported || tool.WhatIfSupported).slice(0, 3);
  const remaining = tools.filter((tool) => !recommended.includes(tool)).slice(0, 9);
  const launch = (tool: BridgeTool) => { if (toolStatuses[tool.ToolId] === 'running') return; setPending({ tool, mode: actionMode(tool) }); };

  const renderAction = (tool: BridgeTool, featured = false) => {
    const running = toolStatuses[tool.ToolId] === 'running';
    const needsPermission = tool.RequiresAdmin && !bridgeElevated;
    return <article key={tool.ToolId} className={`platform-action-card ${featured ? 'is-featured' : ''} ${running ? 'is-running' : ''}`}>
      <div className="platform-action-symbol"><Icon size={featured ? 22 : 18} /></div>
      <div className="platform-action-copy"><h3>{pickName(tool, lang)}</h3><p>{actionSummary(tool, lang)}</p>{needsPermission && <span className="platform-action-access"><CircleAlert size={12} />{copy.needsAccess}</span>}</div>
      {running ? <button type="button" className="platform-action-button is-stop" onClick={onCancelTool}><RefreshCw size={15} className="animate-spin" />{copy.stop}</button> : <button type="button" className="platform-action-button" disabled={needsPermission} onClick={() => launch(tool)}>{actionVerb(tool, lang)}<ArrowRight size={15} className="rtl:rotate-180" /></button>}
    </article>;
  };

  return <section className="service-platform" style={{ '--service-accent': experience.accent } as React.CSSProperties} aria-labelledby="service-platform-title">
    <header className="service-platform-hero">
      <div className="service-platform-emblem"><Icon size={31} /></div>
      <div className="service-platform-hero-copy"><p>{copy.welcome}</p><h1 id="service-platform-title">{experience.title[lang]}</h1><h2>{experience.headline[lang]}</h2><span>{experience.description[lang]}</span></div>
      <aside className={`service-platform-state ${latestStatus.tone}`}><BadgeCheck size={17} /><div><small>{copy.ready}</small><strong>{latestStatus.label}</strong></div></aside>
    </header>

    <div className="service-platform-layout">
      <main className="service-platform-main">
        <section className="service-outcome-card"><div><span>{lang === 'ar' ? 'النتيجة التي نساعدك للوصول إليها' : 'The outcome we help you reach'}</span><strong>{experience.outcome[lang]}</strong></div><CheckCircle2 size={27} /></section>
        <section className="platform-action-section"><div className="platform-section-heading"><div><p>{copy.quick}</p><h2>{experience.title[lang]}</h2></div><span>{tools.length}</span></div>{recommended.length ? <div className="platform-action-grid">{recommended.map((tool) => renderAction(tool, true))}</div> : <div className="platform-empty-state"><CircleAlert size={21} /><p>{copy.noActions}</p><small>{copy.offline}</small></div>}</section>
        {remaining.length > 0 && <section className="platform-action-section platform-more-section"><div className="platform-section-heading"><div><p>{copy.more}</p><h2>{lang === 'ar' ? 'إجراءات إضافية' : 'Additional choices'}</h2></div></div><div className="platform-action-list">{remaining.map((tool) => renderAction(tool))}</div></section>}
      </main>
      <aside className="service-platform-side">
        <section className="platform-journey"><p>{copy.journey}</p><ol>{experience.steps.map((step, index) => <li key={step[lang]}><span>{index + 1}</span><strong>{step[lang]}</strong><ChevronRight size={15} className="rtl:rotate-180" /></li>)}</ol></section>
        <section className="platform-safety-card"><ShieldCheck size={20} /><div><strong>{copy.safe}</strong><p>{copy.safeBody}</p></div></section>
      </aside>
    </div>
    {pending && <ExecutionConfirmDialog tool={pending.tool} mode={pending.mode} lang={lang} onCancel={() => setPending(null)} onConfirm={(options) => { onRunTool(pending.tool, pending.mode, options); setPending(null); }} />}
  </section>;
}
