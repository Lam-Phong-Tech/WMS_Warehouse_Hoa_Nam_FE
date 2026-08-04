"""Trích xuất contract SKU/Product/Item/Import từ swagger-api.json (OpenAPI thật)."""
import json
import sys

swagger_path = "swagger-api.json"

with open(swagger_path, "r", encoding="utf-8") as f:
    spec = json.load(f)

print("=" * 80)
print("TỔNG QUAN OPENAPI")
print("=" * 80)
print("openapi/version:", spec.get("openapi") or spec.get("swagger"))
print("Số lượng path (routes):", len(spec.get("paths", {})))

keywords = ["sku", "product", "item", "import", "physical", "uom", "supplier", "category"]

print("\n" + "=" * 80)
print("CÁC PATH CHỨA TỪ KHÓA LIÊN QUAN (sku/product/item/import/physical/uom/supplier/category)")
print("=" * 80)
paths = spec.get("paths", {})
for p_key, p_methods in paths.items():
    lower_p = p_key.lower()
    if any(kw in lower_p for kw in keywords):
        methods = ", ".join(m.upper() for m in p_methods if m in ("get", "post", "put", "patch", "delete"))
        print(f"{methods:20s} {p_key}")