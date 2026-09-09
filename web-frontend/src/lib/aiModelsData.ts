export interface AiModelItem {
  id: string;
  name: string;
  provider: 'Google AI Studio' | 'OpenRouter' | 'Open Code Zen';
  isFree: boolean;
  badge: string;
  badgeColor: string;
  speed: 'Ultra-Fast' | 'Fast' | 'Reasoning Deep';
  contextWindow: string;
  descriptionEn: string;
  descriptionAr: string;
  strengths: string[];
}

export interface AiTemplateParam {
  id: string;
  labelEn: string;
  labelAr: string;
  defaultValue: string;
  placeholder: string;
}

export interface AiTemplateItem {
  id: string;
  category: 'powershell' | 'bsod' | 'security' | 'network' | 'disk' | 'sql' | 'debloat' | 'drivers';
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  iconName: string;
  suggestedModel: string;
  defaultPromptEn: string;
  defaultPromptAr: string;
  params: AiTemplateParam[];
  sampleOutputScript: string;
  safetyLevel: 'SAFE' | 'CAUTION' | 'ADMIN_REQUIRED';
}

export const FREE_AI_MODELS: AiModelItem[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Server-Native)',
    provider: 'Google AI Studio',
    isFree: true,
    badge: 'ZERO CONFIG',
    badgeColor: 'emerald',
    speed: 'Ultra-Fast',
    contextWindow: '1,000,000 Tokens',
    descriptionEn: 'Default ultra-fast multimodal reasoning engine with native support for Windows PowerShell, CMD, Bash, and complex system troubleshooting.',
    descriptionAr: 'المحرك الافتراضي فائق السرعة والمجاني المدمج، متفوق في كتابة سكربتات PowerShell وأوامر الصيانة وتحليل أخطاء النظام باللغتين العربية والإنجليزية.',
    strengths: ['Windows PowerShell 7+', 'Zero Config Free Tier', 'Instant Script Synthesis', 'Full Arabic/English Support'],
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'Google AI Studio',
    isFree: true,
    badge: 'SUB-SECOND',
    badgeColor: 'cyan',
    speed: 'Ultra-Fast',
    contextWindow: '1,000,000 Tokens',
    descriptionEn: 'Lightweight model designed for sub-second responses, instant command validation, syntax fixing, and quick regexes.',
    descriptionAr: 'موديل خفيف فائق السرعة بزمن استجابة أقل من ثانية لفحص الأوامر وتصحيح الأخطاء النحوية فورياً.',
    strengths: ['Sub-second latency', 'High throughput', 'Syntax validation', 'Quick patch generation'],
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    provider: 'OpenRouter',
    isFree: true,
    badge: 'REASONING R1',
    badgeColor: 'purple',
    speed: 'Reasoning Deep',
    contextWindow: '64,000 Tokens',
    descriptionEn: 'State-of-the-art open reasoning model via OpenRouter Free Tier. Excels at deep architectural debugging, multi-step kernel trace diagnosis, and safe repair planning.',
    descriptionAr: 'أقوى نموذج تفكير وتحليل برمجي مفتوح ومجاني عبر OpenRouter، بارع في تتبع أسباب الانهيارات المعقدة والتخطيط للإصلاح خطوة بخطوة.',
    strengths: ['Deep Chain-of-Thought', 'BSOD Crash Trace Analysis', 'Complex Logic Auditing', 'Open Source Community King'],
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen 2.5 Coder 32B (Free)',
    provider: 'OpenRouter',
    isFree: true,
    badge: '32B CODER',
    badgeColor: 'blue',
    speed: 'Fast',
    contextWindow: '32,768 Tokens',
    descriptionEn: 'Specialized 32-billion parameter software engineering powerhouse. Renowned for writing clean, robust, and safe administrative automation scripts.',
    descriptionAr: 'عملاق البرمجة المفتوح والمتخصص، يولد سكربتات احترافية خالية من الثغرات مع معالجة استثناءات متقدمة لكل من ويندوز ولينكس.',
    strengths: ['Script Generation Pro', 'Clean Error Handling', 'Drizzle SQL & Database Queries', 'Batch/CMD & Reg Keys'],
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Meta Llama 3.2 3B Instruct (Free)',
    provider: 'OpenRouter',
    isFree: true,
    badge: 'LIGHTWEIGHT',
    badgeColor: 'amber',
    speed: 'Ultra-Fast',
    contextWindow: '131,072 Tokens',
    descriptionEn: 'High-speed instruction follower from Meta via OpenRouter Free Tier. Excellent for quick command conversions and human-readable explanations.',
    descriptionAr: 'نموذج ميتا الخفيف والسريع جداً لتنفيذ التعليمات البسيطة وشرح الأوامر للمستخدم بوضوح تام.',
    strengths: ['Low memory footprint', 'Fast instruction execution', 'Friendly summaries'],
  },
  {
    id: 'google/gemma-2-9b-it:free',
    name: 'Google Gemma 2 9B Instruct (Free)',
    provider: 'OpenRouter',
    isFree: true,
    badge: 'OPEN GEMMA',
    badgeColor: 'indigo',
    speed: 'Fast',
    contextWindow: '8,192 Tokens',
    descriptionEn: "Google's high-efficiency open model architecture hosted freely on OpenRouter. Delivers clean, structured JSON and scripts.",
    descriptionAr: 'نموذج جوجل المفتوح عالي الكفاءة عبر OpenRouter لإنتاج الأكواد المهيكلة والتقارير الدقيقة.',
    strengths: ['Precise code syntax', 'Structured markdown output', 'Open weights'],
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B Instruct (Free)',
    provider: 'OpenRouter',
    isFree: true,
    badge: 'BALANCED',
    badgeColor: 'rose',
    speed: 'Fast',
    contextWindow: '32,768 Tokens',
    descriptionEn: 'Battle-tested open weights model by Mistral AI, optimized for concise, precise technical guidance and command generation.',
    descriptionAr: 'نموذج ميسترال الفرنسي الشهير للإرشادات الفنية الدقيقة وتوليد أوامر الصيانة الموجزة.',
    strengths: ['Concise execution', 'Accurate system flags', 'Dependable CLI recipes'],
  }
];

