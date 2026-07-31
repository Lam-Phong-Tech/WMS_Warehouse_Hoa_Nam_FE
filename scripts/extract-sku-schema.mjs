// Trích xuất contract SKU/Product/Item/Import từ swagger-api.json (OpenAPI thật của backend).
import { readFileSync } from "node:fs";

const spec = JSON.parse(readFileSync("swagger-api.json", "utf-8"));

console.log("=".repeat(80));
console.log("TỔNG QUAN OPENAPI (NGUỒN CONTRACT CHÍNH THỨC BE)");
console.log("=".repeat(80));
console.log("openapi/version:", spec.openapi || spec.swagger);
console.log("Số lượng path (routes):", Object.keys(spec.paths || {}).length);

const keywords = ["sku", "product", "item", "import", "physical", "uom", "supplier", "category"];

console.log("\n" + "=".repeat(80));
console.log("CÁC PATH CHỨA TỪ KHÓA: sku/product/item/import/physical/uom/supplier/category");
console.log("=".repeat(80));
for (const [pKey, pMethods] of Object.entries(spec.paths || {})) {
  const lowerP = pKey.toLowerCase();
  if (keywords.some((kw) => lowerP.includes(kw))) {
    const methods = Object.keys(pMethods)
      .filter((m) => ["get", "post", "put", "patch", "delete"].includes(m))
      .map((m) => m.toUpperCase())
      .join(", ");
    console.log(`${methods.padEnd(20)} ${pKey}`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("SCHEMAS LIÊN QUAN SKU/PRODUCT (components.schemas)");
console.log("=".repeat(80));
const schemas = spec.components?.schemas || {};
for (const [sName, sDef] of Object.entries(schemas)) {
  const lowerN = sName.toLowerCase();
  if (keywords.some((kw) => lowerN.includes(kw))) {
    console.log(`\n### ${sName}`);
    const props = sDef.properties || {};
    for (const [prop, pDef] of Object.entries(props)) {
      const type = pDef.type || (pDef.$ref ? pDef.$ref.split("/").pop() : "");
      const enumVals = pDef.enum ? ` enum=${JSON.stringify(pDef.enum)}` : "";
      const required = (sDef.required || []).includes(prop) ? " [required]" : "";
      const ref = pDef.$ref ? ` $ref=${pDef.$ref.split("/").pop()}` : "";
      console.log(`  - ${prop}: ${type}${enumVals}${required}${ref}`);
    }
  }
}