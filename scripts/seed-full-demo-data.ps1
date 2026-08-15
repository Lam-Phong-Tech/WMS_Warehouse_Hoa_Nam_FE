# ============================================================================
# Script: Seed Full Demo Data (toàn bộ nghiệp vụ WMS Hòa Nam)
# Mục đích: Tạo dữ liệu mẫu đầy đủ trạng thái cho các module:
#   1. SKU / Product Master
#   2. Đại lý (Agency)
#   3. Danh mục lỗi (Defect Catalog)
#   4. Phiếu nhập (Inbound)
#   5. Linh kiện chờ xếp khay / Lịch sử putaway
#   6. Phiếu xuất (Outbound)
#   7. Bảo hành (Warranty)
#   8. Tồn kho & đối soát (tự sinh từ inbound/outbound POSTED)
#   9. Phiếu Reversal
#   10. Báo cáo vận hành (tự tính từ dữ liệu trên, không seed riêng)
# Usage: .\scripts\seed-full-demo-data.ps1
# ============================================================================

param(
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$Email = "admin@gmail.com",
    [string]$Password = "Cntt@1234"
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message, [ValidateSet("Info", "Success", "Error", "Warning", "Step")]$Level = "Info")
    $colors = @{ "Info" = "Cyan"; "Success" = "Green"; "Error" = "Red"; "Warning" = "Yellow"; "Step" = "Magenta" }
    Write-Host $Message -ForegroundColor $colors[$Level]
}

function New-IdemKey {
    param([string]$Prefix = "seed")
    return "$Prefix-$([guid]::NewGuid().ToString())"
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Path,
        $Body = $null,
        [hashtable]$ExtraHeaders = @{},
        [switch]$AllowFail
    )
    $uri = "$BaseUrl$Path"
    $headers = $script:AuthHeaders.Clone()
    foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }
    try {
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 10
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $bytes -ErrorAction Stop
        } else {
            return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -ErrorAction Stop
        }
    } catch {
        $msg = $_.Exception.Message
        $respBody = $null
        try {
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $respBody = $reader.ReadToEnd()
            }
        } catch {}
        if ($AllowFail) {
            Write-Status "  [SKIP] $Method $Path -> $msg $respBody" -Level "Warning"
            return $null
        } else {
            Write-Status "  [FAIL] $Method $Path -> $msg $respBody" -Level "Error"
            throw
        }
    }
}

$script:counters = @{ ok = 0; fail = 0 }
function Track($result) {
    if ($null -ne $result) { $script:counters.ok++ } else { $script:counters.fail++ }
}

# ============================================================================
# BƯỚC 0: Đăng nhập
# ============================================================================
Write-Status "`n=== BƯỚC 0: Đăng nhập ===" -Level "Step"
$loginResp = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -ContentType "application/json" `
    -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
$token = $loginResp.data.access_token
$script:AuthHeaders = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
Write-Status "Đăng nhập thành công" -Level "Success"

$ts = Get-Date -Format 'yyyyMMddHHmmss'

# Lấy kho ACTIVE duy nhất
$warehouses = Invoke-Api -Method GET -Path "/warehouses"
$warehouseId = $warehouses.data[0].id
Write-Status "Kho: $($warehouses.data[0].name) ($warehouseId)" -Level "Info"

# ============================================================================
# BƯỚC 1: SKU / Product Master (mục tiêu: 10 SKU, đủ ACTIVE + INACTIVE)
# ============================================================================
Write-Status "`n=== BƯỚC 1: SKU / Product Master ===" -Level "Step"

