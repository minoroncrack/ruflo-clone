# Signal Desk — Cloudflare Tunnel launcher
# Gives you a public HTTPS URL to the dashboard (port 4717), no router config.
#
#   Quick tunnel (instant, random URL, no login):
#       powershell -ExecutionPolicy Bypass -File scripts\start-tunnel.ps1
#
#   Named tunnel (permanent URL, one-time Cloudflare login) — see bottom of file.

$ErrorActionPreference = 'Stop'
$port = 4717
$dir  = Split-Path -Parent $PSScriptRoot
$exe  = Join-Path $dir 'cloudflared.exe'

if (-not (Test-Path $exe)) {
  Write-Host 'Downloading cloudflared.exe (one-time)...' -ForegroundColor Cyan
  $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
  Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
  Write-Host 'Downloaded.' -ForegroundColor Green
}

Write-Host ''
Write-Host '==================================================================' -ForegroundColor Yellow
Write-Host ' Starting secure HTTPS tunnel to http://localhost:'$port -ForegroundColor Yellow
Write-Host ' Watch for a https://<something>.trycloudflare.com URL below.' -ForegroundColor Yellow
Write-Host ' Open it on your phone, then append:  /?key=YOUR_TOKEN' -ForegroundColor Yellow
Write-Host '==================================================================' -ForegroundColor Yellow
Write-Host ''

& $exe tunnel --url "http://localhost:$port"

# ----------------------------------------------------------------------------
# PERMANENT URL (optional, recommended for daily use):
#   1) & .\cloudflared.exe login                 # opens browser, pick your domain
#   2) & .\cloudflared.exe tunnel create signaldesk
#   3) & .\cloudflared.exe tunnel route dns signaldesk desk.yourdomain.com
#   4) & .\cloudflared.exe tunnel --url http://localhost:4717 run signaldesk
#   Then run it always-on under pm2:
#      pm2 start cloudflared.exe --name trump-tunnel -- tunnel --url http://localhost:4717 run signaldesk
#      pm2 save
# ----------------------------------------------------------------------------
