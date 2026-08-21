# KNOUX Platform — Service Experience Catalog

## Product direction

KNOUX REPAIR will operate as a **consumer-facing device-care platform**, not as a wrapper around scripts. The local execution bridge remains an internal implementation detail. Every customer-facing service must start from a clear outcome, show a small number of guided choices, explain the effect in ordinary language, and return a comprehensible completion state.

## Service map

| Current service | Consumer-facing product | Primary user question | Dashboard focus | Execution presentation |
| --- | --- | --- | --- | --- |
| System Maintenance | **صحة الجهاز** | هل ملفات ويندوز وجهازي بخير؟ | فحص الصحة، الإصلاح الآمن، ما يحتاج انتباهًا | فحص ثم إصلاح مؤكد |
| System Cleanup | **تنظيف المساحة** | ما الذي يمكن حذفه بأمان؟ | مساحة يمكن استعادتها، تنظيف مؤقت، خصوصية الملفات | مراجعة ثم تنظيف |
| Network & Internet | **مساعد الاتصال** | لماذا لا يعمل الإنترنت كما يجب؟ | حالة الاتصال، شبكة الجهاز، خطوات الإصلاح | فحص ثم إصلاح اتصال |
| Programs & Applications | **مركز التطبيقات** | هل تطبيقاتي جاهزة وتعمل؟ | التطبيقات، بدء التشغيل، إصلاحات التطبيقات | مراجعة ثم اختيار إجراء |
| Duplicate Files | **منظّم الملفات المكررة** | أين النسخ الزائدة؟ | البحث، المراجعة، الاحتفاظ بنسخة آمنة | مسح ثم اختيار وعزل آمن |
| Disk Space | **مساحة التخزين** | ما الذي يستهلك القرص؟ | السعة، الملفات الكبيرة، فرص الاستعادة | فحص ثم استعادة مساحة |
| Services & Processes | **نشاط الجهاز** | ما الذي يبطّئ الجهاز أو لا يستجيب؟ | تطبيقات مستهلكة، خدمات متوقفة، خيارات آمنة | مراجعة ثم إصلاح موجّه |
| Performance | **تسريع الجهاز** | ما سبب البطء؟ | الذاكرة، بدء التشغيل، الطاقة، توصيات الأداء | تشخيص ثم تحسين مؤكد |
| Security | **الحماية** | هل حماية ويندوز مفعّلة؟ | حالة الحماية، الجدار الناري، تحديث الحماية | تحقق ثم إصلاح حماية |
| Diagnostics & Reports | **فحص الجهاز** | ما المشكلة في جهازي؟ | مؤشرات الصحة، العتاد، السجل، تقرير مبسط | فحص فقط ثم تقرير |
| Backup & Recovery | **الحماية والاستعادة** | هل يمكن استرجاع ملفاتي؟ | نقاط الاستعادة، النسخ المحلية، اختبار النسخة | إنشاء/تحقق/استعادة مؤكد |
| Developer Tools | **بيئات التطوير** | هل بيئة العمل البرمجية جاهزة؟ | الأدوات، المشاريع المحلية، كاش آمن | فحص ثم إجراء صريح |
| Privacy | **الخصوصية** | ما الذي أريد حمايته؟ | إعدادات الخصوصية، السجل المحلي، DNS | مراجعة ثم تغيير محدود |
| Driver Management | **التعريفات والأجهزة** | هل أجهزتي وتعريفاتها سليمة؟ | تعريفات غير موثوقة، أجهزة بها مشكلة، تصدير احتياطي | فحص ثم تصدير/مراجعة |
| System Monitoring | **مراقبة الجهاز** | ما الذي يحدث الآن؟ | الموارد، التطبيقات الثقيلة، التنبيهات | لقطة فورية قابلة للقراءة |
| Software & Environments | **مكتبة البرامج** | ما البرامج والبيئات الموجودة؟ | الجرد، التحديثات، إدارة البرامج | مراجعة ثم إجراء مؤكد |
| Post-Install Setup | **إعداد جهاز جديد** | ما الذي أحتاجه بعد تثبيت ويندوز؟ | تعريفات، تطبيقات أساسية، حالة الاستعداد | اختيار ثم تثبيت مؤكد |
| Project Sonar | **مركز المشاريع** | هل مشروعي جاهز؟ | فهم المشروع، نقاط الفجوة، تسليمات مرئية | اختيار مشروع ثم تقرير |

