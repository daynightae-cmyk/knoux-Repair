param(
    [string]$Repo = "D:\Knoux-repair",
    [ValidateSet("Publish","Finalize")]
    [string]$Mode = "Publish",
    [switch]$FullGate
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Section([string]$Text) {
    Write-Host ""
    Write-Host ("=" * 84) -ForegroundColor DarkCyan
    Write-Host (" " + $Text) -ForegroundColor Cyan
    Write-Host ("=" * 84) -ForegroundColor DarkCyan
}

function GitRun {
    param([string[]]$Args,[switch]$AllowFailure)
    $out = @(& git -c safe.directory=* -C $Repo @Args 2>&1)
    $code = $LASTEXITCODE
    if ($code -ne 0 -and -not $AllowFailure) {
        throw ("git " + ($Args -join " ") + " failed:`n" + (($out | ForEach-Object { "$_" }) -join "`n"))
    }
    return [pscustomobject]@{ Code=$code; Text=(($out | ForEach-Object { "$_" }) -join "`n").Trim(); Lines=$out }
}

$Repo = [IO.Path]::GetFullPath($Repo).TrimEnd('\')
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$evidence = "D:\KNOUX-SYNC-EVIDENCE\SYNC-$stamp"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

Section "KNOUX SAFE TWIN SYNC"
Write-Host "Repo : $Repo"
Write-Host "Mode : $Mode"

if (-not (Test-Path -LiteralPath $Repo)) { throw "Repository not found: $Repo" }
$probe = GitRun @("rev-parse","--show-toplevel") -AllowFailure
if ($probe.Code -ne 0) { throw "Not a Git repository: $Repo" }

if ($Mode -eq "Finalize") {
    Section "FINALIZE LOCAL FROM REMOTE MAIN"
    $dirty = (GitRun @("status","--porcelain=v1","--untracked-files=all")).Text
    if ($dirty) { throw "Working tree is dirty. Run Publish first." }

    GitRun @("fetch","origin","--prune","--tags") | Out-Null
    $hasMain = GitRun @("show-ref","--verify","--quiet","refs/heads/main") -AllowFailure
    if ($hasMain.Code -eq 0) { GitRun @("switch","main") | Out-Null }
    else { GitRun @("switch","-c","main","--track","origin/main") | Out-Null }

    GitRun @("pull","--ff-only","origin","main") | Out-Null
    $local = (GitRun @("rev-parse","HEAD")).Text
    $remote = (GitRun @("rev-parse","origin/main")).Text
    $status = (GitRun @("status","--porcelain=v1")).Text

    if ($local -ne $remote) { throw "Local HEAD != origin/main" }
    if ($status) { throw "Working tree is not clean after finalize" }

    @(
        "KNOUX FINALIZE",
        "Local : $local",
        "Remote: $remote",
        "Clean : True"
    ) | Set-Content -LiteralPath "$evidence\00-finalize.txt" -Encoding UTF8

    Write-Host "TWIN VERIFIED: local main == origin/main == $local" -ForegroundColor Green
    exit 0
}

Section "1. SAFETY CAPTURE"
$branch = (GitRun @("branch","--show-current")).Text
$headBefore = (GitRun @("rev-parse","HEAD")).Text
$origin = (GitRun @("remote","get-url","origin")).Text

GitRun @("status","--porcelain=v1","--untracked-files=all") | Select-Object -ExpandProperty Lines | Out-File "$evidence\01-status-before.txt" -Encoding utf8
GitRun @("branch","-vv") | Select-Object -ExpandProperty Lines | Out-File "$evidence\02-branches.txt" -Encoding utf8
GitRun @("log","--all","--graph","--decorate","--oneline","-100") | Select-Object -ExpandProperty Lines | Out-File "$evidence\03-log.txt" -Encoding utf8

$bundle = GitRun @("bundle","create","$evidence\knoux-all-refs.bundle","--all") -AllowFailure
if ($bundle.Code -eq 0) { Write-Host "Safety bundle created." -ForegroundColor Green }
else { Write-Host "Bundle creation failed; no destructive action was taken." -ForegroundColor Yellow }

Section "2. FETCH REMOTE"
GitRun @("fetch","origin","--prune","--tags") | Out-Null
$remoteMain = (GitRun @("rev-parse","origin/main")).Text
Write-Host "origin/main = $remoteMain"

Section "3. FREEZE CURRENT LOCAL STATE"
GitRun @("add","-A") | Out-Null
$cached = GitRun @("diff","--cached","--quiet") -AllowFailure
if ($cached.Code -eq 1) {
    $name = (GitRun @("config","user.name") -AllowFailure).Text
    $mail = (GitRun @("config","user.email") -AllowFailure).Text
    if (-not $name) { GitRun @("config","user.name","Eng Sadek Elgazar") | Out-Null }
    if (-not $mail) { GitRun @("config","user.email","293348050+daynightae-cmyk@users.noreply.github.com") | Out-Null }
    GitRun @("commit","-m","chore(handoff): preserve exact local KNOUX state $stamp") | Out-Null
    Write-Host "Local modifications committed safely." -ForegroundColor Green
}

$localHead = (GitRun @("rev-parse","HEAD")).Text
$handoff = "handoff/local-final-$stamp"
GitRun @("diff","--name-status","origin/main...HEAD") | Select-Object -ExpandProperty Lines | Out-File "$evidence\04-local-vs-main.txt" -Encoding utf8
GitRun @("diff","--stat","origin/main...HEAD") | Select-Object -ExpandProperty Lines | Out-File "$evidence\05-diff-stat.txt" -Encoding utf8

Section "4. PUSH EXACT LOCAL STATE"
$push = GitRun @("push","origin","HEAD:refs/heads/$handoff") -AllowFailure
if ($push.Code -ne 0) {
    $gh = Get-Command gh.exe -ErrorAction SilentlyContinue
    if ($gh) {
        & gh.exe auth setup-git 2>&1 | Out-File "$evidence\06-gh-auth.txt" -Encoding utf8
        $push = GitRun @("push","origin","HEAD:refs/heads/$handoff") -AllowFailure
    }
}
if ($push.Code -ne 0) {
    $push.Text | Out-File "$evidence\07-push-error.txt" -Encoding utf8
    throw "Push failed. Local work remains safely committed."
}

GitRun @("fetch","origin",$handoff) | Out-Null
$remoteHandoff = (GitRun @("rev-parse","origin/$handoff")).Text
if ($remoteHandoff -ne $localHead) { throw "Remote handoff SHA does not match local HEAD." }

Section "5. OPTIONAL GATES"
$web = Join-Path $Repo "web-frontend"
if (Test-Path "$web\package.json") {
    Push-Location $web
    try {
        & npm.cmd run typecheck 2>&1 | Tee-Object -FilePath "$evidence\08-typecheck.log"
        if ($FullGate) {
            & npm.cmd test 2>&1 | Tee-Object -FilePath "$evidence\09-tests.log"
            & npm.cmd run build 2>&1 | Tee-Object -FilePath "$evidence\10-build.log"
        }
    } finally { Pop-Location }
}

@(
    "KNOUX LOCAL HANDOFF",
    "Original branch : $branch",
    "Original HEAD   : $headBefore",
    "origin/main     : $remoteMain",
    "Final local HEAD: $localHead",
    "Handoff branch : $handoff",
    "Remote handoff : $remoteHandoff",
    "Evidence       : $evidence",
    "",
    "No remote main merge was performed.",
    "The exact current local state is now preserved remotely."
) | Set-Content "$evidence\00-HANDOFF-RECEIPT.txt" -Encoding UTF8

Copy-Item "$evidence\00-HANDOFF-RECEIPT.txt" "D:\KNOUX-LATEST-HANDOFF.txt" -Force

Section "DONE"
Write-Host "HANDOFF BRANCH: $handoff" -ForegroundColor Green
Write-Host "HANDOFF SHA   : $remoteHandoff" -ForegroundColor Green
Write-Host "RECEIPT       : D:\KNOUX-LATEST-HANDOFF.txt" -ForegroundColor Green
Write-Host "Do not pull/reset/clean before the handoff branch is reviewed and merged." -ForegroundColor Yellow
