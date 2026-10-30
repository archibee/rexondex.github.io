param([string]$SiteRoot = (Split-Path $PSScriptRoot -Parent))
# Scan source folders, synchronize lists, and refresh the complete static site.
# No dependencies; compatible with Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'
$siteRoot = [IO.Path]::GetFullPath($SiteRoot)
. (Join-Path $PSScriptRoot 'manifest.ps1')
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-SiteFile([string]$path) {
    [System.IO.File]::ReadAllText((Join-Path $siteRoot $path), [System.Text.Encoding]::UTF8)
}
function Write-SiteFile([string]$path, [string]$content) {
    $target = Join-Path $siteRoot $path
    [System.IO.Directory]::CreateDirectory((Split-Path $target -Parent)) | Out-Null
    [System.IO.File]::WriteAllText($target, $content, $utf8)
}
function Escape-Html([string]$value) { [System.Net.WebUtility]::HtmlEncode($value) }

$diaryFiles = @{}
foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $siteRoot 'database') -File)) {
    if ($file.Name -notmatch '^([0-9]{6})\.html$') { continue }
    $id = $Matches[1]
    [void][datetime]::ParseExact("20$id", 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture)
    $diaryFiles[$id] = $file.Name
}
$ids = @($diaryFiles.Keys | Sort-Object -Descending)
if (!$ids.Count) { throw 'No YYMMDD.html diary files found in database/.' }

# Preserve manually written photo descriptions while discovering files on disk.
$previousSectors = @{}
if (Test-Path -LiteralPath (Join-Path $siteRoot 'pictures.js')) {
    foreach ($sector in @(Read-ManifestArray (Read-SiteFile 'pictures.js') 'PICTURE_SECTORS')) { $previousSectors[$sector.id] = $sector }
}
$imagePattern = '^[^/\\]+\.(jpe?g|png|webp|gif|avif|heic)$'
$pictureRoot = Join-Path $siteRoot 'picture'
if (!(Test-Path -LiteralPath $pictureRoot)) { [void][IO.Directory]::CreateDirectory($pictureRoot) }
if (Get-ChildItem -LiteralPath $pictureRoot -File | Where-Object { $_.Name -match $imagePattern }) {
    throw 'Place photos inside a sector folder, for example picture/sector-1/photo.jpg.'
}
$discoveredSectors = @(foreach ($folder in (Get-ChildItem -LiteralPath $pictureRoot -Directory | Sort-Object { [regex]::Replace($_.Name, '\d+', { param($m) $m.Value.PadLeft(20, '0') }) })) {
    $files = @(Get-ChildItem -LiteralPath $folder.FullName -File | Where-Object { $_.Name -match $imagePattern } | Sort-Object { [regex]::Replace($_.Name, '\d+', { param($m) $m.Value.PadLeft(30, '0') }) } -Descending | ForEach-Object { $_.Name })
    if ($folder.Name -notmatch '^[a-zA-Z0-9-]+$') {
        if ($files.Count) { throw "Photo sector names must use letters, numbers or hyphens: $($folder.Name)" }
        continue
    }
    $descriptions = [ordered]@{}
    $previous = $previousSectors[$folder.Name]
    if ($previous -and $previous.descriptions) {
        foreach ($property in ($previous.descriptions.PSObject.Properties | Sort-Object Name)) {
            if ($files -contains $property.Name) { $descriptions[$property.Name] = $property.Value }
        }
    }
    [ordered]@{ id = $folder.Name; descriptions = $descriptions; files = $files }
})
$listing = @($ids | Sort-Object | ForEach-Object { "  '$($diaryFiles[$_])'," }) -join "`n"
Write-SiteFile 'database.js' ("// Generated from database/ by scripts/update-seo.ps1. Add HTML files to the folder.`nwindow.DIARY_FILES = [`n$listing`n];`n")
$pictureJson = ConvertTo-Json -InputObject $discoveredSectors -Depth 8
Write-SiteFile 'pictures.js' ("// File lists are generated from picture/sector folders. Photo descriptions are preserved.`nwindow.PICTURE_SECTORS = $pictureJson;`n")
function Read-DiarySection([string]$html, [string]$className) {
    $opening = [regex]::Match($html, '(?is)<div\b(?=[^>]*\bclass\s*=\s*["''][^"'']*\b' + $className + '\b[^"'']*["''])[^>]*>')
    if (!$opening.Success) { return $null }
    $start = $opening.Index + $opening.Length
    $depth = 1
    foreach ($tag in [regex]::Matches($html.Substring($start), '(?is)<div\b[^>]*>|</div\s*>')) {
        if ($tag.Value -match '^</') { $depth-- } else { $depth++ }
        if ($depth -eq 0) { return $html.Substring($start, $tag.Index) }
    }
    throw "Unclosed $className div."
}
function Extract-DiaryLinkMarkers([string]$html) {
    $links = [System.Collections.Generic.List[string]]::new()
    $content = [regex]::Replace($html, '\[\[(?:(?<bare>https?://[^\]\s]+)|링크\|(?<url>https?://[^|\]\s]+)(?:\|(?<label>[^\]\r\n]+))?)\]\]', [System.Text.RegularExpressions.MatchEvaluator]{
        param($match)
        $rawUrl = if ($match.Groups['bare'].Success) { $match.Groups['bare'].Value } else { $match.Groups['url'].Value }
        $url = Escape-Html $rawUrl
        if ($match.Groups['label'].Success) { $label = Escape-Html $match.Groups['label'].Value }
        elseif ($match.Groups['bare'].Success) { $label = $url }
        else { $label = '링크' }
        $links.Add('<a class="post-reference" href="' + $url + '">' + $label + '</a>')
        ''
    })
    $content = [regex]::Replace($content, '(?is)<p>\s*</p>', '')
    [pscustomobject]@{ Content = $content; Links = @($links) }
}
function Convert-DiaryLinkMarkers([string]$html) {
    $parsed = Extract-DiaryLinkMarkers $html
    return $parsed.Content + ($parsed.Links -join '')
}

