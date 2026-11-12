param([string]$Name='')
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$releaseVersion=(Get-Content -LiteralPath (Join-Path $root 'VERSION') -Raw -Encoding UTF8).Trim()
& python (Join-Path $PSScriptRoot 'version.py') check
if ($LASTEXITCODE -ne 0) {throw 'Version consistency check failed.'}
if (-not $Name) {$Name="shuyang-home-v$releaseVersion"}
if ($Name -notmatch '^[a-z0-9][a-z0-9.-]*$') {throw 'Package name must contain lowercase letters, digits, dots and hyphens only.'}
$folder=Join-Path $root ('release\'+$Name)
if((Test-Path -LiteralPath $folder) -or (Test-Path -LiteralPath ($folder+'.zip'))){throw 'Package already exists; do not overwrite a released version.'}
$sources=@{
 'backend'="backend\target\shuyang-home-$releaseVersion.jar"
 'web'='frontend\dist'
 'mobile-h5'='frontend\mobile\dist\build\h5'
 'wechat-dev-build'='frontend\mobile\dist\build\mp-weixin'
 'docs'='docs'
 'config'='deploy'
}
foreach($item in $sources.GetEnumerator()) {if(-not(Test-Path -LiteralPath (Join-Path $root $item.Value))){throw ('Missing build: '+$item.Value)}}
foreach($client in @('web','mobile-h5','wechat-dev-build')) {
  $metadata=Get-Content -LiteralPath (Join-Path (Join-Path $root $sources[$client]) 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($metadata.version -ne $releaseVersion -or $metadata.demo -ne $false) {throw ('Stale or demo build: '+$client+'. Rebuild before packaging.')}
}
New-Item -ItemType Directory -Path $folder -Force | Out-Null
foreach($item in $sources.GetEnumerator()) {
  $source=Join-Path $root $item.Value
  $target=Join-Path $folder $item.Key
  if((Get-Item -LiteralPath $source).PSIsContainer){Copy-Item -LiteralPath $source -Destination $target -Recurse}
  else {New-Item -ItemType Directory -Path $target -Force | Out-Null;Copy-Item -LiteralPath $source -Destination $target}
}
foreach($file in @('README.md','VERSION','CHANGELOG.md')) {Copy-Item -LiteralPath (Join-Path $root $file) -Destination $folder}
$toolsFolder=Join-Path $folder 'tools'
New-Item -ItemType Directory -Path $toolsFolder -Force | Out-Null
foreach($tool in @('create-production-config.py','check-deployment.py')) {Copy-Item -LiteralPath (Join-Path $PSScriptRoot $tool) -Destination $toolsFolder}
$webIndex=Get-Content -LiteralPath (Join-Path $folder 'web/index.html') -Raw -Encoding UTF8
if (Test-Path -LiteralPath (Join-Path $folder 'web/demo-worker.js')) {throw 'Refusing to package a demo build as the production website.'}
if ($webIndex -match 'localhost:|127\.0\.0\.1:') {throw 'Production HTML must not reference a local development server.'}
$lines=Get-ChildItem -LiteralPath $folder -Recurse -File | ForEach-Object { $relative=$_.FullName.Substring($folder.Length+1).Replace('\','/'); (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()+'  '+$relative }
[IO.File]::WriteAllText((Join-Path $folder 'SHA256SUMS'), ([string]::Join("`n",$lines)+"`n"), [Text.UTF8Encoding]::new($false))
Compress-Archive -LiteralPath $folder -DestinationPath ($folder+'.zip') -CompressionLevel Optimal
$archiveHash=(Get-FileHash -LiteralPath ($folder+'.zip') -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText(($folder+'.zip.sha256'), ($archiveHash+'  '+$Name+".zip`n"), [Text.UTF8Encoding]::new($false))
Write-Output ('Package: '+$folder+'.zip')
Write-Output ('SHA256: '+$archiveHash)
