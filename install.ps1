<#
.SYNOPSIS
    Install the WE2 console skin into a DeepSeek Harness profile.

.DESCRIPTION
    Copies the built package into <dsh-home>/profiles/<profile>/node_modules,
    declares it in that profile's package.json dependencies (the Loader only
    resolves declared packages), and mounts it from the profile's
    cordis.patch.yml between marker comments.

    Every rewritten file is written as BOM-less UTF-8 and validated afterwards:
    Windows PowerShell 5.1's `Set-Content -Encoding utf8` emits a BOM, and a BOM
    in the profile package.json makes the Host fail at startup with
    "Unexpected token". Both files are backed up before their first change.

    Run with -Uninstall to remove the mount block, the dependency entry, and
    the copied package.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File install.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File install.ps1 -Profile web -Uninstall
#>
param(
    [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
    [string]$Profile = 'desktop',
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$source = $PSScriptRoot
$profileDir = Join-Path (Join-Path $DshHome 'profiles') $Profile
$patchPath = Join-Path $profileDir 'cordis.patch.yml'
$manifestPath = Join-Path $profileDir 'package.json'
$target = Join-Path (Join-Path $profileDir 'node_modules') 'dsh-ui-we2'
$begin = '# >>> dsh-ui-we2 >>>'
$end = '# <<< dsh-ui-we2 <<<'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $profileDir)) { throw "Profile not found: $profileDir" }
if (-not (Test-Path $patchPath)) { throw "Profile patch not found: $patchPath" }
if (-not (Test-Path $manifestPath)) { throw "Profile manifest not found: $manifestPath" }

function Read-Text([string]$path) {
    # -Encoding utf8 strips a BOM if an earlier writer left one.
    return Get-Content $path -Raw -Encoding utf8
}

function Write-Utf8NoBom([string]$path, [string]$text) {
    [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

function Test-Utf8Bom([string]$path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    return ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
}

if ($Uninstall) {
    if (Test-Path $target) {
        Remove-Item $target -Recurse -Force
        Write-Host "removed $target"
    }

    $kept = New-Object System.Collections.Generic.List[string]
    $inside = $false
    foreach ($line in (Get-Content $patchPath -Encoding utf8)) {
        if ($line.Trim() -eq $begin) { $inside = $true; continue }
        if ($line.Trim() -eq $end) { $inside = $false; continue }
        if (-not $inside) { $kept.Add($line) }
    }
    Write-Utf8NoBom $patchPath (($kept -join "`n") + "`n")
    Write-Host "unmounted from $patchPath"

    $manifestText = Read-Text $manifestPath
    if ($manifestText -match '"dsh-ui-we2"') {
        Copy-Item $manifestPath "$manifestPath.$stamp.bak"
        $next = [regex]::Replace($manifestText, '\s*"dsh-ui-we2"\s*:\s*"[^"]*",?', '')
        $next | ConvertFrom-Json | Out-Null
        Write-Utf8NoBom $manifestPath $next
        Write-Host "removed the dsh-ui-we2 dependency entry"
    }

    Write-Host 'Restart DeepSeek Harness to unload the skin.'
    return
}

if (-not (Test-Path (Join-Path $source 'lib/client.js'))) {
    throw "lib/client.js is missing. Run 'node scripts/build.mjs' first."
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach ($item in @('index.js', 'package.json', 'cordis.patch.yml', 'README.md', 'lib')) {
    Copy-Item (Join-Path $source $item) (Join-Path $target $item) -Recurse -Force
}
Write-Host "installed $target"

# The Loader only resolves packages the profile manifest declares.
$manifestText = Read-Text $manifestPath
$needsEntry = $manifestText -notmatch '"dsh-ui-we2"'
$hasBom = Test-Utf8Bom $manifestPath
if ($needsEntry -or $hasBom) {
    Copy-Item $manifestPath "$manifestPath.$stamp.bak"
    if ($needsEntry) {
        $anchor = '"dependencies": {'
        $index = $manifestText.IndexOf($anchor)
        if ($index -lt 0) {
            throw "No `"dependencies`" block in $manifestPath; add `"dsh-ui-we2`": `"link:$($source -replace '\\','/')`" by hand."
        }
        $link = 'link:' + ($source -replace '\\', '/')
        # A fresh profile usually has an empty "dependencies": {} block; there a
        # trailing comma would be invalid JSON, so the separator depends on
        # whether the object already has members.
        $tail = $manifestText.Substring($index + $anchor.Length)
        $empty = [regex]::IsMatch($tail, '^\s*\}')
        $separator = if ($empty) { '' } else { ',' }
        $entry = "`n    `"dsh-ui-we2`": `"$link`"$separator"
        $manifestText = $manifestText.Insert($index + $anchor.Length, $entry)
    }
    $manifestText | ConvertFrom-Json | Out-Null
    Write-Utf8NoBom $manifestPath $manifestText
    if ($hasBom -and -not $needsEntry) { Write-Host "stripped the UTF-8 BOM from $manifestPath" }
    else { Write-Host "declared dsh-ui-we2 in $manifestPath" }
} else {
    Write-Host "dsh-ui-we2 already declared in $manifestPath"
}

$text = Read-Text $patchPath
if ($text -notmatch [regex]::Escape($begin)) {
    Copy-Item $patchPath "$patchPath.$stamp.bak"
    if (-not $text.EndsWith("`n")) { $text += "`n" }
    $block = @(
        $begin
        '- insert:'
        '    - id: ui-we2'
        '      name: dsh-ui-we2'
        $end
        ''
    ) -join "`n"
    Write-Utf8NoBom $patchPath ($text + $block)
    Write-Host "mounted in $patchPath"
} else {
    Write-Host "already mounted in $patchPath"
}

foreach ($path in @($manifestPath, $patchPath)) {
    if (Test-Utf8Bom $path) { throw "Wrote a BOM into $path; the Host would fail to boot." }
}
Write-Host 'Restart DeepSeek Harness to load the skin.'
