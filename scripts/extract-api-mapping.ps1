# Script to extract API mapping from Swagger JSON and format as implementation-ready
param(
    [string]$SwaggerFile = "swagger-api.json",
    [string]$OutputFile = "docs/api-evidence/API_MAPPING_IMPLEMENTATION_READY.md"
)

# Read Swagger JSON
$swagger = Get-Content $SwaggerFile -Raw | ConvertFrom-Json

# Initialize output
$output = @"
# API Contract Mapping - Implementation Ready Format

**Nguồn:** Swagger API Documentation (`$SwaggerFile`)
**Cập nhật:** $(Get-Date -Format "yyyy-MM-dd")
**Base URL:** $($swagger.servers[0].url)

---

## Format Explanation

Mỗi endpoint được mô tả với đầy đủ thông tin implementation-ready:

| Field | Description |
|-------|-------------|
| **Screen** | Màn hình FE sử dụng endpoint này |
| **UI Action** | Hành động người dùng thực hiện |
| **User Story/BRD** | Reference đến user story hoặc BRD |
| **Endpoint** | API path đầy đủ |
| **Method** | HTTP method (GET/POST/PUT/PATCH/DELETE) |
| **Query/Path/Body** | Parameters chi tiết từ Swagger |
| **Success Response** | Response shape khi thành công (200/201) |
| **Error Response** | Response shape khi lỗi (400/401/403/404/409/422/500) |
| **Status Codes** | Tất cả status codes có thể trả về |
| **Permission Code** | Permission cần thiết (nếu có từ Swagger) |
| **Data Scope** | Phạm vi dữ liệu áp dụng |
| **Evidence Source** | Nguồn xác minh (Swagger/Postman/curl/service) |
| **Verification Status** | ✅ Verified / ⚠️ Inferred / ⏳ Pending BE |

---

"@

# Function to extract parameters
function Get-Parameters($params) {
    if (-not $params) { return "None" }
    
    $result = @()
    foreach ($param in $params) {
        if ($param.'$ref') {
            $refName = $param.'$ref' -replace '#/components/parameters/', ''
            $result += "`$ref: $refName"
        } else {
            $required = if ($param.required) { " (required)" } else { " (optional)" }
            $result += "$($param.name)$required - $($param.description) [Type: $($param.schema.type)]"
        }
    }
    return $result -join "`n"
}

# Function to extract request body
function Get-RequestBody($requestBody) {
    if (-not $requestBody) { return "None" }
    
    $content = $requestBody.content.'application/json'
    if (-not $content) { return "None" }
    
    $result = @("**Required fields:** $($content.schema.required -join ', ')")
    
    if ($content.schema.properties) {
        $result += "**Properties:**"
        foreach ($prop in $content.schema.properties.PSObject.Properties) {
            $name = $prop.Name
            $type = $prop.Value.type
            $example = if ($prop.Value.example) { " (example: $($prop.Value.example))" } else { "" }
            $enum = if ($prop.Value.enum) { " [enum: $($prop.Value.enum -join '/')]" } else { "" }
            $nullable = if ($prop.Value.nullable) { " (nullable)" } else { "" }
            $result += "  - $name`: $type$enum$nullable$example"
        }
    }
    
    return $result -join "`n"
}

# Function to extract responses
function Get-Responses($responses) {
    $result = @()
    foreach ($status in $responses.PSObject.Properties) {
        $code = $status.Name
        $desc = $status.Value.description
        
        if ($status.Value.content) {
            $schema = $status.Value.content.'application/json'.schema
            if ($schema.'$ref') {
                $ref = $schema.'$ref' -replace '#/components/schemas/', ''
                $result += "$code`: $desc (ref: $ref)"
            } elseif ($schema.properties) {
                $result += "$code`: $desc"
                foreach ($prop in $schema.properties.PSObject.Properties) {
                    $result += "  - $($prop.Name): $($prop.Value.type)"
                }
            } else {
                $result += "$code`: $desc"
            }
        } else {
            $result += "$code`: $desc"
        }
    }
    return $result -join "`n"
}

# Process each module
$modules = @{
    "M1 - Organization" = @("/org_units", "/departments", "/positions", "/employees", "/employee-assignments", "/employee-status-histories", "/roles", "/permissions", "/user-role-scopes", "/user-data-scopes", "/tasks")
    "M2 - Warehouse" = @("/warehouses", "/inbound-documents", "/outbound-documents", "/transfer-orders", "/inventory/balances", "/stock-movements")
    "M3 - Business" = @("/products", "/price-lists", "/customers", "/sales-orders", "/sales-channels")
}

foreach ($module in $modules.GetEnumerator()) {
    $output += "`n## $($module.Key)`n`n"
    
    foreach ($path in $module.Value) {
        if ($swagger.paths.$path) {
            $output += "### $path`n`n"
            
            foreach ($method in $swagger.paths.$path.PSObject.Properties) {
                $httpMethod = $method.Name.ToUpper()
                $operation = $method.Value
                
                $output += "#### $httpMethod $path`n`n"
                $output += "**Operation ID:** $($operation.operationId)`n`n"
                $output += "**Summary:** $($operation.summary)`n`n"
                
                if ($operation.description) {
                    $output += "**Description:** $($operation.description)`n`n"
                }
                
                $output += "**Parameters:**`n"
                $output += "````n"
                $output += (Get-Parameters $operation.parameters)
                $output += "`n````n`n"
                
                if ($operation.requestBody) {
                    $output += "**Request Body:**`n"
                    $output += "````n"
                    $output += (Get-RequestBody $operation.requestBody)
                    $output += "`n````n`n"
                }
                
                $output += "**Responses:**`n"
                $output += "````n"
                $output += (Get-Responses $operation.responses)
                $output += "`n````n`n"
                
                $output += "---`n`n"
            }
        }
    }
}

# Write to file
$output | Out-File -FilePath $OutputFile -Encoding UTF8
Write-Host "API mapping extracted to: $OutputFile"