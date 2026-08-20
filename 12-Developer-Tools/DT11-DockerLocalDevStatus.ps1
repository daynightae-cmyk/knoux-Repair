[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT11' -ToolName 'Docker and Local Development Status' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  $payload = [ordered]@{ DockerAvailable=[bool]$docker; Version=''; Client=@(); Server=@(); Containers=@(); Images=@(); Error='' }
  if ($docker) {
    try { $payload.Version = ((& $docker.Source version --format '{{.Client.Version}}' 2>$null | Select-Object -First 1) -join '').Trim() } catch { }
    try { $payload.Client = @(& $docker.Source version --format '{{json .Client}}' 2>$null | Select-Object -First 1) } catch { }
    try { $payload.Server = @(& $docker.Source version --format '{{json .Server}}' 2>$null | Select-Object -First 1) } catch { }
    try { $payload.Containers = @(& $docker.Source ps -a --format '{{json .}}' 2>$null | Select-Object -First 200) } catch { $payload.Error = $_.Exception.Message }
    try { $payload.Images = @(& $docker.Source image ls --format '{{json .}}' 2>$null | Select-Object -First 200) } catch { }
  }
  [pscustomobject]$payload | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $Session.RawDir 'docker-local-development-status.json') -Encoding UTF8
  $Session.ItemsFound = $payload.Containers.Count + $payload.Images.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = if($docker){'Docker local-development status collected.'}else{'Docker is not installed or not on PATH.'}
  Write-Host ('[OK] ' + $Session.VerificationResult) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
