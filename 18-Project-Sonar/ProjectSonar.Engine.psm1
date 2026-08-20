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
  $languageMap = @{ '.ts'='TypeScript'; '.tsx'='TypeScript'; '.js'='JavaScript'; '.jsx'='JavaScript'; '.py'='Python'; '.cs'='C#'; '.go'='Go'; '.rs'='Rust'; '.java'='Java'; '.php'='PHP'; '.rb'='Ruby'; '.swift'='Swift'; '.kt'='Kotlin'; '.c'='C'; '.cpp'='C++'; '.h'='C'; '.hpp'='C++'; '.cs'='C#'; '.ps1'='PowerShell'; '.sh'='Shell'; '.bash'='Shell'; '.json'='JSON'; '.yaml'='YAML'; '.yml'='YAML'; '.xml'='XML'; '.html'='HTML'; '.css'='CSS'; '.scss'='SCSS'; '.less'='LESS' }
  foreach ($entry in $extensions) { if ($languageMap.ContainsKey($entry.Extension)) { $languages += $languageMap[$entry.Extension] } }
  $languages = @($languages | Select-Object -Unique)
  
  $package = $null
  $packageError = ''
  $packagePath = Join-Path $Workspace 'package.json'
  if (Test-Path -LiteralPath $packagePath) { 
    try { 
      $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json 
    } catch { 
      $packageError = $_.Exception.Message 
    } 
  }
  
  # FIX #1: Guard property access for optional package.json fields under StrictMode
  $packageScripts = if ($package -and $package.PSObject.Properties['scripts']) { @($package.scripts.PSObject.Properties | ForEach-Object { $_.Name }) } else { @() }
  $packageName = if ($package -and $package.PSObject.Properties['name']) { [string]$package.name } else { '' }
  $packageVersion = if ($package -and $package.PSObject.Properties['version']) { [string]$package.version } else { '' }
  
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
    Workspace=$Workspace
    CapturedAt=(Get-Date).ToString('o')
    Markers=$markerRows
    TopDirectories=$topDirs
    FileCount=$fileRows.Count
    Extensions=$extensions
    Languages=$languages
    PackageName=$packageName
    PackageVersion=$packageVersion
    PackageScripts=$packageScripts
    PackageParseError=$packageError
    Git=$gitState
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
  if ($Snapshot.PackageParseError) { Add-SonarFinding 'CRITICAL' 'PKG_PARSE' 'package.json cannot be parsed' 'تعذر تحليل package.json' $Snapshot.PackageParseError 'Fix the JSON syntax before proceeding.' 'صحح بناء الجملة JSON قبل المتابعة.' }
  if ($isNode -and -not ($present['package-lock.json'] -or $present['pnpm-lock.yaml'] -or $present['yarn.lock'] -or $present['bun.lockb'])) { Add-SonarFinding 'HIGH' 'NODE_LOCK' 'Node project has no lock file' 'مشروع Node بلا ملف قفل' 'Run npm install to create a lock file.' 'قم بتشغيل npm install لإنشاء ملف قفل.' }
  if ($isNode -and -not ($Snapshot.PackageScripts -contains 'test')) { Add-SonarFinding 'HIGH' 'TEST_SCRIPT' 'No test script is declared' 'لا يوجد سكربت اختبار معلن' 'package.json is missing a test entry under scripts.' 'package.json مفقود إدخال الاختبار تحت النصوص.' }
  if ($isNode -and -not ($Snapshot.PackageScripts -contains 'lint')) { Add-SonarFinding 'MEDIUM' 'LINT_SCRIPT' 'No lint script is declared' 'لا يوجد سكربت تدقيق أسلوب معلن' 'Add a lint script to package.json scripts section.' 'أضف سكربت lint إلى قسم النصوص في package.json.' }
  if ($isNode -and ($Snapshot.Languages -contains 'TypeScript') -and -not $present['tsconfig.json']) { Add-SonarFinding 'HIGH' 'TS_CONFIG' 'TypeScript files found without tsconfig.json' 'تم العثور على ملفات TypeScript بدون tsconfig.json' 'Create a tsconfig.json in the project root.' 'قم بإنشاء tsconfig.json في جذر المشروع.' }
  if ($isPython -and -not ($present['requirements.txt'] -or $present['pyproject.toml'] -or $present['Pipfile'])) { Add-SonarFinding 'HIGH' 'PY_DEPENDENCIES' 'Python code lacks a detected dependency manager' 'يفتقد كود Python إلى مدير التبعيات المكتشف' 'Create a requirements.txt, pyproject.toml, or Pipfile.' 'قم بإنشاء requirements.txt أو pyproject.toml أو Pipfile.' }
  if (-not $present['README.md']) { Add-SonarFinding 'MEDIUM' 'README' 'No README.md found at project root' 'لا يوجد README.md في جذر المشروع' 'The project root has no README.md file.' 'جذر المشروع لا يحتوي على ملف README.md.' }
  if (-not $present['.gitignore']) { Add-SonarFinding 'HIGH' 'GITIGNORE' 'No .gitignore found at project root' 'لا يوجد .gitignore في جذر المشروع' 'The project root has no .gitignore file.' 'جذر المشروع لا يحتوي على ملف .gitignore.' }
  if ($present['.env'] -and -not $present['.env.example']) { Add-SonarFinding 'HIGH' 'ENV_TEMPLATE' 'Local environment file has no example template' 'ملف البيئة المحلي بلا قالب مثال' 'Create a .env.example file documenting required variables.' 'قم بإنشاء ملف .env.example يوثق المتغيرات المطلوبة.' }
  if (-not $Snapshot.Git.Repository) { Add-SonarFinding 'MEDIUM' 'GIT_REPOSITORY' 'Selected folder is not a Git work tree' 'المجلد المختار ليس مساحة عمل Git' 'Git did not recognize this folder as a repository.' 'لم يتعرف Git على هذا المجلد كمستودع.' }
  if ($Snapshot.FileCount -eq 0) { Add-SonarFinding 'HIGH' 'NO_FILES' 'No project files were observed in the scan window' 'لم تُرصد ملفات مشروع في نافذة الفحص' 'The boundary check may be too strict or the folder is empty.' 'قد تكون فحص الحدود صارمة جداً أو المجلد فارغ.' }
  $rank = @{ 'CRITICAL'=0; 'HIGH'=1; 'MEDIUM'=2; 'LOW'=3 }
    return @($script:findings | Sort-Object { $rank[$_.Severity] }, Code)

}

