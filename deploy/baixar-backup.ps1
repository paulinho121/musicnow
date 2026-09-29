# Baixa para este PC os backups do banco que estão na VM (cópia fora da nuvem).
# Uso: powershell -ExecutionPolicy Bypass -File deploy\baixar-backup.ps1
# Guarda os últimos 30 arquivos em C:\Users\<você>\.pgvm\backups
$ErrorActionPreference = 'Stop'
$key = "$HOME\.ssh\paulinhoben10.key"
$vm = 'ubuntu@152.67.63.31'
$dest = "$HOME\.pgvm\backups"
New-Item -ItemType Directory -Force $dest | Out-Null

# Só os backups de produção; o de desenvolvimento pode ser recriado pelo seed.
$files = ssh -i $key -o BatchMode=yes $vm "ls -1 /var/backups/postgres/ensaio_facil-*.dump 2>/dev/null"
if (-not $files) { Write-Error 'Nenhum backup encontrado na VM.' }
foreach ($f in $files) {
  $name = Split-Path $f -Leaf
  if (Test-Path (Join-Path $dest $name)) { continue }
  scp -q -i $key -o BatchMode=yes "${vm}:$f" (Join-Path $dest $name)
  Write-Host "Baixado: $name"
}

Get-ChildItem $dest -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
$last = Get-ChildItem $dest -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "Backups em $dest. Mais recente: $($last.Name) ($([math]::Round($last.Length/1KB)) KB)"
