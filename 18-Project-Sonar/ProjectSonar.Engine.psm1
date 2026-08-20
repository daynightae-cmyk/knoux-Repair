# Knoux Repair | Project Sonar shared local analysis engine
Set-StrictMode -Version Latest

function Resolve-SonarWorkspace {
  param([string]$LocalSourcePath)
  $candidate = if ([string]::IsNullOrWhiteSpace($LocalSourcePath)) { (Get-Location).Path } else { $LocalSourcePath }
  if (-not [IO.Path]::IsPathRooted($candidate)) { throw 'Project Sonar requires an absolute project folder path.' }
  if (-not (Test-Path -LiteralPath $candidate -PathType Container)) { throw 'The selected project workspace does not exist or is not a folder.' }
  $resolved = (Resolve-Path -LiteralPath $candidate).Path
  if ($resolved.TrimEnd('\\') -eq [IO.Path]::GetPathRoot($resolved).TrimEnd('\\')) { throw 'A drive root cannot be scanned as a project workspace.' }
  return $resolved
}

function Get-SonarSnapshot {
  param([Parameter(Mandatory)][string]$Workspace)
  $markers = @('package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lockb','tsconfig.json','vite.config.ts','vite.config.js','next.config.js','next.config.mjs','README.md','.gitignore','.editorconfig','.env','.env.example','requirements.txt','pyproject.toml','Pipfile','go.mod','Cargo.toml','composer.json','Gemfile','Dockerfile','docker-compose.yml','.github')
  $markerRows = foreach ($marker in $markers) { [pscustomobject]@{ Name=$marker; Present=(Test-Path -LiteralPath (Join-Path $Workspace $marker)) } }
  $ignoredNames = @('node_modules','.git','.next','dist','build','coverage','out','target','.turbo','.cache','.venv','venv','__pycache__')
  $topDirs = @(Get-ChildItem -LiteralPath $Workspace -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin $ignoredNames } | Select-Object -First 120 | ForEach-Object { $_.Name })
  $fileRows = @()
  try {
    $fileRows = @(Get-ChildItem -LiteralPath $Workspace -File -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
      $segments = $_.FullName -split '[\\/]'
      -not (@($segments | Where-Object { $_ -in $ignoredNames }).Count)
    } | Select-Object -First 6000)
  } catch { $fileRows = @() }
  $extensions = @($fileRows | ForEach-Object { $_.Extension.ToLowerInvariant() } | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 25 | ForEach-Object { [pscustomobject]@{ Extension=$_.Name; Count=$_.Count } })
  $languages = @()
  $languageMap = @{ '.ts'='TypeScript'; '.tsx'='TypeScript'; '.js'='JavaScript'; '.jsx'='JavaScript'; '.py'='Python'; '.cs'='C#'; '.go'='Go'; '.rs'='Rust'; '.java'='Java'; '.php'='PHP'; '.rb'='Ruby'; '.html'='HTML'; '.css'='CSS'; '.scss'='SCSS'; '.ps1'='PowerShell' }
  foreach ($entry in $extensions) { if ($languageMap.ContainsKey($entry.Extension)) { $languages += $languageMap[$entry.Extension] } }
  $languages = @($languages | Select-Object -Unique)
  $package = $null; $packageError = ''
  $packagePath = Join-Path $Workspace 'package.json'
  if (Test-Path -LiteralPath $packagePath) { try { $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json } catch { $packageError = $_.Exception.Message } }
  $packageScripts = if ($package -and $package.scripts) { @($package.scripts.PSObject.Properties | ForEach-Object { $_.Name }) } else { @() }
  $git = Get-Command git -ErrorAction SilentlyContinue
  $gitState = [ordered]@{ Available=[bool]$git; Repository=$false; Branch=''; Status=@(); RemoteLines=@(); LastCommit='' }
  if ($git) {
    try {
      $inside = (& $git.Source -C $Workspace rev-parse --is-inside-work-tree 2>$null | Select-Object -First 1).Trim()
      if ($inside -eq 'true') {
        $gitState.Repository = $true
        $gitState.Branch = (& $git.Source -C $Workspace branch --show-current 2>$null | Select-Object -First 1).Trim()
        $gitState.Status = @(& $git.Source -C $Workspace status --short 2>$null | Select-Object -First 250)
        $gitState.RemoteLines = @(& $git.Source -C $Workspace remote -v 2>$null | Select-Object -First 30)
        $gitState.LastCommit = (& $git.Source -C $Workspace log -1 --pretty=format:%h' '%s 2>$null | Select-Object -First 1).Trim()
      }
    } catch { }
  }
  return [pscustomobject]@{
    Workspace=$Workspace; CapturedAt=(Get-Date).ToString('o'); Markers=$markerRows; TopDirectories=$topDirs; FileCount=$fileRows.Count; Extensions=$extensions; Languages=$languages; PackageName=if($package){[string]$package.name}else{''}; PackageVersion=if($package){[string]$package.version}else{''}; PackageScripts=$packageScripts; PackageParseError=$packageError; Git=[pscustomobject]$gitState
  }
}

