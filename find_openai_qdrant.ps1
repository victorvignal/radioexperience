$lines = Get-Content "C:\Users\vigna\.openclaw\workspace\radioexperience\backend\main.py"
$cnt = $lines.Count
$result = @()
for($i=0; $i -lt $cnt; $i++) {
    if($lines[$i] -match 'openai_client\.embeddings\.create' -or $lines[$i] -match 'qdrant\.query_points') {
        $result += "$i`: $($lines[$i].Trim())"
    }
}
$result -join "`n"