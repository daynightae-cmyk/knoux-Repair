import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, CircleAlert, Download, LoaderCircle, RefreshCw, ShieldCheck, Square, X } from 'lucide-react';
import type { ConsoleEntry } from '../types';
import type { BridgeTool } from '../lib/api';
import type { Lang } from '../lib/i18n';
import { pickName } from '../lib/i18n';

interface DiagnosticConsoleProps {
  visible: boolean;
  onClose: () => void;
  activeTool: BridgeTool | null;
  entries: ConsoleEntry[];
  status: 'idle' | 'running' | 'success' | 'error' | 'cancelled';
  onRetry: () => void;
  onCancel: () => void;
  lang: Lang;
}

const COPY = {
  en: {
    working: 'Working on your request', success: 'Your request is complete', error: 'This request needs attention', cancelled: 'This request was stopped', idle: 'Ready when you are',
    workingBody: 'KNOUX is safely completing the selected step. You can keep this window open to follow progress.', successBody: 'The selected step has finished. You can continue using your device or return to the service for the next step.',
    errorBody: 'KNOUX could not complete this request. Review your device connection and permissions, then try again.', cancelledBody: 'No further steps will be taken unless you start the request again.', idleBody: 'Choose a service action to get started.',
    cancel: 'Stop', retry: 'Try again', close: 'Done', support: 'Download support report', privacy: 'Technical details are kept private unless you choose to share this report.',
    stagePreparing: 'Preparing a safe workspace', stageWorking: 'Completing the selected step', stageFinishing: 'Checking the result',
  },
  ar: {
    working: 'جارٍ تنفيذ طلبك', success: 'اكتمل طلبك', error: 'يحتاج هذا الطلب إلى انتباه', cancelled: 'تم إيقاف الطلب', idle: 'جاهز عند اختيارك',
    workingBody: 'ينفذ KNOUX الخطوة التي اخترتها بأمان. يمكنك إبقاء هذه النافذة مفتوحة لمتابعة التقدم.', successBody: 'انتهت الخطوة المختارة. يمكنك متابعة استخدام جهازك أو العودة للخدمة لاختيار الخطوة التالية.',
    errorBody: 'تعذر على KNOUX إكمال هذا الطلب. راجع اتصال الجهاز والأذونات ثم حاول مرة أخرى.', cancelledBody: 'لن يتم تنفيذ خطوات إضافية إلا إذا بدأت الطلب مرة أخرى.', idleBody: 'اختر إجراءً من الخدمة للبدء.',
    cancel: 'إيقاف', retry: 'حاول مرة أخرى', close: 'تم', support: 'تنزيل تقرير الدعم', privacy: 'تبقى التفاصيل التقنية خاصة ما لم تختر مشاركة هذا التقرير.',
    stagePreparing: 'تحضير مساحة عمل آمنة', stageWorking: 'تنفيذ الخطوة المختارة', stageFinishing: 'التحقق من النتيجة',
  },
};

function exportSupportReport(entries: ConsoleEntry[], activeTool: BridgeTool | null) {
  const text = entries.map((entry) => `[${entry.timestamp}] [${entry.type.toUpperCase()}] ${entry.text}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `knoux-support-${activeTool?.ToolId || 'report'}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DiagnosticConsole({ visible, onClose, activeTool, entries, status, onRetry, onCancel, lang }: DiagnosticConsoleProps) {
  const text = COPY[lang];
  const isRunning = status === 'running';
  const content = status === 'running'
    ? { title: text.working, body: text.workingBody, icon: LoaderCircle, className: 'is-working' }
    : status === 'success'
      ? { title: text.success, body: text.successBody, icon: CheckCircle2, className: 'is-success' }
      : status === 'error'
        ? { title: text.error, body: text.errorBody, icon: CircleAlert, className: 'is-error' }
        : status === 'cancelled'
          ? { title: text.cancelled, body: text.cancelledBody, icon: CircleAlert, className: 'is-cancelled' }
          : { title: text.idle, body: text.idleBody, icon: ShieldCheck, className: 'is-idle' };
  const StatusIcon = content.icon;
  const progress = status === 'success' ? 100 : status === 'running' ? Math.min(82, 18 + entries.length * 9) : status === 'error' || status === 'cancelled' ? 100 : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ y: 260, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 260, opacity: 0 }} transition={{ type: 'spring', stiffness: 310, damping: 29 }}
          className={`service-progress-sheet ${content.className}`} role="status" aria-live="polite"
        >
          <button type="button" onClick={onClose} className="service-progress-close" aria-label={text.close}><X size={18} /></button>
          <div className="service-progress-icon"><StatusIcon size={24} className={isRunning ? 'animate-spin' : ''} /></div>
          <div className="service-progress-copy"><p>{activeTool ? pickName(activeTool, lang) : ''}</p><h2>{content.title}</h2><span>{content.body}</span></div>
          {isRunning && <div className="service-progress-steps"><span className="is-done"><CheckCircle2 size={13} />{text.stagePreparing}</span><span className="is-active"><LoaderCircle size={13} className="animate-spin" />{text.stageWorking}</span><span><span className="service-progress-dot" />{text.stageFinishing}</span></div>}
          <div className="service-progress-track" aria-label={`${progress}%`}><span style={{ width: `${progress}%` }} /></div>
          <div className="service-progress-actions">
            {isRunning && <button type="button" className="service-progress-stop" onClick={onCancel}><Square size={14} />{text.cancel}</button>}
            {(status === 'error' || status === 'cancelled') && <button type="button" className="service-progress-retry" onClick={onRetry}><RefreshCw size={14} />{text.retry}</button>}
            {!isRunning && <button type="button" className="service-progress-done" onClick={onClose}>{text.close}</button>}
            {entries.length > 0 && <button type="button" className="service-progress-support" onClick={() => exportSupportReport(entries, activeTool)} title={text.support}><Download size={15} /></button>}
          </div>
          {entries.length > 0 && <p className="service-progress-privacy">{text.privacy}</p>}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