$skuDefs = @(
    @{ code = "HN-SKU-$ts-01"; name = "Máy bơm nước Hòa Nam PV-100"; type = "PRODUCT"; unit = "cái"; serial = $false }
    @{ code = "HN-SKU-$ts-02"; name = "Máy phát điện Hòa Nam GEN-5000"; type = "PRODUCT"; unit = "cái"; serial = $false }
    @{ code = "HN-SKU-$ts-03"; name = "Máy cắt cỏ Hòa Nam MC-250"; type = "PRODUCT"; unit = "cái"; serial = $false }
    @{ code = "HN-SKU-$ts-04"; name = "Máy xịt rửa áp lực Hòa Nam XR-80"; type = "PRODUCT"; unit = "cái"; serial = $true }
    @{ code = "HN-SKU-$ts-05"; name = "Máy khoan cầm tay Hòa Nam KT-13"; type = "PRODUCT"; unit = "cái"; serial = $true }
    @{ code = "HN-SKU-$ts-06"; name = "Bo mạch điều khiển động cơ"; type = "COMPONENT"; unit = "cái"; serial = $false }
    @{ code = "HN-SKU-$ts-07"; name = "Cuộn dây stator máy phát"; type = "COMPONENT"; unit = "cái"; serial = $false }
    @{ code = "HN-SKU-$ts-08"; name = "Bơm cao áp XR-80"; type = "COMPONENT"; unit = "cái"; serial = $false }
    @{ code = "HN-SKU-$ts-09"; name = "Máy hàn điện tử Hòa Nam WD-200 (ngừng KD)"; type = "PRODUCT"; unit = "cái"; serial = $true }
    @{ code = "HN-SKU-$ts-10"; name = "Lưỡi cắt cỏ hợp kim (ngừng KD)"; type = "COMPONENT"; unit = "cái"; serial = $false }
)

$skus = @()
foreach ($d in $skuDefs) {
    $body = @{ sku_code = $d.code; sku_name = $d.name; sku_type = $d.type; unit = $d.unit; is_serial_tracked = $d.serial }
    $r = Invoke-Api -Method POST -Path "/products" -Body $body -AllowFail
    Track $r
    if ($r) {
        $skus += $r.data
        Write-Status "  + SKU $($d.code) [$($d.type)] -> $($r.data.status)" -Level "Success"
    }
}

# Đưa 2 SKU cuối về INACTIVE để có đủ trạng thái
foreach ($idx in @(8, 9)) {
    if ($skus.Count -gt $idx) {
        $s = $skus[$idx]
        $r = Invoke-Api -Method PATCH -Path "/products/$($s.sku_id)" -Body @{ status = "INACTIVE" } -AllowFail
        Track $r
        if ($r) { Write-Status "  ~ SKU $($s.sku_code) -> INACTIVE" -Level "Success" }
    }
}

$allProductSkus = $skus | Where-Object { $_.sku_type -eq "PRODUCT" -and $_.status -eq "ACTIVE" }
$productSkus = $allProductSkus | Where-Object { -not $_.is_serial_tracked }
if ($productSkus.Count -eq 0) { $productSkus = $allProductSkus }
$componentSkus = $skus | Where-Object { $_.sku_type -eq "COMPONENT" -and $_.status -eq "ACTIVE" }
Write-Status "Tổng SKU tạo được: $($skus.Count) (PRODUCT non-serial dùng để POSTED: $($productSkus.Count), COMPONENT active: $($componentSkus.Count))" -Level "Info"

# ============================================================================
# BƯỚC 2: Đại lý (Agency) - mục tiêu 8 bản ghi, đủ ACTIVE/INACTIVE
# ============================================================================
Write-Status "`n=== BƯỚC 2: Đại lý / nơi nhận ===" -Level "Step"

$agencyDefs = @(
    @{ code = "AG-$ts-01"; name = "Đại lý Hòa Nam Hà Nội"; phone = "0901000001"; addr = "12 Láng Hạ, Đống Đa, Hà Nội"; status = "ACTIVE" }
    @{ code = "AG-$ts-02"; name = "Đại lý Hòa Nam Hải Phòng"; phone = "0901000002"; addr = "45 Lạch Tray, Ngô Quyền, Hải Phòng"; status = "ACTIVE" }
    @{ code = "AG-$ts-03"; name = "Đại lý Hòa Nam Đà Nẵng"; phone = "0901000003"; addr = "88 Nguyễn Văn Linh, Đà Nẵng"; status = "ACTIVE" }
    @{ code = "AG-$ts-04"; name = "Đại lý Hòa Nam Nha Trang"; phone = "0901000004"; addr = "321 Trần Phú, Nha Trang"; status = "ACTIVE" }
    @{ code = "AG-$ts-05"; name = "Đại lý Hòa Nam Cần Thơ"; phone = "0901000005"; addr = "555 Quang Trung, Cần Thơ"; status = "ACTIVE" }
    @{ code = "AG-$ts-06"; name = "Đại lý Hòa Nam TP.HCM"; phone = "0901000006"; addr = "456 Nguyễn Trãi, Quận 11, TP.HCM"; status = "ACTIVE" }
    @{ code = "AG-$ts-07"; name = "Đại lý Hòa Nam Long Xuyên (đã ngừng)"; phone = "0901000007"; addr = "789 Trần Hưng Đạo, Long Xuyên"; status = "INACTIVE" }
    @{ code = "AG-$ts-08"; name = "Đại lý Hòa Nam Buôn Ma Thuột (đã ngừng)"; phone = "0901000008"; addr = "22 Y Jut, Buôn Ma Thuột"; status = "INACTIVE" }
)
$agencies = @()
foreach ($d in $agencyDefs) {
    $r = Invoke-Api -Method POST -Path "/agencies" -Body @{ agency_code = $d.code; agency_name = $d.name; phone = $d.phone; address = $d.addr; status = $d.status } -AllowFail
    Track $r
    if ($r) { $agencies += $r.data; Write-Status "  + Đại lý $($d.code) [$($d.status)]" -Level "Success" }
}

