# Reverse tunnel: MC1 127.0.0.1:5000 -> this PC 127.0.0.1:5000. Reconnects forever.
$Hosts   = @("192.168.137.1", "10.250.85.16", "10.196.130.15", "172.29.93.15", "MC1.local")
$User    = "admin"
$LogFile = Join-Path $PSScriptRoot "mc-tunnel.log"
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" | Add-Content -Path $LogFile -Encoding UTF8 }
Log "=== mc-tunnel start ==="
while ($true) {
    foreach ($h in $Hosts) {
        Log "connecting to $User@$h"
        & ssh -N -T -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -R 5000:127.0.0.1:5000 "$User@$h" 2>&1 | ForEach-Object { Log "ssh: $_" }
        Log "tunnel to $h closed (exit $LASTEXITCODE)"
        Start-Sleep -Seconds 5
    }
    Start-Sleep -Seconds 10
}
