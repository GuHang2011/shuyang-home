param([int]$BackendPort=19999,[int]$WebPort=18888,[int]$MobilePort=18890)
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$work=Join-Path $root '.cache\membership-preview'
New-Item -ItemType Directory -Path $work -Force | Out-Null
foreach ($port in @($BackendPort,$WebPort,$MobilePort)) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is already in use" }
}
$password='Preview'+[Guid]::NewGuid().ToString('N')+'2026'
$previousPassword=$env:SHUYANG_ADMIN_PASSWORD
$previousDb=$env:SHUYANG_DB_URL
$previousPort=$env:SHUYANG_PORT
$previousProxy=$env:VITE_API_PROXY_TARGET
try {
  $env:SHUYANG_ADMIN_PASSWORD=$password
  $env:SHUYANG_DB_URL='jdbc:h2:mem:shuyang-preview;DB_CLOSE_DELAY=-1'
  $env:SHUYANG_PORT=[string]$BackendPort
  $env:VITE_API_PROXY_TARGET="http://127.0.0.1:$BackendPort"
  $java=if($env:JAVA_HOME){Join-Path $env:JAVA_HOME 'bin\java.exe'}else{(Get-Command java.exe).Source}
  $node=(Get-Command node.exe).Source
  $backend=Start-Process -FilePath $java -ArgumentList @('-jar','target/shuyang-home-1.0.0.jar','--server.address=127.0.0.1') -WorkingDirectory (Join-Path $root 'CropDiseasesDetection_springboot') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $work 'backend.log') -RedirectStandardError (Join-Path $work 'backend-error.log')
  $web=Start-Process -FilePath $node -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$WebPort",'--strictPort') -WorkingDirectory (Join-Path $root 'CropDiseasesDetection_vue') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $work 'web.log') -RedirectStandardError (Join-Path $work 'web-error.log')
  $mobile=Start-Process -FilePath $node -ArgumentList @('node_modules/@dcloudio/vite-plugin-uni/bin/uni.js','-p','h5','--host','127.0.0.1','--port',"$MobilePort",'--strictPort') -WorkingDirectory (Join-Path $root 'CropDiseasesDetection_vue\mobile') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $work 'mobile.log') -RedirectStandardError (Join-Path $work 'mobile-error.log')
  @{backendPid=$backend.Id;webPid=$web.Id;mobilePid=$mobile.Id;backend="http://127.0.0.1:$BackendPort";web="http://127.0.0.1:$WebPort";mobile="http://127.0.0.1:$MobilePort";username='admin';password=$password;database='isolated in-memory preview, not production'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $work 'runtime.json') -Encoding UTF8
  Write-Output "Preview web: http://127.0.0.1:$WebPort"
  Write-Output "Preview mobile: http://127.0.0.1:$MobilePort"
} finally {
  $env:SHUYANG_ADMIN_PASSWORD=$previousPassword
  $env:SHUYANG_DB_URL=$previousDb
  $env:SHUYANG_PORT=$previousPort
  $env:VITE_API_PROXY_TARGET=$previousProxy
}
