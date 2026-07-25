# E2E API Test - RBAC/Scope thật cho Task Assignment & 1-Level Approval (M1)
#
# Khắc phục P1-1 (review "M1 Demo Path & QA Handoff"): script cũ (test-api.ps1) chạy TOÀN BỘ
# lifecycle bằng token Super Admin -> chỉ chứng minh endpoint tồn tại, KHÔNG chứng minh:
#   - Nhân viên chỉ Start/Submit công việc giao cho phòng ban/mình.
#   - Người ngoài phòng ban bị chặn (403).
#   - Trưởng phòng đúng phòng ban mới được duyệt.
#   - Người nhận việc không tự duyệt được việc của mình.
#
# Script này KHÔNG dùng token Super Admin cho các bước nghiệp vụ - nó:
#   1) Dùng 1 lần token admin CHỈ để tạo fixture (department, 3 nhân viên kèm account, gán role/scope).
#   2) Đăng nhập THẬT bằng account của từng actor (staff/dept-head/outsider) rồi gọi API bằng token
#      của chính actor đó cho mọi action nghiệp vụ (start/submit/approve/reject).
#   3) Assert cả case PHẢI THÀNH CÔNG (200) lẫn case PHẢI BỊ CHẶN (403) theo đúng actor.
#   4) Tạo account atomic ngay khi tạo nhân sự (POST /employees kèm `password`) - không còn nhánh
#      "skip vì thiếu user_id" như script cũ.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/test-api-rbac.ps1

$ErrorActionPreference = "Stop"
if (-not $env:API_BASE_URL) { throw "Set API_BASE_URL env var (e.g. https://example.com/api/v1)" }
$baseUrl = $env:API_BASE_URL
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$codeSuffix = Get-Date -Format "HHmmss"
$testPassword = "E2eRbac@$codeSuffix"

$script:results = @()

function Assert-True {
    param([bool]$Condition, [string]$Name, [string]$Detail = "")
    if ($Condition) {
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        $script:results += [pscustomobject]@{ Name = $Name; Pass = $true; Detail = $Detail }
    } else {
        Write-Host "  [FAIL] $Name - $Detail" -ForegroundColor Red
        $script:results += [pscustomobject]@{ Name = $Name; Pass = $false; Detail = $Detail }
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers,
        $Body = $null
    )
    $uri = "$baseUrl$Path"
    try {
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 10
            return Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers -ContentType "application/json" -Body $json
        }
        return Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers
    } catch {
        $statusCode = $null
        $errBody = $null
        try {
            $resp = $_.Exception.Response
            if ($resp) {
                $statusCode = [int]$resp.StatusCode
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $errBody = $reader.ReadToEnd()
            }
        } catch {}
        if (-not $errBody -and $_.ErrorDetails.Message) { $errBody = $_.ErrorDetails.Message }
        $ex = New-Object System.Exception("HTTP call failed: $Method $Path - $($_.Exception.Message) - $errBody")
        $ex | Add-Member -NotePropertyName StatusCode -NotePropertyValue $statusCode -Force
        throw $ex
    }
}

# Gọi API và assert PHẢI trả về đúng $ExpectedStatus (mặc định 403) - dùng cho các case
# "actor sai phải bị chặn". Nếu API trả 200 (không bị chặn) -> FAIL rõ ràng, không phải catch im lặng.
function Invoke-ApiExpectStatus {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers,
        $Body = $null,
        [int]$ExpectedStatus = 403,
        [string]$Name
    )
    try {
        Invoke-Api -Method $Method -Path $Path -Headers $Headers -Body $Body | Out-Null
        Assert-True $false $Name "Ky vong HTTP $ExpectedStatus nhung API tra ve 200 (KHONG bi chan - lo hong RBAC/scope)"
    } catch {
        $actual = $_.Exception.StatusCode
        Assert-True ($actual -eq $ExpectedStatus) $Name "Ky vong HTTP $ExpectedStatus, thuc te: $actual - $($_.Exception.Message)"
    }
}

function Login {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingPlainTextForPassword', '')]
    param([string]$Email, [string]$Password)
    $resp = Invoke-Api -Method POST -Path "/auth/login" -Headers @{} -Body @{ email = $Email; password = $Password }
    return $resp.data.access_token
}

