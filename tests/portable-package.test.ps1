# Tests the packaging and checksum mechanism with a synthetic PE header.
# The synthetic file is intentionally NOT a runnable app; real GUI testing is a release gate.
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packer = Join-Path $repo "packaging\portable\Build-Portable.ps1"
$tokens = $null
$parseErrors = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile($packer, [ref]$tokens, [ref]$parseErrors)
if (@($parseErrors).Count -gt 0) {
    throw "PACKAGER POWERSHELL SYNTAX CHECK FAILED: $($parseErrors | Out-String)"
}

$root = Join-Path $env:TEMP ("lotto-portable-check-" + [guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $exe = Join-Path $root "date-lotto-generator.exe"
    $bytes = New-Object byte[] (1MB + 4096)
    [BitConverter]::GetBytes([uint16]0x5A4D).CopyTo($bytes, 0)
    [BitConverter]::GetBytes([int]0x80).CopyTo($bytes, 0x3C)
    [BitConverter]::GetBytes([uint32]0x00004550).CopyTo($bytes, 0x80)
    [BitConverter]::GetBytes([uint16]0x8664).CopyTo($bytes, 0x84)
    [IO.File]::WriteAllBytes($exe, $bytes)
    $hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash

    $wrong = "0" * 64
    if ($wrong -eq $hash) { $wrong = "1" * 64 }
    $rejected = $false
    try {
        & $packer -ExePath $exe -OutputDirectory (Join-Path $root "invalid") -ExpectedExeSha256 $wrong | Out-Null
    } catch { $rejected = $_.Exception.Message -match 'MISMATCH' }
    if (-not $rejected) { throw "WRONG HASH WAS NOT REJECTED" }

    $output = Join-Path $root "release"
    & $packer -ExePath $exe -OutputDirectory $output -ExpectedExeSha256 $hash | Out-Null
    $zip = Join-Path $output "Date-Lotto-Generator-Windows-Portable-1.0.2-x64.zip"
    if (-not (Test-Path -LiteralPath $zip -PathType Leaf)) { throw "ZIP MISSING" }
    $sum = "$zip.sha256"
    if (-not (Test-Path -LiteralPath $sum -PathType Leaf)) { throw "ZIP CHECKSUM MISSING" }
    $expectedChecksum = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
    if (-not ((Get-Content -LiteralPath $sum -Raw).Contains($expectedChecksum))) {
        throw "ZIP CHECKSUM MISMATCH"
    }

    $rejected = $false
    try {
        & $packer -ExePath $exe -OutputDirectory $output -ExpectedExeSha256 $hash | Out-Null
    } catch { $rejected = $_.Exception.Message -match 'ALREADY EXISTS' }
    if (-not $rejected) { throw "EXISTING ZIP WAS NOT PROTECTED" }

    $bytes[0x84] = 0x4C
    $bytes[0x85] = 0x01
    [IO.File]::WriteAllBytes($exe, $bytes)
    $rejected = $false
    try {
        & $packer -ExePath $exe -OutputDirectory (Join-Path $root "wrong-architecture") | Out-Null
    } catch { $rejected = $_.Exception.Message -match 'NOT A WINDOWS X64' }
    if (-not $rejected) { throw "NON-X64 PE WAS NOT REJECTED" }

    Write-Host "PASS: PowerShell parsing, x64 ZIP, EXE/ZIP SHA256, wrong-hash/arch and overwrite guards" -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
