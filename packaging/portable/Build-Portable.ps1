# Create a verifiable ZIP from an EXISTING Windows x64 release executable.
# Never compiles source, modifies EXE, signs files or publishes a release.
[CmdletBinding()]
param(
    [string]$ExePath = "",
    [string]$OutputDirectory = "",
    [string]$ExpectedExeSha256 = ""
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$pkg = Get-Content (Join-Path $repo "package.json") -Raw | ConvertFrom-Json
$config = Get-Content (Join-Path $repo "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$version = [string]$pkg.version
if ($version -ne "1.0.2" -or [string]$config.version -ne $version) {
    throw "VERSION MISMATCH - STOP: expected Windows source version 1.0.2"
}
if ($config.identifier -ne "org.appsandgames.datelottogenerator" -or $config.bundle.active -ne $false) {
    throw "UNEXPECTED TAURI CONFIGURATION - STOP"
}

if (-not $ExePath) {
    $ExePath = Join-Path $repo "src-tauri\target\release\date-lotto-generator.exe"
}
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repo "release-candidates"
}
if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
    throw "RELEASE EXECUTABLE NOT FOUND: $ExePath"
}
$exe = (Resolve-Path -LiteralPath $ExePath).Path
if ([IO.Path]::GetFileName($exe) -ne "date-lotto-generator.exe") {
    throw "UNEXPECTED EXECUTABLE NAME - STOP"
}
if ((Get-Item -LiteralPath $exe).Length -lt 1MB) {
    throw "RELEASE EXECUTABLE TOO SMALL - STOP"
}

# Validate MZ/PE and AMD64 machine type before packaging.
$stream = [IO.File]::OpenRead($exe)
$reader = [IO.BinaryReader]::new($stream)
try {
    if ($reader.ReadUInt16() -ne 0x5A4D) { throw "NOT A WINDOWS PE EXECUTABLE - STOP" }
    $stream.Position = 0x3C
    $offset = $reader.ReadInt32()
    if ($offset -lt 0x40 -or $offset -gt ($stream.Length - 6)) {
        throw "INVALID PE OFFSET - STOP"
    }
    $stream.Position = $offset
    if ($reader.ReadUInt32() -ne 0x00004550) { throw "INVALID PE SIGNATURE - STOP" }
    if ($reader.ReadUInt16() -ne 0x8664) { throw "NOT A WINDOWS X64 EXECUTABLE - STOP" }
} finally {
    $reader.Dispose()
}

$exeSha = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToUpperInvariant()
if ($ExpectedExeSha256) {
    if ($ExpectedExeSha256 -notmatch '^[0-9a-fA-F]{64}$' -or
        $exeSha -ne $ExpectedExeSha256.ToUpperInvariant()) {
        throw "EXECUTABLE SHA256 MISMATCH - STOP"
    }
}

$base = "Date-Lotto-Generator-Windows-Portable-$version-x64"
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
$zip = Join-Path $output "$base.zip"
$checksum = "$zip.sha256"
if ((Test-Path -LiteralPath $zip) -or (Test-Path -LiteralPath $checksum)) {
    throw "OUTPUT ALREADY EXISTS - STOP: $zip"
}
$stage = Join-Path $output ("portable-stage-" + [guid]::NewGuid().ToString("N"))
$verify = Join-Path $output ("portable-verify-" + [guid]::NewGuid().ToString("N"))
$created = $false

try {
    New-Item -ItemType Directory -Path $stage, $verify -Force | Out-Null
    Copy-Item -LiteralPath $exe -Destination (Join-Path $stage "date-lotto-generator.exe")
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "README-PORTABLE.txt") -Destination (Join-Path $stage "README-PORTABLE.txt")
    "$exeSha *date-lotto-generator.exe" | Set-Content -LiteralPath (Join-Path $stage "SHA256SUMS.txt") -Encoding ascii
    if ((Get-FileHash (Join-Path $stage "date-lotto-generator.exe") -Algorithm SHA256).Hash -ne $exeSha) {
        throw "STAGED EXECUTABLE HASH MISMATCH - STOP"
    }

    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal
    $created = $true
    Expand-Archive -LiteralPath $zip -DestinationPath $verify -ErrorAction Stop
    $names = @(Get-ChildItem -LiteralPath $verify -File | Select-Object -ExpandProperty Name | Sort-Object)
    $expected = @("date-lotto-generator.exe", "README-PORTABLE.txt", "SHA256SUMS.txt" | Sort-Object)
    if (($names -join "|") -ne ($expected -join "|")) {
        throw "UNEXPECTED ZIP CONTENTS - STOP"
    }
    if ((Get-FileHash (Join-Path $verify "date-lotto-generator.exe") -Algorithm SHA256).Hash -ne $exeSha) {
        throw "UNPACKED EXECUTABLE HASH MISMATCH - STOP"
    }
    $zipSha = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToUpperInvariant()
    "$zipSha *$base.zip" | Set-Content -LiteralPath $checksum -Encoding ascii
} catch {
    if ($created -and (Test-Path -LiteralPath $zip)) { Remove-Item -LiteralPath $zip -Force }
    if (Test-Path -LiteralPath $checksum) { Remove-Item -LiteralPath $checksum -Force }
    throw
} finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    if (Test-Path -LiteralPath $verify) { Remove-Item -LiteralPath $verify -Recurse -Force }
}

Write-Host "PORTABLE ZIP AND SHA256 VERIFICATION: PASS" -ForegroundColor Green
Write-Host "Archive: $zip"
Write-Host "ZIP SHA256: $zipSha"
Write-Host "EXE SHA256: $exeSha"
Write-Host "EXE signature: $((Get-AuthenticodeSignature -LiteralPath $exe).Status)"
Write-Host "GUI startup and backup/restore require a separate Windows smoke test."
