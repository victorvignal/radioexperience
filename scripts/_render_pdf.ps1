# PDF to PNG using Windows.Data.Pdf API
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName Windows.Storage

$pdfPath = "C:\Users\vigna\OneDrive\Documentos\escalas\07.04.2026 - Escala Médica Cardio Bronstein.pdf"
$outPath = "$env:TEMP\pdf_test.png"

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime]

function Await($op) {
    $tcs = New-Object System.Threading.Tasks.TaskCompletionSource
    $op.Completed = {
        $s = $args[0]
        $st = $args[1]
        if ($st -eq [Windows.Foundation.AsyncStatus]::Error) {
            $tcs.SetException($s.ErrorCode)
        } elseif ($st -eq [Windows.Foundation.AsyncStatus]::Canceled) {
            $tcs.SetCanceled()
        } else {
            $tcs.SetResult($s.GetResults())
        }
    }
    $tcs.Task
}

try {
    Write-Host "Opening file..."
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfPath))
    Write-Host "File: $($file.Name)"
    
    Write-Host "Loading PDF..."
    $pdf = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file))
    Write-Host "Pages: $($pdf.PageCount)"
    
    Write-Host "Getting page 0..."
    $page = $pdf.GetPage(0)
    
    Write-Host "Rendering to stream..."
    $memStream = New-Object System.IO.MemoryStream
    $renderOp = $page.RenderToStreamAsync($memStream.AsOutputStream())
    $renderOp.Start()
    $renderOp.Wait()
    $page.Close()
    
    Write-Host "Stream size: $($memStream.Length) bytes"
    
    # Write raw PNG data to file
    $bytes = $memStream.ToArray()
    [System.IO.File]::WriteAllBytes($outPath, $bytes)
    Write-Host "Written: $outPath ($([math]::Round($bytes.Length/1KB))KB)"
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}