# ---------------------------------------------------------------------------
Write-Host "=== SETUP: login admin (chi de tao fixture, khong dung cho buoc nghiep vu) ===" -ForegroundColor Cyan
if (-not $env:QA_ADMIN_PASSWORD) { throw "Set QA_ADMIN_PASSWORD env var" }
$adminToken = Login -Email $env:QA_ADMIN_EMAIL -Password $env:QA_ADMIN_PASSWORD
Assert-True ($null -ne $adminToken -and $adminToken.Length -gt 10) "Login admin (setup only) tra ve access_token"
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

# org_unit_id=5 la phạm vi thật của account Super Admin tren moi truong staging (xem ghi chu
# trong test-api.ps1) - dung lai de tranh bug scope 403 khong lien quan RBAC nghiep vu dang test.
$scopedOrgUnitId = 5

Write-Host "`n=== SETUP: tao 2 phong ban (A = phong duoc giao viec, B = phong ngoai) ===" -ForegroundColor Cyan
$deptA = Invoke-Api -Method POST -Path "/departments" -Headers $adminHeaders -Body @{
    org_unit_id     = $scopedOrgUnitId
    code            = "RBAC-A-$codeSuffix"
    name            = "Phong RBAC A $stamp"
    department_type = "phong_ban"
    parent_id       = $null
}
Assert-True ($deptA.data.id -gt 0) "POST /departments tao Phong A thanh cong" "id=$($deptA.data.id)"
$deptAId = $deptA.data.id

$deptB = Invoke-Api -Method POST -Path "/departments" -Headers $adminHeaders -Body @{
    org_unit_id     = $scopedOrgUnitId
    code            = "RBAC-B-$codeSuffix"
    name            = "Phong RBAC B (ngoai) $stamp"
    department_type = "phong_ban"
    parent_id       = $null
}
Assert-True ($deptB.data.id -gt 0) "POST /departments tao Phong B (ngoai) thanh cong" "id=$($deptB.data.id)"
$deptBId = $deptB.data.id

Write-Host "`n=== SETUP: lay role_id cua EMPLOYEE / DEPT_HEAD tu catalog role that ===" -ForegroundColor Cyan
$roles = Invoke-Api -Method GET -Path "/roles" -Headers $adminHeaders
$employeeRole = $roles.data | Where-Object { $_.code -eq "EMPLOYEE" } | Select-Object -First 1
$deptHeadRole = $roles.data | Where-Object { $_.code -eq "DEPT_HEAD" } | Select-Object -First 1
Assert-True ($null -ne $employeeRole) "Tim thay role code=EMPLOYEE trong catalog" "id=$($employeeRole.id)"
Assert-True ($null -ne $deptHeadRole) "Tim thay role code=DEPT_HEAD trong catalog" "id=$($deptHeadRole.id)"

# ---------------------------------------------------------------------------
Write-Host "`n=== SETUP: tao 3 nhan su, roi cap account rieng (POST /employees/{id}/account) ===" -ForegroundColor Cyan
Write-Host "(BE hien tai TU CHOI truong 'password' luc tao nhan su moi - 422 'Khong duoc truyen mat khau" -ForegroundColor DarkGray
Write-Host " khi tao nhan vien' - khac voi ghi nhan cu trong TASK_BLOCKERS.md; da cap nhat script theo" -ForegroundColor DarkGray
Write-Host " dung hanh vi BE hien tai: tao nhan su TRUOC, cap account NGAY SAU do trong cung 1 setup" -ForegroundColor DarkGray
Write-Host " step - khong con nhanh 'skip vi thieu user_id' nhu script cu.)" -ForegroundColor DarkGray

$epochBase = [int64]([DateTimeOffset](Get-Date)).ToUnixTimeSeconds()

