import fs from 'node:fs';import cp from 'node:child_process';import crypto from 'node:crypto';import assert from 'node:assert/strict';import ts from 'typescript';
const changed=new Set(JSON.parse(fs.readFileSync('/tmp/nonreport-changed.json','utf8')));
function load(p,expected){const base=cp.execFileSync('git',['show','HEAD:'+p],{encoding:'utf8'});const sha=crypto.createHash('sha1').update('blob '+Buffer.byteLength(base)+'\0').update(base).digest('hex');assert.equal(sha,expected,'Concurrent change: '+p);return fs.readFileSync(p,'utf8');}
function sf(s){return ts.createSourceFile('source.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function edit(s,predicate,replacement,label,all=false){const tree=sf(s),hits=[];function visit(n){if(predicate(n,tree))hits.push(n);else ts.forEachChild(n,visit);}visit(tree);assert(hits.length>0,'Missing AST anchor '+label);if(!all)assert.equal(hits.length,1,'Ambiguous AST anchor '+label);for(const n of hits.sort((a,b)=>b.pos-a.pos))s=s.slice(0,n.getStart(tree))+(typeof replacement==='function'?replacement(n,tree):replacement)+s.slice(n.end);return s;}
function rep(s,a,b){assert(s.includes(a),'Missing text '+a.slice(0,120));return s.replace(a,b);}
function put(p,s){assert(!p.includes('/reports/'));assert.equal(sf(s).parseDiagnostics.length,0,'Invalid TS: '+p);fs.mkdirSync(p.slice(0,p.lastIndexOf('/')),{recursive:true});fs.writeFileSync(p,s);changed.add(p);console.log('API_ONLY_EDIT',p);}
const variable=(s,name,value)=>edit(s,n=>ts.isVariableDeclaration(n)&&n.name.getText()===name,(n,t)=>n.getText(t).slice(0,n.initializer.getStart(t)-n.getStart(t))+value,name);
{
 const p='src/shared/ui/catalog/FoundationCatalogPage.tsx';let s=load(p,'9992ef4a98c028021579dbe1c103986a6e83b964');
 s=rep(s,'import { useEffect, useMemo, useState } from "react";','import { useMemo, useState } from "react";');
 s=rep(s,'import { useT, type TranslateFn } from "@/shared/i18n/useT";','import { useT } from "@/shared/i18n/useT";\nimport { useAuthStore } from "@/shared/store/auth.store";');
 s=edit(s,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='catalogRows','','remove runtime business fixtures');
 s=variable(s,'rows','useMemo<CatalogRow[]>(() => [], [])');
 s=variable(s,'options','useMemo<Array<{value: string; label: string; disabled?: boolean}>>(() => [], [])');
 s=rep(s,'const { control, setError } = useForm<CatalogFormValues>','const { control } = useForm<CatalogFormValues>');
 s=edit(s,(n,t)=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(t)==='useEffect'&&n.getText(t).includes('setError('),'','remove forced form outcome');
 s=s.replaceAll('t("catalog.longText")','EMPTY_TEXT');
 s=edit(s,(n,t)=>ts.isJsxAttribute(n)&&n.name.getText(t)==='options'&&n.initializer&&ts.isJsxExpression(n.initializer)&&n.initializer.expression&&ts.isArrayLiteralExpression(n.initializer.expression)&&n.getText(t).includes('catalog.data.brand'),'options={[]}','remove fictional brands');
 s=edit(s,(n,t)=>ts.isJsxAttribute(n)&&n.name.getText(t)==='value'&&n.parent.parent.tagName?.getText(t)==='UiKpiCard','value={EMPTY_TEXT}','remove catalogue KPI numbers',true);
 s=rep(s,'total={137}','total={rows.length}');
 s=rep(s,'useState(3)','useState(1)');
 s=edit(s,(n,t)=>ts.isJsxAttribute(n)&&n.name.getText(t)==='items'&&n.parent.parent.tagName?.getText(t)==='UiTimeline','items={[]}','remove fabricated event history');
 s=edit(s,(n,t)=>ts.isPropertyAssignment(n)&&n.name.getText(t)==='value'&&n.parent.parent.parent?.name?.getText(t)==='items',n=>n.getText().startsWith('value:')?'value: EMPTY_TEXT':n.getText(),'clear descriptive business values',true);
 s=s.replaceAll('"REV-20260818-0001"','EMPTY_TEXT');
 // The developer catalogue is not a business data source. No fake people or master options.
 s=s.replaceAll('t("catalog.data.userLam")','useAuthStore.getState().user?.name || EMPTY_TEXT');
 s=s.replaceAll('t("catalog.data.userAn")','EMPTY_TEXT');s=s.replaceAll('t("catalog.data.warehouseShort")','EMPTY_TEXT');
 s=s.replace(/t\("catalog\.data\.[^"]+"\)/g,'EMPTY_TEXT');
 s=s.replace(' * - Dữ liệu cố định, tiếng Việt dài, có case dense/empty — không phụ thuộc\n *   API/locale/timezone runtime (deterministic cho visual golden).',' * - Không chứa chứng từ, người dùng, KPI hoặc danh mục giả. Các bề mặt dữ liệu\n *   chưa nối API hiển thị rỗng/chưa có; fixture kiểm thử không nằm trong runtime.');
 s=s.replace('/** Form showcase — có field lỗi cưỡng bức để soi state validation (fixture). */','/** Developer-only form anatomy; no persisted business data or forced API outcome. */');
 put(p,s);
}
{
 const p='src/modules/inventory/components/BalanceDetailModal.tsx';let s=load(p,'58570621b3166f46d8bae6685490cf45ab80fe23');
 s=s.replaceAll('row.qty >= 0','row.qty !== null && row.qty >= 0');
 s=rep(s,'color:\n              row.qty !== null && row.qty >= 0','color:\n              row.qty === null ? "text.secondary" : row.qty >= 0');
 s=rep(s,'count: subledger?.item_count ?? balance.serialQty','count: formatQuantity(subledger?.item_count ?? balance.serialQty)');
 s=rep(s,'count: subledger?.container_count ?? balance.boxQty','count: formatQuantity(subledger?.container_count ?? balance.boxQty)');
 s=rep(s,'rowKey={(row) => text(row.id, String(Math.random()))}','rowKey={(row) => text(row.id ?? row.item_id ?? row.item_code, `item-row-${((subledger?.items as RawRecord[]) ?? []).indexOf(row)}`)}');
 s=rep(s,'rowKey={(row) => text(row.id, String(Math.random()))}','rowKey={(row) => text(row.id ?? row.container_id ?? row.container_code, `container-row-${((subledger?.containers as RawRecord[]) ?? []).indexOf(row)}`)}');
 s=s.replaceAll('row.quantity ?? 0','row.quantity');
 put(p,s);
}
{
 const p='src/modules/inventory/pages/InventoryPage.tsx';let s=load(p,'19177172b7cf35b72c60dfdfe4bb7c5be6ebef92');
 s=rep(s,'if (row.variance === 0) {','if (row.variance === null) return EMPTY_TEXT;\n        if (row.variance === 0) {');
 s=s.replaceAll('row.qty >= 0','row.qty !== null && row.qty >= 0');
 s=rep(s,'color:\n              row.qty !== null && row.qty >= 0','color:\n              row.qty === null ? "text.secondary" : row.qty >= 0');
 put(p,s);
}
{
 const p='src/modules/inventory/services/inventoryService.ts';let s=fs.readFileSync(p,'utf8');
 s=edit(s,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='num','','remove unused zero coercion');put(p,s);
}
{
 const p='src/modules/dashboard/overview/DashboardSnapshot.test.tsx';let s=load(p,'382d5aed61abeab3099221f6c5a0330a6de0c0c4');
 s=edit(s,(n,t)=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(t)==='it'&&n.getText(t).includes('phát trạng thái nghiệp vụ của bộ reference Tablet'),`it("không sinh trạng thái nghiệp vụ từ tham số trình diễn", () => {
    window.history.replaceState({}, "", "/dashboard?screen=MAP-01&state=overview-urgent");
    const { container } = renderSnapshot();
    expect(container.querySelector(".snapshot-reference-banner")).toBeNull();
    expect(screen.queryByRole("status", { name: "Trạng thái tổng quan: Khẩn cấp" })).not.toBeInTheDocument();
    window.history.replaceState({}, "", "/");
  });`,'replace obsolete fake-state test with no-fake-state regression');put(p,s);
}
{
 const p='src/modules/inventory/services/inventoryService.test.ts';let s=load(p,'72e0d3288dee93edf08e6de9cc851d8d79c06c6a');
 const match=(n,t)=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(t)==='it'&&n.getText(t).includes('fetchInventoryBalances giữ fallback normalization');
 s=edit(s,match,(n,t)=>{
   let body=n.getText(t).replace('fetchInventoryBalances giữ fallback normalization để tương thích payload hiện hành','fetchInventoryBalances không tạo balance ID giả khi API thiếu định danh');
   const start=body.indexOf('    const result = await fetchInventoryBalances();');assert(start>0);
   return body.slice(0,start)+`    await expect(fetchInventoryBalances()).rejects.toMatchObject({ code: "WMS_FE_MISSING_API_ID" });\n  });`;
 },'replace fabricated ID expectation');put(p,s);
}
put('src/shared/api/api-read-values.test.ts',`import { describe, expect, it } from "vitest";
import { nullableApiNumber, requiredApiNumber, requiredApiState, requiredApiIdentity } from "./api-read-values";
describe("API read values are never invented", () => {
  it.each([null, undefined, "", " ", false, true, {}, [], "not-a-number", Infinity, NaN])("keeps absent or invalid numbers unknown (%s)", value => {
    expect(nullableApiNumber(value)).toBeNull();
    expect(() => requiredApiNumber(value)).toThrow();
  });
  it.each([0, -1, 2.5, "0", "-1", "2.5"])("preserves a supplied finite number (%s)", value => {
    expect(nullableApiNumber(value)).toBe(Number(value));
    expect(requiredApiNumber(value)).toBe(Number(value));
  });
  it("does not assume a missing API status is active or posted", () => {
    expect(() => requiredApiState(undefined, ["ACTIVE", "INACTIVE"])).toThrow();
    expect(() => requiredApiState("", ["DRAFT", "POSTED"])).toThrow();
    expect(requiredApiState("inactive", ["ACTIVE", "INACTIVE"])).toBe("INACTIVE");
  });
  it.each([null, undefined, "", " ", {}, NaN])("does not fabricate server identity (%s)", value => {
    expect(() => requiredApiIdentity(value)).toThrow();
  });
});
`);
fs.writeFileSync('/tmp/nonreport-changed.json',JSON.stringify([...changed]));
