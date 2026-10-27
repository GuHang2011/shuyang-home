param(
  [switch]$Lan,
  [ValidateRange(1, 65535)]
  [int]$BackendPort = 9999
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'CropDiseasesDetection_vue')
if (-not (Test-Path -LiteralPath 'node_modules')) {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependencies could not be installed.' }
}
$bindAddress = if ($Lan) { '0.0.0.0' } else { '127.0.0.1' }
$previousProxyTarget = [Environment]::GetEnvironmentVariable('VITE_API_PROXY_TARGET', 'Process')
try {
  $env:VITE_API_PROXY_TARGET = "http://127.0.0.1:$BackendPort"
  & npm.cmd run dev -- --host $bindAddress --strictPort
  if ($LASTEXITCODE -ne 0) { throw 'Frontend stopped with an error. Check the log and whether port 8888 is already in use.' }
}
finally {
  if ($null -eq $previousProxyTarget) {
    Remove-Item Env:VITE_API_PROXY_TARGET -ErrorAction SilentlyContinue
  }
  else {
    $env:VITE_API_PROXY_TARGET = $previousProxyTarget
  }
}