function New-TestEmployeeWithAccount {
    param([string]$Suffix, [string]$FullName, [int]$Index)
    $cccdBase = "00$epochBase"
    $cccd = $cccdBase.Substring(0, $cccdBase.Length - 1) + $Index
    $phoneDigits = ($epochBase % 100000000).ToString("00000000")
    $phone = "09" + $phoneDigits.Substring(0, $phoneDigits.Length - 1) + $Index
    $payload = @{
        full_name = $FullName
        gender    = 0
        birthday  = "1995-05-15"
        cccd      = $cccd
        phone     = $phone
        email     = "e2e.rbac.$Suffix.$stamp@example.com"
        address   = "So 1, Duong E2E RBAC, Q5, TP.HCM"
    }
    $created = Invoke-Api -Method POST -Path "/employees" -Headers $adminHeaders -Body $payload
    Assert-True ($created.data.id -gt 0) "POST /employees tao '$FullName' thanh cong" "employee_id=$($created.data.id)"
    $employeeId = $created.data.id

    $account = Invoke-Api -Method POST -Path "/employees/$employeeId/account" -Headers $adminHeaders -Body @{ password = $testPassword }
    Assert-True ($null -ne $account.data.email) `
        "POST /employees/$employeeId/account cap account thanh cong" "email=$($account.data.email), password_change_required=$($account.data.password_change_required)"

    $loginEmail = $account.data.email
    $tempToken = Login -Email $loginEmail -Password $testPassword
    Assert-True ($tempToken.Length -gt 10) "Login lan dau bang mat khau tam cho '$FullName' thanh cong"

    $finalPassword = $testPassword
    if ($account.data.password_change_required) {
        $finalPassword = "E2eRbacFinal@$codeSuffix$Index"
        $changeHeaders = @{ Authorization = "Bearer $tempToken" }
        Invoke-Api -Method POST -Path "/auth/change-password" -Headers $changeHeaders -Body @{
            current_password              = $testPassword
            new_password                  = $finalPassword
            new_password_confirmation     = $finalPassword
        } | Out-Null
        Assert-True $true "POST /auth/change-password doi mat khau bat buoc lan dau cho '$FullName' thanh cong"
    }

    # user_id can thiet de goi PUT /users/{id}/role-scopes - lay tu GET /employees/{id} sau khi co account.
    $employeeAfter = Invoke-Api -Method GET -Path "/employees/$employeeId" -Headers $adminHeaders
    Assert-True ($null -ne $employeeAfter.data.user_id) `
        "GET /employees/$employeeId tra ve user_id sau khi cap account (khong con thieu user_id)" "user_id=$($employeeAfter.data.user_id)"

    return @{ EmployeeId = $employeeId; UserId = $employeeAfter.data.user_id; Email = $loginEmail; Password = $finalPassword }
}

$staff = New-TestEmployeeWithAccount -Suffix "staff" -FullName "E2E RBAC Nhan Vien $stamp" -Index 1
$deptHead = New-TestEmployeeWithAccount -Suffix "head" -FullName "E2E RBAC Truong Phong $stamp" -Index 2
$outsider = New-TestEmployeeWithAccount -Suffix "out" -FullName "E2E RBAC Nguoi Ngoai $stamp" -Index 3

Write-Host "`n=== SETUP: tao Employee Assignment THAT cho tung nhan su (POST /employee-assignments) ===" -ForegroundColor Cyan
Write-Host "(RBAC scope (user_role_scopes) chi gan quyen; BE kiem tra 'thanh vien phong ban' qua" -ForegroundColor DarkGray
Write-Host " employee_assignments rieng - thieu buoc nay se van bi 403 du role/scope da dung.)" -ForegroundColor DarkGray
$positions = Invoke-Api -Method GET -Path "/positions" -Headers $adminHeaders
Assert-True ($positions.data.Count -gt 0) "GET /positions tra ve danh sach (can position_id de tao assignment)" "Count=$($positions.data.Count)"
$positionId = $positions.data[0].id

function New-DeptAssignment {
    param([int]$EmployeeId, [int]$DepartmentId, [string]$ActorName)
    $assignment = Invoke-Api -Method POST -Path "/employee-assignments" -Headers $adminHeaders -Body @{
        employee_id   = $EmployeeId
        org_unit_id   = $scopedOrgUnitId
        department_id = $DepartmentId
        position_id   = $positionId
        is_primary    = $true
        start_date    = (Get-Date).ToString("yyyy-MM-dd")
        end_date      = $null
        status        = 1
    }
    Assert-True ($assignment.data.id -gt 0) "POST /employee-assignments gan '$ActorName' vao phong (department_id=$DepartmentId)" "assignment_id=$($assignment.data.id)"
}

