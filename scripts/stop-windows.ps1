if (docker ps -aq -f name='^prelegal$') {
    docker rm -f prelegal | Out-Null
    Write-Host "Prelegal stopped"
} else {
    Write-Host "Prelegal is not running"
}
