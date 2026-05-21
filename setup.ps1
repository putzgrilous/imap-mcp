# Compila o projeto
Write-Host "Compilando..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build! Verifique os erros acima." -ForegroundColor Red
    pause
    exit 1
}

# Cria/atualiza o claude_desktop_config.json
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
New-Item -ItemType Directory -Force -Path (Split-Path $configPath) | Out-Null

$imapEntry = @{
    command = "node"
    args    = @("C:\VSCode\imap-mcp\dist\index.js")
}

if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
} else {
    $config = [PSCustomObject]@{ mcpServers = [PSCustomObject]@{} }
}

$config.mcpServers | Add-Member -MemberType NoteProperty -Name "imap" -Value $imapEntry -Force
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath

Write-Host ""
Write-Host "Pronto! Reinicie o Cowork para ativar o conector IMAP." -ForegroundColor Green
pause
