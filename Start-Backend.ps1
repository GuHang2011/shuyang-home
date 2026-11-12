param([switch]$Build, [switch]$InitializeAdmin)
$ErrorActionPreference = 'Stop'
$releaseVersion = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'VERSION') -Raw -Encoding UTF8).Trim()
if ($releaseVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid VERSION file.' }
$backendJar = "target\shuyang-home-$releaseVersion.jar"
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'backend')
if (-not $env:JAVA_HOME) {
  throw 'Install JDK 21 and set JAVA_HOME to its directory before starting the backend.'
}
$java = Join-Path $env:JAVA_HOME 'bin\java.exe'
try { $javaVersion = (& $java --version 2>&1 | Out-String) }
catch { throw 'JDK 21 or newer is required. Check JAVA_HOME.' }
if ($javaVersion -notmatch '(?:openjdk|java) (\d+)' -or [int]$Matches[1] -lt 21) { throw 'JDK 21 or newer is required. Java 8 cannot run this release.' }
if ($Build -or -not (Test-Path -LiteralPath $backendJar)) {
  $buildOptions = @('clean', 'package')
  $cachedRepository = Join-Path $PSScriptRoot '.cache\m2'
  $cachedTrust = Join-Path $PSScriptRoot '.cache\java-cacerts'
  if (Test-Path -LiteralPath $cachedRepository) { $buildOptions += ('-Dmaven.repo.local=' + $cachedRepository) }
  $previousMavenOptions = $env:MAVEN_OPTS
  try {
    if (Test-Path -LiteralPath $cachedTrust) { $env:MAVEN_OPTS = $previousMavenOptions + ' "-Djavax.net.ssl.trustStore=' + $cachedTrust + '" -Djavax.net.ssl.trustStorePassword=changeit' }
    & .\mvnw.cmd @buildOptions
    $buildExitCode = $LASTEXITCODE
  } finally { $env:MAVEN_OPTS = $previousMavenOptions }
  if ($buildExitCode -ne 0) { throw 'Backend build failed. Check JAVA_HOME and Maven connectivity.' }
}
$previousPassword = $env:SHUYANG_ADMIN_PASSWORD
$databaseUrl = if ($env:SHUYANG_DB_URL) { $env:SHUYANG_DB_URL } else { 'jdbc:h2:file:./data/shuyang-home;DB_CLOSE_ON_EXIT=FALSE' }
$newFileDatabase = $false
if ($databaseUrl.StartsWith('jdbc:h2:file:')) {
  $databasePath = ($databaseUrl.Substring('jdbc:h2:file:'.Length) -split ';', 2)[0]
  if ($databasePath.StartsWith('~/')) { $databasePath = Join-Path ([Environment]::GetFolderPath('UserProfile')) $databasePath.Substring(2) }
  $newFileDatabase = -not ((Test-Path -LiteralPath ($databasePath + '.mv.db')) -or (Test-Path -LiteralPath ($databasePath + '.h2.db')))
}
if (-not $env:SHUYANG_ADMIN_PASSWORD -and ($InitializeAdmin -or $newFileDatabase)) {
  $securePassword = Read-Host 'Initial admin password (12+ characters, letters and digits; changed on first login)' -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try { $env:SHUYANG_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
}
try {
  if ($env:JAVA_HOME) { & (Join-Path $env:JAVA_HOME 'bin\java.exe') -jar $backendJar }
  else { & java -jar $backendJar }
  if ($LASTEXITCODE -ne 0) { throw 'Backend stopped with an error. Check the startup log, data paths and keys.' }
} finally { $env:SHUYANG_ADMIN_PASSWORD = $previousPassword }
