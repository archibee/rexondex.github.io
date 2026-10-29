$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$existing = git -C $repoRoot config --local --get core.hooksPath
if ($existing -and $existing -ne '.githooks') { throw "Existing hooksPath is $existing; not replacing it." }
$defaultHook = git -C $repoRoot rev-parse --git-path hooks/pre-commit
if (!$existing -and (Test-Path -LiteralPath (Join-Path $repoRoot $defaultHook))) { throw 'An existing pre-commit hook is installed; not replacing it.' }
if ($env:OS -ne 'Windows_NT') {
    & chmod +x (Join-Path $repoRoot '.githooks/pre-commit')
    if ($LASTEXITCODE -ne 0) { throw 'Unable to make the hook executable.' }
}
git -C $repoRoot config --local core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) { throw 'Unable to configure the local Git hook.' }
Write-Output 'Installed local SEO pre-commit automation. Commit and push normally.'
