param([string]$Name='shuyang-home-20261028-r4')
$ErrorActionPreference='Stop'
if ($Name -notmatch '^[a-z0-9-]+$') {throw 'Package name must contain lowercase letters, digits and hyphens only.'}
$root=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$folder=Join-Path $root ('release\'+$Name)
if(Test-Path -LiteralPath $folder){throw 'Package directory already exists; choose a new name.'}
$sources=@{
 'backend'='CropDiseasesDetection_springboot\target\shuyang-home-1.0.0.jar'
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
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $folder
$lines=Get-ChildItem -LiteralPath $folder -Recurse -File | ForEach-Object { $relative=$_.FullName.Substring($folder.Length+1).Replace('\','/'); (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()+'  '+$relative }
$lines | Set-Content -LiteralPath (Join-Path $folder 'SHA256SUMS') -Encoding UTF8
Compress-Archive -LiteralPath $folder -DestinationPath ($folder+'.zip') -CompressionLevel Optimal
Get-FileHash -LiteralPath ($folder+'.zip') -Algorithm SHA256 | Format-List
