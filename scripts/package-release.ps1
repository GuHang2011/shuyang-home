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
 'backend'="CropDiseasesDetection_springboot\target\shuyang-home-$releaseVersion.jar"
 'web'='CropDiseasesDetection_vue\dist'
 'mobile-h5'='CropDiseasesDetection_vue\mobile\dist\build\h5'
 'wechat-dev-build'='CropDiseasesDetection_vue\mobile\dist\build\mp-weixin'
 'docs'='docs'
 'config'='deploy'
}
foreach($item in $sources.GetEnumerator()) {if(-not(Test-Path -LiteralPath (Join-Path $root $item.Value))){throw ('Missing build: '+$item.Value)}}
New-Item -ItemType Directory -Path $folder -Force | Out-Null
foreach($item in $sources.GetEnumerator()) {
  $source=Join-Path $root $item.Value
  $target=Join-Path $folder $item.Key
  if((Get-Item -LiteralPath $source).PSIsContainer){Copy-Item -LiteralPath $source -Destination $target -Recurse}
  else {New-Item -ItemType Directory -Path $target -Force | Out-Null;Copy-Item -LiteralPath $source -Destination $target}
}
foreach($file in @('README.md','VERSION','CHANGELOG.md')) {Copy-Item -LiteralPath (Join-Path $root $file) -Destination $folder}
$lines=Get-ChildItem -LiteralPath $folder -Recurse -File | ForEach-Object { $relative=$_.FullName.Substring($folder.Length+1).Replace('\','/'); (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()+'  '+$relative }
$lines | Set-Content -LiteralPath (Join-Path $folder 'SHA256SUMS') -Encoding UTF8
Compress-Archive -LiteralPath $folder -DestinationPath ($folder+'.zip') -CompressionLevel Optimal
Get-FileHash -LiteralPath ($folder+'.zip') -Algorithm SHA256 | Format-List