# ============================================================================
# BƯỚC 3: Danh mục lỗi (Defect Catalog) - mục tiêu 8 bản ghi
# ============================================================================
Write-Status "`n=== BƯỚC 3: Danh mục bệnh / lỗi ===" -Level "Step"

$defectDefs = @(
    @{ code = "DEF-$ts-01"; name = "Trầy xước bề mặt"; desc = "Trầy xước ngoại quan không ảnh hưởng chức năng"; status = "ACTIVE" }
    @{ code = "DEF-$ts-02"; name = "Vỡ/nứt vỏ máy"; desc = "Vỡ hoặc nứt vỏ ngoài của thiết bị"; status = "ACTIVE" }
    @{ code = "DEF-$ts-03"; name = "Không khởi động được"; desc = "Máy không lên nguồn hoặc không khởi động"; status = "ACTIVE" }
    @{ code = "DEF-$ts-04"; name = "Rò rỉ dầu/nhớt"; desc = "Rò rỉ dầu hoặc nhớt bôi trơn"; status = "ACTIVE" }
    @{ code = "DEF-$ts-05"; name = "Tiếng ồn bất thường"; desc = "Phát ra tiếng ồn lạ khi vận hành"; status = "ACTIVE" }
    @{ code = "DEF-$ts-06"; name = "Lỗi bo mạch điều khiển"; desc = "Bo mạch điều khiển bị lỗi hoặc cháy"; status = "ACTIVE" }
    @{ code = "DEF-$ts-07"; name = "Motor yếu / mất công suất"; desc = "Động cơ hoạt động yếu, không đạt công suất"; status = "ACTIVE" }
    @{ code = "DEF-$ts-08"; name = "Lỗi cũ đã gộp (ngừng dùng)"; desc = "Mã lỗi cũ không còn sử dụng"; status = "INACTIVE" }
)
$defects = @()
foreach ($d in $defectDefs) {
    $r = Invoke-Api -Method POST -Path "/defect-catalogs" -Body @{ defect_code = $d.code; defect_name = $d.name; description = $d.desc; status = $d.status } -AllowFail
    Track $r
    if ($r) { $defects += $r.data; Write-Status "  + Lỗi $($d.code) [$($d.status)]" -Level "Success" }
}
$activeDefects = $defects | Where-Object { $_.status -eq "ACTIVE" }

# ============================================================================
# BƯỚC 4: Phiếu nhập (Inbound) - mục tiêu 8-10 phiếu, đủ DRAFT/SCANNING/POSTED/CANCELLED
# ============================================================================
Write-Status "`n=== BƯỚC 4: Phiếu nhập (Inbound) ===" -Level "Step"

function New-InboundDoc {
    param([string]$SourceName, [array]$Lines, [string]$Note)
    $body = @{
        doc_date = (Get-Date -Format 'yyyy-MM-dd')
        dst_warehouse_id = $warehouseId
        source_name = $SourceName
        note = $Note
        lines = $Lines
    }
    return Invoke-Api -Method POST -Path "/inbound-documents" -Body $body -AllowFail
}

$postedInbound = @()   # documents đưa lên POSTED (cần cho warranty item + reversal)
$allInbound = @()