export const REPAIR_TEMPLATES: AiTemplateItem[] = [
  {
    id: 'dism-sfc-restore',
    category: 'powershell',
    titleEn: 'Windows DISM & Component Store Restorer',
    titleAr: 'إصلاح ملفات نظام ويندوز ومستودع WinSxS (DISM + SFC)',
    descriptionEn: 'Generates an automated, self-healing PowerShell script that scans the WinSxS store, fixes component corruptions, and verifies integrity.',
    descriptionAr: 'توليد سكربت PowerShell تلقائي يفحص ويعالج تلف ملفات النظام ومستودع المكونات مع حماية من الأخطاء.',
    iconName: 'Wrench',
    suggestedModel: 'gemini-3.8-flash',
    safetyLevel: 'ADMIN_REQUIRED',
    params: [
      { id: 'scanLevel', labelEn: 'Scan Depth', labelAr: 'عمق الفحص', defaultValue: 'Deep (CheckHealth + ScanHealth + RestoreHealth)', placeholder: 'Choose scan level' },
      { id: 'cleanImage', labelEn: 'Start Component Cleanup', labelAr: 'تنظيف المستودع الزائد', defaultValue: 'Yes ($true)', placeholder: 'true / false' },
      { id: 'logOutput', labelEn: 'Export Log Path', labelAr: 'مسار حفظ التقرير', defaultValue: 'C:\\KNOUX_Logs\\DISM_Repair.log', placeholder: 'Path to log' },
    ],
    defaultPromptEn: 'Write an elevated, bulletproof PowerShell script that runs DISM /Online /Cleanup-Image with CheckHealth, ScanHealth, and RestoreHealth, followed by SFC /scannow. Include progress indicators, error-handling try/catch blocks, and export detailed results to a log file.',
    defaultPromptAr: 'اكتب سكربت PowerShell بصلاحيات المسؤول لتنفيذ فحص وإصلاح شامل باستخدام DISM (CheckHealth, ScanHealth, RestoreHealth) يليه فحص SFC /scannow مع معالجة الأخطاء وحفظ السجلات.',
    sampleOutputScript: `# KNOUX Open Code Zen: DISM & SFC Integrity Healing Engine
# Requires Administrator privileges
$ErrorActionPreference = 'Stop'
$logDir = "C:\\KNOUX_Logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$logFile = "$logDir\\DISM_Repair_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

Write-Host "=== KNOUX OPEN CODE ZEN: WINDOWS COMPONENT HEALING ===" -ForegroundColor Cyan
Write-Host "Logging to: $logFile" -ForegroundColor DarkGray

try {
    Write-Host "[1/3] Checking WinSxS Component Store Health..." -ForegroundColor Yellow
    & dism.exe /Online /Cleanup-Image /CheckHealth | Tee-Object -FilePath $logFile -Append

    Write-Host "[2/3] Deep Scanning Component Store..." -ForegroundColor Yellow
    & dism.exe /Online /Cleanup-Image /ScanHealth | Tee-Object -FilePath $logFile -Append

    Write-Host "[3/3] Restoring Health & Repairing Files..." -ForegroundColor Green
    & dism.exe /Online /Cleanup-Image /RestoreHealth | Tee-Object -FilePath $logFile -Append

    Write-Host "[VERIFY] Running System File Checker (SFC)..." -ForegroundColor Cyan
    & sfc.exe /scannow | Tee-Object -FilePath $logFile -Append

    Write-Host "SUCCESS: System integrity repair completed successfully!" -ForegroundColor Green
} catch {
    Write-Error "Repair operation encountered an error: $_" | Tee-Object -FilePath $logFile -Append
}`,
  },
  {
    id: 'bsod-analyzer',
    category: 'bsod',
    titleEn: 'BSOD Crash BugCheck & Minidump Diagnostic',
    titleAr: 'محلل انهيار الشاشة الزرقاء (BSOD) وأكواد BugCheck',
    descriptionEn: 'Parses crash codes (e.g., 0x0000007E, 0x0000003B, PAGE_FAULT_IN_NONPAGED_AREA), queries recent event logs, and produces targeted driver/memory remedies.',
    descriptionAr: 'تحليل أكواد الشاشة الزرقاء مثل 0x0000007E واستخراج مسببات الانهيار من ملفات Minidump وسجلات Event Log مع حلول فورية.',
    iconName: 'AlertTriangle',
    suggestedModel: 'deepseek/deepseek-r1:free',
    safetyLevel: 'SAFE',
    params: [
      { id: 'bugCheckCode', labelEn: 'BugCheck / Stop Code', labelAr: 'رمز الخطأ / Stop Code', defaultValue: 'CRITICAL_PROCESS_DIED (0x000000EF)', placeholder: 'e.g. 0x0000007E or MEMORY_MANAGEMENT' },
      { id: 'suspectDriver', labelEn: 'Faulting Module / Driver', labelAr: 'الملف أو التعريف المشتبه به', defaultValue: 'ntoskrnl.exe', placeholder: 'e.g. nvlddmkm.sys, ntoskrnl.exe' },
    ],
    defaultPromptEn: 'Analyze the BSOD Stop Code {bugCheckCode} caused by {suspectDriver}. Provide the exact architectural root cause, a diagnostic PowerShell script to query the relevant Event Viewer entries (Event ID 41 and 1001), and a 4-step remediation plan (driver rollback, memory test, disk check, and registry hotfix).',
    defaultPromptAr: 'حلل كود الشاشة الزرقاء {bugCheckCode} والملف {suspectDriver}. اشرح السبب الجذري واكتب سكربت PowerShell لفحص سجلات الحوادث (Event ID 41 و 1001) وخطة إصلاح من 4 خطوات.',
    sampleOutputScript: `# KNOUX Open Code Zen: Crash Event Log Extractor
Write-Host "=== Querying Kernel-Power & BugCheck Crash Logs ===" -ForegroundColor Cyan

# 1. Fetch Kernel-Power Event 41 (System rebooted without cleanly shutting down first)
$reboots = Get-WinEvent -FilterHashtable @{LogName='System'; Id=41} -MaxEvents 5 -ErrorAction SilentlyContinue
foreach ($r in $reboots) {
    Write-Host "Crash Timestamp: $($r.TimeCreated)" -ForegroundColor Red
}

# 2. Query Windows Error Reporting (Event 1001) for detailed Stop Code parameters
$crashDumps = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WER-SystemErrorReporting'; Id=1001} -MaxEvents 3 -ErrorAction SilentlyContinue
foreach ($dump in $crashDumps) {
    Write-Host "Dump Report: $($dump.Message)" -ForegroundColor Yellow
}

# 3. Memory diagnostic verification
Write-Host "Recommendation: Schedule Windows Memory Diagnostic tool:" -ForegroundColor Green
Write-Host "Run: mdsched.exe to test RAM modules for bit flips." -ForegroundColor White`,
  },
  {
    id: 'security-hardening',
    category: 'security',
    titleEn: 'Windows Defender & Zero-Trust Hardening',
    titleAr: 'تحصين النظام ومكافحة التهديدات (Zero-Trust Hardening)',
    descriptionEn: 'Generates Attack Surface Reduction (ASR) rules, enables credential guard policies, and reinforces PowerShell script execution security.',
    descriptionAr: 'توليد قواعد تقليل مساحة الهجوم (ASR) وتأمين تشغيل السكربتات وتعزيز سياسات جدار الحماية ضد برمجيات الفدية.',
    iconName: 'Shield',
    suggestedModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
    safetyLevel: 'ADMIN_REQUIRED',
    params: [
      { id: 'blockRansomware', labelEn: 'Enable Controlled Folder Access', labelAr: 'تفعيل حماية المجلدات ضد الفدية', defaultValue: 'Yes ($true)', placeholder: 'true / false' },
      { id: 'asrRules', labelEn: 'ASR Rules Level', labelAr: 'مستوى قواعد ASR', defaultValue: 'Block mode on Office & Script vectors', placeholder: 'Audit / Block' },
    ],
    defaultPromptEn: 'Write a PowerShell script that hardens Windows 10/11: enable Microsoft Defender Controlled Folder Access for Documents/Desktop, activate key Attack Surface Reduction (ASR) rules in Block mode, and verify Real-time Protection status.',
    defaultPromptAr: 'اكتب سكربت PowerShell لتحصين ويندوز 10/11: تفعيل حماية المجلدات من برامج الفدية، تفعيل قواعد تقليل مساحة الهجوم ASR في وضع الحظر، والتحقق من جدار الحماية.',
    sampleOutputScript: `# KNOUX Open Code Zen: Zero-Trust Security Hardening
# Administrator Privileges Required
Write-Host "Enforcing Microsoft Defender Hardening Policies..." -ForegroundColor Cyan

# 1. Enable Controlled Folder Access (Ransomware Protection)
Set-MpPreference -EnableControlledFolderAccess Enabled
Write-Host "[+] Controlled Folder Access is ENABLED." -ForegroundColor Green

# 2. Block executable content from email client and webmail
Add-MpPreference -AttackSurfaceReductionRules_Ids "be9ba2d9-53ea-44a7-8f61-b54c0141b7e2" -AttackSurfaceReductionRules_Actions Enabled

# 3. Block credential stealing from the Windows local security authority subsystem (lsass.exe)
Add-MpPreference -AttackSurfaceReductionRules_Ids "9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2" -AttackSurfaceReductionRules_Actions Enabled

# 4. Block abuse of exploited vulnerable signed drivers
Add-MpPreference -AttackSurfaceReductionRules_Ids "56a863a9-875e-4185-98a7-b882c60b3ce5" -AttackSurfaceReductionRules_Actions Enabled

Write-Host "Security Hardening Policies successfully applied!" -ForegroundColor Green`,
  },
  {
    id: 'network-protocol-heal',
    category: 'network',
    titleEn: 'TCP/IP, Winsock & DNS Protocol Auto-Heal',
    titleAr: 'إصلاح بروتوكولات الشبكة والـ DNS وتصفير محولات Winsock',
    descriptionEn: 'Resolves IP conflicts, flushes corrupted DNS cache, resets Winsock catalog, and reinitializes network stack with graceful adapter bounce.',
    descriptionAr: 'حل مشاكل انقطاع الإنترنت وتجديد IP وتفريغ كاش DNS وإعادة بناء كتالوج Winsock بالكامل.',
    iconName: 'Network',
    suggestedModel: 'gemini-3.8-flash',
    safetyLevel: 'SAFE',
    params: [
      { id: 'flushDns', labelEn: 'Flush DNS Resolver Cache', labelAr: 'تفريغ كاش DNS', defaultValue: 'Yes', placeholder: 'Yes/No' },
      { id: 'resetWinsock', labelEn: 'Reset Winsock Catalog', labelAr: 'تصفير كتالوج Winsock', defaultValue: 'Yes', placeholder: 'Yes/No' },
    ],
    defaultPromptEn: 'Create a clean, self-contained PowerShell script that safely flushes the DNS resolver cache, resets the TCP/IP stack via netsh, clears the ARP table, and releases/renews DHCP leases with console feedback.',
    defaultPromptAr: 'أنشئ سكربت PowerShell نظيف يقوم بتفريغ كاش الـ DNS، وإعادة ضبط بروتوكول TCP/IP و Winsock عبر netsh، ومسح جدول ARP وتجديد عنوان IP.',
    sampleOutputScript: `# KNOUX Open Code Zen: Network Protocol Restorer
Write-Host "=== Resetting Network Stack and Resolvers ===" -ForegroundColor Cyan

Write-Host "[1/5] Flushing DNS Cache..." -ForegroundColor Yellow
Clear-DnsClientCache
ipconfig /flushdns | Out-Null

Write-Host "[2/5] Resetting Winsock Catalog..." -ForegroundColor Yellow
netsh winsock reset | Out-Null

Write-Host "[3/5] Resetting IPv4 & IPv6 Stack..." -ForegroundColor Yellow
netsh int ip reset | Out-Null
netsh int ipv6 reset | Out-Null

Write-Host "[4/5] Clearing ARP Cache..." -ForegroundColor Yellow
arp -d * 2>$null

Write-Host "[5/5] Releasing and Renewing DHCP Leases..." -ForegroundColor Yellow
ipconfig /release | Out-Null
ipconfig /renew | Out-Null

Write-Host "Network stack successfully reinitialized!" -ForegroundColor Green`,
  },
  {
    id: 'disk-purge-dedup',
    category: 'disk',
    titleEn: 'Safe Temp Purge & Deduplication Helper',
    titleAr: 'تنظيف المساحة الآمن وحذف الملفات المؤقتة والمكررة',
    descriptionEn: 'Safely purges Windows SoftwareDistribution download caches, %TEMP% folders, memory dumps, and duplicate asset candidates with dry-run support.',
    descriptionAr: 'تنظيف مجلدات التحميل المؤقتة وكاش تحديثات ويندوز وملفات الذاكرة المؤقتة مع دعم وضع المعاينة الآمن قبل الحذف.',
    iconName: 'HardDrive',
    suggestedModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
    safetyLevel: 'SAFE',
    params: [
      { id: 'dryRun', labelEn: 'Dry Run Only (Safe Preview)', labelAr: 'معاينة فقط (بدون حذف)', defaultValue: '$true', placeholder: '$true / $false' },
      { id: 'targetDirs', labelEn: 'Target Directories', labelAr: 'المجلدات المستهدفة', defaultValue: 'Temp, Prefetch, SoftwareDistribution', placeholder: 'Dirs list' },
    ],
    defaultPromptEn: 'Write a PowerShell script with a $DryRun boolean flag that calculates and purges accumulated temp files in C:\\Windows\\Temp, $env:LOCALAPPDATA\\Temp, and Windows Update cache while gracefully skipping in-use files.',
    defaultPromptAr: 'اكتب سكربت PowerShell مع خيار المعاينة $DryRun لحساب وتفريغ الملفات المؤقتة في مجلد Temp وكاش تحديثات ويندوز مع تخطي الملفات قيد الاستخدام بأمان.',
    sampleOutputScript: `# KNOUX Open Code Zen: Disk Temp & Space Reclaimer
param(
    [bool]$DryRun = $true
)

Write-Host "=== Safe Disk Space Reclamation Engine ===" -ForegroundColor Cyan
Write-Host "Mode: $(if ($DryRun) { 'DRY RUN (Preview Only)' } else { 'LIVE PURGE' })" -ForegroundColor $(if ($DryRun) { 'Yellow' } else { 'Red' })

$targets = @(
    "$env:LOCALAPPDATA\\Temp",
    "C:\\Windows\\Temp",
    "C:\\Windows\\Prefetch"
)

$totalBytes = 0
foreach ($dir in $targets) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue
        $size = ($files | Measure-Object -Property Length -Sum).Sum
        $totalBytes += $size
        $mb = [math]::Round($size / 1MB, 2)
        Write-Host "Scanned: $dir -> Found $mb MB" -ForegroundColor DarkGray

        if (-not $DryRun) {
            $files | Remove-Item -Force -ErrorAction SilentlyContinue
        }
    }
}

$freedMB = [math]::Round($totalBytes / 1MB, 2)
Write-Host "Total space identifiable: $freedMB MB" -ForegroundColor Green`,
  },
  {
    id: 'cloud-sql-optimizer',
    category: 'sql',
    titleEn: 'Cloud SQL & Postgres Schema Index Optimizer',
    titleAr: 'محسن استعلامات وفهارس Cloud SQL و PostgreSQL',
    descriptionEn: 'Analyzes slow queries, recommends composite indexes for telemetry and repair logs tables, and optimizes Drizzle ORM queries.',
    descriptionAr: 'فحص استعلامات قاعدة البيانات واقتراح فهارس مركبة لجداول repair_logs و telemetry لتحقيق أعلى سرعة.',
    iconName: 'Database',
    suggestedModel: 'gemini-3.8-flash',
    safetyLevel: 'SAFE',
    params: [
      { id: 'tableName', labelEn: 'Target SQL Table', labelAr: 'اسم جدول قاعدة البيانات', defaultValue: 'repair_logs', placeholder: 'e.g. repair_logs, system_telemetry' },
      { id: 'queryPattern', labelEn: 'Query Pattern to Optimize', labelAr: 'نمط الاستعلام المراد تسريعه', defaultValue: 'SELECT * FROM repair_logs WHERE uid = $1 ORDER BY created_at DESC', placeholder: 'SQL Query' },
    ],
    defaultPromptEn: 'Provide the optimal PostgreSQL DDL statements to create compound B-tree indexes on {tableName} for fast filtering by uid and created_at. Include EXPLAIN ANALYZE instructions and connection pool tuning guidelines for Cloud SQL.',
    defaultPromptAr: 'قدم أوامر SQL المثلى لإنشاء فهارس B-Tree على جدول {tableName} للبحث السريع بحسب uid و created_at مع تعليمات فحص الأداء وضبط Cloud SQL.',
    sampleOutputScript: `-- KNOUX Open Code Zen: Cloud SQL Index & Performance Blueprint
-- Optimize high-frequency filtering on repair logs and telemetry

CREATE INDEX IF NOT EXISTS idx_repair_logs_uid_created 
ON repair_logs (uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_uid_created 
ON system_telemetry (uid, created_at DESC);

-- Analyze performance gain:
EXPLAIN ANALYZE 
SELECT id, tool_id, tool_name, status, created_at 
FROM repair_logs 
WHERE uid = 'u123' 
ORDER BY created_at DESC 
LIMIT 50;`,
  },
  {
    id: 'windows-debloater',
    category: 'debloat',
    titleEn: 'Safe Windows Debloater & Telemetry Tamer',
    titleAr: 'أداة تنظيف البرامج الزائدة وإيقاف التتبع الإعلاني الآمن',
    descriptionEn: 'Safely disables unnecessary advertising telemetry, diagnostic background trackers, and Cortana startup hooks while preserving core system updates.',
    descriptionAr: 'إلغاء تنشيط خدمات التتبع الإعلاني والاستهلاك الخفي للذاكرة مع الحفاظ على استقرار النظام وتحديثات ويندوز الرسمية.',
    iconName: 'Zap',
    suggestedModel: 'gemini-3.8-flash',
    safetyLevel: 'ADMIN_REQUIRED',
    params: [
      { id: 'disableAds', labelEn: 'Disable Lockscreen & Start Menu Ads', labelAr: 'إيقاف إعلانات شاشة القفل وقائمة ابدأ', defaultValue: 'Yes', placeholder: 'Yes/No' },
      { id: 'diagTracking', labelEn: 'Set Telemetry to Security/Minimal', labelAr: 'تقليص جمع البيانات للحد الأدنى', defaultValue: 'Yes', placeholder: 'Yes/No' },
    ],
    defaultPromptEn: 'Write a non-destructive PowerShell script that adjusts registry keys to turn off Start Menu recommendations, lockscreen advertisements, and minimizes diagnostic telemetry without breaking the Microsoft Store or Windows Update.',
    defaultPromptAr: 'اكتب سكربت PowerShell آمن يقوم بإيقاف إعلانات قائمة ابدأ وشاشة القفل وتقليص خدمات التتبع غير الضرورية دون المساس بمتجر مايكروسوفت أو التحديثات.',
    sampleOutputScript: `# KNOUX Open Code Zen: Safe Windows Debloat & Privacy Tune
Write-Host "Applying Non-Destructive Privacy and Speed Tweaks..." -ForegroundColor Cyan

# 1. Disable Start Menu App Suggestions
$key1 = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager"
Set-ItemProperty -Path $key1 -Name "SystemPaneSuggestionsEnabled" -Value 0 -ErrorAction SilentlyContinue

# 2. Disable Lock Screen Spotlight Advertisements
Set-ItemProperty -Path $key1 -Name "RotatingImageEnabled" -Value 0 -ErrorAction SilentlyContinue

# 3. Disable Telemetry Service (DiagTrack) safely
Stop-Service -Name "DiagTrack" -ErrorAction SilentlyContinue
Set-Service -Name "DiagTrack" -StartupType Disabled -ErrorAction SilentlyContinue

Write-Host "Privacy and performance optimizations applied cleanly!" -ForegroundColor Green`,
  }
];
