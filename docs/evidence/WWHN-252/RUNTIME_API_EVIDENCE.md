# WWHN-252 — Runtime API evidence (App PV, thu that tren BE dang chay)

Base URL: http://localhost:8080/api/v1  ·  BE commit: b90d5ef67c6577db166fdac00f1323741ccfd888

## 1. GET /pv/products (an danh, khong Authorization) -> 200
```json
{"success":true,"data":[],"meta":{"current_page":1,"per_page":3,"last_page":1,"total":0,"from":null,"to":null,"request_id":"f8b4afe5-7c21-41aa-8ea1-ac8b132dc777","timestamp":"2026-08-18T23:23:53+07:00","data_as_of":"2026-08-18T23:23:53+07:00","max_staleness_seconds":60,"inventory_freshness":"LIVE"},"links":{"first":"http:\/\/localhost\/api\/v1\/pv\/products?page=1","last":"http:\/\/localhost\/api\/v1\/pv\/products?page=1","prev":null,"next":null}}
```

## 2. GET /pv/products?per_page=500 -> 400 INVALID_QUERY (Annex C error set khong co 422)
```json
{"success":false,"message":"per_page t\u1ed1i \u0111a l\u00e0 50.","error_code":"INVALID_QUERY","errors":[],"error":{"code":"INVALID_QUERY","details":[]},"meta":{"request_id":"5665c173-5e89-4dc7-a69c-d834e33b23da","timestamp":"2026-08-18T23:23:53+07:00"}}
```

## 3. GET /pv/products?industry_id=not-a-uuid -> 400 INVALID_QUERY
```json
{"success":false,"message":"industry_id ph\u1ea3i l\u00e0 UUID.","error_code":"INVALID_QUERY","errors":[],"error":{"code":"INVALID_QUERY","details":[]},"meta":{"request_id":"e9c13a53-5493-4143-8f58-f65ac60f9ebd","timestamp":"2026-08-18T23:23:54+07:00"}}
```

## 4. GET /pv/products/{sku_id} khong ton tai / chua publish -> 404 masked (§13.8)
```json
{"success":false,"message":"Kh\u00f4ng t\u00ecm th\u1ea5y s\u1ea3n ph\u1ea9m.","error_code":"RESOURCE_NOT_FOUND","errors":[],"error":{"code":"RESOURCE_NOT_FOUND","details":[]},"meta":{"request_id":"266bd705-a98b-4c3c-811d-1a804aefff12","timestamp":"2026-08-18T23:23:54+07:00"}}
```

## 5. GET /pv/products/not-a-uuid -> 400 INVALID_PATH
```json
{"success":false,"message":"sku_id ph\u1ea3i l\u00e0 UUID.","error_code":"INVALID_PATH","errors":[],"error":{"code":"INVALID_PATH","details":[]},"meta":{"request_id":"d44bb1cd-72e3-4376-8f80-37bdc839318c","timestamp":"2026-08-18T23:23:54+07:00"}}
```

## 6. GET /pv/recommendations thieu industry_id -> 400 INVALID_QUERY
```json
{"success":false,"message":"industry_id l\u00e0 tham s\u1ed1 b\u1eaft bu\u1ed9c v\u00e0 ph\u1ea3i l\u00e0 UUID.","error_code":"INVALID_QUERY","errors":[],"error":{"code":"INVALID_QUERY","details":[]},"meta":{"request_id":"6a50657f-837e-4ef7-bc7f-11ae6c1deafa","timestamp":"2026-08-18T23:23:55+07:00"}}
```

## 7. GET /pv/industries -> 200
```json
{"success":true,"data":[],"meta":{"current_page":1,"per_page":5,"last_page":1,"total":0,"from":null,"to":null,"request_id":"6ef9812b-a6c2-4753-8e09-53d9f5cbf262","timestamp":"2026-08-18T23:23:55+07:00","data_as_of":"2026-08-18T23:23:55+07:00","max_staleness_seconds":60,"inventory_freshness":"LIVE"},"links":{"first":"http:\/\/localhost\/api\/v1\/pv\/industries?page=1","last":"http:\/\/localhost\/api\/v1\/pv\/industries?page=1","prev":null,"next":null}}
```

## 8. GET /pv-admin/resources/industries khong token -> 401 (gate pv.master.manage)
```json
{"success":false,"message":"Ch\u01b0a x\u00e1c th\u1ef1c","error_code":"UNAUTHENTICATED","errors":[],"error":{"code":"UNAUTHENTICATED","details":[]},"meta":{"request_id":"28b9f742-93f5-476d-850c-e09d9c9239ba","timestamp":"2026-08-18T23:23:55+07:00"}}
```