function Render-Shell([string]$heading, [string]$body, [string]$navigation) {
    @"
<div class="social-shell">
  <header class="mobile-header"><a href="./">rexondex</a></header>
  <aside class="side-nav"><a class="wordmark" href="./"><img class="brand-logo" src="./favicon.svg" alt=""><span>rexondex</span><small>archive</small></a><nav aria-label="주요 메뉴"><a href="./">일기</a><a href="./pictures.html">사진</a></nav></aside>
  <main class="main-column"><section class="view feed-view" aria-labelledby="static-title">
    <header class="view-header"><h1 id="static-title">$heading</h1></header>
    $body
    <footer class="diary-post">$navigation</footer>
  </section></main>
</div>
"@
}
# Read the home head as the shared metadata/icon/style template. Runtime scripts are
# added explicitly in document order; nested pages use a base URL for all assets.
$template = [regex]::Match((Read-SiteFile 'index.html'), '(?s)<head>(.*?)</head>').Groups[1].Value
$siteUrl = [regex]::Match($template, '<link rel="canonical" href="([^"]+)"').Groups[1].Value
if (!$siteUrl.EndsWith('/')) { throw 'Home canonical must end with /.' }
$graph = (([regex]::Match($template, '(?s)<script type="application/ld\+json">(.*?)</script>').Groups[1].Value | ConvertFrom-Json).'@graph')
$template = [regex]::Replace($template, '(?s)\s*<script\b.*?</script>', '')
$template = [regex]::Replace($template, '\s*<base\b[^>]*>', '')
$template = $template.Trim()

function Render-Page([string]$path, [string]$title, [string]$description, [string]$body,
    [bool]$interactive = $false, [string]$attributes = '', $entity = $null) {
    $url = if ($path -eq 'index.html') { $siteUrl } else { $siteUrl + $path }
    $head = $template
    $safeTitle = Escape-Html $title
    $safeDescription = Escape-Html $description
    $head = [regex]::Replace($head, '<title>.*?</title>', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) "<title>$safeTitle</title>" })
    foreach ($name in @('description', 'og:description', 'twitter:description')) {
        $head = [regex]::Replace($head, '((?:name|property)="' + $name + '" content=")[^"]*', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Groups[1].Value + $safeDescription })
    }
    foreach ($name in @('og:title', 'twitter:title')) {
        $head = [regex]::Replace($head, '((?:name|property)="' + $name + '" content=")[^"]*', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Groups[1].Value + $safeTitle })
    }
    $head = [regex]::Replace($head, '(rel="canonical" href=")[^"]*', '${1}' + $url)
    $head = [regex]::Replace($head, '(property="og:url" content=")[^"]*', '${1}' + $url)
    if ($entity -and $entity.'@type' -eq 'BlogPosting') {
        $head = $head.Replace('property="og:type" content="website"', 'property="og:type" content="article"')
        $head += "`n<meta property=""article:published_time"" content=""$($entity.datePublished)"">"
    }
    $pageGraph = @($graph)
    if ($entity) { $pageGraph += $entity }
    $json = [ordered]@{ '@context' = 'https://schema.org'; '@graph' = $pageGraph } | ConvertTo-Json -Depth 15
    # Prevent diary text inside JSON-LD from terminating its script element.
    $json = $json.Replace('<', '\u003c').Replace('>', '\u003e').Replace('&', '\u0026')
    $base = if ($path.Contains('/')) { '<base href="../">' } else { '' }
    $scripts = '<script src="./legacy-links.js"></script><script src="./theme-init.js"></script>'
    if ($interactive) {
        $scripts += '<script defer src="./database.js"></script><script defer src="./pictures.js"></script><script defer src="./app.js"></script>'
    }
    $noscript = '<noscript><p>달력과 테마 설정은 JavaScript를 활성화하면 사용할 수 있습니다. <a href="./">메인</a> · <a href="./archive.html">전체 일기</a> · <a href="./pictures.html">사진</a></p></noscript>'
    Write-SiteFile $path "<!doctype html>`n<html lang=""ko"">`n<head>`n$base$head`n<script type=""application/ld+json"">$json</script>`n$scripts`n</head>`n<body $attributes><div id=""app"">`n<!-- STATIC-ARCHIVE:START -->`n$body`n<!-- STATIC-ARCHIVE:END -->`n</div>$noscript</body>`n</html>`n"
}

