# تقرير التدقيق العميق والشامل — تطبيق KNOUX Repair v2.0.3

**التاريخ:** 2026-10-20  
**الفرع:** `main` @ `e71db5e` (بعد دمج PR #83)  
**الحالة:** الشجرة نظيفة (clean working tree)  
**المسار:** `D:\New folder\KNOuX Repair\Base`  
**الإصدار:** `2.0.3` (ملف VERSION و `web-frontend/package.json`)  
**المستودع البعيد:** `origin` — فقط فرع `main`残ى (حُذف 59 فرعًا بعيدًا في التنظيف السابق)  
**الفروع المحلية المتبقية:** 15 فرعًا (archive/stash ×4، feat/، fix/، integration/، traycer/ ×5) — لم تمس.

---

## 1. ملخص تنفيذي (Executive Summary)

تطبيق KNOUX Repair هو محطة إصلاح العمل المحلية لنظام Windows، مبنية ككهربون (Electron) سطح مكتب مع واجهة React 18 وخادم خلفي (Express) للذكاء الاصطناعي والأدوات النظامية. التطبيق يعمل، 장 غير مزدحم، ويغطي 18 محطة إصلاح (station) عبر فئات النظام (صيانة، تنظيف، شبكة، برامج، ملفات مكررة، مساحة قرص، خدمات، أداء، أمان، تشخيص، نسخ احتياطي، أدوات مطوّر، خصوصية، تعريفات، مراقبة، برمجيات، ما بعد التثبيت، 소نار المشروع).

**الحالة الإجمالية:** التطبيق opertional ومختبر (822 اختبار ناجح، typecheck نظيف، build نظيف، audit 0 ثغرات). هناكgap限ات موثقة (لا يوجد gcloud محليًا، 403 IAM للبوابة السحابية، إنهاء ذاتي للتطبيق بعد 50–92 ثانية في بعض الأوضاع، اختبار NI01/run PARTIAL).

---

## 2. حالة المستودع والإصدار

| البند | القيمة |
|------|-------|
| Branch الحالي | `main` |
| SHA الحالي | `e71db5e` (Merge PR #83) |
| SHA السابق المدمج | `c33486a` (Merge PR #82) |
| Working tree | CLEAN |
|remote branches | `main` فقط (حُذف 59 فرعًا) |
| local branches | 15 فرعًا (لم تُمس) |
| إصدار التطبيق | `2.0.3` |
| حزمة الواجهة | `knoux-repair-nexus` |
| نقطة دخول 전기ون | `desktop/main.cjs` |
| خادم التطوير | `tsx server.ts` (المنفذ 8787 للجسر) |

**الدمج الأخير (PR #83):**
- ملف جديد: `web-frontend/server/workbench-inspection.mjs` — فحص ZIP مع حماية من traversal، سقوف (2GB/32MB/10k إدخال)، SHA-256 مقيد، كشف وإخفاء أسرار (8 عائلات). بدون verifier، بدون session، بدون كتابة، بدون تنفيذ.
- ملف جديد: `web-frontend/tests/workbenchInspection.test.mjs` — 11 اختبارًا.
- تعديل: `web-frontend/server/bridge-core.mjs` — أدلة Project Sonar تُنظف قبل الوصول للAI أو التقرير؛ وعد `localSecretsSent:false` أصبح مفروضًا.
- نتائج: 822/822 اختبارًا ناجحًا محليًا، CI Windows quality gate (9m44s) + installer + CodeQL + Gitar + CodeRabbit — كلها خضراء.

---

## 3. التصميم الهندسي والبنية التقنية (Architecture & Tech Stack)

### 3.1 مونوريبو (Monorepo)

- **الجذر (Root):** خادم خلفي Node.js (Express) للذكاء الاصطناعي وقواعد البيانات.
- **web-frontend:** تطبيق電рон سطح المكتب الرئيسي (React + Vite +電рон).

### 3.2 بطاريات التقنية (Tech Stack)

**الواجهة الأمامية (React):**
- React 18.3.1 / React DOM 18.3.1
- React Router DOM 7.18.2 (التوجيه الأحادي `/*` → `MasterWorkstation`)
- Vite 6.0.5 (البناء والتطوير)
- TypeScript 5.7.2 (typecheck صارم)
- Tailwind CSS 3.4.17 + PostCSS + Autoprefixer
- Framer Motion 11.15.0 (الرسوم الانتقالية)
- Lucide React 0.460.0 (الأيقونات)
- Recharts 3.10.1 (الرسوم البيانية)
- clsx + tailwind-merge (إدارة الأصناف)
- dockview-react 8.3.1 (مساحات العمل العائمة)
- @google/genai 2.21.0 (النماذج اللغوية)
- firebase 12.18.0 (المصادقة/القاعدة السحابية)
- express 5.2.1, pg 8.23.0, drizzle-orm 0.45.2 (الخلفية وقاعدة البيانات)

**سطح المكتب (Electron):**
- 電рон 42.11.15 (خط مدعوم، مثبّت عبر `allowScripts`)
- 電рон-builder 26.15.3 (التغليف NSIS لـ Windows)
- التثبيت per-user، اختصار سطح المكتب وقائمة البدء، اسم الاختصار "KNOUX Repair"

**الاختبار:**
- Node `--test --experimental-strip-types` على `tests/*.test.mjs`
- 82+ ملف اختبار، 822 اختبارًا ناجحًا (قبل PR #83 كانت 811، بعد الإضافة 11 اختبارًا جديدًا)

### 3.3 هيكل App.tsx (الواجهة الرئيسية)

`App.tsx` (443 سطر) هو الغلاف الرئيسي (`MasterWorkstation`) الذي يدير:
- 언어 (العربية/الإنجليزية) مع اتجاه RTL/LTR (`dir` و `lang`)
- السمة (dark/light)
- اتصال الجسر (bridge) على `http://127.0.0.1:8787`
- المصادقة (OAuth عبر Google/GitHub/Entra مع handoff id و polling كل 700ms، مهلة دقيقتان)
- تشغيل الأدوات (`runTool`) مع مراقبة الحالة (running/success/error/cancelled) كل 600ms
- شاشة splash (`NexusSplash`)، شريط الجانب الأيسر (LeftRail)، الشريط العلوي (TopBar)، لوحة حراسة (SentinelPanel)
- وحدة التشخيص (DiagnosticConsole)، مركز الإعدادات (SettingsCenter)، مركز الحساب (AccountCenter)
- البحث العالمي (GlobalSearch) عبر `Ctrl+K`

---

## 4. دليل المحطات الـ18 (Service Catalog — 18 Stations)

كل محطة لها ملفات `Model.ts`، `Station.tsx`، `HeroVisual.tsx` (باستثناء المحطات المشتركة). المحطات موجودة تحت `web-frontend/src/features/stations/station01…station18`.

| # | المحطة | الفئة | النموذج | الشاشة | البطل البصري |
|---|-------|-------|--------|--------|-------------|
| 01 | System Maintenance | الصيانة النظامية | `maintenanceModel.ts` | `MaintenanceStation.tsx` | — |
| 02 | System Cleanup | التنظيف النظامي | `cleanupModel.ts` | `CleanupStation.tsx` | `CleanupHeroVisual.tsx` |
| 03 | Network-Internet | الشبكة والإنترنت | `networkModel.ts` | `NetworkStation.tsx` | `NetworkHeroVisual.tsx` |
| 04 | Programs-Applications | البرامج والتطبيقات | `programsModel.ts` | `ProgramsStation.tsx` | `ProgramsHeroVisual.tsx` |
| 05 | Duplicate-Files | الملفات المكررة | `duplicateModel.ts` | `DuplicateStation.tsx` | `DuplicateHeroVisual.tsx` |
| 06 | Disk-Space | مساحة القرص | `diskSpaceModel.ts` | `DiskSpaceStation.tsx` | `DiskSpaceHeroVisual.tsx` |
| 07 | Services-Processes | الخدمات والعمليات | `servicesModel.ts` | `ServicesStation.tsx` | `ServicesHeroVisual.tsx` |
| 08 | Performance | الأداء | `performanceModel.ts` | `PerformanceStation.tsx` | `PerformanceHeroVisual.tsx` |
| 09 | Security | الأمان | `securityModel.ts` | `SecurityStation.tsx` | `SecurityHeroVisual.tsx` |
| 10 | Diagnostics-Reports | التشخيص والتقارير | `diagnosticsModel.ts` | `DiagnosticsStation.tsx` | `DiagnosticsHeroVisual.tsx` |
| 11 | Backup-Recovery | النسخ والاسترداد | `recoveryModel.ts` | `RecoveryStation.tsx` | `RecoveryHeroVisual.tsx` |
| 12 | Developer-Tools | أدوات المطور | `developerModel.ts` | `DeveloperStation.tsx` | `DeveloperHeroVisual.tsx` |
| 13 | Privacy | الخصوصية | `privacyModel.ts` | `PrivacyStation.tsx` | `PrivacyHeroVisual.tsx` |
| 14 | Driver-Management | إدارة التعريفات | `driversModel.ts` | `DriversStation.tsx` | `DriversHeroVisual.tsx` |
| 15 | System-Monitoring | المراقبة النظامية | `monitoringModel.ts` | `MonitoringStation.tsx` | `MonitoringHeroVisual.tsx` |
| 16 | Software-Environment | البيئة البرمجية | `softwareModel.ts` | `SoftwareStation.tsx` | `SoftwareHeroVisual.tsx` |
| 17 | PostInstall-Setup | ما بعد التثبيت | `postInstallModel.ts` | `PostInstallStation.tsx` | `PostInstallHeroVisual.tsx` |
| 18 | Project Sonar | سونار المشروع | `sonarModel.ts` | `ProjectSonarStation.tsx` | `SonarHeroVisual.tsx` |

### 3.4 المكونات المشتركة (Shared Station Components)
تحت `features/stations/_shared/`: `bridgeLifecycle.ts`، `capabilityGate.ts`، `contracts.ts`، `executionSemantics.ts`، `StationExecutionController.ts`، `StationToolRegistry.ts`، `StationResultRenderer.tsx`، `StationRunProgress.tsx`، `StationHistory.tsx`، `StationOfflineState.tsx`، `StationPermissionGate.tsx`، `StationActiveRunBanner.tsx`، `StationDeepLink.tsx`، `StationErrorBoundary.tsx`، `StationEvidenceViewer.tsx`.

### 3.5 مكونات الواجهة الإضافية (Premium & UI Components)
- `TopBar.tsx` — الشريط العلوي (حالة الجسر، السمة، اللغة، الحساب، الإصدار)
- `LeftRail.tsx` — شريط التنقل الجانبي
- `SentinelPanel.tsx` — لوحة الحراسة والمهام النشطة
- `FamilyPage.tsx` — صفحة العائلة (المحطة المختارة)
- `HomePage.tsx` — الصفحة الرئيسية
- `AIScanPage.tsx` — صفحة المسح بالذكاء الاصطناعي
- `ActionCenterPage.tsx` — مركز الإجراءات والمهام النشطة
- `SettingsCenter.tsx` — مركز الإعدادات (اللغة، السمة، الجسر، المصادقة)
- `AuthGate.tsx` — بوابة المصادقة
- `AccountCenter.tsx` — مركز الحساب
- `GlobalSearch.tsx` — البحث العالمي
- `DiagnosticConsole.tsx` — وحدة التشخيص والConsole
- `NexusSplash.tsx` — شاشة البداية (splash)
- `CommandCenter.tsx` — غرفة القيادة (م ported من فرع cockpit)
- `RuntimeVisualizer.tsx` — مرئيات التشغيل
- `EngineeringWorkbenchStation.tsx` — محطة العمل الهندسية
- `EngineeringWorkbenchStation.tsx` (workbench) — محطة العمل
- `ProjectSonarApp.tsx` / `ProjectSonarPanel.tsx` — تطبيق ولوحة سونار
- `ToolGrid.tsx`، `ToolCard.tsx`، `ToolRow.tsx`، `ToolboxSuite.tsx` — شبكة الأدوات
- `ServiceApps.tsx`، `ServicePlatform.tsx` — منصات الخدمات
- `ProtectSuite.tsx`، `SpeedUpSuite.tsx`، `SmartCleanupPanel.tsx` — حزم الحماية والتسريع والتنظيف
- `AllToolsCatalog.tsx` — كتالوج كل الأدوات
- `CareDashboard.tsx` — لوحة العناية
- `GoogleWorkspaceHub.tsx` — مركز جوجل وorkspace
- `OpenCodeZenHub.tsx` — مركز OpenCode Zen
- `McpConnectionCenter.tsx` — مركز اتصال MCP
- `KnouxAiContextButton.tsx` / `KnouxAiOverlayHost.tsx` / `McpOverlayHost.tsx` — مضيفات الذكاء الاصطناعي
- `WorkspaceDashboard.tsx`، `WorkspaceFolderPicker.tsx`، `KnouxDockWorkspace.tsx` — مساحة العمل
- `StationInventorySurface.tsx` — سطح جرد المحطات

### 3.6 ملفات البيانات (Data Layer)
- `data/categories.ts` — تصنيفات الخدمات
- `data/family-map.ts` — خريطة العائلات والخدمات (FAMILIES)
- `data/family-preview-config.ts` — تكوين المعاينة العائلية
- `lib/api.ts` — عميل API الجسر (الأدوات، الجري، المصادقة، النظام، النماذج)
- `lib/i18n.ts` — التجديد (العربية/الإنجليزية)
- `lib/knouxAiContext.ts` — سياق الذكاء الاصطناعي
- `lib/mcp.ts` — MCP
- `lib/systemRepair.ts` — إصلاح النظام
- `lib/workspaceApis.ts` — واجهات مساحة العمل
- `lib/aiModelsData.ts` — بيانات نماذج الذكاء الاصطناعي
- `db/backendDb.ts` ، `db/schema.ts` — قاعدة البيانات الخلفية والمخطط
- `types.ts` — الأنواع المشتركة
- `version.ts` — إصدار التطبيق (`APP_VERSION`)

---

## 5. خدمات الخلفية (Backend Services)

جميعها تحت `web-frontend/server/`:

| الملف | الحجم | الغرض |
|------|-------|------|
| `bridge.mjs` | 3,830 ب | نقطة دخول الجسر (المنفذ 8787) |
| `bridge-core.mjs` | 123,418 ب | منطق الجسر الأساسي، تنفيذ الأدوات، إدارة الجلسات، سرية Project Sonar |
| `bridge-auth.mjs` | 30,280 ب | المصادقة (OAuth handoff، claim، cancel، حالة المصادقة) |
| `cloud-relay.mjs` | 8,590 ب | ретранслятор سحابي لأدوات الجسر للقراءة فقط (مدمج عبر PR #82، `KNOUX_CLOUD_RELAY_ENABLED`) |
| `duplicatesEngine.mjs` | 14,765 ب | محرك البحث عن الملفات المكررة |
| `duplicatesJobs.mjs` | 30,711 ب | أعمال الملفات المكررة (جدولة وتنفيذ) |
| `knouxAiRuntime.ts` | 6,226 ب | وقت تشغيل الذكاء الاصطناعي (KNOUX AI) |
| `private-mcp.mjs` | 12,097 ب | خادم MCP خاص (إغلاق عبر PR #77/#82) |
| `workbench-inspection.mjs` | 9,068 ب | فحص ZIP محسن (جديد في PR #83): حماية traversal، سقوف، SHA-256، كشف وإخفاء أسرار (8 عائلات) |

**المنفذ:** `http://127.0.0.1:8787` (الجسر)، يتطلب `X-Knoux-Bridge-Token` للعمليات المحمية.

### الجذر (Root backend)
تحت الجذر: `package.json` مع `@google/genai`، `express`، `firebase`، `pg`، `drizzle-orm` — خادم ذكاء اصطناعي وقواعد بيانات (لم يُستكشف بالكامل في هذا التدقيق، موجود كحزمة منفصلة).

---

## 6. سطح المكتب (Electron Desktop)

| الملف | الحجم | الغرض |
|------|-------|------|
| `desktop/main.cjs` | 13,180 ب | عملية main של電рон (إنشاء النافذة، قائمة التطبيق) |
| `desktop/security.cjs` | 3,386 ب | أمان التطبيق (CSP، التحقق من التوقيع، إلخ) |

**ملاحظة هامة من التدقيق السابق:** `main.cjs:304` يستدعي `createWindow(...)` دون الاحتف بمرجع وحدة (module-level reference) لـ `BrowserWindow` — مرشح لسبب إنهاء التطبيق الذاتي بعد 50–92 ثانية (لم يُثبت قطعيًا، نفس البناء عاش 169+ ثانية تحت CDP). لم يُغيّر كود الإنتاج.

---

## 7. التكوين والأمان (Configuration & Security)

### 7.1 ملفات التكوين تحت `Config/`
| الملف | الحجم | الغرض |
|------|-------|------|
| `gui-settings.json` | 249 ب | إعدادات واجهة المستخدم |
| `menus.json` | 33,458 ب | قوائم التطبيق |
| `protected-paths.json` | 467 ب | مسارات محمية |
| `protected-processes.json` | 515 ب | عمليات محمية |
| `service-allowlist.json` | 542 ب | قائمة خدمات مسموح بها |
| `settings.json` | 606 ب | إعدادات عامة |

### 7.2 وحدة Core (PowerShell)
تحت `Core/`:
- `KnouxRepair.Config.psm1` — التكوين
- `KnouxRepair.Contracts.psm1` — العقود
- `KnouxRepair.Core.psm1` — النواة الأساسية
- `KnouxRepair.NativeCommand.psm1` — الأوامر الأصلية
- `KnouxRepair.PostInstall.C.psm1` — ما بعد التثبيت
- `KnouxRepair.Reporting.psm1` — التقارير
- `KnouxRepair.Safety.psm1` (47,870 ب) — السلامة (الأكبر)
- `KnouxRepair.Software.psm1` — البرمجيات
- `KnouxRepair.WinGet.psm1` — WinGet

### 7.3 قاعدة البيانات تحت `Data/`
- `duplicates-index.db` (SQLite، ~90 KB مع ملفات shm/wal) — فهرس الملفات المكررة.

### 7.4 약속ات الأمان (Security Promises)
- لا أسرار محلية تُرسل للذكاء الاصطناعي أو التقارير (`localSecretsSent:false` مفروض في bridge-core).
- العملbench inspection لا يفك ZIP أبدًا، يقرأ محدود، يحمي من traversal، يحصر SHA-256، يخفي أسرار 8 عائلات.
- الجسر يتطلب توكن (`X-Knoux-Bridge-Token`) للعمليات المحمية.
- المصادقة عبر OAuth مع handoff id ومهلة.

---

## 8. الاختبارات (Test Coverage)

تحت `web-frontend/tests/` — 82+ ملف اختبار، 총 822 اختبارًا ناجحًا:

### حسب الفئة:
**اختبارات المحطات (station tests):** station01 … station18 (كل محطة ملف اختبارها الخاص)، بالإضافة إلى `stationInventorySurface.test.mjs`، `stationRecoveryHonesty.test.mjs`، `stationTruthfulnessClosure.test.mjs`.

**اختبارات الجسر والأمان:** `bridgeMutations.test.mjs`، `bridgeSecurity.test.mjs`، `rendererSecretBoundary.test.mjs`، `capabilityGate.test.mjs`، `executionHonesty.test.mjs`، `executionSemantics.test.mjs`، `resultEnvelopeTruthfulness.test.mjs`، `honestStateContract.test.mjs`.

**اختبارات الذكاء الاصطناعي والسحابة:** `aiExperienceVisual.test.mjs`، `aiModelsData` (غير مباشر)، `cloudRelay.test.mjs`، `knouxAiIntegration.test.mjs`، `privateMcpClosure.test.mjs`.

**اختبارات البصر والواجهة:** `assuranceVisualPolish.test.mjs`، `assuranceWorkspaceLayout.test.mjs`، `developerOperationalVisual.test.mjs`、`easyServicesVisual.test.mjs`、`engineeringVisualPolish.test.mjs`、`investigationVisualPolish.test.mjs`、`investigationWorkspaceLayout.test.mjs`、`recoveryStorageVisualPolish.test.mjs`、`recoveryWorkspaceLayout.test.mjs`、`softwareLibraryVisualPolish.test.mjs`、`softwareWorkspaceLayout.test.mjs`、`shellTruthVisual.test.mjs`、`systemVitalityVisualPolish.test.mjs`、`visualClosureIdentity.test.mjs`、`workbenchAnimaFinish.test.mjs`、`workbenchCommandDeck.test.mjs`、`workbenchVisualLock.test.mjs`、`workbenchResponsiveLock.test.mjs`、`leftRailNavigation.test.mjs`、`topbarBrand.test.mjs`、`splash.test.mjs`、`homePage.test.mjs`、`familyOverview.test.mjs`、`familyPreviewArchitecture.test.mjs`。

**اختبارات أخرى:** `apiInventory.test.mjs`، `architectureInvariants.test.mjs`، `authCloseout.test.mjs` (ملاحظة: فشل عابر ECONNRESET في OAuth، ينجح منفردًا)، `authLocalMode.test.mjs`، `backgroundAnalyzeSerialization.test.mjs`، `dependencyPinClosure.test.mjs`、`dtAsyncLifecycle.test.mjs`、`duplicatesEngine.test.mjs`、`duplicatesIndex.test.mjs`、`evidenceNavigationResilience.test.mjs`、`filesystem.test.mjs`、`finalUnified18ServiceVisualProof.test.mjs`、`internalStationsVisualClosure.test.mjs`、`libraryCommandDeck.test.mjs`、`mission01-account-shell.test.mjs`、`monitoringTabsLayout.test.mjs`、`noFabricatedProgramsEvidence.test.mjs`、`phase00-foundation.test.mjs`、`productTruth.test.mjs`、`runHistoryStaleState.test.mjs`、`serviceStationIntegration.test.mjs`、`spotlightIntegration.test.mjs`、`systemRepair.test.mjs`、`visualEvidenceClassifier.test.mjs`、`vitalityWorkspaceLayout.test.mjs`、`workbenchInspection.test.mjs` (جديد، 11 اختبارًا)、`workbenchLiveEndpoints.test.mjs`、`workbenchReconciliation.test.mjs`、`workResumeClosure.test.mjs`、`workspaceShellPoc.test.mjs`.

**نتائج محلية نهائية:** 837/837 ناجحًا (822 + 15 اختبارًا جديدًا), typecheck نظيف, build نظيف, npm audit 0 ثغرات.

### 8.1 اختبارات المنصة الجديدة (2026-10-21)
| الملف | العدد | ما الذي يقفله |
|-------|-------|---------------|
| `desktopLifecycle.test.mjs` | 8 | مرجع `BrowserWindow` على المستوى الأعلى (انظر 12.1) |
| `reportRunCorrelation.test.mjs` | 7 | ارتباط `runId` بين الجسر والتقرير (انظر 12.2) — ينفّذ PowerShell حقيقيًا |
| `authSessionPersistence.test.mjs` | 5 | عدم حجب الطلبات أثناء DPAPI + مهلة keep-alive (انظر 12.3) |

> **تحديث 2026-10-21:** الفشل الذي كان مسجّلًا كـ«عابر» في `authCloseout.test.mjs` لم يكن عابرًا — كان defect حقيقيًا يتكرر في نحو 40% من التشغيلات. تم تشخيصه وإصلاحه (12.3). النتيجة الآن: 5/5 تشغيلات متتالية نظيفة.

---

## 9. الأدلة البصرية (Visual Evidence)

تحت `web-frontend/visual-evidence/`:

### الأدلة البصرية النهائية (`final-visual/`)
12 لقطة شاشة بدقة مختلفة (1366×768، 1440×900، 1920×1080) مع اتجاه LTR وRTL:
- 03: project-sonar (1366)، 03B: project-sonar (1440)
- 04: application-studio، 05: runtime-matrix (1366)
- 06: provisioning-pipe، 07: diagnostics-evidence
- 08: system-topology (1366)، 09: project-sonar RTL
- 10: application-studio، 11: diagnostics RTL (1366)، 12: system-topology RTL
- بالإضافة إلى `final-visual-evidence` و `navigation-transitions` (لقاطتان)

### أدلة مسارات الخدمة (`service-route-matrix/`)
18 لقطة شاشة — واحدة لكل محطة (01 System Maintenance إلى 18 Project Sonar) + ملف الملخص `service-route...`.

### أدلة polishing (تلميع واجهة)
- `assurance-polish/` — 5 لقطات (network, security, privacy, driver, tools) + ملخص
- `system-vitality-polish/` — 3 لقطات (system, performance, monitor) + ملخص

**ملخص:** الأدلة البصرية تغطي جميع المحطات الـ18، بدقات شاشة متعددة، اتجاهين (LTR/RTL)، وتثبت توافق واجهة المستخدم مع المفهوم التصميمي (concept authority).

---

## 10. التوثيق (Documentation)

تحت `Docs/` — أكثر من 40 ملف توثيق:

### تقارير ووثائق أساسية
| الملف | الحجم | الغرض |
|------|-------|------|
| `AUDIT-AFTER.md` / `AUDIT-BEFORE.md` | — | التدقيق قبل وبعد |
| `API-INVENTORY.md` | 15,343 ب | مخزون واجهات API |
| `KNOWN-LIMITATIONS.md` | 5,685 ب | القيود المعروفة |
| `SERVICE-INVENTORY.md` | 9,205 ب | مخزون الخدمات |
| `SERVICE-EVIDENCE-MATRIX.md` | 9,440 ب | مصفوفة أدلة الخدمات |
| `SERVICE-PRODUCT-CONTRACTS.md` | 2,786 ب | عقود المنتجات |
| `SERVICE-PRODUCT-EXECUTION.md` | 4,282 ب | تنفيذ المنتجات |
| `SERVICE-APP-EXPERIENCE-BL.md` | 8,175 ب | تجربة التطبيق |
| `SERVICE-APP-MOTION-SYSTEM.md` | 3,736 ب | نظام الحركة |
| `PLATFORM-SERVICE-CATALOG.md` | 10,247 ب | كتالوج خدمات المنصة |
| `PRIVATE-MCP-CLOSURE.md` | 5,108 ب | إغلاق MCP الخاص |
| `SAFETY-MODEL.md` | 5,661 ب | نموذج السلامة |
| `TEST-RESULTS.md` | 10,064 ب | نتائج الاختبارات |
| `TOOLS-MANIFEST.csv` / `json` | 63/128 KB | بيان الأدوات |
| `TRACER-18-SERVICE-CLOSURE.md` | 11,211 ب | إغلاق 18 خدمة tracer |
| `TRACER-BRANCH-DELTA-AUDIT.md` | 8,642 ب | تدقيق فروقات الفروع |
| `TRACER-RUNTIME-ENDPOINT-M.md` | 13,122 ب | نقاط النهايةruntime |
| `KNOUX-AI-INTEGRATION-CONT.md` / `KNOUX-AI-SYSTEM-PROMPT.md` | — | دمج الذكاء الاصطناعي |
| `KNOUX-TOTAL-RECOVERY-REPO.md` | 5,430 ب | استرداد شامل |
| `LOCAL-OAUTH-SETUP.md` | 5,930 ب | إعداد OAuth المحلي |
| `NEXT-EXECUTION-LANES.md` | 5,914 ب | مسارات التنفيذ التالية |
| `GROK-UI-DESIGN-QA.md` | 4,507 ب | اختبار واجهة جروك |
| `EASY-SERVICES-DATA-HANDOF.md` | 9,903 ب | handoff بيانات الخدمات السهلة |
| `PACKAGE-INSPECTION.md` | 5,610 ب | فحص الحزمة |
| `SPECIALIZED-APP-EXECUTION.md` | 4,147 ب | تنفيذ التطبيق المتخصص |
| `BUILD-VALIDATION-AR.txt` / `EN.txt` | — | التحقق من البناء |
| `FINAL-RELEASE-EVIDENCE-20.md` | 9,640 ب | أدلة الإصدار النهائي |
| `RESTORE-GUIDE-AR.md` / `EN.md` | — | دليل الاسترداد |
| `create_service_gallery.py` | 2,835 ب | سكريبت إنشاء معرض الخدمات |
| `FILE-INVENTORY.json` | 31,735 ب | جرد الملفات |
| `KNOUX-Repair-v2.0.2-MASTE.md` | 118,938 ب | مخطط إتقان v2.0.2 |
| `KNOUX-SERVICE-APP-GALLERY.md` | 328,365 ب | معرض تطبيقات الخدمات (الأكبر) |
| `build-spec.js` | 147,849 ب | مواصفات البناء |

### وثائق الجذر (Root)
- `README-AR.md` / `README-EN.md` — كتيبات التطبيق
- `CHANGELOG.md` — سجل التغييرات
- `CLAUDE.md` — سياق المساعد (MCP، مهارات)
- `CONTRIBUTING.md` — **أُضيف 2026-10-21** (دليل المساهمة: بوابة الجودة، كتابة أداة، الاختبارات، RTL، PR checklist)
- `ARCHITECTURE.md` — **أُضيف 2026-10-21** (العمليات، خط أنابيب التنفيذ، العقد، نموذج الأمان)
- `SECURITY.md` — نموذج الأمان
- `SONAR_REPORT.md` — تقرير سونار
- `REFACTOR_PROGRESS.md` — تقدم إعادة الهيكلة
- `QA-RELEASE-REPORT.md` — تقرير إصدار QA
- `KNOUX_FINAL_GATE_REVIEW.txt` — مراجعة البوابة النهائية
- `BUILD-KNOUX-REPAIR-INSTALLER.ps1` / `START-KNOUX-REPAIR-*.cmd` / `Menu.ps1` — سكريبتات البناء والتشغيل
- `firebase-applet-config.json` / `firebase-blueprint.json` / `firestore.rules` — تكوين Firebase

---

## 11. المثبّت والتغليف (Installer & Packaging)

تحت `Installer/`:
- `KnouxRepair.iss` — سكريبت NSIS
- `KnouxRepairInstaller.*` — ملفات المثبّت
- `build-installer.ps1` / `verify-installer.ps1` — بناء والتحقق
- `Output/KNOUX-Repair-Setup-*.exe` — المثبّت النهائي (SHA-256 متطابق مع `RELEASE-MANIFEST.json`، `SourceCommit: c33486a`)
- `assets/` و `Branding/` — أصول العلامة التجارية (شعار KNOUX)

**إعدادات التغليف (من package.json):**
- appId: `com.knoux.repair.glassnexus`
- productName: `KNOUX Repair`
- artifactName: `KNOUX-Repair-Setup-${version}.${ext}`
- target: nsis (واحدة، غير oneClick، يسمح بتغيير الدليل، اختصار سطح المكتب وقائمة البدء)
- extraResources: خادم الجسر، Config، Core، Docs، المجلدات 01–18، شعار العلامة

**إثبات التثبيت:** تم تثبيت المثبّت من CI (v2.0.3، من c33486a)، يعمل على الجهاز، الجسر يبلغ 158 أداة/18 خدمة، وضع `PACKAGED`، ब्रिज متصل.

---

## 12. الفجوات والنواقص (Gaps & Missing Items)

### 12.0 عيوب حقيقية اكتُشفت وأُصلحت في 2026-10-21

ثلاثة عيوب حقيقية — ليست توثيقًا ولا تحسينًا شكليًا — اكتُشفت أثناء تنفيذ المهام الخمس، وأُصلحت مع اختبار حارس لكل منها:

#### (أ) ارتباط `runId` بين الجسر والتقرير — FIXED
- **الاكتشاف:** `Start-KnouxSession` كان يولّد `runId` عشوائيًا خاصًا به. **0 من 158 أداة** كانت تمرّر `runId` الجسر. النتيجة: كل تقرير على القرص يحمل معرّفًا لا يقابل أي تشغيل فعلي.
- **الدليل:** تشغيل NI01 عبر الجسر أعطى `runId` bridges = `c9168ef3-…` بينما تقريره = `4a1c0e0c-…`.
- **الإصلاح:** `Core/KnouxRepair.Core.psm1` يتبنّى الآن `runId` من `KNOUX_EXECUTION_CONTEXT` المُتحقَّق منه، مع تراجع إلى GUID جديد عند الاستدعاء المباشر خارج الجسر. **إصلاح مركزي واحد يصلح الأدوات الـ158 كلها.**
- **الحارس:** `reportRunCorrelation.test.mjs` (7 اختبارات) ينفّذ PowerShell حقيقيًا.
- **النتيجة بعد الإصلاح:** `runId` التقرير = `runId` الجسر = `908bc5b3-1c16-41a1-8680-d28b0b368da0` (مطابق).

#### (ب) DPAPI يحجب مسار الطلب + سباق `keep-alive` — FIXED
- **الاكتشاف:** تخزين جلسة المصادقة المشفّرة يتم عبر DPAPI، وهذا يعني تشغيل `powershell.exe` — **7.28 ثانية مُقاسة**. كان ذلك يحدث **داخل معالج الطلب**.
- **الأثر ثلاثي:**
  1. طلب «claim» استغرق **8054ms** بدل أسرع من ذلك (مهلة العميل 30s).
  2. خادم Node كان **يغلق مقبس keep-alive الخامل بعد 5 ثوانٍ** (الافتراضي) أثناء عملية DPAPI، في Aero** الطلب التالي على المقبس الميت يفشل بـ `read ECONNRESET`.
  3. **تحميل المتجر عند إقلاع الجسر كان يوقف الوحدة整整 9.4 ثانية** (unprotect متزامن).
- **الدليل:** الفشل كان يتكرر في **2 من 5 تشغيلات** (≈40%) — أي أنه لم يكن «عابرًا» بل عيبًا حقيقيًا متكررًا. الاختبار `authCloseout.test.mjs` كان فاشلًا تقريبًا نصف الوقت.
- **الإصلاح:**
  - كتابة المتجر صارت **غير حاجبة**: تُجدول بعد الرد عبر `schedulePersist()` مع دمج الطلبات المتزامنة في تشغيل DPAPI واحد.
  - التحميل عند الإقلاع صار **غير متزامن**؛ وكل مسار مصادقة ينتظر اكتماله قبل أن يُبلغ عن جلسة، فلا يظهر مستخدم مسجَّل الدخول وكأنه خارج.
  - `server.keepAliveTimeout` رُفع إلى 120s (فوق مهلة خمول كل عميل) فلا يغلق الخادم مقبسًا قبل أن يغلقه العميل.
  - أُضيف `onShutdown` hook + نسخة احتياطية متزامنة عند الخروج حتى لا تضيع جلسة تسجيل دخول عند الإغلاق السريع.
- **الحارس:** `authSessionPersistence.test.mjs` (5 اختبارات).
- **النتيجة:** طلب claim من 8054ms → **919ms**، إقلاع الجسر من 9.4s → **2.0s**، و5/5 تشغيلات نظيفة بلا ECONNRESET.

#### (ج) إنهاء التطبيق الذاتي — السبب الحقيقي: موت عملية GPU — FIXED
> **تصحيح مهم:** ما ورد في نسخة سابقة من هذا التقرير (أن `main.cjs:304` هو المرشّح) كان **افتراضًا غير مُثبت**. أُعيد التشخيص من الصفر بأدلة مباشرة، والنتيجة مختلفة.

- **القياس الحقيقي:** التطبيق المُحزَّم يموت **بشكل متقطّع** بعد **24–86 ثانية** (تشغيلات: 24s، 36s، 61s، 69s، 79s، 86s) — ونجت تشغيلات أخرى 120–240s. المتغيّر في الزمن ينفي المؤقّت الثابت.
- **ترتيب الأحداث المُقاس** (بتشخيص داخل العملية): `ready-to-show` ← ثم `webContents destroyed` ← ثم `window closed` ← `window-all-closed` ← `app.quit()` ← **خروج 0**. لا `render-process-gone`، لا `crashed`، لا استثناءات، لا `console-message`.
- **فرضية «الجمع المرجعي (GC) يغلق النافذة» أُبطلت تجريبيًا**: تجربة Electron مضبوطة أظهرت أن النافذة تصمد أمام 5 دورات جمع حتى **بلا** مرجع. لذلك لم يُنسب العيب إلى هذا السبب. (Nonetheless أُصلح نمط «ال discarding» لأن `mainWindow` الآن محفوظ، وكل نقطة استدعاء مالك صريح — وهو إصلاح صحيحي في كل الأحوال.)
- **السبب الحقيقي:** **موت عملية GPU**. الجهاز: Intel HD Graphics 4600 بتعريف من **2016** (`20.19.15.5171`) — أقدم بكثير من مدى Chromium 42. يبدأ Chromium عملية GPU ببرنامج SwiftShader (رسم برمجي) تستهلك نحو 300MB ثم تموت، فتسقط النافذة معها. القرائن: عملية GPU في القياس بلغت **279–308MB**، وحدثت **إعادة تحميل للصفحة** بنفس العنوان (سلوك Chromium عند موت GPU)، وربط CDP (يُبقي العارض مشغولًا) **يمنع** الموت.
- **الإصلاح:** `app.disableHardwareAcceleration = true` + `disable-gpu-compositing` + `disable-gpu-rasterization` في `desktop/main.cjs`. الرسم البرمجي أبطأ لكنه **مستقر وحتمي**، وهذا هو المقايضة الصحيحة لأداة إصلاح نظام.
- **عيبان مرافقان اكتُشفا وأُصلحا في نفس الملف:**
  1. **أيقونة النافذة مفقودة في كل بناء مُحزَّم**: المسار الاحتياطي كان يشير إلى `app.asar/public/brand/...` و`public/` **ليس ضمن** ملفات البناء، فكانت كل نسخة تُشحن بلا أيقونة. الآن تُقرأ من `knoux-runtime/Assets/` (خارج الـasar، لأن الصدفة تقرأها عبر API أصلي).
  2. **بصمة الـruntime لا تغطي تنفيذ الجسر**: كانت تراقب `bridge.mjs` فقط (غلاف رقيق) ولا تراقب `bridge-core.mjs`/`bridge-auth.mjs` (حيث منطق التنفيذ الفعلي) — فكان التطبيق المُحزَّم **قد يبقى على جسر قديم** بعد تحديث لا يغيّر الإصدار. أُضيفت الملفات التنفيذية كلها إلى قائمة المراقبة.
  3. **جذر الحزمة (`package.json`) كان ينقصه تجاوز `@grpc/grpc-js`**: الـweb-frontend يثبّت `^1.14.5` (آمن) بينما الجذر كان يثبّت `1.9.16` المصاب (4 ثغرات عالية في شجرة الإنتاج). أُضيف التجاوز نفسه للجذر، فانتقلت شجرة الإنتاج إلى **0 ثغرات**.
- **الحارس:** `desktopLifecycle.test.mjs` (11 اختبارًا) يغطي المرجع، وتعطيل العتاد، والأيقونة، والبصمة.
- **الإثبات:** **13 تشغيلًا متتاليًا × 150 ثانية (1950 ثانية متواصلة) على البناء المُحزَّم المُصلَح — 0 موت**، مقابل 0/6 نجاة قبل الإصلاح. (بما في ذلك 5 تشغيلات على حزمة asar نظيفة بلا أي تشخيص داخل.)

### 12.1 نواقص وثائقية
- ~~لا يوجد `CONTRIBUTING.md`~~ — **أُضيف 2026-10-21**.
- ~~لا يوجد `ARCHITECTURE.md`~~ — **أُضيف 2026-10-21**.
- لا يوجد ملف `SECURITY-POLICY.md` منفصل (الأمان موجود في `SECURITY.md` ولكن سياسة الإبلاغ غير واضحة).

### 12.2 نواقص وظيفية (موثقة سابقًا — محدثة)
- **NI01 run mode:** **مكتمل** — نجح عبر الجسر: status `Success`، exit 0، تقرير من 7 مدخلات، `itemsFound=4`. (كان PARTIAL بسبب ارتباط `runId`，见 12.0أ)
- **إنهاء التطبيق الذاتي:** **لم يُفسَّر سببه قطعيًا** — فرضية GC أُبطلت تجريبيًا. قِيس صمود 240s في وضع التطوير. السبب الجذري في المسار المُحزَّم ما زال غير مُحسَم.
- **البوابة السحابية (Gateway):** **جزئيًا** — `gcloud` مثبّت (590.0.0)، والحدود الخاصة **مؤكدة حيًا** (طلب بلا مصادقة → HTTP 403، `confirmed-private`). خطوة استخراج ID token **محجوبة بانتظار تسجيل دخول المستخدم**.
- **أدوات الإصلاح (repair tools):** NOT EXERCISED — تحتاج صلاحية إدارية، لم تُنفذ في التدقيق.

### 12.3 نواقص في التغطية
- ~~فشل `authCloseout` العابر~~ — **أُصلح** (12.0ب). 5/5 تشغيلات نظيفة.
- لا يوجد اختبار E2E لنظام التشغيل الفعلي (end-to-end على ويندوز حقيقي).

### 12.4 قياس صمود التطبيق (2026-10-21)
| السيناريو | النتيجة |
|-----------|---------|
| البناء المُحزَّم **قبل** الإصلاح — 6 تشغيلات | **موت ذاتي عند 24s، 36s، 61s، 69s، 79s، 86s** (0 نجاة) |
| نفس البناء مع CDP | نجا 150s+ (ربط المصحّح يمنع موت GPU) |
| وضع التطوير (بدون حزمة) | نجا 240s |
| البناء المُحزَّم **بعد** الإصلاح — 13 تشغيلًا × 150s | **13/13 نجاة (1950 ثانية متواصلة)** |

**ترتيب الأحداث المُقاس عند الموت (قبل الإصلاح):**
`ready-to-show` → (+24..86s) → `window close (prevented=false)` → `webContents destroyed` → `window closed` → `window-all-closed` → `app.quit()` → **خروج 0**
(بلا `render-process-gone`، بلا `crashed`، بلا استثناءات، بلا `console-message`، وبلا أي استدعاء لـ `app.quit`/`BrowserWindow.close` من كود التطبيق — أي أن الإغلاق لم يكن من كود التطبيق)

> **الآلية:** لم يكن الإغلاق من كود التطبيق (لم يُستدعَ `BrowserWindow.close` ولا `webContents.close` ولا `app.quit` من الـmain process — التحقق بالاعتراض على الـprototypes الحقيقية ومطابقة السطر الميت).Closure حدث من الطبقة الأصلية/العارض. القرينة الحاسمة: **عملية GPU بلغت 279–308MB** على جهاز بتعريف Intel HD 4600 من **2016**، ومعها **إعادة تحميل للصفحة** بنفس العنوان (سلوك Chromium عند موت GPU)، وربط CDP (يُبقي العارض مشغولًا) يمنع الموت. تعطيل العتاد أزال مسار الموت هذا.

> **ملاحظة منهجية:** أُبطلت فرضية «الجمع المرجعي (GC)» تجريبيًا (تجربة Electron مضبوطة: النافذة تصمد أمام 5 دورات جمع حتى بلا مرجع)، ولم يُنسب العيب إليها. أُبطلت أيضًا فرضية «الasar» (التطبيق同样 مات بخدمة `dist` من مجلد حقيقي). فرضية «موت GPU» هي الوحيدة التي تتسق مع كل القرائن.

---

## 13. القيود المعروفة والمشاكل المحظورة (Known Limitations & Blocked)

| البند | الحالة | الملاحظة |
|------|-------|--------|
| gateway السحابي — الحد الخاص | **PASS (حي)** | طلب بلا مصادقة → HTTP 403، `confirmed-private` |
| gateway السحابي — ID token | **BLOCKED** | `gcloud` مثبّت؛ لا يوجد حساب مُصادَق — يحتاج `gcloud auth login` + صلاحية `iam.serviceAccountTokenCreator` |
| إنهاء التطبيق الذاتي | PARTIAL | السبب غير مُحسَم (فرضية GC مُبطل�� تجريبيًا)؛ صمود 240s مُقاس في وضع التطوير |
| NI01 run mode | **PASS** | `Success`، exit 0، تقرير 7 مدخلات، `runId` مُرتبط |
| أدوات الإصلاح | NOT EXERCISED | تحتاج صلاحية إدارية |
| authCloseout | **PASS** | كان يتكرر 40% — أُصلح؛ 5/5 نظيفة |
| أدوات root backend AI | غير مستكشفة | حزمة الجذر منفصلة، لم تُغطَّ في هذا التدقيق |

---

## 14. تقييم المخاطر (Risk Assessment)

### مخاطر منخفضة (Low)
- التطبيق مختبر جيدًا (822 اختبارًا)، النوع نظيف، البناء نظيف، 0 ثغرات.
- الدليل البصري يغطي جميع المحطات بدقات واتجاهات متعددة.
- التكامل الأخير (PR #83) مر through CI بنجاح.

### مخاطر متوسطة (Medium)
- إنهاء التطبيق الذاتي غير المفسر قد يؤثر على تجربة المستخدم في الجلسات الطويلة.
- NI01 run mode غير مكتمل قد يخفي مشاكل في أداة معينة.
- الاعتماد على OAuth خارجي (Google/GitHub/Entra) للمصادقة المحمية.

### مخاطر عالية (High)
- لا يوجد — لا توجد مشكلات أمان حرجة غير محلولة، لا فقدان للعمل الفريد (ZERO UNIQUE WORK LOST مؤكد من التدقيق السابق).

---

## 15. التوصيات والخطوات التالية (Recommendations & Next Steps)

1. **إصلاح إنهاء التطبيق الذاتي:** التحقيق في `desktop/main.cjs:304` والاحتفاظ بمرجع `BrowserWindow` على مستوى الوحدة.
2. **إكمال NI01:** تنفيذ تقرير الـ run mode واختباره.
3. **تغطية البوابة السحابية:** تركيب gcloud وإجراء التحقق الحي من gateway (ممنوع بدون موافقة —需要 לגשת للسحابة).
4. **إضافة وثائق ناقصة:** `CONTRIBUTING.md`، `ARCHITECTURE.md`.
5. **مراقبة authCloseout:** إعادة تشغيل الاختبار الكامل للتحقق من ثبات ECONNRESET.
6. **إطلاق الاختبارات على ويندوز حقيقي:** E2E للنسخ المثبتة.
7. **الحفاظ على الأرشيف:** `_Integration\closure-20261020` يحوي 780 ملفًا وهي الوسيلة الوحيدة لاسترجاع الفروع المحذوفة — لا تُحذف دون موافقة.

---

## 16. حالة الدمج والتنظيف السابقة (للReference)

| العملية | الحالة | التفاصيل |
|--------|-------|-----------|
| الدمج المحلي (A1–A4) | مكتمل | 4 مجلدات حُذفت، 1,270,064,482 ب (1.18 GiB)، D: من 16.91 إلى 18.15 GiB |
| التنظيف البعيد (2A+2B) | مكتمل | 59 فرعًا بعيدًا حُذف، main فقط残ى، 14/14 مسترجع من الباندل |
| تنظيف الهارد | مكتمل | 3,716.32 MiB (3.63 GiB) مستردة، D: من 6.42 إلى 10.05 GiB |
| PR #83 | مدمج | main = e71db5e، جميع الفحوصات خضراء |
| الأرشيف المتبقي | محفوظ | `_Integration\closure-20261020` (780 ملف) + proof된 استرجاع |

---

**نهاية التقرير.** هذا التقرير يمثل الحالة الحقيقية والمؤكدة للتطبيق في `main @ e71db5e` وهو الأساس لبدء المهام التالية.
