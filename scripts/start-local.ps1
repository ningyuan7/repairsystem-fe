param([int]$Port=5173)
$ErrorActionPreference='Stop'
$repairFrontendRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repairLocal=Join-Path $repairFrontendRoot '.local'
New-Item -ItemType Directory -Path $repairLocal -Force|Out-Null
$repairStatePath=Join-Path $repairLocal 'process.json'
$repairVite=Join-Path $repairFrontendRoot 'node_modules/vite/bin/vite.js'
if(!(Test-Path -LiteralPath $repairVite)){throw 'Run npm ci in the frontend repository first'}
$repairListeners=Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if($repairListeners){
    if(!(Test-Path -LiteralPath $repairStatePath)){throw "Port $Port is occupied by another service"}
    $repairPrevious=Get-Content -LiteralPath $repairStatePath -Raw|ConvertFrom-Json
    $repairProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($repairPrevious.frontend)"
    if(!$repairProcess -or $repairProcess.CommandLine -notlike ('*'+$repairVite+'*') -or $repairListeners.OwningProcess -notcontains $repairPrevious.frontend){throw "Port $Port belongs to another service"}
}else{
    $repairNode=if($env:REPAIR_NODE){$env:REPAIR_NODE}else{(Get-Command node.exe -ErrorAction Stop).Source}
    $repairProcess=Start-Process -FilePath $repairNode -ArgumentList @('--dns-result-order=ipv4first',('"'+$repairVite+'"'),'--host','127.0.0.1','--port',[string]$Port,'--strictPort') -WorkingDirectory $repairFrontendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $repairLocal 'vite.log') -RedirectStandardError (Join-Path $repairLocal 'vite-error.log') -PassThru
    @{frontend=$repairProcess.Id}|ConvertTo-Json|Set-Content -LiteralPath $repairStatePath -Encoding UTF8
}
$repairDeadline=[DateTime]::UtcNow.AddSeconds(25)
while([DateTime]::UtcNow -lt $repairDeadline){
    try{$repairResponse=Invoke-WebRequest "http://127.0.0.1:$Port/" -TimeoutSec 2;if($repairResponse.StatusCode -eq 200){Write-Output "RepairSystem frontend ready: http://127.0.0.1:$Port/";return}}catch{}
    Start-Sleep -Milliseconds 250
}
throw 'Frontend did not become ready; check .local/vite-error.log'