$culture = [Globalization.CultureInfo]::GetCultureInfo('ko-KR')
$posts = for ($i = 0; $i -lt $ids.Count; $i++) {
    $id = $ids[$i]
    $path = "database/$($diaryFiles[$id])"
    $html = Read-SiteFile $path
    $content = Read-DiarySection $html 'post-content'
    $references = Read-DiarySection $html 'post-references'
    if ($null -eq $content) {
        if ($html -match '(?i)<(?:html|head|body)\b|<!doctype') { throw "Missing .post-content in $path" }
        $content = $html.Trim()
    }
    $parsedLinks = Extract-DiaryLinkMarkers $content
    $content = $parsedLinks.Content
    if ($null -ne $references) { $references = Convert-DiaryLinkMarkers $references }
    if ($parsedLinks.Links.Count) {
        $references = (@($references) + @($parsedLinks.Links) | Where-Object { $null -ne $_ }) -join ''
    }
    $date = [datetime]::ParseExact("20$id", 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture)
    $iso = $date.ToString('yyyy-MM-dd')
    $label = $date.ToString('yyyy년 M월 d일', $culture)
    $longLabel = Escape-Html ($date.ToString('D', $culture))
    $shortDate = $date.ToString('yy.MM.dd')
    # Only a leading date-only paragraph is normalized; prose dates are preserved.
    $content = [regex]::Replace($content, '^\s*<p>\s*\d{2}\.\d{2}\.\d{2}\s*</p>', "<p>$shortDate</p>")
    $summary = [regex]::Replace($content, '(?is)<(?:script|style)\b.*?</(?:script|style)>', '')
    $summary = [Net.WebUtility]::HtmlDecode([regex]::Replace($summary, '<[^>]+>', ' '))
    $summary = [regex]::Replace($summary, '\s+', ' ').Trim()
    $summary = [regex]::Replace($summary, '^\d{2}\.\d{2}\.\d{2}\s*', '')
    if ($summary.Length -gt 150) { $summary = $summary.Substring(0, 150) + '…' }
    $description = "$label 일기. $summary"
    $referenceHtml = if ($null -ne $references) { '<div class="post-references" aria-label="참고 링크">' + $references + '</div>' } else { '' }
    $post = @"
<article class="diary-post" id="daily-$id" aria-label="$longLabel">
  <header><img class="post-avatar" src="./rexondex.jpg" alt="" width="44" height="44" loading="lazy"><div><strong>rexondex</strong><time datetime="$iso">$longLabel</time></div></header>
  $referenceHtml
  <div class="post-content">$content</div>
  <footer><a class="post-permalink" href="./$path">$id &#183; &#47553;&#53356;</a></footer>
</article>
"@
    $navigation = '<a href="./">메인</a> · <a href="./archive.html">전체 일기</a>'
    if ($i -gt 0) { $navigation += " · <a href=""./database/$($diaryFiles[$ids[$i - 1]])"">다음 일기</a>" }
    if ($i -lt $ids.Count - 1) { $navigation += " · <a href=""./database/$($diaryFiles[$ids[$i + 1]])"">이전 일기</a>" }
    $entity = [ordered]@{
        '@type' = 'BlogPosting'; '@id' = "$siteUrl$path#article"
        headline = "$label 일기"; description = $description; datePublished = $iso
        inLanguage = 'ko'; author = [ordered]@{ '@id' = "$($siteUrl)#author" }
        mainEntityOfPage = "$siteUrl$path"
    }
    $body = Render-Shell "$label 일기" $post $navigation
    Render-Page $path "$label 일기 | rexondex Archive" $description $body $true "data-diary-id=""$id""" $entity
    $post
}

