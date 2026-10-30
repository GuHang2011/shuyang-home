$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$config=Get-Content -LiteralPath (Join-Path $root '.cache\membership-preview\runtime.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($key in @('backendPid','webPid','mobilePid')) {
  $processId=[int]$config.$key
  $process=Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
  if (-not $process) {continue}
  $expected=if($key -eq 'backendPid'){if($config.backendJar){[string]$config.backendJar}else{'target/shuyang-home-1.0.0.jar'}}elseif($key -eq 'webPid'){'node_modules/vite/bin/vite.js'}else{'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'}
  if($process.CommandLine.Contains($expected)) {
    $handle=[Diagnostics.Process]::GetProcessById($processId)
    $handle.Kill()
    if(-not $handle.WaitForExit(10000)) {throw "Preview process $processId did not exit"}
  }
  else {throw "Process $processId no longer matches this preview. Not stopping it."}
}
