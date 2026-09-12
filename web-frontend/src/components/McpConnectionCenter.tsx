import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, CheckCircle2, CloudCog, Fingerprint, KeyRound, Laptop, LoaderCircle,
  LockKeyhole, Radio, RefreshCw, Route, ServerCog, ShieldCheck, SquareTerminal, X,
} from 'lucide-react';
import { mcpApi, type PrivateMcpContract, type PrivateMcpProbe } from '../lib/mcp';
import type { Lang } from '../lib/i18n';

const COPY = {
  en: {
    eyebrow: 'KNOUX PRIVATE MCP', title: 'Private MCP Connection Center',
    subtitle: 'One evidence-backed path from this workstation to the private Cloud Run gateway. No public fallback, no token exposure, no invented health.',
    close: 'Close MCP center', verify: 'Verify private gateway', verifying: 'Verifying private gateway…', refresh: 'Reload contract',
    privateByDesign: 'PRIVATE BY DESIGN', canonical: 'Canonical endpoint', audience: 'ID-token audience', tool: 'Read-only proof tool',
    contract: 'Endpoint contract', privacy: 'Private boundary', identity: 'Invoker identity', protocol: 'MCP transport', gateway: 'gateway_status',
    pinned: 'Pinned', waiting: 'Not verified yet', privateOk: 'Unauthenticated access denied', publicRisk: 'Public access may be enabled',
    identityReady: 'ID token acquired server-side', identityMissing: 'No authenticated token source available',
    protocolOk: 'Authenticated MCP call completed', gatewayOk: 'Real gateway payload received', unavailable: 'Evidence unavailable',
    localPath: 'Local / ADK path', localBody: 'Uses gcloud to mint a short-lived ID token for the Cloud Run audience. The token never enters React.',
    cloudPath: 'Studio / Agent Engine path', cloudBody: 'Uses the Google metadata identity endpoint when the runtime has an invoker-capable service account.',
    rule: 'Hard security rule', ruleBody: 'If private access cannot be proven, KNOUX stops. It does not retry anonymously or switch to a public endpoint.',
    payload: 'Sanitized gateway_status evidence', noPayload: 'No gateway payload has been proven in this runtime.',
    lastProof: 'Last proof', never: 'Never', bridgeOffline: 'Local bridge is unavailable. MCP verification cannot run.',
    modern: 'Modern stateless', legacy: 'Legacy session fallback', source: 'Identity source', http: 'Boundary HTTP',
  },
  ar: {
    eyebrow: 'KNOUX MCP الخاص', title: 'مركز اتصال MCP الخاص',
    subtitle: 'مسار واحد مدعوم بالأدلة من محطة العمل إلى بوابة Cloud Run الخاصة. لا بديل عام، لا كشف للتوكن، ولا صحة وهمية.',
    close: 'إغلاق مركز MCP', verify: 'تحقق من البوابة الخاصة', verifying: 'جارٍ التحقق من البوابة الخاصة…', refresh: 'إعادة تحميل العقد',
    privateByDesign: 'خاص افتراضيًا', canonical: 'النقطة النهائية المعتمدة', audience: 'جمهور ID-token', tool: 'أداة الإثبات للقراءة فقط',
    contract: 'عقد النقطة النهائية', privacy: 'حد الخصوصية', identity: 'هوية المستدعي', protocol: 'نقل MCP', gateway: 'gateway_status',
    pinned: 'مثبت', waiting: 'لم يتم التحقق بعد', privateOk: 'تم رفض الوصول بدون مصادقة', publicRisk: 'قد يكون الوصول العام مفعّلًا',
    identityReady: 'تم الحصول على ID token داخل الخادم', identityMissing: 'لا يوجد مصدر توكن موثّق متاح',
    protocolOk: 'اكتملت مكالمة MCP موثقة', gatewayOk: 'تم استلام حمولة حقيقية من البوابة', unavailable: 'الدليل غير متاح',
    localPath: 'المسار المحلي / ADK', localBody: 'يستخدم gcloud لإصدار ID token قصير العمر لجمهور Cloud Run. التوكن لا يدخل React.',
    cloudPath: 'مسار Studio / Agent Engine', cloudBody: 'يستخدم نقطة هوية Google metadata عندما يملك وقت التشغيل حساب خدمة بصلاحية الاستدعاء.',
    rule: 'قاعدة أمان صارمة', ruleBody: 'إذا تعذر إثبات الخصوصية يتوقف KNOUX. لا يعيد المحاولة بدون مصادقة ولا يتحول إلى نقطة عامة.',
    payload: 'دليل gateway_status بعد التنقية', noPayload: 'لم يتم إثبات أي حمولة من البوابة في بيئة التشغيل الحالية.',
    lastProof: 'آخر إثبات', never: 'أبدًا', bridgeOffline: 'الجسر المحلي غير متاح. لا يمكن تشغيل تحقق MCP.',
    modern: 'حديث بدون جلسة', legacy: 'توافق رجعي بجلسة', source: 'مصدر الهوية', http: 'HTTP للحد الخاص',
  },
};

