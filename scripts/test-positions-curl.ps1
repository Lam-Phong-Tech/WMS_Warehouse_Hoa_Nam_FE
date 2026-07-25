$ErrorActionPreference = "Stop"
if (-not $env:API_BASE_URL) { throw "Set API_BASE_URL env var (e.g. https://example.com/api/v1)" }
$API_BASE = $env:API_BASE_URL

Write-Host "=== Test Positions API ===" -ForegroundColor Cyan

# Login
$login = Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method Post -Body (@{ email = $env:QA_ADMIN_EMAIL; password = $env:QA_ADMIN_PASSWORD } | ConvertTo-Json) -ContentType "application/json"
$token = $login.data.access_token
$authHeaders = @{ Authorization = "Bearer $token" }

Write-Host "`n=== GET /positions ===" -ForegroundColor Cyan
$list = Invoke-RestMethod -Uri "$API_BASE/positions?page=1&per_page=5" -Method Get -Headers $authHeaders
Write-Host "Positions: $($list.data.Count) items" -ForegroundColor Green

Write-Host "`n=== GET /positions/export-excel ===" -ForegroundColor Cyan
$excel = Invoke-WebRequest -Uri "$API_BASE/positions/export-excel" -Method Get -Headers $authHeaders
Write-Host "Excel export: $($excel.StatusCode) - Content-Type: $($excel.Headers['Content-Type'])" -ForegroundColor Green

Write-Host "`n=== GET /positions/export-pdf ===" -ForegroundColor Cyan
$pdf = Invoke-WebRequest -Uri "$API_BASE/positions/export-pdf" -Method Get -Headers $authHeaders
Write-Host "PDF export: $($pdf.StatusCode) - Content-Type: $($pdf.Headers['Content-Type'])" -ForegroundColor Green

Write-Host "`n=== ALL TESTS PASSED ===" -ForegroundColor Green