import { BrainCircuit } from 'lucide-react';

export interface KnouxAiContextButtonProps {
  lang: 'en' | 'ar';
  familyId: string;
  familyName: string;
  serviceId: string;
  serviceName: string;
  toolId?: string | null;
  toolName?: string | null;
}

export default function KnouxAiContextButton({
  lang,
  familyId,
  familyName,
  serviceId,
  serviceName,
  toolId,
  toolName,
}: KnouxAiContextButtonProps) {
  const isRtl = lang === 'ar';

  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent('knoux:ai-open', {
      detail: {
        prompt: toolId && toolName
          ? (isRtl ? `اشرح لي ${toolName} داخل خدمة ${serviceName}.` : `Explain ${toolName} inside ${serviceName}.`)
          : (isRtl ? `اشرح لي خدمة ${serviceName}.` : `Explain the ${serviceName} service.`),
        context: {
          familyId,
          familyName,
          serviceId,
          serviceName,
          tool: toolId ? { id: toolId, name: toolName || toolId } : null,
          evidence: [],
        },
      },
    }));
  };

  return (
    <button
      type="button"
      onClick={openAssistant}
      className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2.5 py-1 text-[10px] font-semibold text-cyan-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      title={isRtl ? 'فتح KNOUX AI بهذا السياق' : 'Open KNOUX AI with this context'}
      aria-label={isRtl ? 'فتح KNOUX AI بهذا السياق' : 'Open KNOUX AI with this context'}
    >
      <BrainCircuit size={12} />
      <span>KNOUX AI</span>
    </button>
  );
}
