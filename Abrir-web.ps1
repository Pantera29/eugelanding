$ErrorActionPreference='Stop'
$taskNodeCommand=Get-Command node -ErrorAction SilentlyContinue
if($taskNodeCommand){$taskNodePath=$taskNodeCommand.Source}else{
  $taskNodePath=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if(-not(Test-Path -LiteralPath $taskNodePath)){throw 'Instala Node.js 24 para abrir la web.'}
$taskUrl='http://127.0.0.1:4173'
try{$taskRunning=Invoke-RestMethod "$taskUrl/api/status" -TimeoutSec 2}catch{$taskRunning=$null}
if(-not $taskRunning.demo){
  $taskDataPath=Join-Path $PSScriptRoot 'data'
  New-Item -ItemType Directory -Force -Path $taskDataPath | Out-Null
  Start-Process -FilePath $taskNodePath -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskDataPath 'server.log') -RedirectStandardError (Join-Path $taskDataPath 'server-error.log')
  for($taskTry=0;$taskTry -lt 15;$taskTry++){
    try{$taskRunning=Invoke-RestMethod "$taskUrl/api/status" -TimeoutSec 2;if($taskRunning.demo){break}}catch{}
    Start-Sleep -Milliseconds 300
  }
}
if(-not $taskRunning.demo){throw 'No se ha podido iniciar la web. Consulta data/server-error.log.'}
Start-Process $taskUrl
Write-Output "Web: $taskUrl"
Write-Output "Zona profesional: $taskUrl/admin (contraseña de prueba: consultorio-demo)"

