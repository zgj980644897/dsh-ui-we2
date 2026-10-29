<#
.SYNOPSIS
    Update the WE2 console skin to the latest published version and reinstall it.

.DESCRIPTION
    Works for both ways this folder is distributed:

      * a git clone — `git pull --ff-only` in this folder, so local history stays clean;
      * a ZIP download — fetches the latest branch archive from GitHub and copies it
        over this folder.

    Afterwards it runs install.ps1 so the profile's `node_modules` copy is replaced,
    prints the version change, and asks for a restart.

    Double-click update.cmd for the same flow with a console that stays open.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\update.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\update.ps1 -Profile web -NoRestartPrompt
#>
param(
    [string]$DshHome = $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }),
    [string]$Profile = 'desktop',
    [switch]$NoRestartPrompt
)

$ErrorActionPreference = 'Stop'

$source = $PSScriptRoot
$repository = 'zgj980644897/dsh-ui-we2'
$branch = 'main'

function Read-Version([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    try { return (Get-Content $path -Raw -Encoding utf8 | ConvertFrom-Json).version } catch { return $null }
}

$installedManifest = Join-Path (Join-Path (Join-Path (Join-Path $DshHome 'profiles') $Profile) 'node_modules\dsh-ui-we2') 'package.json'
$before = Read-Version $installedManifest

$pulled = $false
$git = Get-Command git -ErrorAction SilentlyContinue
if ((Test-Path (Join-Path $source '.git')) -and $null -ne $git) {
    Write-Host 'fetching the latest changes with git...'
    & $git.Source -C $source pull --ff-only 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -eq 0) {
        $pulled = $true
    } else {
        Write-Warning 'git pull failed; falling back to a ZIP download.'
    }
}

if (-not $pulled) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $zip = Join-Path $env:TEMP ('we2-{0}.zip' -f [guid]::NewGuid().ToString('N'))
    $extract = Join-Path $env:TEMP ('we2-{0}' -f [guid]::NewGuid().ToString('N'))
    $url = "https://github.com/$repository/archive/refs/heads/$branch.zip"
    Write-Host "downloading $url"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $root = Get-ChildItem $extract -Directory | Select-Object -First 1
    if ($null -eq $root) { throw 'the downloaded archive is empty' }
    Get-ChildItem -Force $root.FullName | Copy-Item -Destination $source -Recurse -Force
    Remove-Item $zip -Force
    Remove-Item $extract -Recurse -Force
}

$after = Read-Version (Join-Path $source 'package.json')
$from = if ($null -eq $before) { 'not installed' } else { $before }
$to = if ($null -eq $after) { 'unknown' } else { $after }
Write-Host ("version: {0} -> {1}" -f $from, $to)

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $source 'install.ps1') -DshHome $DshHome -Profile $Profile
if ($LASTEXITCODE -ne 0) { throw "install.ps1 failed with exit code $LASTEXITCODE" }

Write-Host ''
Write-Host 'Updated. Restart DeepSeek Harness to load the new version.'
if (-not $NoRestartPrompt -and $Host.Name -eq 'ConsoleHost') {
    Write-Host 'Press Enter to close...'
    [void][Console]::ReadLine()
}
