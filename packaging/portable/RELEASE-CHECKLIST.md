# Windows Portable 1.0.2 x64 — release checklist

This packaging-only release uses an already tested Windows executable. It does not build Rust, modify the Store package, sign files or publish a release.

## Preflight

- Use the real date-lotto-generator.exe from the approved Windows x64 release build, not an unknown file.
- Record its SHA-256 and, if possible, compare it with the EXE contained in the tested MSIX.
- Check out factory/date-lotto-windows-portable-v1 in a dedicated worktree. The script validates version 1.0.2 and Tauri identity.
- Run the packaging script with its EXE source path and expected SHA-256.

## Package on Windows PowerShell

    $portableRepo = "E:\GitHub\lotto-date-generator-portable"
    $storeExe = "E:\GitHub\lotto-date-generator-windows\src-tauri\target\release\date-lotto-generator.exe"
    $sha = (Get-FileHash -LiteralPath $storeExe -Algorithm SHA256).Hash
    & "$portableRepo\packaging\portable\Build-Portable.ps1" -ExePath $storeExe -ExpectedExeSha256 $sha

The ZIP and .zip.sha256 checksum are created under release-candidates. The packager refuses overwrites, rejects non-x64 and mismatched binaries, extracts the ZIP and checks its contents and the EXE SHA-256.

## Required real Windows smoke checks

1. Export a backup from any important existing Date Lotto installation.
2. Extract the ZIP into a separate writable folder, then run the EXE directly (not from inside the archive).
3. Test app startup, number generation, History/Save/Delete, five languages, all three themes, Settings, JSON Export/Import and Reset confirmation.
4. Verify that the installed Microsoft Store edition is unaffected.
5. If possible, test on a second Windows 10/11 x64 machine/account with WebView2 Runtime.
6. Compare published SHA-256 with the ZIP and document whether the EXE is signed.

## Publication gate

Publish the tested ZIP and its .zip.sha256 file as GitHub Release v1.0.2-portable only after the real Windows smoke check passes. Do not link an untested or nonexistent asset from the portal.

After the public asset URL is verified, add a separate Windows Portable card beside Web/PWA and Windows – Microsoft Store in Soldatix/apps-and-games. Localize it in EN, HR, DE, IT and ES and verify the live download URL.

This edition needs no installer, but its local app data can still reside in the Windows user profile. Use Settings Export/Import to move data between installations or machines.
