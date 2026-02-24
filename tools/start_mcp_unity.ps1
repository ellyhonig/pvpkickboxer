param(
  [string]$HostName = "localhost",
  [int]$Port = 8090
)

$env:UNITY_HOST = $HostName
$env:UNITY_PORT = "$Port"

Write-Host "Starting mcp-unity server with UNITY_HOST=$env:UNITY_HOST UNITY_PORT=$env:UNITY_PORT"
node "X:/pvpkickboxer/tools/mcp-unity/Server~/build/index.js"