function Get-SonarFindings {
  param([Parameter(Mandatory)]$Snapshot)
  $present = @{}; foreach ($marker in $Snapshot.Markers) { $present[$marker.Name] = [bool]$marker.Present }
    $script:findings = @()

  function Add-SonarFinding { param([string]$Severity,[string]$Code,[string]$TitleEn,[string]$TitleAr,[string]$Evidence,[string]$FixEn,[string]$FixAr)
    $script:findings += [pscustomobject]@{ Severity=$Severity; Code=$Code; TitleEn=$TitleEn; TitleAr=$TitleAr; Evidence=$Evidence; FixEn=$FixEn; FixAr=$FixAr }
  }
  $isNode = [bool]$present['package.json']; $isPython = [bool]($present['requirements.txt'] -or $present['pyproject.toml'] -or $present['Pipfile'])
  if ($Snapshot.PackageParseError) { Add-SonarFinding 'CRITICAL' 'PKG_PARSE' 'package.json cannot be parsed' 'تعذر تحليل package.json' $Snapshot.PackageParseError 'Fix the JSON syntax before dependency or build work.' 'أصلح صياغة JSON قبل العمل على الاعتمادات أو البناء.' }
  if ($isNode -and -not ($present['package-lock.json'] -or $present['pnpm-lock.yaml'] -or $present['yarn.lock'] -or $present['bun.lockb'])) { Add-SonarFinding 'HIGH' 'NODE_LOCK' 'Node project has no detected lockfile' 'مشروع Node بلا ملف قفل مكتشف' 'package.json exists but no supported Node lockfile was found.' 'Create and commit one package-manager lockfile.' 'أنشئ وثبّت في المستودع ملف قفل واحد لمدير الحزم.' }
  if ($isNode -and -not ($Snapshot.PackageScripts -contains 'test')) { Add-SonarFinding 'HIGH' 'TEST_SCRIPT' 'No test script is declared' 'لا يوجد سكربت اختبار معلن' 'package.json does not declare a test script.' 'Add a repeatable test command and document it.' 'أضف أمر اختبار قابلًا للتكرار ووثّقه.' }
  if ($isNode -and -not ($Snapshot.PackageScripts -contains 'lint')) { Add-SonarFinding 'MEDIUM' 'LINT_SCRIPT' 'No lint script is declared' 'لا يوجد سكربت تدقيق أسلوب معلن' 'package.json does not declare a lint script.' 'Add a lint command or document the selected quality gate.' 'أضف أمر تدقيق أسلوب أو وثّق بوابة الجودة المختارة.' }
  if ($isNode -and ($Snapshot.Languages -contains 'TypeScript') -and -not $present['tsconfig.json']) { Add-SonarFinding 'HIGH' 'TS_CONFIG' 'TypeScript files found without tsconfig.json' 'تم العثور على TypeScript دون tsconfig.json' 'TypeScript extensions were detected but tsconfig.json was not found at the workspace root.' 'Add or document the TypeScript compiler configuration.' 'أضف أو وثّق إعداد مترجم TypeScript.' }
  if ($isPython -and -not ($present['requirements.txt'] -or $present['pyproject.toml'] -or $present['Pipfile'])) { Add-SonarFinding 'HIGH' 'PY_DEPENDENCIES' 'Python code lacks a detected dependency manifest' 'كود Python بلا ملف اعتمادات مكتشف' 'Python extensions were detected but no dependency manifest was found.' 'Add requirements.txt, pyproject.toml, or Pipfile.' 'أضف requirements.txt أو pyproject.toml أو Pipfile.' }
  if (-not $present['README.md']) { Add-SonarFinding 'MEDIUM' 'README' 'No README.md found at project root' 'لا يوجد README.md في جذر المشروع' 'The project root has no README.md marker.' 'Document setup, run, test, and recovery steps.' 'وثّق الإعداد والتشغيل والاختبار وخطوات الاسترداد.' }
  if (-not $present['.gitignore']) { Add-SonarFinding 'HIGH' 'GITIGNORE' 'No .gitignore found at project root' 'لا يوجد .gitignore في جذر المشروع' 'The project root has no .gitignore marker.' 'Add ignore rules for generated files, local environment values, and IDE artifacts.' 'أضف قواعد تجاهل للملفات المولدة وقيم البيئة المحلية ومخلفات IDE.' }
  if ($present['.env'] -and -not $present['.env.example']) { Add-SonarFinding 'HIGH' 'ENV_TEMPLATE' 'Local environment file has no example template' 'ملف البيئة المحلي بلا قالب مثال' '.env exists while .env.example was not found.' 'Create a redacted .env.example without secrets.' 'أنشئ .env.example منقحًا من الأسرار.' }
  if (-not $Snapshot.Git.Repository) { Add-SonarFinding 'MEDIUM' 'GIT_REPOSITORY' 'Selected folder is not a Git work tree' 'المجلد المختار ليس مساحة عمل Git' 'Git did not report a work tree for the selected folder.' 'Initialize Git or choose the actual repository root.' 'هيئ Git أو اختر الجذر الفعلي للمستودع.' }
  if ($Snapshot.FileCount -eq 0) { Add-SonarFinding 'HIGH' 'NO_FILES' 'No project files were observed in the scan window' 'لم تُرصد ملفات مشروع في نافذة الفحص' 'The bounded scan did not find non-generated project files.' 'Verify the selected folder and project structure.' 'تحقق من المجلد المختار وهيكل المشروع.' }
  $rank = @{ 'CRITICAL'=0; 'HIGH'=1; 'MEDIUM'=2; 'LOW'=3 }
    return @($script:findings | Sort-Object { $rank[$_.Severity] }, Code)

}