# --- 3 phiếu POSTED (đầy đủ) dùng SKU PRODUCT để sau này có item_instances cho outbound/warranty ---
# PRODUCT line luôn bắt buộc scan theo item_id cụ thể (kể cả khi is_serial_tracked=false),
# nên phải tạo item_instances trước rồi scan quantity=1 từng item.
$createdItemInstances = @()
for ($i = 0; $i -lt 3; $i++) {
    if ($productSkus.Count -eq 0) { break }
    $p = $productSkus[$i % $productSkus.Count]
    $qty = 3
    $lines = @(@{ product_id = $p.sku_id; qty_planned = $qty })
    $doc = New-InboundDoc -SourceName "NCC Hòa Nam Central $i" -Lines $lines -Note "Nhập hàng định kỳ POSTED #$i"
    Track $doc
    if (-not $doc) { continue }
    $d = $doc.data
    $ver = $d.version
    $line = $d.lines[0]
    $scanOk = $true
    for ($j = 0; $j -lt $qty; $j++) {
        $itemResp = Invoke-Api -Method POST -Path "/item-instances" -Body @{ sku_id = $p.sku_id } -AllowFail
        Track $itemResp
        if (-not $itemResp) { $scanOk = $false; break }
        $createdItemInstances += $itemResp.data
        $scanBody = @{ line_id = $line.id; quantity = 1; item_id = $itemResp.data.item_id }
        $scanResp = Invoke-Api -Method POST -Path "/inbound-documents/$($d.id)/scan" -Body $scanBody -ExtraHeaders @{ "If-Match" = "$ver" } -AllowFail
        Track $scanResp
        if (-not $scanResp) { $scanOk = $false; break }
        $ver = $scanResp.data.version
    }
    if (-not $scanOk) { $allInbound += $d; continue }
    $postResp = Invoke-Api -Method POST -Path "/inbound-documents/$($d.id)/post-receipt" -Body @{} `
        -ExtraHeaders @{ "If-Match" = "$ver"; "Idempotency-Key" = (New-IdemKey "inb-post") } -AllowFail
    Track $postResp
    if ($postResp) {
        Write-Status "  + Phiếu nhập $($d.doc_no) -> POSTED" -Level "Success"
        $fullDoc = Invoke-Api -Method GET -Path "/inbound-documents/$($d.id)" -AllowFail
        if ($fullDoc) { $postedInbound += $fullDoc.data; $allInbound += $fullDoc.data } else { $allInbound += $d }
    } else {
        $allInbound += $d
    }
}

# --- 2 phiếu COMPONENT POSTED riêng (để có box cho putaway) ---
$componentInboundDocs = @()
for ($i = 0; $i -lt 3; $i++) {
    if ($componentSkus.Count -eq 0) { break }
    $c = $componentSkus[$i % $componentSkus.Count]
    $lines = @(@{ product_id = $c.sku_id; qty_planned = 10 })
    $doc = New-InboundDoc -SourceName "NCC Linh kiện Hòa Nam $i" -Lines $lines -Note "Nhập linh kiện chờ xếp khay #$i"
    Track $doc
    if (-not $doc) { continue }
    $d = $doc.data
    $ver = $d.version
    $line = $d.lines[0]
    # đăng ký box cho line COMPONENT trước khi scan
    $boxResp = Invoke-Api -Method POST -Path "/inbound-documents/$($d.id)/boxes" -Body @{ line_id = $line.id; box_code = "BOX-$ts-$i" } -AllowFail
    Track $boxResp
    if (-not $boxResp) { $allInbound += $d; continue }
    $boxContainerId = $boxResp.data.container_id
    $scanBody = @{ line_id = $line.id; quantity = 10; container_id = $boxContainerId }
    $scanResp = Invoke-Api -Method POST -Path "/inbound-documents/$($d.id)/scan" -Body $scanBody -ExtraHeaders @{ "If-Match" = "$ver" } -AllowFail
    Track $scanResp
    if ($scanResp) { $ver = $scanResp.data.version }
    $postResp = Invoke-Api -Method POST -Path "/inbound-documents/$($d.id)/post-receipt" -Body @{} `
        -ExtraHeaders @{ "If-Match" = "$ver"; "Idempotency-Key" = (New-IdemKey "inb-post") } -AllowFail
    Track $postResp
    if ($postResp) {
        Write-Status "  + Phiếu nhập linh kiện $($d.doc_no) -> POSTED, box=$boxContainerId" -Level "Success"
        $fullDoc = Invoke-Api -Method GET -Path "/inbound-documents/$($d.id)" -AllowFail
        if ($fullDoc) { $componentInboundDocs += @{ doc = $fullDoc.data; boxContainerId = $boxContainerId }; $allInbound += $fullDoc.data }
        else { $allInbound += $d }
    } else {
        $allInbound += $d
    }
}

