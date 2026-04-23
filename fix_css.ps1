$content = Get-Content "C:\Users\vigna\.openclaw\workspace\radioexperience\web\src\pages\AriaPage.jsx" -Raw
$fixed = $content -replace '#\{C\.accent\}', '#DDFF55' -replace '#\{C\.text\}', '#F6F2E8' -replace '#\{C\.border\}', 'rgba\(192,214,234,0.1\)'
$fixed | Set-Content "C:\Users\vigna\.openclaw\workspace\radioexperience\web\src\pages\AriaPage.jsx" -NoNewline
"Done"