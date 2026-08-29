<#
  Lists the site's folders over FTP, because shared Plesk gives no shell.
  Fill in the three values below from Plesk, then run this file.
#>

$FtpHost  = "appsmartwash.com"     # or the server IP
$User     = "PUT-FTP-USERNAME-HERE"
$Pass     = "PUT-FTP-PASSWORD-HERE"
$UseSsl   = $false                 # set $true if plain FTP is refused
$MaxDepth = 2                      # 0 = root only

$out = Join-Path $PSScriptRoot "remote-listing.txt"
$lines = New-Object System.Collections.Generic.List[string]

function Read-FtpDir {
    param([string]$Path)
    $url = "ftp://$FtpHost/$($Path.TrimStart('/'))"
    $req = [System.Net.FtpWebRequest]::Create($url)
    $req.Credentials = New-Object System.Net.NetworkCredential($User, $Pass)
    $req.Method      = [System.Net.WebRequestMethods+Ftp]::ListDirectoryDetails
    $req.UsePassive  = $true
    $req.UseBinary   = $true
    $req.KeepAlive   = $false
    $req.EnableSsl   = $UseSsl
    $req.Timeout     = 30000
    $resp = $req.GetResponse()
    $rd = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $rd.ReadToEnd()
    $rd.Close(); $resp.Close()
    return ($text -split "`r?`n" | Where-Object { $_.Trim() -ne "" })
}

# Windows FTP answers in MS-DOS format, Unix hosts in ls -l format. Handle both.
function Parse-FtpLine {
    param([string]$Line)
    if ($Line -match '^\s*\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}(AM|PM)\s+(<DIR>|\d+)\s+(.+)$') {
        return [pscustomobject]@{
            IsDir = ($Matches[2] -eq '<DIR>')
            Size  = $(if ($Matches[2] -eq '<DIR>') { 0 } else { [int64]$Matches[2] })
            Name  = $Matches[3].Trim()
        }
    }
    if ($Line -match '^([dl-])\S*\s+\S+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\S+\s+\S+\s+(.+)$') {
        return [pscustomobject]@{
            IsDir = ($Matches[1] -eq 'd')
            Size  = [int64]$Matches[2]
            Name  = $Matches[3].Trim()
        }
    }
    return $null
}

function Walk {
    param([string]$Path, [int]$Depth)
    $pad = "  " * $Depth
    try { $raw = Read-FtpDir -Path $Path }
    catch { $lines.Add("$pad[unreadable] $Path -- $($_.Exception.Message)"); return }

    $items = $raw | ForEach-Object { Parse-FtpLine $_ } | Where-Object { $_ -and $_.Name -notin '.', '..' }
    $dirs  = @($items | Where-Object IsDir)
    $files = @($items | Where-Object { -not $_.IsDir })

    foreach ($d in $dirs) {
        $lines.Add("$pad[DIR ] $($d.Name)")
        if ($Depth -lt $MaxDepth) { Walk -Path "$Path/$($d.Name)" -Depth ($Depth + 1) }
    }
    if ($files.Count -gt 0) {
        # A full 410-file dump helps nobody; the count and a sample tell the story.
        $lines.Add("$pad       ($($files.Count) files) e.g. " + (($files | Select-Object -First 6 | ForEach-Object { $_.Name }) -join ', '))
        foreach ($key in 'SmartWash.Api.exe','web.config','appsettings.Production.json','index.html') {
            if ($files.Name -contains $key) { $lines.Add("$pad       >>> $key present") }
        }
    }
}

"Listing ftp://$FtpHost as $User ..." | Write-Host
Walk -Path "/" -Depth 0
$lines | Set-Content -Path $out -Encoding utf8
$lines | Write-Host
"`nSaved to: $out" | Write-Host
