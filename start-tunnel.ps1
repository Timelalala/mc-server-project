$hostIP = "10.250.85.16"
$keyPath = "$env:USERPROFILE\.ssh\id_mc_tunnel"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MC Reverse SSH Tunnel Auto-Reconnect" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting Tunnel (Port 5000)..." -ForegroundColor Green
    ssh -N -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -i $keyPath -R 5000:localhost:5000 admin@$hostIP
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Connection lost. Reconnecting in 3 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}
