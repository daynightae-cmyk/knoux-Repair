import { useState, useEffect } from 'react';
import {
  Lock, KeyRound, ShieldAlert,
  AlertTriangle, Loader2, Shield
} from 'lucide-react';
import { api } from '../../../lib/api';

interface PremiumGateProps {
  lang: 'en' | 'ar';
  isUnlocked: boolean;
  onUnlocked: (token: string) => void;
  onClose?: () => void;
  children?: React.ReactNode;
}

export default function PremiumGate({ lang, isUnlocked, onUnlocked, onClose, children }: PremiumGateProps) {
  const isRtl = lang === 'ar';
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockStatus, setLockStatus] = useState<{ locked: boolean; lockRemainingSec: number; failedAttempts: number }>({
    locked: false,
    lockRemainingSec: 0,
    failedAttempts: 0,
  });

  const checkStatus = async () => {
    try {
      const res = await api.workbenchKeyStatus();
      if (res.ok) {
        setLockStatus({
          locked: res.locked,
          lockRemainingSec: res.lockRemainingSec,
          failedAttempts: res.failedAttempts,
        });
      }
    } catch {
      // Offline / bridge fallback
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || lockStatus.locked || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.workbenchVerifyKey(keyInput.trim());
      if (res.ok && res.sessionToken) {
        onUnlocked(res.sessionToken);
      } else {
        setErrorMsg(res.message || (isRtl ? 'مفتاح المرور غير صالح.' : 'Invalid access key.'));
        await checkStatus();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || (isRtl ? 'تعذر التحقق من المفتاح عبر الجسر المحلي.' : 'Key verification failed via local bridge.'));
      await checkStatus();
    } finally {
      setLoading(false);
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  const gateContent = (
    <div className="flex flex-col items-center justify-center p-8 min-h-[400px] max-w-lg mx-auto text-center relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition"
        >
          ✕ {isRtl ? 'إغلاق' : 'Close'}
        </button>
      )}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
          <Lock size={32} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-violet-600 border border-violet-400 flex items-center justify-center text-white">
          <KeyRound size={13} />
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-2 tracking-wide">
        {isRtl ? 'محطة هندسة البرمجيات المتقدمة' : 'Engineering Workbench Intelligence'}
      </h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-6">
        {isRtl
          ? 'يتطلب الوصول إلى سونار المشاريع واستوديو المطور المتقدم التحقق الآمن عبر scrypt من خادم الجسر المحلي. لا يُخزن المفتاح بصيغة نص صريح.'
          : 'Access to Project Sonar and Developer Arsenal requires local bridge cryptographic verification. Key is verified server-side via salted scrypt and rate-limited.'}
      </p>

      {lockStatus.locked ? (
        <div className="w-full bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-4 flex items-center gap-3 text-rose-300 text-xs text-start">
          <ShieldAlert size={20} className="shrink-0 text-rose-400" />
          <div>
            <div className="font-semibold">{isRtl ? 'المحطة مقفلة مؤقتًا' : 'Station Access Locked'}</div>
            <div className="text-[11px] text-rose-300/80 mt-0.5">
              {isRtl
                ? `تجاوز الحد الأقصى للمحاولات. الرجاء الانتظار ${lockStatus.lockRemainingSec} ثانية.`
                : `Maximum attempts exceeded. Rate-limited for ${lockStatus.lockRemainingSec} seconds.`}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="w-full space-y-3">
          <div className="relative">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={isRtl ? 'أدخل مفتاح الترخيص المميز...' : 'Enter station access key...'}
              disabled={loading || lockStatus.locked}
              className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-mono"
            />
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-400 flex items-center justify-center gap-1.5 font-medium">
              <AlertTriangle size={13} />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || lockStatus.locked || !keyInput.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium text-xs tracking-wider uppercase transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            <span>{loading ? (isRtl ? 'جارٍ التحقق المشفر...' : 'Verifying...') : (isRtl ? 'فتح المحطة' : 'Unlock Station')}</span>
          </button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Shield size={12} className="text-emerald-400" />
          {isRtl ? 'مقارنة زمنية ثابتة' : 'Constant-Time Equal'}
        </span>
        <span>•</span>
        <span>{isRtl ? 'حماية من القوة الغاشمة' : 'Brute-Force Protected'}</span>
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-[#0b0f19] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full">
          {gateContent}
        </div>
      </div>
    );
  }

  return gateContent;
}
