$port = 5005
$process = Start-Process -FilePath "dotnet" -ArgumentList "run --urls=http://localhost:$port" -PassThru -NoNewWindow -RedirectStandardOutput "api_out.txt" -RedirectStandardError "api_err.txt"

Start-Sleep -Seconds 5

$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"
$bodyLines = (
    "--$boundary",
    "Content-Disposition: form-data; name=`"workflowName`"",
    "",
    "Test Workflow",
    "--$boundary",
    "Content-Disposition: form-data; name=`"signers`"",
    "",
    "[{`"firstName`":`"Jane`",`"lastName`":`"Doe`",`"email`":`"manager@example.com`",`"signingOrder`":1}]",
    "--$boundary",
    "Content-Disposition: form-data; name=`"document`"; filename=`"test.pdf`"",
    "Content-Type: application/pdf",
    "",
    "dummy pdf content",
    "--$boundary--"
) -join $LF

try {
    $response = Invoke-WebRequest -Uri "http://localhost:$port/api/v1/Packages" -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines
    Write-Host "Success!"
    Write-Host $response.Content
} catch {
    Write-Host "Error!"
    Write-Host $_.Exception.Response.StatusCode
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host $reader.ReadToEnd()
}

Stop-Process -Id $process.Id -Force
