// Trích xuất chi tiết contract Product (create/status/enable/disable) + Product schema từ OpenAPI thật.
import { readFileSync } from "node:fs";

const spec = JSON.parse(readFileSync("swagger-api.json", "utf-8"));
const paths = spec.paths || {};

function resolveSchemaRef(ref) {
  const name = ref.split("/").pop();
  return spec.components?.schemas?.[name] || null;
}

function describeSchema(schema, depth = 0, seen = new Set()) {
  if (!schema) return "{}";
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    if (seen.has(name)) return `[ref:${name}]`;
    seen.add(name);
    return describeSchema(resolveSchemaRef(name), depth, seen);
  }
  if (schema.allOf) {
    return schema.allOf.map((s) => describeSchema(s, depth, seen)).join(" + ");
  }
  if (schema.type === "object" || schema.properties) {
    const props = schema.properties || {};
    const parts = Object.entries(props).map(([k, v]) => {
      let desc = v.type || "obj";
      if (v.$ref) desc = describeSchema(v.$ref, depth + 1, seen);
      if (v.enum) desc = `enum=${JSON.stringify(v.enum)}`;
      if (v.items?.$ref) desc = `array<${v.items.$ref.split("/").pop()}>`;
      if (v.items?.enum) desc = `array<enum=${JSON.stringify(v.items.enum)}>`;
      const req = (schema.required || []).includes(k) ? "*" : "";
      return `${k}${req}:${desc}`;
    });
    return `{ ${parts.join(", ")} }`;
  }
  if (schema.type === "array") return `array<${describeSchema(schema.items, depth, seen)}>`;
  return schema.type || "obj";
}

console.log("=".repeat(90));
console.log("PATH /products — CHI TIẾT METHODS + REQUEST/RESPONSE (CONTRACT THẬT BE)");
console.log("=".repeat(90));
for (const [method, op] of Object.entries(paths["/products"] || {})) {
  console.log(`\n### ${method.toUpperCase()} /products`);
  console.log("summary:", op.summary || "");
  if (op.requestBody) {
    for (const [ct, content] of Object.entries(op.requestBody.content || {})) {
      console.log(`requestBody[${ct}]:`, describeSchema(content.schema));
    }
  }
  if (op.responses) {
    for (const [code, resp] of Object.entries(op.responses)) {
      const c = resp.content?.["application/json"];
      if (c?.schema) console.log(`  resp ${code}:`, describeSchema(c.schema));
    }
  }
}

for (const pKey of ["/products/{id}", "/products/{id}/enable", "/products/{id}/disable", "/products/{id}/status", "/products/{id}/restore"]) {
  for (const [method, op] of Object.entries(paths[pKey] || {})) {
    console.log(`\n### ${method.toUpperCase()} ${pKey}`);
    console.log("summary:", op.summary || "");
    if (op.requestBody) {
      for (const [ct, content] of Object.entries(op.requestBody.content || {})) {
        console.log(`requestBody[${ct}]:`, describeSchema(content.schema));
      }
    }
    if (op.responses) {
      for (const [code, resp] of Object.entries(op.responses)) {
        const c = resp.content?.["application/json"];
        if (c?.schema) console.log(`  resp ${code}:`, describeSchema(c.schema));
      }
    }
  }
}

console.log("\n" + "=".repeat(90));
console.log("SCHEMA Product / ProductCreate / ProductUpdate / ProductStatus (ĐẦY ĐỦ FIELD + ENUM)");
console.log("=".repeat(90));
const schemas = spec.components?.schemas || {};
for (const name of ["Product", "ProductCreate", "ProductUpdate", "ProductStatus", "ProductStore", "Sku", "SkuCreate"]) {
  const s = schemas[name];
  if (!s) continue;
  console.log(`\n### ${name}: ${describeSchema({ $ref: `#/components/schemas/${name}` })}`);
}