function Get-SonarPromptPack {
  param([Parameter(Mandatory)]$Snapshot,[Parameter(Mandatory)]$Findings,[ValidateSet('en','ar')][string]$Language='en')
  $facts = [pscustomobject]@{ Workspace=$Snapshot.Workspace; Languages=$Snapshot.Languages; FileCount=$Snapshot.FileCount; PackageName=$Snapshot.PackageName; Scripts=$Snapshot.PackageScripts; GitRepository=$Snapshot.Git.Repository; Findings=$Findings } | ConvertTo-Json -Depth 7
  if ($Language -eq 'ar') {
    return @"
أنت مساعد هندسي لمشروع برمجي. استخدم الحقائق التالية فقط ولا تفترض ملفات أو أخطاء غير مذكورة. رتب خطة تنفيذ من CRITICAL إلى LOW. لكل بند: السبب، أثره، خطوات إصلاح صغيرة قابلة للتحقق، الملفات المحتملة المتأثرة، وأمر اختبار أو معيار قبول. لا تُخرج أسرارًا، ولا تطلب حذف ملفات مولدة قبل المعاينة. إذا كانت البيانات غير كافية فاكتب أسئلة توضيحية قبل اقتراح التعديل.

حقائق Project Sonar:
$facts

المطلوب: تقرير عمل عربي منظم، ثم قائمة مهام قابلة للنسخ، ثم اقتراح أول تغيير صغير وآمن فقط.
"@
  }
  return @"
You are an engineering assistant for a software project. Use only the facts below; do not invent files or defects. Prioritize a plan from CRITICAL to LOW. For every item provide: cause, impact, small verifiable repair steps, likely files affected, and a test command or acceptance criterion. Do not expose secrets and do not recommend deleting generated files before preview. If evidence is insufficient, list clarifying questions before proposing a change.

Project Sonar facts:
$facts

Deliver: a structured engineering brief, a copyable task list, and only the first safe incremental change.
"@
}