## Shared interaction contract

Every service dashboard must apply the same four-stage user journey:

1. **Understand:** Explain what the service can help with, without tool identifiers, command names, risk codes, or script terminology.
2. **Check:** Offer a harmless scan or review first whenever the underlying capability supports it.
3. **Choose:** Present a small number of recommended actions in natural language, each with a clear effect and confirmation when a change can occur.
4. **Finish:** Report status as preparing, working, completed, needs attention, or cancelled. Raw output is never rendered in the main interface.

## Execution safety

Safety controls are retained: administrator permission, recovery acknowledgement, option validation, explicit confirmation for device changes, and cancellation. The consumer interface will describe these as access permission, recovery option, requested folder, or confirmation phrase. The implementation must not disclose PowerShell, script paths, tool IDs, command lines, technical risk codes, or raw console output.

## Platform screen model

Each service uses the same visual shell but receives its own copy, color, icon, recommendations, and progress language.

| Screen block | Purpose for the user | Internal data source |
| --- | --- | --- |
| Service welcome | Explains one useful outcome in plain language | Category descriptor and service experience map |
| Device status | Shows whether the service is ready, needs a scan, or has an active task | Local bridge health and current run state |
| Quick actions | Presents a small set of everyday outcomes, such as check, clean, protect, recover, or improve | Registered tools grouped by user intent |
| Guided path | Shows what will happen before any device change | Per-service three-step guidance |
| Recent result | States completion, attention needed, or cancellation without streaming raw command output | Normalized bridge-run status |
| Safety confirmation | Requests administrator access, folder choice, restore acknowledgement, or a confirmation word only when needed | Existing execution options and safeguards |

The renderer will use a single semantic component and an 18-service experience map. This provides a distinct dashboard narrative for every service while keeping behavior, translation, responsive layout, safety controls, and maintenance consistent.

## Visual-check note

The existing local preview page was stale after the platform build and rendered a blank document during the first post-build inspection. The production build had already completed successfully. The local preview will be restarted before the next visual check so that the updated service-platform bundle can be inspected reliably.

The restarted local preview loaded the updated bundle successfully. The workspace landing page remains intact, and the next visual step is to open a repair service and confirm that the new consumer-platform dashboard replaces the former technical grid.

The first service click exposed an existing fallback that replaces the whole service with a technical connection error when the local bridge is offline. This conflicts with the platform direction. The final integration must keep the service dashboard visible in this state and use the service’s own plain-language “not ready yet” state rather than exposing a bridge command or technical error text.

After the offline-state adjustment, the workspace landing page continues to render correctly. The splash was dismissed and the service navigation is available for the final service-dashboard inspection.

## Consumer-platform visual result

The Device Health service now opens as an independent consumer dashboard instead of a PowerShell-style tool grid. It remains visible while the local service is unavailable and explains that live checks need the local service without exposing a command or implementation detail. The same dashboard was verified in Arabic RTL: heading, description, outcome, guided journey, empty state, and safety note all render in clear Arabic with the sidebar mirrored correctly.

The Performance and Space Cleaner services were also checked in Arabic RTL. Each has its own visual accent, consumer outcome, plain-language explanation, and three-step journey; neither exposes tool identifiers, command output, or PowerShell terminology. This validates the shared platform renderer’s service-specific experience map for the system, cleanup, and performance family.

The Connection Helper and Protection services were visually checked in Arabic RTL. Their headings, outcomes, guided paths, accent colors, and safe empty states are context-specific and avoid technical console language. This validates the platform treatment for network and security services.

The Device Checkup and Protect & Recover services were visually verified in Arabic RTL. Their wording emphasizes readable results, reports, recovery options, and explicit confirmation rather than implementation details, completing the validation set for diagnostics and recovery.

The Software Library and New Device Setup services were visually verified in Arabic RTL. They present application management and first-time device preparation as understandable user journeys with distinct outcomes and guidance, completing the validation set for software and setup services.

The Privacy and Development Environments services were visually verified in Arabic RTL. The privacy dashboard uses straightforward choice-and-confirm language, while the developer dashboard presents workspace readiness and safe steps without showing scripts, identifiers, or raw runtime output.
