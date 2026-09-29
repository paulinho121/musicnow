# Publica o Ensaio Fácil na VM a partir do PowerShell.
# No Windows, "bash" no PowerShell abre o WSL; este atalho usa o Git Bash, que tem o Node e a chave SSH.
$gitBash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $gitBash)) {
  Write-Error "Git Bash não encontrado em $gitBash. Instale o Git for Windows."
  exit 1
}
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  & $gitBash deploy/deploy.sh
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