function Export-SonarArtifacts {
  param([Parameter(Mandatory)]$Session,[Parameter(Mandatory)]$Snapshot,[Parameter(Mandatory)]$Findings,[string]$Prefix='project-sonar')
  $payload = [pscustomobject]@{ Snapshot=$Snapshot; Findings=$Findings; SeverityCounts=[pscustomobject]@{ Critical=@($Findings|Where-Object Severity -eq 'CRITICAL').Count; High=@($Findings|Where-Object Severity -eq 'HIGH').Count; Medium=@($Findings|Where-Object Severity -eq 'MEDIUM').Count; Low=@($Findings|Where-Object Severity -eq 'LOW').Count } }
  $payload | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $Session.RawDir ($Prefix + '.json')) -Encoding UTF8
  $enLines = @('# Project Sonar report','','## Evidence',('* Workspace: ' + $Snapshot.Workspace),('* Languages: ' + ($Snapshot.Languages -join ', ')),('* Files observed: ' + $Snapshot.FileCount),'','## Findings')
  foreach($finding in $Findings){ $enLines += ('### [' + $finding.Severity + '] ' + $finding.TitleEn); $enLines += ('Evidence: ' + $finding.Evidence); $enLines += ('Recommended next step: ' + $finding.FixEn); $enLines += '' }
  $arLines = @('# تقرير Project Sonar','','## الأدلة',('* مساحة العمل: ' + $Snapshot.Workspace),('* اللغات: ' + ($Snapshot.Languages -join ', ')),('* الملفات المرصودة: ' + $Snapshot.FileCount),'','## النتائج')
  foreach($finding in $Findings){ $arLines += ('### [' + $finding.Severity + '] ' + $finding.TitleAr); $arLines += ('الدليل: ' + $finding.Evidence); $arLines += ('الخطوة المقترحة: ' + $finding.FixAr); $arLines += '' }
  $enLines | Set-Content (Join-Path $Session.RawDir ($Prefix + '.en.md')) -Encoding UTF8
  $arLines | Set-Content (Join-Path $Session.RawDir ($Prefix + '.ar.md')) -Encoding UTF8
  Get-SonarPromptPack -Snapshot $Snapshot -Findings $Findings -Language 'en' | Set-Content (Join-Path $Session.RawDir ($Prefix + '.prompt.en.md')) -Encoding UTF8
  Get-SonarPromptPack -Snapshot $Snapshot -Findings $Findings -Language 'ar' | Set-Content (Join-Path $Session.RawDir ($Prefix + '.prompt.ar.md')) -Encoding UTF8
  return $payload
}

Export-ModuleMember -Function Resolve-SonarWorkspace,Get-SonarSnapshot,Get-SonarFindings,Get-SonarPromptPack,Export-SonarArtifacts