function Get-SonarPromptPack {
  param([Parameter(Mandatory)]$Snapshot,[Parameter(Mandatory)]$Findings,[ValidateSet('en','ar')][string]$Language='en')
  $facts = [pscustomobject]@{ Workspace=$Snapshot.Workspace; Languages=$Snapshot.Languages; FileCount=$Snapshot.FileCount; PackageName=$Snapshot.PackageName; Scripts=$Snapshot.PackageScripts; GitRepository=$Snapshot.Git.Repository; GitBranch=$Snapshot.Git.Branch }
  if ($Language -eq 'ar') {
    return @"
أنت مساعد هندسي لمشروع برمجي. استخدم الحقائق التالية فقط ولا تفترض ملفات أو أخطاء غير مذكورة. رتب خطة تنفيذ من CRITICAL إلى LOW. لكل عنصر قدم: السبب والتأثير والخطوة الموصى بها.

حقائق Project Sonar:
$facts

المطلوب: تقرير عمل عربي منظم، ثم قائمة مهام قابلة للنسخ، ثم اقتراح أول تغيير صغير وآمن فقط.
"@
  }
  return @"
You are an engineering assistant for a software project. Use only the facts below; do not invent files or defects. Prioritize a plan from CRITICAL to LOW. For every item provide: cause, impact, and recommended next step.

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