# --- 2 phiếu ở SCANNING (scan 1 phần, không post) ---
for ($i = 0; $i -lt 2; $i++) {
    if ($productSkus.Count -eq 0) { break }
    $p = $productSkus[($i + 1) % $productSkus.Count]
    $lines = @(@{ product_id = $p.sku_id; qty_planned = 20 })
    $doc = New-InboundDoc -SourceName "NCC Hòa Nam Partial $i" -Lines $lines -Note "Đang quét dở dang #$i"
    Track $doc
    if (-not $doc) { continue }
    $d = $doc.data
    $line = $d.lines[0]
    $itemResp = Invoke-Api -Method POST -Path "/item-instances" -Body @{ sku_id = $p.sku_id } -AllowFail
    Track $itemResp
    $scanResp = $null
    if ($itemResp) {
        $createdItemInstances += $itemResp.data
        $scanResp = Invoke-Api -Method POST -Path "/inbound-documents/$($d.id)/scan" -Body @{ line_id = $line.id; quantity = 1; item_id = $itemResp.data.item_id } -ExtraHeaders @{ "If-Match" = "$($d.version)" } -AllowFail
        Track $scanResp
    }
    if ($scanResp) { $allInbound += $scanResp.data; Write-Status "  + Phiếu nhập $($d.doc_no) -> SCANNING" -Level "Success" }
    else { $allInbound += $d }
}

# --- 1 phiếu DRAFT (không động vào) ---
if ($productSkus.Count -gt 0) {
    $p = $productSkus[0]
    $doc = New-InboundDoc -SourceName "NCC Hòa Nam Draft" -Lines @(@{ product_id = $p.sku_id; qty_planned = 30 }) -Note "Phiếu nháp chưa xử lý"
    Track $doc
    if ($doc) { $allInbound += $doc.data; Write-Status "  + Phiếu nhập $($doc.data.doc_no) -> DRAFT" -Level "Success" }
}

# --- 2 phiếu CANCELLED ---
for ($i = 0; $i -lt 2; $i++) {
    if ($productSkus.Count -eq 0) { break }
    $p = $productSkus[($i + 2) % $productSkus.Count]
    $doc = New-InboundDoc -SourceName "NCC Hòa Nam Cancel $i" -Lines @(@{ product_id = $p.sku_id; qty_planned = 10 }) -Note "Phiếu sẽ bị hủy #$i"
    Track $doc
    if (-not $doc) { continue }
    $d = $doc.data
    $cancelResp = Invoke-Api -Method POST -Path "/inbound-documents/$($d.id)/cancel" -Body @{ reason = "Sai thông tin nhà cung cấp, hủy phiếu #$i" } -ExtraHeaders @{ "If-Match" = "$($d.version)" } -AllowFail
    Track $cancelResp
    if ($cancelResp) { $allInbound += $cancelResp.data; Write-Status "  + Phiếu nhập $($d.doc_no) -> CANCELLED" -Level "Success" }
    else { $allInbound += $d }
}

Write-Status "Tổng phiếu nhập: $($allInbound.Count), trong đó POSTED: $($postedInbound.Count + $componentInboundDocs.Count)" -Level "Info"

# ============================================================================
# BƯỚC 5: Linh kiện chờ xếp khay (Putaway) - tab "chờ xếp khay" + "lịch sử"
# ============================================================================
Write-Status "`n=== BƯỚC 5: Linh kiện chờ xếp khay (Putaway) ===" -Level "Step"

# Tạo các TRAY đích để putaway vào
$trays = @()
for ($i = 0; $i -lt 3; $i++) {
    $r = Invoke-Api -Method POST -Path "/containers" -Body @{ container_code = "TRAY-$ts-$i"; container_type = "TRAY" } -AllowFail
    Track $r
    if ($r) { $trays += $r.data; Write-Status "  + Tạo khay $($r.data.container_code)" -Level "Success" }
}

