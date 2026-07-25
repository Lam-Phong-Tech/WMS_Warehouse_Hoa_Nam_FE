# Login để lấy token
if (-not $env:QA_ADMIN_PASSWORD) { throw "Set QA_ADMIN_PASSWORD env var" }
if (-not $env:API_BASE_URL) { throw "Set API_BASE_URL env var (e.g. https://example.com/api/v1)" }
$loginBody = @{ email = $env:QA_ADMIN_EMAIL; password = $env:QA_ADMIN_PASSWORD } | ConvertTo-Json
$headers = @{'Content-Type'='application/json'; 'Accept'='application/json'}
try {
    $loginResp = Invoke-RestMethod -Uri "$($env:API_BASE_URL)/auth/login" -Method POST -Body $loginBody -Headers $headers
    Write-Host "Login response structure:"
    $loginResp | ConvertTo-Json -Depth 5
    $token = $loginResp.data.access_token
    Write-Host "Token: $token"
    Write-Host "Token OK: $($null -ne $token)"
} catch {
    Write-Host "Login Failed!"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        Write-Host "Response body: $errBody"
    } else {
        Write-Host "Error: $_"
    }
    exit 1
}

# Header với auth
$authHeaders = @{'Authorization'="Bearer $token"; 'Accept'='application/json'}

# Test GET /permissions - lấy tất cả mã quyền
Write-Host "=== ALL PERMISSIONS ==="
$perms = Invoke-RestMethod -Uri "$($env:API_BASE_URL)/permissions" -Method GET -Headers $authHeaders
$perms.data | ForEach-Object { Write-Host $_.name }

Write-Host "`n=== TEST EXPORT ENDPOINTS ==="

# Hàm test endpoint
function Test-Endpoint($method, $path, $label) {
    try {
        $uri = "$($env:API_BASE_URL)$path"
        if ($method -eq 'GET') {
            $resp = Invoke-WebRequest -Uri $uri -Method GET -Headers $authHeaders -ErrorAction Stop
            Write-Host "[$label] $method $path => $($resp.StatusCode) OK"
        } else {
            $resp = Invoke-WebRequest -Uri $uri -Method POST -Headers $authHeaders -ErrorAction Stop
            Write-Host "[$label] $method $path => $($resp.StatusCode) OK"
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "[$label] $method $path => $statusCode"
    }
}

Test-Endpoint 'GET' '/org_units/export-excel' 'ORG_EXPORT Excel'
Test-Endpoint 'GET' '/org_units/export-pdf' 'ORG_EXPORT PDF'
Test-Endpoint 'GET' '/org_units/chart/export-pdf' 'ORG_CHART_EXPORT'
Test-Endpoint 'GET' '/departments/export-excel' 'DEPT_EXPORT Excel'
Test-Endpoint 'GET' '/departments/export-pdf' 'DEPT_EXPORT PDF'
Test-Endpoint 'GET' '/employees/export-excel' 'EMP_EXPORT Excel'
Test-Endpoint 'GET' '/employees/export-pdf' 'EMP_EXPORT PDF'
Test-Endpoint 'POST' '/employees/import-excel' 'EMP_IMPORT'
Test-Endpoint 'GET' '/positions/export-excel' 'POS_EXPORT Excel'
Test-Endpoint 'GET' '/positions/export-pdf' 'POS_EXPORT PDF'
