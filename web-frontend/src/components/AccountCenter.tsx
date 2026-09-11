import { Github, Laptop, Link2, LogOut, MonitorCheck, RefreshCw, ShieldCheck, UserRound, Wifi, WifiOff, X } from 'lucide-react';
import type { BridgeAuthStatus } from '../lib/api';
import type { Lang } from '../lib/i18n';

type AuthenticationProviderId = 'google' | 'github' | 'entra';
type ProviderStatus = { label: string; configured: boolean };
type AuthUser = { provider?: string; id?: string; name?: string; handle?: string; avatarUrl?: string };

const COPY = {
  en: {
    title: 'Account & connections', subtitle: 'Identity stays local-first. Connected state is shown only when the bridge proves it.',
    localMode: 'Local Mode', localBody: 'No provider session is active. The workstation remains usable locally; protected execution can request sign-in.',
    profile: 'Profile', connectedAccounts: 'Connected Accounts', devices: 'Devices', currentDevice: 'Current workstation', remoteDevices: 'Remote devices',
    connected: 'Connected', ready: 'Available to connect', unavailable: 'Not configured', signIn: 'Connect', signOut: 'Sign out', close: 'Close account center',
    bridgeOnline: 'Local bridge online', bridgeOffline: 'Local bridge unavailable', bridgeChecking: 'Checking local bridge',
    noRemote: 'No remote device registry is connected. KNOUX is not inventing device names, operating systems, or last-seen timestamps.',
    truthful: 'Evidence-backed identity state', refresh: 'Refresh account state', providerSession: 'Provider session', localSession: 'Local workstation session',
  },
  ar: {
    title: 'الحساب والاتصالات', subtitle: 'الهوية محلية أولًا. لا تظهر حالة اتصال إلا إذا أثبتها الجسر.',
    localMode: 'الوضع المحلي', localBody: 'لا توجد جلسة مزود نشطة. تظل محطة العمل قابلة للاستخدام محليًا، وقد يطلب التنفيذ المحمي تسجيل الدخول.',
    profile: 'الملف الشخصي', connectedAccounts: 'الحسابات المتصلة', devices: 'الأجهزة', currentDevice: 'محطة العمل الحالية', remoteDevices: 'الأجهزة البعيدة',
    connected: 'متصل', ready: 'متاح للاتصال', unavailable: 'غير مهيأ', signIn: 'اتصال', signOut: 'تسجيل الخروج', close: 'إغلاق مركز الحساب',
    bridgeOnline: 'الجسر المحلي متصل', bridgeOffline: 'الجسر المحلي غير متاح', bridgeChecking: 'جارٍ فحص الجسر المحلي',
    noRemote: 'لا يوجد سجل أجهزة بعيدة متصل. لا يقوم KNOUX باختراع أسماء أجهزة أو أنظمة تشغيل أو أوقات آخر ظهور.',
    truthful: 'حالة هوية مدعومة بالأدلة', refresh: 'تحديث حالة الحساب', providerSession: 'جلسة المزود', localSession: 'جلسة محطة العمل المحلية',
  },
};

export default function AccountCenter({
  open, onClose, lang, auth, localModeActive, bridgeOnline, pendingProvider, onSignIn, onLogout, onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  auth: BridgeAuthStatus | null;
  localModeActive: boolean;
  bridgeOnline: boolean | null;
  pendingProvider: AuthenticationProviderId | null;
  onSignIn: (provider: AuthenticationProviderId) => void;
  onLogout: () => void;
  onRefresh: () => void;
}) {
  if (!open) return null;
  const c = COPY[lang];
  const providers = (auth?.providers || {}) as Record<string, ProviderStatus>;
  const user = auth?.user as AuthUser | null | undefined;
  const authenticated = Boolean(auth?.authenticated && user);
  const modeLabel = authenticated ? c.providerSession : c.localSession;
  const displayName = authenticated ? (user?.name || user?.handle || c.providerSession) : c.localMode;
  const handle = authenticated ? (user?.handle || user?.provider || '') : c.localBody;
  const ids: AuthenticationProviderId[] = ['google', 'entra', 'github'];
  const bridgeLabel = bridgeOnline === true ? c.bridgeOnline : bridgeOnline === false ? c.bridgeOffline : c.bridgeChecking;

  return (
    <div className="knoux-account-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="knoux-account-center" role="dialog" aria-modal="true" aria-label={c.title} onMouseDown={event => event.stopPropagation()}>
        <header className="knoux-account-head">
          <div><p className="eyebrow">KNOUX IDENTITY</p><h2>{c.title}</h2><p>{c.subtitle}</p></div>
          <div className="knoux-account-actions">
            <button type="button" onClick={onRefresh}><RefreshCw size={15}/>{c.refresh}</button>
            <button type="button" className="icon-only" onClick={onClose} aria-label={c.close}><X size={18}/></button>
          </div>
        </header>

        <div className="knoux-account-grid">
          <article className="knoux-account-profile">
            <div className="knoux-account-avatar">
              {authenticated && user?.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer"/> : <UserRound size={34}/>} 
              <span className={authenticated ? 'is-connected' : 'is-local'} />
            </div>
            <p className="knoux-account-kicker">{c.profile}</p>
            <h3>{displayName}</h3>
            <p>{handle}</p>
            <div className="knoux-account-truth"><ShieldCheck size={14}/>{c.truthful}</div>
            {authenticated ? (
              <button type="button" className="knoux-account-logout" onClick={onLogout}><LogOut size={15}/>{c.signOut}</button>
            ) : (
              <div className="knoux-account-local"><Laptop size={17}/><span><b>{c.localMode}</b><small>{localModeActive || !auth?.required ? modeLabel : c.localBody}</small></span></div>
            )}
          </article>

          <div className="knoux-account-stack">
            <section className="knoux-account-panel">
              <div className="knoux-account-panel-title"><Link2 size={17}/><div><h3>{c.connectedAccounts}</h3><p>{modeLabel}</p></div></div>
              <div className="knoux-connected-list">
                {ids.map(provider => {
                  const item = providers[provider];
                  const active = Boolean(authenticated && user?.provider === provider);
                  const pending = pendingProvider === provider;
                  const label = item?.label || (provider === 'entra' ? 'Microsoft Entra ID' : provider === 'google' ? 'Google' : 'GitHub');
                  const state = active ? c.connected : item?.configured ? c.ready : c.unavailable;
                  return (
                    <article key={provider} className={active ? 'is-connected' : !item?.configured ? 'is-disabled' : ''}>
                      <span className="knoux-provider-glyph">{provider === 'github' ? <Github size={16}/> : provider === 'google' ? 'G' : 'M'}</span>
                      <div><b>{label}</b><small>{state}</small></div>
                      {active ? <MonitorCheck size={17}/> : <button type="button" disabled={!item?.configured || Boolean(pendingProvider)} onClick={() => onSignIn(provider)}>{pending ? '…' : c.signIn}</button>}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="knoux-account-panel">
              <div className="knoux-account-panel-title"><Laptop size={17}/><div><h3>{c.devices}</h3><p>{c.currentDevice}</p></div></div>
              <div className="knoux-device-current">
                <span>{bridgeOnline ? <Wifi size={18}/> : <WifiOff size={18}/>}</span>
                <div><b>{c.currentDevice}</b><small>{bridgeLabel}</small></div>
                <em>{bridgeOnline === true ? 'LOCAL' : 'UNAVAILABLE'}</em>
              </div>
              <div className="knoux-device-empty"><b>{c.remoteDevices}</b><p>{c.noRemote}</p></div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
