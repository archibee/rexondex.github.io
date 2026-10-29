# Validate generated pages and the complete local link graph without dependencies.
$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path $PSScriptRoot -Parent
function Assert([bool]$condition, [string]$message) {
    if (!$condition) { throw $message }
}
function Read-SiteFile([string]$path) {
    [IO.File]::ReadAllText((Join-Path $siteRoot $path), [Text.Encoding]::UTF8)
}
$homeHtml = Read-SiteFile 'index.html'
$siteUrl = [uri]([regex]::Match($homeHtml, 'rel="canonical" href="([^"]+)"').Groups[1].Value)
$sitemap = [xml](Read-SiteFile 'sitemap.xml')
$locations = @($sitemap.urlset.url | ForEach-Object { [string]$_.loc })
Assert ($locations.Count -eq @($locations | Sort-Object -Unique).Count) 'Duplicate sitemap URLs.'
$diaryIds = @([regex]::Matches((Read-SiteFile 'database.js'), "(?m)^\s*'([0-9]{6})'\s*,?\s*$") | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$titles = @{}
$checkedLinks = 0
foreach ($location in $locations) {
    $uri = [uri]$location
    Assert (!$uri.Fragment -and !$uri.Query) "Non-canonical sitemap URL: $location"
    $relative = $siteUrl.MakeRelativeUri($uri).ToString()
    if (!$relative) { $relative = 'index.html' }
    Assert (Test-Path -LiteralPath (Join-Path $siteRoot $relative) -PathType Leaf) "Missing page: $relative"
    $html = Read-SiteFile $relative
    Assert (([regex]::Matches($html, '<link rel="canonical"')).Count -eq 1) "Expected one canonical: $relative"
    Assert ($html.Contains('rel="canonical" href="' + $location + '"')) "Wrong canonical: $relative"
    Assert ($html.Contains('property="og:url" content="' + $location + '"')) "Wrong sharing URL: $relative"
    Assert ($html.Contains('<meta name="robots" content="index, follow, max-image-preview:large">')) "Robots mismatch: $relative"
    Assert ($html.Contains('src="./legacy-links.js"')) "Legacy fallback missing: $relative"
    Assert (([regex]::Matches($html, '<h1\b')).Count -eq 1) "Expected one static heading: $relative"
    $title = [regex]::Match($html, '<title>(.*?)</title>').Groups[1].Value
    Assert ($title -and !$titles.ContainsKey($title)) "Empty or duplicate title: $relative"
    $titles[$title] = $true
    $structured = [regex]::Match($html, '(?s)<script type="application/ld\+json">(.*?)</script>').Groups[1].Value | ConvertFrom-Json
    if ($relative -match '^diary/([0-9]{6})\.html$') {
        $id = $Matches[1]
        Assert ($html.Contains('data-diary-id="' + $id + '"')) "Wrong diary state: $relative"
        Assert (([regex]::Matches($html, '<article\b')).Count -eq 1) "Expected one diary: $relative"
        $article = @($structured.'@graph' | Where-Object { $_.'@type' -eq 'BlogPosting' })
        Assert ($article.Count -eq 1 -and $article[0].mainEntityOfPage -eq $location) "Wrong article data: $relative"
        Assert ($html.Contains('<div class="post-content">')) "Static body missing: $relative"
    }
    $base = $uri
    $baseMatch = [regex]::Match($html, '<base href="([^"]+)"')
    if ($baseMatch.Success) { $base = [uri]::new($uri, $baseMatch.Groups[1].Value) }
    foreach ($match in [regex]::Matches($html, '(?:href|src)="([^"]+)"')) {
        $href = [Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
        Assert ($href -notmatch '^\./(?:archive\.html)?#daily-') "Legacy diary link emitted: $relative"
        # Diary references may point to another repository on the same GitHub host.
        if ($href -match '^https?://') { continue }
        $target = [uri]::new($base, $href)
        if ($target.Scheme -notin @('http', 'https') -or $target.Host -ne $siteUrl.Host) { continue }
        $path = [uri]::UnescapeDataString($siteUrl.MakeRelativeUri([uri]($target.GetLeftPart([UriPartial]::Path))).ToString())
        if (!$path -or $path.EndsWith('/')) { $path += 'index.html' }
        Assert (Test-Path -LiteralPath (Join-Path $siteRoot $path) -PathType Leaf) "Broken link in $relative -> $href"
        $checkedLinks++
    }
}
foreach ($id in $diaryIds) {
    Assert ($locations -contains "$($siteUrl.AbsoluteUri)diary/$id.html") "Diary missing from sitemap: $id"
}
$imageNodes = @($sitemap.SelectNodes('//*[local-name()="image"]/*[local-name()="loc"]'))
foreach ($node in $imageNodes) {
    $imageUri = [uri]$node.InnerText
    Assert ($imageUri.AbsolutePath -notmatch '\.heic$') 'Unsupported HEIC image in image sitemap.'
    $path = [uri]::UnescapeDataString($siteUrl.MakeRelativeUri($imageUri).ToString())
    Assert (Test-Path -LiteralPath (Join-Path $siteRoot $path) -PathType Leaf) "Missing sitemap image: $path"
}
Write-Output "PASS: $($locations.Count) pages, $($diaryIds.Count) diaries, $($imageNodes.Count) sitemap images and $checkedLinks local links."
