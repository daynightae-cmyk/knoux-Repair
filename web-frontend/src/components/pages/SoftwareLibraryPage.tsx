import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Cpu,
  Filter,
  Layers3,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TerminalSquare,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { BridgeTool } from '../../lib/api';
import type { RiskLevel } from '../../types';
import type { FamilyDefinition, ServiceDefinition, ServiceId } from '../../data/family-map';

interface SoftwareLibraryPageProps {
  family: FamilyDefinition;
  tools: BridgeTool[];
  lang: 'en' | 'ar';
  bridgeOnline: boolean | null;
  bridgeElevated: boolean;
  onSelectService: (id: ServiceId) => void;
}

const SERVICE_ICONS: Record<string, ElementType> = {
  '04-Programs-Applications': Boxes,
  '16-Software-Environment': Cpu,
  '17-PostInstall-Setup': Settings2,
};

/** Ascending blast radius. The risk ceiling slider admits levels up to this index. */
const RISK_LADDER: RiskLevel[] = ['READ_ONLY', 'SAFE_CLEANUP', 'SYSTEM_REPAIR', 'DESTRUCTIVE'];

const RISK_LABEL: Record<RiskLevel, { en: string; ar: string }> = {
  READ_ONLY: { en: 'Read only', ar: 'قراءة فقط' },
  SAFE_CLEANUP: { en: 'Safe cleanup', ar: 'تنظيف آمن' },
  SYSTEM_REPAIR: { en: 'System repair', ar: 'إصلاح النظام' },
  REBOOT_REQUIRED: { en: 'Reboot required', ar: 'يتطلب إعادة تشغيل' },
  DESTRUCTIVE: { en: 'Destructive', ar: 'مدمّر' },
  WINRE_ONLY: { en: 'WinRE only', ar: 'بيئة الاستعادة فقط' },
};

const DENSITY_LABEL = [
  { en: 'Compact', ar: 'مضغوط' },
  { en: 'Comfortable', ar: 'مريح' },
  { en: 'Full', ar: 'كامل' },
] as const;

function riskRank(level: RiskLevel) {
  const index = RISK_LADDER.indexOf(level);
  return index < 0 ? RISK_LADDER.length : index;
}

/** The manifest writes recovery intent as prose, e.g. "None (read-only listing)".
    Only an explicit recovery method counts, so a control labelled "has backup"
    can never admit a tool whose own manifest says it has none. */
function declaresRecovery(value: string | undefined) {
  const text = (value ?? '').trim().toLowerCase();
  if (text === '') return false;
  return !/^(none|no\b|n\/?a|not (applicable|available|required)|unsupported|-)\b/.test(text) && !text.startsWith('none');
}

function hasRollback(tool: BridgeTool) {
  return declaresRecovery(tool.RollbackMethod);
}

function hasBackup(tool: BridgeTool) {
  return declaresRecovery(tool.BackupMethod);
}

