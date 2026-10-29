# Read manually edited JS data arrays without executing JavaScript.
# Supports quoted strings, comments, trailing commas and unquoted object keys.
function Read-ManifestArray([string]$source, [string]$name) {
    $tokenPattern = '"(?:\\.|[^"\\])*"|''(?:\\.|[^''\\])*''|//[^\r\n]*|/\*[\s\S]*?\*/|[A-Za-z_$][\w$]*|[^\s]'
    $tokens = @([regex]::Matches($source, $tokenPattern) | ForEach-Object { $_.Value } | Where-Object { $_ -notmatch '^//|^/\*' })
    $start = -1
    for ($i = 0; $i -lt $tokens.Count - 4; $i++) {
        if (($tokens[$i..($i + 4)] -join '') -ceq "window.$name=[") { $start = $i + 4; break }
    }
    if ($start -lt 0) { throw "Missing window.$name array." }
    $json = [Text.StringBuilder]::new()
    $depth = 0
    $closed = $false
    for ($i = $start; $i -lt $tokens.Count; $i++) {
        $token = $tokens[$i]
        if ($token -eq '[') { $depth++ }
        if ($token -eq ']') { $depth-- }
        if ($token -eq ',' -and $tokens[$i + 1] -in @(']', '}')) { continue }
        if ($token.StartsWith("'")) {
            $value = $token.Substring(1, $token.Length - 2).Replace('\' + "'", "'").Replace('"', '\"')
            $token = '"' + $value + '"'
        } elseif ($token -match '^[A-Za-z_$][\w$]*$' -and $tokens[$i + 1] -eq ':') {
            $token = '"' + $token + '"'
        }
        [void]$json.Append($token)
        if ($depth -eq 0) { $closed = $true; break }
    }
    if (!$closed) { throw "Unclosed window.$name array." }
    foreach ($item in ($json.ToString() | ConvertFrom-Json)) { $item }
}

function Read-DiaryFiles([string]$source) {
    $files = @{}
    foreach ($value in @(Read-ManifestArray $source 'DIARY_FILES')) {
        $file = ([string]$value).Trim()
        if ($file -notmatch '^([0-9]{6})\.html$') { throw "Invalid diary filename (expected YYMMDD.html): $file" }
        $id = $Matches[1]
        [void][datetime]::ParseExact("20$id", 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture)
        $files[$id] = $file
    }
    $files
}
