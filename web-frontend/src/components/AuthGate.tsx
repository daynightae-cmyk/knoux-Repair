import { Fingerprint, Github, LoaderCircle, RefreshCw, ShieldCheck, ShieldX, Sparkles, UserRound, X } from 'lucide-react';
import type { BridgeAuthStatus } from '../lib/api';
import type { Lang } from '../lib/i18n';

type AuthenticationProviderId = 'google' | 'github' | 'entra';
type ProviderStatus = { label: string; configured: boolean };

const COPY = {
  en: {
    eyebrow: 'KNOUX IDENTITY',
    title: 'Your repair workstation, your choice of access.',
    body: 'Sign in for protected execution and account identity, or continue locally. Local Mode never bypasses bridge-side authorization.',
    google: 'Continue with Google',
    github: 'GitHub',
    entra: 'Microsoft',
    secondary: 'Or use another provider',
    local: 'Continue in Local Mode',
    localHint: 'Open the workstation without a provider account. Protected actions can still require sign-in.',
    configured: 'System Browser • PKCE',
    unavailable: 'Not configured locally',
    waiting: 'Waiting for system browser…',
    cancel: 'Cancel sign-in',
    retry: 'Refresh provider status',
    passkey: 'Windows Hello / Passkey',
    passkeyHint: 'Device sign-in is not configured in this bridge',
    setup: 'No provider is configured on this workstation yet. Local Mode remains available.',
    safety: 'OAuth secrets and provider tokens never enter the React bundle. The local bridge owns the session boundary.',
  },
  ar: {
    eyebrow: 'هوية KNOUX',
    title: 'محطة الإصلاح الخاصة بك، وطريقة الدخول باختيارك.',
    body: 'سجّل الدخول للتنفيذ المحمي وهوية الحساب، أو تابع محليًا. الوضع المحلي لا يتجاوز تفويض الجسر من الخلفية.',
    google: 'المتابعة باستخدام Google',
    github: 'GitHub',
    entra: 'Microsoft',
    secondary: 'أو استخدم مزودًا آخر',
    local: 'المتابعة بالوضع المحلي',
    localHint: 'افتح محطة العمل دون حساب مزود. قد تظل الإجراءات المحمية بحاجة إلى تسجيل الدخول.',
    configured: 'متصفح النظام • PKCE',
    unavailable: 'غير مهيأ محليًا',
    waiting: 'في انتظار متصفح النظام…',
    cancel: 'إلغاء تسجيل الدخول',
    retry: 'تحديث حالة المزودين',
    passkey: 'Windows Hello / Passkey',
    passkeyHint: 'تسجيل دخول الجهاز غير مهيأ في هذا الجسر',
    setup: 'لا يوجد مزود مهيأ على هذا الجهاز حتى الآن. الوضع المحلي يظل متاحًا.',
    safety: 'لا تدخل أسرار OAuth أو رموز المزود إلى حزمة React. الجسر المحلي هو صاحب حد الجلسة.',
  },
};

export default function AuthGate({
  lang,
  status,
  loading,
  error,
  pendingProvider,
  onRetry,
  onSignIn,
  onCancel,
  onLocalMode,
}: {
  lang: Lang;
  status: BridgeAuthStatus | null;
  loading: boolean;
  error: string;
  pendingProvider: AuthenticationProviderId | null;
  onRetry: () => void;
  onSignIn: (provider: AuthenticationProviderId) => void;
  onCancel: () => void;
  onLocalMode: () => void;
}) {
  const c = COPY[lang];
  const providers = (status?.providers || {}) as Record<string, ProviderStatus>;
  const google = providers.google;
  const secondary: AuthenticationProviderId[] = ['entra', 'github'];
  const anyConfigured = Object.values(providers).some(provider => provider.configured);

  return (
    <div className="knoux-login-shell" role="dialog" aria-modal="true" aria-label={c.title}>
      <div className="knoux-login-atmosphere" />
      <section className="knoux-login-story">
        <div className="knoux-login-brand"><span>KNOUX</span><b>Repair</b></div>
        <div className="knoux-login-orbit" aria-hidden="true"><div /><div /><div /><ShieldCheck size={34} /></div>
        <div className="knoux-login-signal" aria-hidden="true">
          <span><i />{lang === 'ar' ? 'جلسة محلية مشفّرة' : 'Encrypted local session'}</span>
          <span><i />{lang === 'ar' ? 'تحقق PKCE' : 'PKCE verified'}</span>
          <span><i />{lang === 'ar' ? 'جسر موثوق' : 'Trusted bridge'}</span>
        </div>
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p>{c.body}</p>
        <div className="knoux-login-trust"><ShieldCheck size={16}/><span>{c.safety}</span></div>
      </section>

      <main className="knoux-login-card">
        <div className="knoux-login-card-head"><Sparkles size={18}/><span>{lang === 'ar' ? 'دخول آمن' : 'Secure access'}</span></div>
        {error && <div className="knoux-login-error"><ShieldX size={16}/><span>{error}</span></div>}

        <button
          type="button"
          className="knoux-login-google"
          disabled={!google?.configured || Boolean(pendingProvider)}
          onClick={() => onSignIn('google')}
        >
          <span className="knoux-provider-glyph">G</span>
          <span><b>{c.google}</b><small>{google?.configured ? c.configured : c.unavailable}</small></span>
          {pendingProvider === 'google' ? <LoaderCircle size={17} className="is-spinning"/> : <UserRound size={17}/>} 
        </button>

        <div className="knoux-login-divider"><span>{c.secondary}</span></div>
        <div className="knoux-login-secondary">
          {secondary.map(provider => {
            const item = providers[provider];
            const pending = pendingProvider === provider;
            return (
              <button key={provider} type="button" disabled={!item?.configured || Boolean(pendingProvider)} onClick={() => onSignIn(provider)}>
                <span className="knoux-provider-glyph">{provider === 'github' ? <Github size={17}/> : 'M'}</span>
                <span><b>{provider === 'github' ? c.github : c.entra}</b><small>{item?.configured ? c.configured : c.unavailable}</small></span>
                {pending && <LoaderCircle size={15} className="is-spinning"/>}
              </button>
            );
          })}
        </div>

        <button type="button" className="knoux-login-passkey" disabled title={c.passkeyHint}>
          <Fingerprint size={17} />
          <span><b>{c.passkey}</b><small>{c.passkeyHint}</small></span>
          <span className="knoux-login-unavailable">{c.unavailable}</span>
        </button>

        {pendingProvider && <button type="button" className="knoux-login-cancel" onClick={onCancel}><X size={14}/>{c.cancel}</button>}

        <button type="button" className="knoux-login-local" onClick={onLocalMode} disabled={loading || Boolean(pendingProvider)}>
          <ShieldCheck size={17}/><span><b>{c.local}</b><small>{c.localHint}</small></span>
        </button>

        {!anyConfigured && status && <p className="knoux-login-setup">{c.setup}</p>}
        <button type="button" className="knoux-login-refresh" onClick={onRetry} disabled={Boolean(pendingProvider)}>
          {loading ? <LoaderCircle size={14} className="is-spinning"/> : <RefreshCw size={14}/>} {c.retry}
        </button>
      </main>
    </div>
  );
}
