# Package only public static files. Generated pages come from the current sitemap,
# so a removed diary does not accidentally stay published from an older snapshot.
$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path $PSScriptRoot -Parent
$outputPath = Join-Path $siteRoot '_site'
if (Test-Path -LiteralPath $outputPath) { throw '_site already exists; use a fresh output directory.' }
[void][IO.Directory]::CreateDirectory($outputPath)
$rootAssets = Get-ChildItem -LiteralPath $siteRoot -File | Where-Object {
    $_.Extension -in @('.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg', '.txt', '.xml') -or $_.Name -eq 'CNAME'
}
foreach ($file in $rootAssets) { Copy-Item -LiteralPath $file.FullName -Destination $outputPath }
foreach ($directory in @('database', 'picture')) {
    Copy-Item -LiteralPath (Join-Path $siteRoot $directory) -Destination $outputPath -Recurse
}
$sitemap = [xml][IO.File]::ReadAllText((Join-Path $siteRoot 'sitemap.xml'))
$homeHtml = [IO.File]::ReadAllText((Join-Path $siteRoot 'index.html'))
$siteUrl = [uri][regex]::Match($homeHtml, 'rel="canonical" href="([^"]+)"').Groups[1].Value
foreach ($entry in $sitemap.urlset.url) {
    $relative = $siteUrl.MakeRelativeUri([uri][string]$entry.loc).ToString()
    if (!$relative) { $relative = 'index.html' }
    $destination = Join-Path $outputPath $relative
    [void][IO.Directory]::CreateDirectory((Split-Path $destination -Parent))
    Copy-Item -LiteralPath (Join-Path $siteRoot $relative) -Destination $destination
}
[IO.File]::WriteAllText((Join-Path $outputPath '.nojekyll'), '')
Write-Output 'Prepared _site with static HTML, scripts, styles, diary sources and photos.'