if ($componentInboundDocs.Count -gt 0 -and $trays.Count -gt 0) {
    # Box đầu tiên: giữ nguyên ở "chờ xếp khay" (không confirm)
    $pending = $componentInboundDocs[0]
    Write-Status "  Box $($pending.boxContainerId) giữ nguyên trạng thái RECEIVED_PENDING_PUTAWAY (tab chờ xếp khay)" -Level "Info"

    # Các box còn lại: tạo task + confirm -> STORED (tab lịch sử)
    for ($i = 1; $i -lt $componentInboundDocs.Count; $i++) {
        $box = $componentInboundDocs[$i]
        $tray = $trays[($i - 1) % $trays.Count]
        $taskResp = Invoke-Api -Method POST -Path "/putaway/tasks" -Body @{ box_container_id = $box.boxContainerId; to_tray_id = $tray.container_id; location_hint = "Kệ A$i" } -AllowFail
        Track $taskResp
        if (-not $taskResp) { continue }
        $taskId = $taskResp.data.id
        $taskVer = $taskResp.data.version
        $confirmResp = Invoke-Api -Method POST -Path "/putaway/tasks/$taskId/confirm" -Body @{} -ExtraHeaders @{ "If-Match" = "$taskVer" } -AllowFail
        Track $confirmResp
        if ($confirmResp) { Write-Status "  + Xếp khay box $($box.boxContainerId) -> STORED (tab lịch sử)" -Level "Success" }
    }
}

# ============================================================================
# BƯỚC 6: Phiếu xuất (Outbound) - qua luồng import -> consume
# ============================================================================
Write-Status "`n=== BƯỚC 6: Phiếu xuất (Outbound) ===" -Level "Step"

$outboundDocs = @()