New-DeptAssignment -EmployeeId $staff.EmployeeId -DepartmentId $deptAId -ActorName "staff"
New-DeptAssignment -EmployeeId $deptHead.EmployeeId -DepartmentId $deptAId -ActorName "truong phong"
New-DeptAssignment -EmployeeId $outsider.EmployeeId -DepartmentId $deptBId -ActorName "nguoi ngoai"

Write-Host "`n=== SETUP: gan role + scope THAT cho tung actor (PUT /users/{id}/role-scopes) ===" -ForegroundColor Cyan
$grantStaff = Invoke-Api -Method PUT -Path "/users/$($staff.UserId)/role-scopes" -Headers $adminHeaders -Body @{
    grants = @(@{ role_id = $employeeRole.id; scope_type = "phong_ban"; department_id = $deptAId })
}
Assert-True ($grantStaff.success -eq $true) "Gan role EMPLOYEE + scope Phong A cho staff" "user_id=$($staff.UserId)"

$grantHead = Invoke-Api -Method PUT -Path "/users/$($deptHead.UserId)/role-scopes" -Headers $adminHeaders -Body @{
    grants = @(@{ role_id = $deptHeadRole.id; scope_type = "phong_ban"; department_id = $deptAId })
}
Assert-True ($grantHead.success -eq $true) "Gan role DEPT_HEAD + scope Phong A cho truong phong" "user_id=$($deptHead.UserId)"

$grantOutsider = Invoke-Api -Method PUT -Path "/users/$($outsider.UserId)/role-scopes" -Headers $adminHeaders -Body @{
    grants = @(@{ role_id = $employeeRole.id; scope_type = "phong_ban"; department_id = $deptBId })
}
Assert-True ($grantOutsider.success -eq $true) "Gan role EMPLOYEE + scope Phong B (ngoai) cho nguoi ngoai" "user_id=$($outsider.UserId)"

# ---------------------------------------------------------------------------
Write-Host "`n=== SETUP: dang nhap THAT bang tung account (khong dung token admin nua) ===" -ForegroundColor Cyan
$staffToken = Login -Email $staff.Email -Password $staff.Password
Assert-True ($staffToken.Length -gt 10) "Login THAT bang account staff"
$staffHeaders = @{ Authorization = "Bearer $staffToken" }

$headToken = Login -Email $deptHead.Email -Password $deptHead.Password
Assert-True ($headToken.Length -gt 10) "Login THAT bang account truong phong"
$headHeaders = @{ Authorization = "Bearer $headToken" }

$outsiderToken = Login -Email $outsider.Email -Password $outsider.Password
Assert-True ($outsiderToken.Length -gt 10) "Login THAT bang account nguoi ngoai"
$outsiderHeaders = @{ Authorization = "Bearer $outsiderToken" }

function New-DeptTask {
    param([string]$Title)
    $task = Invoke-Api -Method POST -Path "/tasks" -Headers $adminHeaders -Body @{
        type            = "task"
        title            = "$Title $stamp"
        description     = "Task E2E RBAC test, giao cho Phong A"
        priority        = "P1"
        assignee_dept_id = $deptAId
        approver_id     = $deptHead.EmployeeId
        due_date        = (Get-Date).AddDays(7).ToString("yyyy-MM-dd HH:mm:ss")
    }
    return $task.data
}

# ---------------------------------------------------------------------------
Write-Host "`n=== SCENARIO 1: Nhan vien trong phong tu nhan viec (self-claim) + submit ===" -ForegroundColor Cyan
$task1 = New-DeptTask -Title "RBAC Approve Path"
$task1Id = $task1.id
Assert-True ($task1Id -gt 0) "Tao task1 (giao Phong A) thanh cong" "id=$task1Id"

$start1 = Invoke-Api -Method POST -Path "/tasks/$task1Id/start" -Headers $staffHeaders
Assert-True ($start1.data.status -eq "processing") "Staff (dung phong) POST /start -> processing" "status=$($start1.data.status)"

$submit1 = Invoke-Api -Method POST -Path "/tasks/$task1Id/submit" -Headers $staffHeaders
Assert-True ($submit1.data.status -eq "pending_approval") "Staff POST /submit -> pending_approval" "status=$($submit1.data.status)"

