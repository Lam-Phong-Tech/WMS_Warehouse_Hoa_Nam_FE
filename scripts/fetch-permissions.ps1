$ErrorActionPreference = 'Stop'
if (-not $env:QA_ADMIN_PASSWORD) { throw "Set QA_ADMIN_PASSWORD env var" }
if (-not $env:API_BASE_URL) { throw "Set API_BASE_URL env var" }
$loginBody = @{ email = $env:QA_ADMIN_EMAIL; password = $env:QA_ADMIN_PASSWORD } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$($env:API_BASE_URL)/auth/login" -Method Post -ContentType 'application/json' -Body $loginBody
$token = $login.data.access_token
Write-Host "TOKEN: $token"

function GetPerms($path) {
  try {
    $r = Invoke-RestMethod -Uri "$($env:API_BASE_URL)$path" -Headers @{Authorization="Bearer $token"}
    Write-Host "=== $path ==="
    $r | ConvertTo-Json -Depth 10
  } catch {
    Write-Host "ERROR $path : $($_.Exception.Message)"
  }
}

GetPerms "/permissions"
GetPerms "/auth/me"