# Refresh committed static HTML after updating database.js or diary files.
# No dependencies; compatible with Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path $PSScriptRoot -Parent
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

$ids = @([regex]::Matches((Read-SiteFile 'database.js'), "(?m)^\s*'([0-9]{6})'\s*,?\s*$") |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique -Descending)
if (!$ids.Count) { throw 'No diary IDs found in database.js.' }
$culture = [System.Globalization.CultureInfo]::GetCultureInfo('ko-KR')
$entries = @{}
$posts = foreach ($id in $ids) {
    $iso = "20$($id.Substring(0, 2))-$($id.Substring(2, 2))-$($id.Substring(4, 2))"
    $date = [datetime]::ParseExact($iso, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
    $source = (Read-SiteFile "database/$id.md").TrimStart([char]0xFEFF).Replace("`r`n", "`n")
    $lines = $source -split "`n"
    $first = $lines[0].Trim()
    $references = [System.Collections.Generic.List[string]]::new()
    $cursor = 0
    # Match the reference syntax used by parseDiaryMarkdown in app.js.
    foreach ($match in [regex]::Matches($first, '\[([^\]]+)\](?:\(([^)]+)\))?')) {
        if ($match.Index -ne $cursor) { break }
        $raw = $match.Groups[1].Value.Trim()
        if ($match.Groups[2].Success) { $raw = $match.Groups[2].Value.Trim() }
        $href = $raw
        if ($href -notmatch '^(https?://|mailto:|/|\./|\.\./|#)') {
            if ($href -match '^(www\.|[a-z0-9.-]+\.[a-z]{2,})') { $href = "https://$href" }
            else { break }
        }
        $label = $match.Groups[1].Value.Trim()
        $references.Add('<a class="post-reference" href="' + (Escape-Html $href) + '">' + (Escape-Html $label) + '</a>')
        $cursor += $match.Length
    }
    $referenceHtml = ''
    if ($references.Count -and $cursor -eq $first.Length) {
        $source = ($lines | Select-Object -Skip 1) -join "`n"
        $referenceHtml = '<div class="post-references" aria-label="&#52280;&#44256; &#47553;&#53356;">' + ($references -join '') + '</div>'
    }
    # A dependency-free text snapshot: escape markup and retain paragraphs/line breaks.
    # The interactive app continues to render full Markdown with marked.
    $paragraphs = @($source.Trim() -split '\n\s*\n' | ForEach-Object {
        '<p>' + (Escape-Html $_).Replace("`n", '<br>') + '</p>'
    }) -join "`n"
    $label = Escape-Html ($date.ToString('D', $culture))
    $summary = [regex]::Replace($source.Trim(), '\s+', ' ')
    $summary = [regex]::Replace($summary, '^[0-9]{2}\.[0-9]{2}\.[0-9]{2}\s*', '')
    if ($summary.Length -gt 150) { $summary = $summary.Substring(0, 150) + '…' }
    $entries[$id] = @{ Date = $iso; Label = $date.ToString('yyyy년 M월 d일', $culture); Summary = $summary }
    @"
<article class="diary-post" id="daily-$id" aria-label="$label">
  <header><img class="post-avatar" src="./rexondex.jpg" alt="" width="44" height="44" loading="lazy"><div><strong>rexondex</strong><time datetime="$iso">$label</time></div></header>
  $referenceHtml
  <div class="post-content">$paragraphs</div>
  <footer><a class="post-permalink" href="./diary/$id.html">$id &#183; &#47553;&#53356;</a></footer>
</article>
"@
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
        $scripts += '<script defer src="./database.js"></script><script defer src="./pictures.js"></script><script defer src="https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js"></script><script defer src="./app.js"></script>'
    }
    $noscript = '<noscript><p>달력과 테마 설정은 JavaScript를 활성화하면 사용할 수 있습니다. <a href="./">메인</a> · <a href="./archive.html">전체 일기</a> · <a href="./pictures.html">사진</a></p></noscript>'
    Write-SiteFile $path "<!doctype html>`n<html lang=""ko"">`n<head>`n$base$head`n<script type=""application/ld+json"">$json</script>`n$scripts`n</head>`n<body $attributes><div id=""app"">`n<!-- STATIC-ARCHIVE:START -->`n$body`n<!-- STATIC-ARCHIVE:END -->`n</div>$noscript</body>`n</html>`n"
}

$homeDescription = 'rexondex의 일기와 사진을 모은 개인 디지털 아카이브입니다. 일상의 기록과 참고 링크를 달력으로 탐색할 수 있습니다.'
$homeContent = Render-Shell '일기' (($posts | Select-Object -First 8) -join "`n") '<a href="./archive.html">전체 일기 보기</a> · <a href="./pictures.html">사진 보기</a>'
Render-Page 'index.html' 'rexondex Archive' $homeDescription $homeContent $true
$archive = Render-Shell '전체 일기' ($posts -join "`n") '<a href="./">일기장으로 돌아가기</a>'
Render-Page 'archive.html' '전체 일기 | rexondex Archive' 'rexondex의 전체 일기를 최신 날짜순으로 읽고, 각 날짜의 일기와 참고 링크를 찾아볼 수 있습니다.' $archive

$sitemapEntries = [System.Collections.Generic.List[string]]::new()
$sitemapEntries.Add("<url><loc>$siteUrl</loc></url>")
$sitemapEntries.Add("<url><loc>$($siteUrl)archive.html</loc></url>")
for ($i = 0; $i -lt $ids.Count; $i++) {
    $id = $ids[$i]
    $entry = $entries[$id]
    $title = "$($entry.Label) 일기 | rexondex Archive"
    $description = "$($entry.Label)의 일기. $($entry.Summary)"
    $navigation = '<a href="./">메인</a> · <a href="./archive.html">전체 일기</a>'
    if ($i -gt 0) { $navigation += " · <a href=""./diary/$($ids[$i - 1]).html"">다음 일기</a>" }
    if ($i -lt $ids.Count - 1) { $navigation += " · <a href=""./diary/$($ids[$i + 1]).html"">이전 일기</a>" }
    $body = Render-Shell "$($entry.Label) 일기" $posts[$i] $navigation
    $entity = [ordered]@{
        '@type' = 'BlogPosting'; '@id' = "$($siteUrl)diary/$id.html#article"
        headline = "$($entry.Label) 일기"; description = $description
        datePublished = $entry.Date; inLanguage = 'ko'
        author = [ordered]@{ '@id' = "$($siteUrl)#author" }
        mainEntityOfPage = "$($siteUrl)diary/$id.html"
    }
    Render-Page "diary/$id.html" $title $description $body $true "data-diary-id=""$id""" $entity
    $sitemapEntries.Add("<url><loc>$($siteUrl)diary/$id.html</loc></url>")
}

# pictures.js is intentionally a plain assignment to a JSON array.
$pictureSource = Read-SiteFile 'pictures.js'
$pictureJson = [regex]::Match($pictureSource, '(?s)window\.PICTURE_SECTORS\s*=\s*(\[.*\])\s*;?\s*$').Groups[1].Value
if (!$pictureJson) { throw 'PICTURE_SECTORS must contain a JSON array.' }
$sectors = @($pictureJson | ConvertFrom-Json)
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
Write-Output "Updated home, archive, $($ids.Count) diary pages, $($sectors.Count) galleries and sitemap.xml."
