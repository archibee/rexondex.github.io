# Refresh committed static HTML after updating database.js or diary files.
# No dependencies; compatible with Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'
$siteRoot = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read-SiteFile([string]$path) {
    [System.IO.File]::ReadAllText((Join-Path $siteRoot $path), [System.Text.Encoding]::UTF8)
}
function Write-SiteFile([string]$path, [string]$content) {
    [System.IO.File]::WriteAllText((Join-Path $siteRoot $path), $content, $utf8)
}
function Escape-Html([string]$value) { [System.Net.WebUtility]::HtmlEncode($value) }

$ids = @([regex]::Matches((Read-SiteFile 'database.js'), "(?m)^\s*'([0-9]{6})'\s*,?\s*$") |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique -Descending)
if (!$ids.Count) { throw 'No diary IDs found in database.js.' }
$culture = [System.Globalization.CultureInfo]::GetCultureInfo('ko-KR')
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
    @"
<article class="diary-post" id="daily-$id" aria-label="$label">
  <header><img class="post-avatar" src="./rexondex.jpg" alt="" width="44" height="44" loading="lazy"><div><strong>rexondex</strong><time datetime="$iso">$label</time></div></header>
  $referenceHtml
  <div class="post-content">$paragraphs</div>
  <footer><a class="post-permalink" href="./#daily-$id">$id &#183; &#47553;&#53356;</a></footer>
</article>
"@
}

function Render-Shell([string]$heading, [string]$body, [string]$navigation) {
    @"
<div class="social-shell">
  <header class="mobile-header"><a href="./">rexondex</a></header>
  <aside class="side-nav"><a class="wordmark" href="./"><img class="brand-logo" src="./favicon.svg" alt=""><span>rexondex</span><small>archive</small></a></aside>
  <main class="main-column"><section class="view feed-view" aria-labelledby="static-title">
    <header class="view-header"><h1 id="static-title">$heading</h1></header>
    $body
    <footer class="diary-post">$navigation</footer>
  </section></main>
</div>
"@
}
$index = Read-SiteFile 'index.html'
$homeContent = Render-Shell '&#51068;&#44592;' (($posts | Select-Object -First 8) -join "`n") '<a href="./archive.html">&#51060;&#51204; &#44592;&#47197; &#45908; &#48372;&#44592;</a>'
$pattern = '(?s)(<!-- STATIC-ARCHIVE:START -->).*?(<!-- STATIC-ARCHIVE:END -->)'
if (![regex]::IsMatch($index, $pattern)) { throw 'Static archive markers missing from index.html.' }
$index = [regex]::Replace($index, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{
    param($match)
    $match.Groups[1].Value + "`n" + $homeContent + "`n    " + $match.Groups[2].Value
})
Write-SiteFile 'index.html' $index

# Reuse head metadata/icons/styles, excluding app-specific scripts.
$head = [regex]::Match($index, '(?s)<head>(.*?)</head>').Groups[1].Value
$head = [regex]::Replace($head, '(?s)\s*<script(?! type="application/ld\+json").*?</script>', '')
$head = $head.Replace('<title>rexondex Archive</title>', '<title>rexondex Archive | &#51204;&#52404; &#51068;&#44592;</title>')
$head = $head.Replace('rel="canonical" href="https://rexondex.github.io/"', 'rel="canonical" href="https://rexondex.github.io/archive.html"')
$head = $head.Replace('property="og:url" content="https://rexondex.github.io/"', 'property="og:url" content="https://rexondex.github.io/archive.html"')
$head = $head.Replace('property="og:title" content="rexondex Archive"', 'property="og:title" content="rexondex Archive | &#51204;&#52404; &#51068;&#44592;"')
$head = $head.Replace('name="twitter:title" content="rexondex Archive"', 'name="twitter:title" content="rexondex Archive | &#51204;&#52404; &#51068;&#44592;"')
$archive = Render-Shell '&#51204;&#52404; &#51068;&#44592;' ($posts -join "`n") '<a href="./">&#51068;&#44592;&#51109;&#51004;&#47196; &#46028;&#50500;&#44032;&#44592;</a>'
Write-SiteFile 'archive.html' "<!doctype html>`n<html lang=""ko"">`n<head>$head</head>`n<body>$archive</body>`n</html>`n"
Write-SiteFile 'sitemap.xml' @'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://rexondex.github.io/</loc></url>
  <url><loc>https://rexondex.github.io/archive.html</loc></url>
</urlset>
'@
Write-Output "Updated index.html, archive.html and sitemap.xml ($($ids.Count) diaries)."
