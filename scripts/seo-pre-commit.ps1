$ErrorActionPreference = 'Stop'
$repoRoot = (git rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0) { throw 'Not in a Git repository.' }
Set-Location -LiteralPath $repoRoot
$changed = @(git -c core.quotepath=false diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { throw 'Unable to read staged files.' }
if (!($changed | Where-Object { $_ -match '^(database/|picture/|pictures/|database\.js$|pictures\.js$|index\.html$|archive\.html$|pictures\.html$|sitemap\.xml$|scripts/(update-seo|manifest)\.ps1$)' })) { exit 0 }

# Export the index so unstaged edits are never swept into the commit.
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$snapshot = Join-Path $tempBase ('rexondex-seo-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($snapshot)
try {
    $prefix = $snapshot.Replace('\', '/') + '/'
    git checkout-index --all "--prefix=$prefix"
    if ($LASTEXITCODE -ne 0) { throw 'Unable to export staged content.' }
    & (Join-Path $PSScriptRoot 'update-seo.ps1') -SiteRoot $snapshot
    $original = @{}
    foreach ($line in @(git ls-files --stage)) {
        if ($line -match '^([0-9]+) ([0-9a-f]+) 0\t(.+)$') { $original[$Matches[3]] = $Matches[2] }
    }
    $generated = @('index.html', 'archive.html', 'sitemap.xml', 'pictures.html')
    $generated += @(Get-ChildItem -LiteralPath (Join-Path $snapshot 'database') -Filter *.html -File | ForEach-Object { 'database/' + $_.Name })
    if (Test-Path -LiteralPath (Join-Path $snapshot 'pictures')) {
        $generated += @(Get-ChildItem -LiteralPath (Join-Path $snapshot 'pictures') -Filter *.html -File | ForEach-Object { 'pictures/' + $_.Name })
    }
    $updated = 0
    foreach ($relative in $generated) {
        $source = Join-Path $snapshot $relative
        if (!(Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $blob = git -c core.safecrlf=false hash-object -w "--path=$relative" -- $source
        if ($LASTEXITCODE -ne 0) { throw "Unable to hash $relative" }
        if ($original[$relative] -eq $blob) { continue }
        git diff --quiet -- $relative
        $hasUnstaged = $LASTEXITCODE -ne 0
        $destination = Join-Path $repoRoot $relative
        $canCopy = !$hasUnstaged -and ($original.ContainsKey($relative) -or !(Test-Path -LiteralPath $destination))
        git update-index --add --cacheinfo "100644,$blob,$relative"
        if ($LASTEXITCODE -ne 0) { throw "Unable to stage $relative" }
        if ($canCopy) {
            [void][IO.Directory]::CreateDirectory((Split-Path $destination -Parent))
            Copy-Item -LiteralPath $source -Destination $destination
        }
        $updated++
    }
    Write-Output "SEO: $updated generated files included in this commit."
} finally {
    $resolved = [IO.Path]::GetFullPath($snapshot)
    if ($resolved.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf) -match '^rexondex-seo-[0-9a-f]{32}$') {
        [IO.Directory]::Delete($resolved, $true)
    }
}
