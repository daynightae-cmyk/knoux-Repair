# KNOUX Repair v2.0.2 — نوكس ريبير

محطة صيانة وتشخيص وإصلاح ويندوز تعمل محليًا أولًا، وتشمل التنظيف، الاستعادة، الأمان، الأداء، أدوات المطور، وتحليل المشاريع.

المستودع الحالي أصبح منتجًا أوسع من حزمة الـConsole الأصلية. الخريطة الحالية تحتوي على **18 قسم خدمة / 158 أداة وسكربتًا مسجلًا** مع بنية مشتركة للأمان والتنفيذ والتقارير.

## واجهات المنتج الحالية

- **Glass Nexus Web UI** — React 18 + TypeScript + Vite.
- **Electron Desktop** — غلاف سطح مكتب محمي لواجهة Glass Nexus.
- **WPF/.NET Desktop** — مشروع ويندوز أصلي داخل `Glass-GUI-Builder`.
- **PowerShell Console** — `Menu.ps1` مع `START-KNOUX-REPAIR.cmd`.
- **Local Execution Bridge** — الملف `web-frontend/server/bridge.mjs`، يعمل على `127.0.0.1` فقط وينفذ أدوات KNOUX المسجلة فقط.

وثائق الإصدار التاريخية التي تشير إلى 100 أداة ما زالت محفوظة كدليل على خط الأساس القديم، لكن المرجع الحالي للخدمات هو `Docs/SERVICE-INVENTORY.md`.

## الأقسام الحالية

1. صيانة النظام
2. تنظيف النظام
3. الشبكة والإنترنت
4. البرامج والتطبيقات
5. الملفات المكررة
6. مساحة وتخزين الأقراص
7. الخدمات والعمليات
8. الأداء
9. الأمان
10. التشخيص والتقارير
11. النسخ الاحتياطي والاستعادة
12. أدوات المطور
13. الخصوصية
14. إدارة التعريفات
15. مراقبة النظام
16. بيئة البرامج
17. إعداد ما بعد التثبيت
18. Project Sonar

## نموذج الأمان

كل أداة مسجلة تحمل بيانات مستوى الخطر والصلاحيات. النظام يعتمد على:

- مستويات `READ_ONLY`, `SAFE_CLEANUP`, `SYSTEM_REPAIR`, `DESTRUCTIVE`, `REBOOT_REQUIRED` ومستويات الاستعادة المتخصصة،
- تأكيد صريح قبل العمليات الخطرة،
- الحجر والنسخ الاحتياطي ودليل الاسترجاع حيث تدعم الأداة ذلك،
- حماية المسارات والعمليات الحساسة،
- Allowlist للأدوات داخل الـbridge،
- فحص وتقييد المدخلات وحدود الفحص،
- حدود Windows UAC الحقيقية.

إذا كانت الأداة `RequiresAdmin=true` والـbridge غير مرفوع الصلاحيات، يرفض التنفيذ **قبل تشغيل PowerShell** برسالة `403 / ELEVATION_REQUIRED`. البرنامج لا يتجاوز UAC ولا يحاول تصعيد الصلاحيات بصمت.

التفاصيل: `Docs/SAFETY-MODEL.md`.

## تشغيل واجهة الويب محليًا

من جذر المستودع:

```powershell
npm --prefix web-frontend ci
npm run dev
```

ثم افتح:

```text
http://127.0.0.1:3000
```

الـgateway المحلي يشغّل أو يعيد استخدام **الـbridge الحقيقي** ويحوّل `/api` إليه. لا توجد بيانات ويندوز وهمية ولا نجاحات تشغيل مصطنعة في مسار التشغيل المدعوم.

للأدوات التي تحتاج Administrator، شغّل الطرفية أو التطبيق عبر **Run as administrator** واترك Windows UAC هو جهة منح الصلاحية.

## التحقق من الويب

```powershell
npm --prefix web-frontend run typecheck
npm --prefix web-frontend test
npm --prefix web-frontend run build
```

فحص اعتماديات الإنتاج:

```powershell
npm --prefix web-frontend audit --omit=dev --audit-level=high
```

## Electron Desktop

للتطوير:

```powershell
npm --prefix web-frontend run desktop:dev
```

لإنشاء الحزمة:

```powershell
npm --prefix web-frontend run desktop:package
```

Electron يستخدم `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`، ويقدم الواجهة محليًا فقط مع منع التنقل الخارجي داخل التطبيق وإضافة رؤوس أمان للصفحات.

## PowerShell Console

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Menu.ps1"
```

أو استخدم `START-KNOUX-REPAIR.cmd`.

الأدوات التي تدعم ذلك يمكن تشغيلها مباشرة بوضع `-AnalyzeOnly` أو `-WhatIf` قبل أي تغيير.

## الاختبارات وCI

GitHub Actions يشغّل بوابة جودة Windows مع كل Push أو Pull Request إلى `main` وتشمل:

- `npm ci`
- Dependency Audit لاعتماديات الإنتاج
- TypeScript
- اختبارات الواجهة
- بناء الويب
- .NET restore/build
- اختبار timeout معزول للـbridge
- مجموعة الاختبارات الوظيفية لـPowerShell/Desktop

يبقى الاختبار اليدوي على أجهزة ويندوز حقيقية مطلوبًا لمسارات الإصلاح الخطرة، إعادة التشغيل، الاسترجاع الفعلي، حالات الهاردوير الخاصة، والاختبار الموسع لقارئات الشاشة ولوحة المفاتيح. راجع `Docs/KNOWN-LIMITATIONS.md`.

## المصادقة

المصادقة اختيارية في التشغيل المحلي. عند تفعيل `KNOUX_AUTH_REQUIRED=true` يمكن إعداد GitHub OAuth و/أو Microsoft Entra ID. عملية OAuth تستخدم state + PKCE، وتبقى access tokens داخل عملية الـbridge؛ المتصفح يستلم فقط session cookie محلية `HttpOnly` و`SameSite=Lax`.

راجع `.env.example` و`web-frontend/.env.example` و`Docs/LOCAL-OAUTH-SETUP.md`.

## مراجع الحقيقة الحالية

- `Docs/SERVICE-INVENTORY.md` — خريطة الخدمات والأدوات ونضج واجهاتها.
- `Docs/SAFETY-MODEL.md` — حدود التنفيذ وUAC والمصادقة والحجر والحماية.
- `Docs/KNOWN-LIMITATIONS.md` — القيود الحالية وحدود الاختبارات اليدوية.
- `Docs/TOOLS-MANIFEST.json` + `Config/menus.json` — الأدوات المسجلة المسموح بتنفيذها.
- `.github/workflows/ci.yml` — بوابة الجودة الآلية.

أي وثيقة تاريخية تشير إلى 100 أداة تصف خط الأساس القديم للإصدار، وليست جردًا كاملًا للمستودع الحالي.