if ($productSkus.Count -gt 0 -and $agencies.Count -gt 0) {
    $rows = @()
    for ($i = 0; $i -lt 6; $i++) {
        $p = $productSkus[$i % $productSkus.Count]
        $rows += @{
            request_no = "REQ-$ts-$('{0:D3}' -f $i)"
            sku_code = $p.sku_code
            required_qty = 2 + $i
            recipient_name = "Khách hàng Hòa Nam $i"
            recipient_address = "Số $i, Đường ABC, Quận XYZ"
            note = "Đơn hàng mẫu #$i"
        }
    }
    $importResp = Invoke-Api -Method POST -Path "/outbound-request-imports" -Body @{ rows = $rows } -AllowFail
    Track $importResp
    if ($importResp) {
        $importId = $importResp.data.import.id
        Write-Status "  + Import request thành công, id=$importId" -Level "Success"
        $consumeResp = Invoke-Api -Method POST -Path "/outbound-request-imports/$importId/consume" -Body @{} `
            -ExtraHeaders @{ "Idempotency-Key" = (New-IdemKey "obr-consume") } -AllowFail
        Track $consumeResp
        if ($consumeResp) {
            $docIds = $consumeResp.data.outbound_document_ids
            Write-Status "  + Consume thành công, sinh $($docIds.Count) phiếu xuất DRAFT" -Level "Success"
            foreach ($id in $docIds) {
                $doc = Invoke-Api -Method GET -Path "/outbound-documents/$id" -AllowFail
                Track $doc
                if ($doc) { $outboundDocs += $doc.data }
            }
        }
    }
}

# Đưa 2 phiếu đầu sang SCANNING (scan 1 phần, dùng item IN_STOCK sẵn có từ inbound POSTED), 1 phiếu sang CANCELLED, còn lại giữ DRAFT
for ($i = 0; $i -lt $outboundDocs.Count; $i++) {
    $d = $outboundDocs[$i]
    if ($i -lt 2 -and $d.lines -and $d.lines.Count -gt 0) {
        $line = $d.lines[0]
        $matchItem = $createdItemInstances | Where-Object { $_.sku_id -eq $line.product_id } | Select-Object -First 1
        $scanBody = @{ line_id = $line.id; quantity = 1 }
        if ($matchItem) { $scanBody["item_id"] = $matchItem.item_id }
        $scanResp = Invoke-Api -Method POST -Path "/outbound-documents/$($d.id)/scan" -Body $scanBody -ExtraHeaders @{ "If-Match" = "$($d.version)" } -AllowFail
        Track $scanResp
        if ($scanResp) { $outboundDocs[$i] = $scanResp.data; Write-Status "  + Phiếu xuất $($d.doc_no) -> SCANNING" -Level "Success" }
    } elseif ($i -eq 2) {
        $cancelResp = Invoke-Api -Method POST -Path "/outbound-documents/$($d.id)/cancel" -Body @{ reason = "Khách hủy đơn hàng" } -ExtraHeaders @{ "If-Match" = "$($d.version)" } -AllowFail
        Track $cancelResp
        if ($cancelResp) { $outboundDocs[$i] = $cancelResp.data; Write-Status "  + Phiếu xuất $($d.doc_no) -> CANCELLED" -Level "Success" }
    } else {
        Write-Status "  + Phiếu xuất $($d.doc_no) giữ nguyên DRAFT" -Level "Info"
    }
}
Write-Status "Lưu ý: bỏ qua trạng thái POSTED cho outbound vì backend yêu cầu in nhãn qua printer_config thật (agent_endpoint reachable) mới cho post-issue." -Level "Warning"

# ============================================================================
# BƯỚC 7: Bảo hành (Warranty) - đủ RECEIVED/CHECKING/REPAIRING/COMPLETED/RETURNED/CANCELLED
# ============================================================================
Write-Status "`n=== BƯỚC 7: Bảo hành (Warranty) ===" -Level "Step"

function New-WarrantyCase {
    param([string]$CustomerName, [string]$CustomerPhone, [string]$Desc, $DefectId, $DefectCode)
    $body = @{
        customer_name = $CustomerName
        customer_phone = $CustomerPhone
        customer_address = "Địa chỉ khách hàng $CustomerName"
        description = $Desc
        reported_defect = $Desc
        accessories_received = "Đầy đủ phụ kiện"
        received_condition = "Còn nguyên vẹn, có dấu hiệu hư hỏng theo mô tả"
        missing_code_reason = "Không xác định được mã máy, khách mang tới trực tiếp"
        manual_product_description = "Máy móc Hòa Nam theo mô tả khách hàng, chưa định danh serial"
    }
    if ($DefectId) { $body["defect_id"] = $DefectId } elseif ($DefectCode) { $body["defect_code"] = $DefectCode }
    return Invoke-Api -Method POST -Path "/warranty-cases" -Body $body -ExtraHeaders @{ "Idempotency-Key" = (New-IdemKey "warr-create") } -AllowFail
}

$warrantyTargets = @(
    @{ status = "RECEIVED"; name = "Nguyễn Văn An"; phone = "0911000001" }
    @{ status = "RECEIVED"; name = "Trần Thị Bình"; phone = "0911000002" }
    @{ status = "CHECKING"; name = "Lê Văn Cường"; phone = "0911000003" }
    @{ status = "CHECKING"; name = "Phạm Thị Dung"; phone = "0911000004" }
    @{ status = "REPAIRING"; name = "Hoàng Văn Em"; phone = "0911000005" }
    @{ status = "REPAIRING"; name = "Vũ Thị Phương"; phone = "0911000006" }
    @{ status = "COMPLETED"; name = "Đặng Văn Giang"; phone = "0911000007" }
    @{ status = "RETURNED"; name = "Bùi Thị Hoa"; phone = "0911000008" }
    @{ status = "RETURNED"; name = "Ngô Văn Inh"; phone = "0911000009" }
    @{ status = "CANCELLED"; name = "Đỗ Thị Kim"; phone = "0911000010" }
)

$transitionPath = @{
    "RECEIVED" = @()
    "CHECKING" = @("CHECKING")
    "REPAIRING" = @("CHECKING", "REPAIRING")
    "COMPLETED" = @("CHECKING", "REPAIRING", "COMPLETED")
    "RETURNED" = @("CHECKING", "REPAIRING", "COMPLETED", "RETURNED")
    "CANCELLED" = @("CANCELLED")
}

for ($i = 0; $i -lt $warrantyTargets.Count; $i++) {
    $t = $warrantyTargets[$i]
    $defect = if ($activeDefects.Count -gt 0) { $activeDefects[$i % $activeDefects.Count] } else { $null }
    $case = New-WarrantyCase -CustomerName $t.name -CustomerPhone $t.phone -Desc "Lỗi báo hỏng: $($t.name) mang máy tới bảo hành" -DefectId $(if ($defect) { $defect.defect_id } else { $null })
    Track $case
    if (-not $case) { continue }
    $caseId = $case.data.id
    $ver = $case.data.version
    $steps = $transitionPath[$t.status]
    foreach ($step in $steps) {
        $patchBody = @{ status = $step }
        if ($step -eq "CANCELLED") { $patchBody["cancel_reason"] = "Khách hàng hủy yêu cầu bảo hành" }
        $patchResp = Invoke-Api -Method PATCH -Path "/warranty-cases/$caseId" -Body $patchBody `
            -ExtraHeaders @{ "If-Match" = "$ver"; "Idempotency-Key" = (New-IdemKey "warr-patch") } -AllowFail
        Track $patchResp
        if ($patchResp) { $ver = $patchResp.data.version }
    }
    Write-Status "  + Ca bảo hành #$($case.data.warranty_case_code) ($($t.name)) -> $($t.status)" -Level "Success"
}

# ============================================================================
# BƯỚC 8: Tồn kho & đối soát -> tự sinh, chỉ cần xác nhận có dữ liệu
# ============================================================================
Write-Status "`n=== BƯỚC 8: Tồn kho & đối soát (tự sinh) ===" -Level "Step"
$balances = Invoke-Api -Method GET -Path "/inventory/balances?per_page=5" -AllowFail
if ($balances) { Write-Status "  Tồn kho hiện có $($balances.meta.total) dòng cân đối (đã tự sinh từ inbound/outbound POSTED)" -Level "Success" }

# ============================================================================
# BƯỚC 9: Phiếu Reversal - dựa trên các phiếu nhập đã POSTED
# ============================================================================
Write-Status "`n=== BƯỚC 9: Phiếu Reversal ===" -Level "Step"

$reversalSources = $postedInbound + ($componentInboundDocs | ForEach-Object { $_.doc })
$reversalCount = 0
foreach ($doc in $reversalSources) {
    if ($reversalCount -ge 5) { break }
    if (-not $doc.lines -or $doc.lines.Count -eq 0) { continue }
    $line = $doc.lines[0]
    $skuCode = $null
    $matchSku = $skus | Where-Object { $_.sku_id -eq $line.product_id } | Select-Object -First 1
    if ($matchSku) { $skuCode = $matchSku.sku_code }
    if (-not $skuCode) { continue }
    $reversalLine = @{ sku = $skuCode; reversal_qty = 1; reason = "Hàng lỗi phát hiện sau nhập kho" }
    if ($matchSku.sku_type -eq "PRODUCT") {
        $matchItem = $createdItemInstances | Where-Object { $_.sku_id -eq $line.product_id } | Select-Object -First 1
        if (-not $matchItem) { continue }
        $reversalLine["item_id"] = $matchItem.item_id
    }
    $body = @{
        reference_document_id = $doc.id
        reference_document_type = "receipt"
        reason = "Đối soát phát hiện sai lệch số lượng nhập, hoàn trả 1 đơn vị"
        lines = @($reversalLine)
    }
    $r = Invoke-Api -Method POST -Path "/reversal-documents" -Body $body -ExtraHeaders @{ "Idempotency-Key" = (New-IdemKey "rev-create"); "If-Match" = "$($doc.version)" } -AllowFail
    Track $r
    if ($r) {
        $reversalCount++
        Write-Status "  + Reversal cho phiếu $($doc.doc_no) -> $($r.data.status)" -Level "Success"
    }
}
if ($reversalCount -eq 0) {
    Write-Status "  Không tạo được reversal nào - kiểm tra lại field 'sku' trong line response của inbound POSTED." -Level "Warning"
}

# ============================================================================
# TỔNG KẾT
# ============================================================================
Write-Status "`n============================================" -Level "Info"
Write-Status "TỔNG KẾT: $($script:counters.ok) request thành công, $($script:counters.fail) request thất bại/bỏ qua" -Level "Success"
Write-Status "============================================" -Level "Info"
Write-Status "Mở lại các trang trong ứng dụng để xem dữ liệu mẫu vừa tạo." -Level "Info"
Write-Status "Lưu ý: Outbound POSTED và Reversal CANCELLED không seed được do ràng buộc backend (in nhãn thật / không có endpoint hủy reversal công khai)." -Level "Warning"