$homeDescription = 'rexondex의 일기와 사진을 모은 개인 디지털 아카이브입니다. 일상의 기록과 참고 링크를 달력으로 탐색할 수 있습니다.'
$homeContent = Render-Shell '일기' (($posts | Select-Object -First 8) -join "`n") '<a href="./archive.html">전체 일기 보기</a> · <a href="./pictures.html">사진 보기</a>'
Render-Page 'index.html' 'rexondex Archive' $homeDescription $homeContent $true
$archive = Render-Shell '전체 일기' ($posts -join "`n") '<a href="./">일기장으로 돌아가기</a>'
Render-Page 'archive.html' '전체 일기 | rexondex Archive' 'rexondex의 전체 일기를 최신 날짜순으로 읽고, 각 날짜의 일기와 참고 링크를 찾아볼 수 있습니다.' $archive $true 'data-all-entries="true"'

$sitemapEntries = [System.Collections.Generic.List[string]]::new()
$sitemapEntries.Add("<url><loc>$siteUrl</loc></url>")
$sitemapEntries.Add("<url><loc>$($siteUrl)archive.html</loc></url>")
foreach ($id in $ids) {
    $sitemapEntries.Add("<url><loc>$($siteUrl)database/$($diaryFiles[$id])</loc></url>")
}

$sectors = @(Read-ManifestArray (Read-SiteFile 'pictures.js') 'PICTURE_SECTORS' | Sort-Object { [regex]::Replace($_.id, '\d+', { param($m) $m.Value.PadLeft(20, '0') }) })
for ($i = 0; $i -lt $sectors.Count; $i++) {
    $sector = $sectors[$i]
    if ($sector.id -notmatch '^[a-zA-Z0-9-]+$') { throw 'Invalid picture sector ID.' }
    $path = if ($i -eq 0) { 'pictures.html' } else { "pictures/$($sector.id).html" }
    $sectorLinks = for ($j = 0; $j -lt $sectors.Count; $j++) {
        $href = if ($j -eq 0) { './pictures.html' } else { "./pictures/$($sectors[$j].id).html" }
        "<a href=""$href"">$(Escape-Html $sectors[$j].id)</a>"
    }
    $images = foreach ($file in ($sector.files | Sort-Object -Unique -Descending)) {
        if ($file -notmatch '^[^/\\]+\.(jpe?g|png|webp|gif|avif|heic)$') { throw "Invalid picture filename: $file" }
        if (!(Test-Path -LiteralPath (Join-Path $siteRoot "picture/$($sector.id)/$file"))) { throw "Missing picture: $file" }
        $src = "./picture/$($sector.id)/$([uri]::EscapeDataString($file))"
        $alt = ''
        if ($sector.descriptions -and $sector.descriptions.PSObject.Properties[$file]) { $alt = Escape-Html $sector.descriptions.PSObject.Properties[$file].Value }
        $label = if ($alt) { $alt } else { Escape-Html "$($sector.id)/$file 사진 크게 보기" }
        "<a class=""picture-tile"" href=""$src"" aria-label=""$label""><img src=""$src"" alt=""$alt"" loading=""lazy"" decoding=""async""></a>"
    }
    $content = '<div class="picture-toolbar"><nav class="picture-sector-nav" aria-label="사진 섹터">' + ($sectorLinks -join '') + '</nav><span>' + $sector.files.Count + '장</span></div><div class="picture-grid">' + ($images -join "`n") + '</div>'
    $body = Render-Shell '사진' $content '<a href="./">일기장으로 돌아가기</a>'
    $body = $body.Replace('view feed-view', 'view picture-view')
    $entity = [ordered]@{ '@type' = 'CollectionPage'; name = "rexondex 사진 $($sector.id)"; url = $siteUrl + $path; inLanguage = 'ko' }
    Render-Page $path "사진 $($sector.id) | rexondex Archive" "rexondex의 $($sector.id) 사진 아카이브입니다. $($sector.files.Count)장의 사진을 둘러보고 원본을 열어볼 수 있습니다." $body $true "data-initial-view=""picture"" data-picture-sector=""$($sector.id)""" $entity
    # HEIC is available to visitors but isn't a supported Google Images format.
    $imageEntries = foreach ($file in $sector.files) {
        if ($file -notmatch '\.heic$') {
            '<image:image><image:loc>' + $siteUrl + 'picture/' + $sector.id + '/' + [uri]::EscapeDataString($file) + '</image:loc></image:image>'
        }
    }
    $sitemapEntries.Add("<url><loc>$siteUrl$path</loc>$($imageEntries -join '')</url>")
}
Write-SiteFile 'sitemap.xml' ('<?xml version="1.0" encoding="UTF-8"?>' + "`n" + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' + "`n" + ($sitemapEntries -join "`n") + "`n</urlset>`n")
Write-Output "Updated snapshots and sitemap for $($ids.Count) existing HTML diaries and $($sectors.Count) galleries."
