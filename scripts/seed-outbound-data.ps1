# ============================================================================
# Script: Seed Outbound Data
# Purpose: Add sample outbound documents to test the outbound module
# Usage: .\scripts\seed-outbound-data.ps1
# ============================================================================

param(
    [string]$BaseUrl = "http://localhost:8080/api/v1",
    [string]$Email = "admin@gmail.com",
    [string]$Password = "Cntt@1234",
    [int]$Count = 5
)

function Write-Status {
    param([string]$Message, [ValidateSet("Info", "Success", "Error", "Warning")]$Level = "Info")
    $colors = @{
        "Info" = "Cyan"
        "Success" = "Green"
        "Error" = "Red"
        "Warning" = "Yellow"
    }
    Write-Host $Message -ForegroundColor $colors[$Level]
}

# Step 1: Login
Write-Status "Authenticating..." -Level "Info"
$loginBody = @{
    email = $Email
    password = $Password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginResponse.data.access_token
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    Write-Status "Authentication successful" -Level "Success"
} catch {
    Write-Status "Authentication failed: $($_.Exception.Message)" -Level "Error"
    exit 1
}

# Step 2: Get warehouse
Write-Status "Fetching warehouse..." -Level "Info"
try {
    $warehouseResponse = Invoke-RestMethod -Uri "$BaseUrl/warehouses" -Headers $headers -ErrorAction Stop
    $warehouse = $warehouseResponse.data[0]
    $warehouseId = $warehouse.id
    Write-Status "Warehouse: $($warehouse.name)" -Level "Success"
} catch {
    Write-Status "Failed to fetch warehouse: $($_.Exception.Message)" -Level "Error"
    exit 1
}

# Step 3: Get products
Write-Status "Fetching products..." -Level "Info"
try {
    $productResponse = Invoke-RestMethod -Uri "$BaseUrl/products?per_page=100" -Headers $headers -ErrorAction Stop
    # Filter for ACTIVE PRODUCT type SKUs only (not COMPONENT)
    $activeProducts = @()
    foreach ($product in $productResponse.data) {
        if ($product.status -eq 'ACTIVE' -and $product.sku_type -eq 'PRODUCT') {
            $activeProducts += $product
        }
    }
    if ($activeProducts.Count -eq 0) {
        Write-Status "No ACTIVE PRODUCT type SKUs found" -Level "Error"
        exit 1
    }
    $products = $activeProducts
    if ($products.Count -lt 2) {
        Write-Status "Need at least 2 products to create samples" -Level "Warning"
        exit 1
    }
    Write-Status "Found $($products.Count) ACTIVE PRODUCT type SKUs" -Level "Success"
} catch {
    Write-Status "Failed to fetch products: $($_.Exception.Message)" -Level "Error"
    exit 1
}

# Step 4: Prepare sample data
# Use unique timestamp to avoid conflicts
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'

# Helper function to cycle through products when we don't have enough
function Get-ProductAtIndex {
    param([int]$index)
    return $products[$index % $products.Count]
}

$sampleData = @(
    @{
        doc_no = "EXP-$timestamp-001"
        doc_date = (Get-Date -Format 'yyyy-MM-dd')
        src_warehouse_id = $warehouseId
        recipient_name = "Long Xuyen Construction Ltd"
        recipient_address = "789 Tran Hung Dao St, An Phu, Long Xuyen"
        note = "Regular order for components"
        lines = @(
            @{ product_id = (Get-ProductAtIndex 0).id; qty_planned = 15 },
            @{ product_id = (Get-ProductAtIndex 1).id; qty_planned = 8 }
        )
    },
    @{
        doc_no = "EXP-$timestamp-002"
        doc_date = (Get-Date -Format 'yyyy-MM-dd')
        src_warehouse_id = $warehouseId
        recipient_name = "Saigon Manufacturing Co"
        recipient_address = "456 Nguyen Trai Ave, District 11, HCMC"
        note = "Wholesale shipment"
        lines = @(
            @{ product_id = (Get-ProductAtIndex 2).id; qty_planned = 50 }
        )
    },
    @{
        doc_no = "EXP-$timestamp-003"
        doc_date = (Get-Date -Format 'yyyy-MM-dd')
        src_warehouse_id = $warehouseId
        recipient_name = "Nha Trang Electronics"
        recipient_address = "321 Tran Phu St, Nha Trang City"
        note = "Priority shipment - customer urgent"
        lines = @(
            @{ product_id = (Get-ProductAtIndex 3).id; qty_planned = 25 },
            @{ product_id = (Get-ProductAtIndex 4).id; qty_planned = 12 }
        )
    },
    @{
        doc_no = "EXP-$timestamp-004"
        doc_date = (Get-Date -Format 'yyyy-MM-dd')
        src_warehouse_id = $warehouseId
        recipient_name = "Hanoi Distribution Center"
        recipient_address = "111 Hoang Van Thu Rd, Thu Duc, HCMC"
        note = "Inter-warehouse transfer"
        lines = @(
            @{ product_id = (Get-ProductAtIndex 5).id; qty_planned = 40 }
        )
    },
    @{
        doc_no = "EXP-$timestamp-005"
        doc_date = (Get-Date -Format 'yyyy-MM-dd')
        src_warehouse_id = $warehouseId
        recipient_name = "Mekong Delta Industrial Park"
        recipient_address = "555 Quang Trung St, Can Tho City"
        note = "Export order - international"
        lines = @(
            @{ product_id = (Get-ProductAtIndex 0).id; qty_planned = 100 },
            @{ product_id = (Get-ProductAtIndex 1).id; qty_planned = 75 }
        )
    }
)

# Step 5: Create documents
Write-Status "`nCreating outbound documents..." -Level "Info"

$created = 0
foreach ($data in $sampleData | Select-Object -First $Count) {
    try {
        $body = $data | ConvertTo-Json -Depth 3
        $result = Invoke-RestMethod -Uri "$BaseUrl/outbound-documents" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        $created++
        Write-Status "  Created: $($data.doc_no)" -Level "Success"
    } catch {
        Write-Status "  Failed: $($data.doc_no) - $($_.Exception.Message)" -Level "Error"
    }
}

# Summary
Write-Host ""
Write-Status "============================================" -Level "Info"
Write-Status "Summary: $created/$Count documents created" -Level "Success"
Write-Status "============================================" -Level "Info"
Write-Status "Refresh your browser to see the new data" -Level "Info"
