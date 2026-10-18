# Runs mc-server-backend and restarts it if it exits.
# If something already listens on port 5000 (e.g. a manual npm start), it just waits.
$BackendDir = "C:\Users\LENOVO\.gemini\antigravity\scratch\mc-server-project\mc-server-backend"
$LogFile    = Join-Path $PSScriptRoot "mc-backend.log"
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" | Add-Content -Path $LogFile -Encoding UTF8 }
Set-Location $BackendDir
Log "=== mc-backend start ==="
while ($true) {
    if (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) {
        Start-Sleep -Seconds 30
        continue
    }
    Log "starting node server.js"
    & node server.js *>> $LogFile
    Log "backend exited (exit $LASTEXITCODE), restarting in 5s"
    Start-Sleep -Seconds 5
}