type StageTone = 'idle' | 'ok' | 'warn' | 'error';

function Stage({ icon, title, state, detail, tone = 'idle' }: { icon: ReactNode; title: string; state: string; detail: string; tone?: StageTone }) {
  return (
    <article className={`knoux-mcp-stage is-${tone}`}>
      <span className="knoux-mcp-stage-icon">{icon}</span>
      <div><small>{title}</small><b>{state}</b><p>{detail}</p></div>
      <span className="knoux-mcp-stage-status">{tone === 'ok' ? <CheckCircle2 size={17}/> : tone === 'warn' || tone === 'error' ? <AlertTriangle size={17}/> : <Radio size={16}/>}</span>
    </article>
  );
}

function safeJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value ?? ''); }
}

export default function McpConnectionCenter({ open, onClose, lang, bridgeOnline }: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  bridgeOnline: boolean | null;
}) {
  const c = COPY[lang];
  const [contract, setContract] = useState<PrivateMcpContract | null>(null);
  const [probe, setProbe] = useState<PrivateMcpProbe | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const loadContract = useCallback(async () => {
    setLoadingContract(true); setError('');
    try { setContract(await mcpApi.contract()); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : String(nextError)); }
    finally { setLoadingContract(false); }
  }, []);

  useEffect(() => {
    if (open && !contract && !loadingContract) void loadContract();
  }, [open, contract, loadingContract, loadContract]);

  const verify = useCallback(async () => {
    if (bridgeOnline === false) return;
    setVerifying(true); setError('');
    try {
      const next = await mcpApi.verify();
      setProbe(next);
      setContract(next.contract);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally { setVerifying(false); }
  }, [bridgeOnline]);

  const overall = useMemo(() => {
    if (verifying) return { tone: 'idle' as StageTone, label: c.verifying };
    if (probe?.ok) return { tone: 'ok' as StageTone, label: c.gatewayOk };
    if (probe?.privacy.state === 'public-or-misconfigured') return { tone: 'error' as StageTone, label: c.publicRisk };
    if (probe) return { tone: 'warn' as StageTone, label: probe.error?.message || c.unavailable };
    return { tone: 'idle' as StageTone, label: c.waiting };
  }, [c, probe, verifying]);

  if (!open) return null;
  const endpointHost = contract ? new URL(contract.endpoint).host : 'knoux-mcp-gateway-ewyqpoh6ra-uc.a.run.app';
  const privacyTone: StageTone = probe?.privacy.state === 'confirmed-private' ? 'ok' : probe?.privacy.state === 'public-or-misconfigured' ? 'error' : probe ? 'warn' : 'idle';
  const identityTone: StageTone = probe?.identity.state === 'available' ? 'ok' : probe ? 'warn' : 'idle';
  const protocolTone: StageTone = probe?.protocol.state === 'success' ? 'ok' : probe ? 'warn' : 'idle';
  const gatewayTone: StageTone = probe?.gatewayStatus.state === 'success' ? 'ok' : probe ? 'warn' : 'idle';
  const lastProof = probe?.checkedAt ? new Date(probe.checkedAt).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-AE') : c.never;

  return (
    <div className="knoux-mcp-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="knoux-mcp-center" role="dialog" aria-modal="true" aria-label={c.title} onMouseDown={event => event.stopPropagation()}>
        <header className="knoux-mcp-head">
          <div className="knoux-mcp-head-mark"><CloudCog size={25}/><span/></div>
          <div className="knoux-mcp-head-copy"><p className="eyebrow">{c.eyebrow}</p><h2>{c.title}</h2><p>{c.subtitle}</p></div>
          <button type="button" className="knoux-mcp-close" onClick={onClose} aria-label={c.close}><X size={18}/></button>
        </header>

        <div className="knoux-mcp-scroll">
          <section className="knoux-mcp-hero">
            <div className="knoux-mcp-hero-copy">
              <span className="knoux-mcp-private-badge"><LockKeyhole size={13}/>{c.privateByDesign}</span>
              <h3>{endpointHost}</h3>
              <code>{contract?.endpoint || 'Loading canonical endpoint…'}</code>
              <div className={`knoux-mcp-overall is-${overall.tone}`} aria-live="polite">
                {verifying ? <LoaderCircle size={16} className="is-spinning"/> : overall.tone === 'ok' ? <ShieldCheck size={16}/> : <Fingerprint size={16}/>}<span>{overall.label}</span>
              </div>
            </div>
            <div className="knoux-mcp-actions">
              <button type="button" className="knoux-mcp-verify" disabled={verifying || bridgeOnline === false || !contract} onClick={() => void verify()}>
                {verifying ? <LoaderCircle size={16} className="is-spinning"/> : <ShieldCheck size={16}/>} {verifying ? c.verifying : c.verify}
              </button>
              <button type="button" className="knoux-mcp-refresh" disabled={loadingContract || verifying} onClick={() => void loadContract()}><RefreshCw size={14}/>{c.refresh}</button>
              {bridgeOnline === false && <p className="knoux-mcp-bridge-warning"><AlertTriangle size={14}/>{c.bridgeOffline}</p>}
            </div>
          </section>

          <section className="knoux-mcp-contract-grid">
            <article><span><Route size={15}/></span><div><small>{c.canonical}</small><b>{contract?.endpoint || c.unavailable}</b></div></article>
            <article><span><KeyRound size={15}/></span><div><small>{c.audience}</small><b>{contract?.audience || c.unavailable}</b></div></article>
            <article><span><SquareTerminal size={15}/></span><div><small>{c.tool}</small><b>{contract?.tool || 'gateway_status'}</b></div></article>
          </section>

          <section className="knoux-mcp-proof-flow">
            <Stage icon={<Route size={18}/>} title={c.contract} state={contract ? c.pinned : c.waiting} detail={contract ? `${contract.service} · ${contract.region}` : c.unavailable} tone={contract ? 'ok' : 'idle'}/>
            <div className="knoux-mcp-proof-line"/>
            <Stage icon={<LockKeyhole size={18}/>} title={c.privacy} state={probe?.privacy.state === 'confirmed-private' ? c.privateOk : probe?.privacy.state === 'public-or-misconfigured' ? c.publicRisk : probe ? c.unavailable : c.waiting} detail={probe?.privacy.evidence || '401 / 403 proof required before any authenticated call.'} tone={privacyTone}/>
            <div className="knoux-mcp-proof-line"/>
            <Stage icon={<Fingerprint size={18}/>} title={c.identity} state={probe?.identity.state === 'available' ? c.identityReady : probe ? c.identityMissing : c.waiting} detail={probe?.identity.source ? `${c.source}: ${probe.identity.source}` : 'metadata → gcloud'} tone={identityTone}/>
            <div className="knoux-mcp-proof-line"/>
            <Stage icon={<Radio size={18}/>} title={c.protocol} state={probe?.protocol.state === 'success' ? c.protocolOk : probe ? c.unavailable : c.waiting} detail={probe?.protocol.version ? `${probe.protocol.era === 'modern' ? c.modern : c.legacy} · ${probe.protocol.version}` : `${contract?.modernProtocol || '2026-07-28'} → ${contract?.legacyFallbackProtocol || '2025-11-25'}`} tone={protocolTone}/>
            <div className="knoux-mcp-proof-line"/>
            <Stage icon={<ServerCog size={18}/>} title={c.gateway} state={probe?.gatewayStatus.state === 'success' ? c.gatewayOk : probe ? c.unavailable : c.waiting} detail={probe?.gatewayStatus.receivedAt ? `${c.lastProof}: ${lastProof}` : 'Read-only tool call'} tone={gatewayTone}/>
          </section>

          <section className="knoux-mcp-runtime-grid">
            <article><div className="knoux-mcp-runtime-icon"><Laptop size={20}/></div><div><small>LOCAL IDENTITY</small><h4>{c.localPath}</h4><p>{c.localBody}</p><code>gcloud auth print-identity-token</code></div></article>
            <article><div className="knoux-mcp-runtime-icon"><CloudCog size={20}/></div><div><small>CLOUD IDENTITY</small><h4>{c.cloudPath}</h4><p>{c.cloudBody}</p><code>metadata.google.internal</code></div></article>
          </section>

          <section className="knoux-mcp-hard-rule"><ShieldCheck size={19}/><div><b>{c.rule}</b><p>{c.ruleBody}</p></div><span>NO PUBLIC FALLBACK</span></section>

          {error && <section className="knoux-mcp-error"><AlertTriangle size={16}/><div><b>{c.unavailable}</b><p>{error}</p></div></section>}
          {probe?.error && <section className="knoux-mcp-error"><AlertTriangle size={16}/><div><b>{probe.error.code}</b><p>{probe.error.message}</p>{probe.privacy.httpStatus && <small>{c.http}: {probe.privacy.httpStatus}</small>}</div></section>}

          <section className="knoux-mcp-payload">
            <div><ServerCog size={16}/><h3>{c.payload}</h3><span>{probe?.gatewayStatus.state === 'success' ? 'PROVEN' : 'UNAVAILABLE'}</span></div>
            {probe?.gatewayStatus.state === 'success' ? <pre>{safeJson(probe.gatewayStatus.payload)}</pre> : <p>{c.noPayload}</p>}
          </section>
        </div>
      </section>
    </div>
  );
}
