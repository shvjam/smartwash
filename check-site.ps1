<#
  Asks the server directly what it answers for the API site.
  No DNS needed: it connects to the IP and passes the site name in the Host header,
  which is exactly how IIS decides which site should handle the request.
#>

$ServerIp = "45.92.94.50"
$SiteHost = "api.appsmartwash.com"
$Paths    = @("/", "/health/live", "/api/public/plans")

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$out = New-Object System.Collections.Generic.List[string]

function Probe {
    param([string]$Path)
    $url = "http://$ServerIp$Path"
    $out.Add("=== $Path ===")
    try {
        $r = Invoke-WebRequest -Uri $url -Headers @{ Host = $SiteHost } -UseBasicParsing -TimeoutSec 25
        $out.Add("STATUS: $($r.StatusCode) $($r.StatusDescription)")
        $out.Add("SERVER: $($r.Headers['Server'])")
        $body = $r.Content
        if ($body.Length -gt 1500) { $body = $body.Substring(0,1500) + " ...[truncated]" }
        $out.Add("BODY:"); $out.Add($body)
    }
    catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $out.Add("STATUS: $([int]$resp.StatusCode) $($resp.StatusDescription)")
            try {
                $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $body = $sr.ReadToEnd(); $sr.Close()
                if ($body.Length -gt 2500) { $body = $body.Substring(0,2500) + " ...[truncated]" }
                $out.Add("BODY:"); $out.Add($body)
            } catch { $out.Add("BODY: <could not read>") }
        }
        else { $out.Add("NO RESPONSE: $($_.Exception.Message)") }
    }
    $out.Add("")
}

foreach ($p in $Paths) { Probe $p }

$file = Join-Path $PSScriptRoot "site-response.txt"
$out | Set-Content -Path $file -Encoding utf8
$out | Write-Host
Write-Host "`nSaved to: $file"