export default function SoftwareLibraryPage({
  family,
  tools,
  lang,
  bridgeOnline,
  bridgeElevated,
  onSelectService,
}: SoftwareLibraryPageProps) {
  const ar = lang === 'ar';
  const t = (en: string, arLabel: string) => (ar ? arLabel : en);

  // Every control below is driven by the live manifest. With no bridge there is
  // nothing measured, so nothing is counted and the deck says so plainly.
  const measured = bridgeOnline === true;
  const byService = useMemo(() => {
    const map = new Map<string, BridgeTool[]>();
    for (const service of family.services) {
      map.set(service.id, tools.filter(tool => tool.Category === service.id));
    }
    return map;
  }, [family.services, tools]);

  const [query, setQuery] = useState('');
  const [riskCeiling, setRiskCeiling] = useState(RISK_LADDER.length - 1);
  const [privilege, setPrivilege] = useState<1 | 2>(1);
  const [reversibility, setReversibility] = useState<0 | 1 | 2>(0);
  const [density, setDensity] = useState<0 | 1 | 2>(1);
  const [focusService, setFocusService] = useState<ServiceId | null>(null);

  const matchesControls = (tool: BridgeTool) => {
    if (focusService && tool.Category !== focusService) return false;
    if (riskRank(tool.RiskLevel) > riskCeiling) return false;
    if (privilege === 1 && tool.RequiresAdmin) return false;
    if (reversibility === 1 && !hasRollback(tool)) return false;
    if (reversibility === 2 && !(hasRollback(tool) && hasBackup(tool))) return false;
    const needle = query.trim().toLocaleLowerCase(ar ? 'ar' : 'en');
    if (needle === '') return true;
    return [tool.EnglishName, tool.ArabicName, tool.Purpose, tool.ToolId]
      .some(value => value.toLocaleLowerCase(ar ? 'ar' : 'en').includes(needle));
  };

  const visibleByService = useMemo(() => {
    const map = new Map<string, BridgeTool[]>();
    let total = 0;
    for (const [serviceId, list] of byService) {
      const filtered = list.filter(matchesControls);
      map.set(serviceId, filtered);
      total += filtered.length;
    }
    return { map, total };
  }, [byService, query, riskCeiling, privilege, reversibility, focusService]);

  const totalRegistered = measured ? tools.filter(tool => family.services.some(s => s.id === tool.Category)).length : null;
  const admitted = measured ? visibleByService.total : null;

  // Each slider shows how many registered actions its own position admits, so a
  // control is never a knob that does nothing.
  const riskAdmitted = measured
    ? tools.filter(tool => family.services.some(s => s.id === tool.Category) && riskRank(tool.RiskLevel) <= riskCeiling).length
    : null;
  const privilegeAdmitted = measured
    ? tools.filter(tool => family.services.some(s => s.id === tool.Category) && (privilege === 2 || !tool.RequiresAdmin)).length
    : null;
  const reversibilityAdmitted = measured
    ? tools.filter(tool => {
        if (!family.services.some(s => s.id === tool.Category)) return false;
        if (reversibility === 0) return true;
        if (reversibility === 1) return hasRollback(tool);
        return hasRollback(tool) && hasBackup(tool);
      }).length
    : null;

  const controlsLocked = !measured;
  const filtersActive = query.trim() !== '' || focusService !== null || riskCeiling !== RISK_LADDER.length - 1
    || privilege === 1 || reversibility !== 0;

  const resetControls = () => {
    setQuery('');
    setRiskCeiling(RISK_LADDER.length - 1);
    setPrivilege(1);
    setReversibility(0);
    setFocusService(null);
  };

  const workspaceName = (service: ServiceDefinition) => (ar ? service.name.ar : service.name.en);

  return (
    <div className="sl-deck" dir={ar ? 'rtl' : 'ltr'} data-family="software" data-measured={measured}>

      <section className="sl-masthead" aria-labelledby="sl-masthead-title">
        <div className="sl-masthead__identity">
          <span className="sl-masthead__mark" aria-hidden="true"><Layers3 size={20} /></span>
          <div>
            <p className="sl-masthead__kicker">{t('LIBRARY COMMAND DECK', 'سطح أوامر المكتبة')}</p>
            <h1 id="sl-masthead-title">{t('Software Library', 'مكتبة البرامج')}</h1>
            <p className="sl-masthead__sub">
              {t(
                'Pick a workspace, then drive the registered actions with the controls below. Every number here comes from the live manifest.',
                'اختر مساحة عمل، ثم قدّم الإجراءات المسجلة عبر أدوات التحكم أدناه. كل رقم هنا يأتي من سجل الأدوات الحقيقي.',
              )}
            </p>
          </div>
        </div>
        <dl className="sl-masthead__state">
          <div>
            <dt>{t('Bridge', 'الجسر')}</dt>
            <dd data-state={bridgeOnline === true ? 'ready' : bridgeOnline === false ? 'offline' : 'checking'}>
              {bridgeOnline === true
                ? t('Online', 'متصل')
                : bridgeOnline === false
                  ? t('Offline', 'غير متصل')
                  : t('Checking', 'جارٍ الفحص')}
            </dd>
          </div>
          <div>
            <dt>{t('Privilege', 'الامتياز')}</dt>
            <dd data-state={bridgeElevated ? 'elevated' : 'standard'}>
              {bridgeElevated ? t('Elevated', 'مرتفع') : t('Standard', 'قياسي')}
            </dd>
          </div>
          <div>
            <dt>{t('Registered', 'مسجّل')}</dt>
            <dd data-state={measured ? 'ready' : 'unknown'}>
              {totalRegistered === null ? '—' : totalRegistered}
            </dd>
          </div>
        </dl>
      </section>

      <section className="sl-controls" aria-labelledby="sl-controls-title" aria-disabled={controlsLocked}>
        <header className="sl-controls__head">
          <span className="sl-controls__mark" aria-hidden="true"><SlidersHorizontal size={15} /></span>
          <h2 id="sl-controls-title">{t('Action controls', 'أدوات التحكم بالإجراءات')}</h2>
          <p className="sl-controls__readout" aria-live="polite">
            {admitted === null
              ? t('Not checked yet', 'لم يتم الفحص بعد')
              : t(`${admitted} of ${totalRegistered} actions`, `${admitted} من ${totalRegistered} إجراءً`)}
          </p>
          <button
            type="button"
            className="sl-controls__reset"
            onClick={resetControls}
            disabled={controlsLocked || !filtersActive}
          >
            <RotateCcw size={13} />
            {t('Reset', 'إعادة ضبط')}
          </button>
        </header>

        <div className="sl-controls__body">
          <label className="sl-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              disabled={controlsLocked}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('Search actions…', 'ابحث في الإجراءات…')}
              aria-label={t('Search actions by name, purpose or ToolId', 'ابحث في الإجراءات بالاسم أو الغرض أو المعرّف')}
            />
          </label>

          <DeckSlider
            label={t('Risk ceiling', 'سقف الخطورة')}
            hint={t(`Admit actions up to ${RISK_LABEL[RISK_LADDER[riskCeiling]].en}`, `السماح حتى ${RISK_LABEL[RISK_LADDER[riskCeiling]].ar}`)}
            value={riskCeiling}
            max={RISK_LADDER.length - 1}
            count={riskAdmitted}
            disabled={controlsLocked}
            marks={RISK_LADDER.map(level => RISK_LABEL[level][lang])}
            onChange={setRiskCeiling}
          />
          <DeckSlider
            label={t('Privilege scope', 'نطاق الامتياز')}
            hint={privilege === 1
              ? t('Standard user actions only', 'إجراءات المستخدم القياسي فقط')
              : t('Include administrator actions', 'تضمين إجراءات المسؤول')}
            value={privilege}
            max={2}
            count={privilegeAdmitted}
            disabled={controlsLocked}
            marks={[t('Any', 'الكل'), t('Standard', 'قياسي'), t('Admin', 'مسؤول')]}
            onChange={value => setPrivilege(value === 0 ? 1 : (value as 1 | 2))}
          />
          <DeckSlider
            label={t('Reversibility', 'قابلية التراجع')}
            hint={reversibility === 0
              ? t('Any recovery story', 'أي وسيلة استرجاع')
              : reversibility === 1
                ? t('Has a rollback path', 'له مسار تراجع')
                : t('Rollback and backup', 'تراجع واحتياطي')}
            value={reversibility}
            max={2}
            count={reversibilityAdmitted}
            disabled={controlsLocked}
            marks={[t('Any', 'الكل'), t('Rollback', 'تراجع'), t('Both', 'كلاهما')]}
            onChange={value => setReversibility(value as 0 | 1 | 2)}
          />
          <DeckSlider
            label={t('Row detail', 'تفصيل الصف')}
            hint={DENSITY_LABEL[density][lang]}
            value={density}
            max={2}
            count={null}
            valueText={DENSITY_LABEL[density][lang]}
            disabled={controlsLocked}
            marks={DENSITY_LABEL.map(entry => entry[lang])}
            onChange={value => setDensity(value as 0 | 1 | 2)}
          />
        </div>

        {controlsLocked && (
          <p className="sl-controls__lock">
            <ShieldCheck size={14} />
            {bridgeOnline === false
              ? t('Controls stay locked until the local execution bridge is reachable. No action count is assumed.', 'تبقى الأدوات مقفلة حتى يمكن الوصول إلى جسر التنفيذ المحلي. لا يُفترض أي عدد.')
              : t('Reading the live action manifest…', 'جارٍ قراءة سجل الإجراءات الحقيقي…')}
          </p>
        )}
      </section>

      <section className="sl-topology" aria-labelledby="sl-topology-title">
        <header className="sl-section-head">
          <span className="sl-section-head__mark" aria-hidden="true"><Filter size={14} /></span>
          <div>
            <h2 id="sl-topology-title">{t('Workspace topology', 'طوبولوجيا مساحات العمل')}</h2>
            <p>
              {t(
                'Select a workspace to scope the inventory below, or open it to work inside it.',
                'اختر مساحة عمل لتقييد الجرد أدناه، أو افتحها للعمل داخلها.',
              )}
            </p>
          </div>
        </header>

        <ol className="sl-topology__rail">
          {family.services.map((service, index) => {
            const Icon = SERVICE_ICONS[service.id] ?? Layers3;
            const all = byService.get(service.id) ?? [];
            const shown = visibleByService.map.get(service.id) ?? [];
            const adminCount = all.filter(tool => tool.RequiresAdmin).length;
            const riskBars = RISK_LADDER.map(level => all.filter(tool => tool.RiskLevel === level).length);
            const focused = focusService === service.id;
            return (
              <li key={service.id} className="sl-node" data-focused={focused} data-service-id={service.id}>
                <span className="sl-node__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <button
                  type="button"
                  className="sl-node__head"
                  onClick={() => onSelectService(service.id)}
                  aria-label={t(`Open ${workspaceName(service)}`, `افتح ${workspaceName(service)}`)}
                >
                  <span className="sl-node__icon" aria-hidden="true"><Icon size={19} /></span>
                  <span className="sl-node__heading">
                    <strong>{workspaceName(service)}</strong>
                    <small>{ar ? service.purpose.ar : service.purpose.en}</small>
                  </span>
                  <ArrowRight size={15} className="sl-node__head-go rtl:rotate-180" aria-hidden="true" />
                </button>

                <div className="sl-node__risk" role="img" aria-label={t(
                  `Registered actions by risk: ${RISK_LADDER.map(level => `${RISK_LABEL[level].en} ${riskBars[RISK_LADDER.indexOf(level)]}`).join(', ')}`,
                  `الإجراءات المسجلة حسب الخطورة: ${RISK_LADDER.map(level => `${RISK_LABEL[level].ar} ${riskBars[RISK_LADDER.indexOf(level)]}`).join('، ')}`,
                )}>
                  {RISK_LADDER.map((level, levelIndex) => (
                    <i key={level} data-risk={level} style={{ flexGrow: Math.max(riskBars[levelIndex], 0.001) }} />
                  ))}
                </div>

                <dl className="sl-node__meta">
                  <div>
                    <dt>{t('Registered', 'مسجّل')}</dt>
                    <dd>{measured ? all.length : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('Shown', 'معروض')}</dt>
                    <dd>{measured ? shown.length : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('Needs admin', 'يحتاج مسؤول')}</dt>
                    <dd>{measured ? adminCount : '—'}</dd>
                  </div>
                </dl>

                <div className="sl-node__actions">
                  <button
                    type="button"
                    onClick={() => setFocusService(focused ? null : service.id)}
                    disabled={controlsLocked}
                    aria-pressed={focused}
                  >
                    {focused ? t('Clear focus', 'إلغاء التركيز') : t('Focus inventory', 'تركيز الجرد')}
                  </button>
                  <button type="button" className="sl-node__open" onClick={() => onSelectService(service.id)}>
                    {t('Open workspace', 'افتح المساحة')}
                    <ArrowRight size={15} className="rtl:rotate-180" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="sl-inventory" aria-labelledby="sl-inventory-title">
        <header className="sl-section-head">
          <span className="sl-section-head__mark" aria-hidden="true"><TerminalSquare size={14} /></span>
          <div>
            <h2 id="sl-inventory-title">{t('Action inventory', 'جرد الإجراءات')}</h2>
            <p>
              {admitted === null
                ? t('Waiting for the live manifest.', 'بانتظار سجل الإجراءات الحقيقي.')
                : t('Registered actions matching the current controls.', 'الإجراءات المسجلة المطابقة لأدوات التحكم الحالية.')}
            </p>
          </div>
        </header>

        <div className="sl-inventory__groups" data-density={density}>
          {family.services.map(service => {
            const list = visibleByService.map.get(service.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={service.id} className="sl-group">
                <header>
                  <h3>{workspaceName(service)}</h3>
                  <span>{t(`${list.length} shown`, `${list.length} معروض`)}</span>
                </header>
                <ul>
                  {list.map(tool => (
                    <li key={tool.ToolId} data-risk={tool.RiskLevel}>
                      <code>{tool.ToolId}</code>
                      <div className="sl-group__name">
                        <strong>{ar ? tool.ArabicName : tool.EnglishName}</strong>
                        {density > 0 && (ar ? tool.ArabicName : tool.EnglishName) !== (ar ? tool.EnglishName : tool.ArabicName) && (
                          <small>{ar ? tool.EnglishName : tool.ArabicName}</small>
                        )}
                        {density === 2 && <p>{tool.Purpose}</p>}
                      </div>
                      <div className="sl-group__chips">
                        <span data-chip="risk" data-risk={tool.RiskLevel}>{RISK_LABEL[tool.RiskLevel][lang]}</span>
                        {tool.RequiresAdmin && <span data-chip="admin">{t('Admin', 'مسؤول')}</span>}
                        {tool.AnalyzeOnlySupported && <span data-chip="analyze">{t('Analyze', 'تحليل')}</span>}
                        {tool.WhatIfSupported && <span data-chip="whatif">{t('What-if', 'معاينة')}</span>}
                        {tool.ReportsEvidence && <span data-chip="evidence">{t('Evidence', 'دليل')}</span>}
                        {tool.RequiresRestart && <span data-chip="reboot">{t('Reboot', 'إعادة تشغيل')}</span>}
                        {hasRollback(tool) && <span data-chip="rollback">{t('Rollback', 'تراجع')}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {admitted === 0 && (
          <p className="sl-inventory__empty">
            {t(
              'No registered action matches these controls. Loosen a control to widen the inventory.',
              'لا يوجد إجراء مسجّل يطابق هذه الأدوات. خفّف أحدها لتوسيع الجرد.',
            )}
          </p>
        )}
      </section>

      <footer className="sl-safety">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          <strong>{t('Selection is not execution.', 'الاختيار ليس تنفيذًا.')}</strong>
          <span>
            {t(
              'Nothing on this screen changes your device. Open a workspace, review the evidence, and confirm there before any action runs.',
              'لا يغيّر شيء في هذه الشاشة جهازك. افتح مساحة عمل، وراجع الأدلة، وأكّد هناك قبل تنفيذ أي إجراء.',
            )}
          </span>
        </p>
        <span className="sl-safety__privilege" data-state={bridgeElevated ? 'elevated' : 'standard'}>
          {bridgeElevated ? t('Administrator access available', 'صلاحيات المدير متاحة') : t('Standard access', 'الوضع القياسي')}
        </span>
      </footer>
    </div>
  );
}

interface DeckSliderProps {
  label: string;
  hint: string;
  value: number;
  max: number;
  count: number | null;
  valueText?: string;
  disabled: boolean;
  marks: string[];
  onChange: (value: number) => void;
}

function DeckSlider({ label, hint, value, max, count, valueText, disabled, marks, onChange }: DeckSliderProps) {
  return (
    <div className="sl-slider" data-disabled={disabled}>
      <div className="sl-slider__head">
        <label htmlFor={`sl-slider-${label}`}>{label}</label>
        <span
          className="sl-slider__count"
          data-state={count === null ? 'label' : 'measured'}
        >
          {valueText ?? (count === null ? '—' : count)}
        </span>
      </div>
      <input
        id={`sl-slider-${label}`}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
        aria-valuetext={hint}
      />
      <div className="sl-slider__foot">
        <small>{hint}</small>
        <span className="sl-slider__marks" aria-hidden="true">
          {marks.map((mark, index) => <i key={mark} data-active={index === value}>{mark}</i>)}
        </span>
      </div>
    </div>
  );
}
