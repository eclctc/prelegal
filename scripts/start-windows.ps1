Set-Location (Join-Path $PSScriptRoot "..")
docker build -t prelegal .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (docker ps -aq -f name='^prelegal$') { docker rm -f prelegal | Out-Null }
docker run -d --name prelegal -p 8000:8000 --env-file .env prelegal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Prelegal running at http://localhost:8000"