Write-Host "`n=== SCENARIO 2: Nguoi NGOAI phong ban KHONG duoc tu nhan viec cua phong khac ===" -ForegroundColor Cyan
$task2 = New-DeptTask -Title "RBAC Outsider Block"
$task2Id = $task2.id
Invoke-ApiExpectStatus -Method POST -Path "/tasks/$task2Id/start" -Headers $outsiderHeaders -ExpectedStatus 403 `
    -Name "Nguoi ngoai phong ban KHONG start duoc task cua Phong A (403)"

Write-Host "`n=== SCENARIO 3: Truong phong DUNG phong duyet -> completed ===" -ForegroundColor Cyan
$approve1 = Invoke-Api -Method POST -Path "/tasks/$task1Id/approve" -Headers $headHeaders
Assert-True ($approve1.data.status -eq "completed") "Truong phong (dung phong, la approver chi dinh) POST /approve -> completed" "status=$($approve1.data.status)"

Write-Host "`n=== SCENARIO 4: Nguoi nhan viec KHONG duoc tu duyet viec cua chinh minh ===" -ForegroundColor Cyan
$task3 = New-DeptTask -Title "RBAC Self-Approve Block"
$task3Id = $task3.id
Invoke-Api -Method POST -Path "/tasks/$task3Id/start" -Headers $staffHeaders | Out-Null
Invoke-Api -Method POST -Path "/tasks/$task3Id/submit" -Headers $staffHeaders | Out-Null
Invoke-ApiExpectStatus -Method POST -Path "/tasks/$task3Id/approve" -Headers $staffHeaders -ExpectedStatus 403 `
    -Name "Staff KHONG tu duyet duoc viec cua chinh minh (403)"

Write-Host "`n=== SCENARIO 5: Nguoi ngoai phong ban KHONG duoc duyet task khong thuoc minh ===" -ForegroundColor Cyan
Invoke-ApiExpectStatus -Method POST -Path "/tasks/$task3Id/approve" -Headers $outsiderHeaders -ExpectedStatus 403 `
    -Name "Nguoi ngoai phong ban KHONG duyet duoc task cua Phong A (403)"

Write-Host "`n=== SCENARIO 6: Truong phong reject kem ly do -> rejected ===" -ForegroundColor Cyan
$task4 = New-DeptTask -Title "RBAC Reject Path"
$task4Id = $task4.id
Invoke-Api -Method POST -Path "/tasks/$task4Id/start" -Headers $staffHeaders | Out-Null
Invoke-Api -Method POST -Path "/tasks/$task4Id/submit" -Headers $staffHeaders | Out-Null
$rejectNote = "E2E RBAC test: tu choi de kiem tra workflow that."
$reject1 = Invoke-Api -Method POST -Path "/tasks/$task4Id/reject" -Headers $headHeaders -Body @{ note = $rejectNote }
Assert-True ($reject1.data.status -eq "rejected") "Truong phong POST /reject -> rejected" "status=$($reject1.data.status)"
Assert-True ($reject1.data.reject_reason -eq $rejectNote) "reject_reason luu dung noi dung note gui len (bang token truong phong, khong phai admin)"

# ---------------------------------------------------------------------------
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
$total = $script:results.Count
$passed = ($script:results | Where-Object { $_.Pass }).Count
$failed = $total - $passed

$script:results | ForEach-Object {
    $mark = if ($_.Pass) { "PASS" } else { "FAIL" }
    Write-Host "[$mark] $($_.Name)"
}

Write-Host "`nTotal: $total | Passed: $passed | Failed: $failed"
Write-Host "Run timestamp: $stamp | Base URL: $baseUrl"
Write-Host "Fixture (giu lai tren staging de doi chieu): DeptA id=$deptAId, DeptB id=$deptBId, staff emp_id=$($staff.EmployeeId), depthead emp_id=$($deptHead.EmployeeId), outsider emp_id=$($outsider.EmployeeId), task1=$task1Id(completed) task2=$task2Id(assigned,blocked) task3=$task3Id(pending_approval,blocked) task4=$task4Id(rejected)"

if ($failed -gt 0) {
    Write-Host "`n=== E2E RBAC TEST FAILED ($failed/$total) ===" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n=== ALL E2E RBAC TESTS PASSED ($passed/$total) - actor that, khong phai Super Admin bypass ===" -ForegroundColor Green
    exit 0
}
