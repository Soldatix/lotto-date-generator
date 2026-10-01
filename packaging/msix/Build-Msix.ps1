[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedCommit,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedExeSha256
)

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$manifest = Join-Path $PSScriptRoot "AppxManifest.xml"
$exe = Join-Path $repo "src-tauri\target\release\date-lotto-generator.exe"
$iconDir = Join-Path $repo "src-tauri\icons"

Write-Host "`n=== MSIX BUILD PREFLIGHT ===" -ForegroundColor Cyan

$head = (git -C $repo rev-parse --short=7 HEAD).Trim()

if ($LASTEXITCODE -ne 0 -or $head -ne $ExpectedCommit) {
    throw "UNEXPECTED GIT COMMIT - STOP"
}

if (@(git -C $repo diff --name-only).Count -ne 0 -or
    @(git -C $repo diff --cached --name-only).Count -ne 0) {
    throw "TRACKED SOURCE CHANGES - STOP"
}

$allowed = @(
    "packaging/msix/AppxManifest.xml",
    "packaging/msix/Build-Msix.ps1"
)

$untracked = @(git -C $repo ls-files --others --exclude-standard)

$unexpected = @($untracked | Where-Object { $_ -notin $allowed })

if ($unexpected.Count -ne 0) {
    throw "UNEXPECTED UNTRACKED FILES - STOP"
}

foreach ($path in @($manifest, $exe)) {
    if (-not (Test-Path $path)) {
        throw "MISSING REQUIRED FILE: $path"
    }
}

if ($ExpectedExeSha256 -notmatch '^[0-9a-fA-F]{64}$') {
    throw "INVALID EXPECTED EXE SHA256"
}

$exeHash = (Get-FileHash $exe -Algorithm SHA256).Hash

if ($exeHash -ne $ExpectedExeSha256) {
    throw "RELEASE EXE HASH MISMATCH - STOP"
}

[xml]$xml = Get-Content $manifest -Raw
$id = $xml.Package.Identity

if ($id.Name -ne "Soldatix.DateLottoGenerator" -or
    $id.Publisher -ne "CN=AD206FDB-4EAC-4060-8F05-FC95B75B6C61" -or
    $id.ProcessorArchitecture -ne "x64" -or
    $id.Version -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "INVALID STORE PACKAGE IDENTITY"
}

if ($xml.Package.Applications.Application.Executable -ne
    "date-lotto-generator.exe") {
    throw "UNEXPECTED APPLICATION EXECUTABLE"
}

$sdkBin = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"

$sdkTools = @(
    Get-ChildItem $sdkBin -Recurse -Filter "makeappx.exe" `
        -File -ErrorAction SilentlyContinue |
    Where-Object { $_.DirectoryName -match '\\x64$' } |
    Sort-Object { [version]$_.Directory.Parent.Name } -Descending
)

if ($sdkTools.Count -eq 0) {
    throw "X64 MAKEAPPX NOT FOUND"
}

$makeAppx = $sdkTools[0].FullName

$names = @(
    "StoreLogo.png",
    "Square44x44Logo.png",
    "Square150x150Logo.png"
)

foreach ($name in $names) {
    if (-not (Test-Path (Join-Path $iconDir $name))) {
        throw "MISSING ICON: $name"
    }
}

Write-Host "Commit: $head"
Write-Host "EXE SHA256: $exeHash"
Write-Host "SDK tool: $makeAppx"
Write-Host "Preflight PASS"

Write-Host "`n=== CREATE PACKAGE ===" -ForegroundColor Cyan

$outputRoot = Join-Path $env:LOCALAPPDATA "DateLotto-MSIX-Builds"

$buildName = "candidate-$head-" +
    (Get-Date -Format "yyyyMMdd-HHmmss-fff")

$root = Join-Path $outputRoot $buildName
$stage = Join-Path $root "staging"
$assets = Join-Path $stage "Assets"
$inspect = Join-Path $root "inspection"

$filename = "{0}_{1}_{2}.msix" -f `
    $id.Name, $id.Version, $id.ProcessorArchitecture

$package = Join-Path $root $filename

if (Test-Path $root) {
    throw "OUTPUT DIRECTORY ALREADY EXISTS - STOP"
}

New-Item -ItemType Directory -Path $assets -Force | Out-Null

Copy-Item $exe (Join-Path $stage "date-lotto-generator.exe")
Copy-Item $manifest (Join-Path $stage "AppxManifest.xml")

foreach ($name in $names) {
    Copy-Item (Join-Path $iconDir $name) `
        (Join-Path $assets $name)
}

& $makeAppx pack /d $stage /p $package

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $package)) {
    throw "MSIX PACK FAILED"
}

Write-Host "`n=== VERIFY PACKAGE ===" -ForegroundColor Cyan

& $makeAppx unpack /p $package /d $inspect

if ($LASTEXITCODE -ne 0) {
    throw "MSIX UNPACK FAILED"
}

$packedExe = Join-Path $inspect "date-lotto-generator.exe"
$packedManifest = Join-Path $inspect "AppxManifest.xml"

if ((Get-FileHash $packedExe -Algorithm SHA256).Hash -ne
    $exeHash) {
    throw "PACKAGED EXE HASH MISMATCH"
}

if ((Get-FileHash $packedManifest -Algorithm SHA256).Hash -ne
    (Get-FileHash $manifest -Algorithm SHA256).Hash) {
    throw "PACKAGED MANIFEST HASH MISMATCH"
}

foreach ($name in $names) {
    $original = Join-Path $iconDir $name
    $packed = Join-Path $inspect "Assets\$name"

    if (-not (Test-Path $packed)) {
        throw "MISSING PACKAGED ICON: $name"
    }

    if ((Get-FileHash $original).Hash -ne
        (Get-FileHash $packed).Hash) {
        throw "PACKAGED ICON HASH MISMATCH: $name"
    }
}

Write-Host "`n=== MSIX BUILD AND VALIDATION PASS ===" `
    -ForegroundColor Green

Get-Item $package |
    Format-List FullName, Length, LastWriteTime

Get-FileHash $package -Algorithm SHA256 |
    Format-List Algorithm, Hash

Write-Host "Commit: $head"
Write-Host "Unsigned package; no installation or publishing."