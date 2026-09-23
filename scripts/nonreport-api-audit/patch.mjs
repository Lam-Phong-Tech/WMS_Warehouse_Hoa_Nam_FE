import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const edits=new Map();
const sha=body=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(body)+'\0').update(body).digest('hex');
function load(path,expected){const source=fs.readFileSync(path,'utf8');assert.equal(sha(source),expected,'Concurrent source change: '+path);return source;}
function put(path,source){assert(!path.includes('/reports/'),'Reports are excluded');edits.set(path,source);}
function replace(source,from,to,label=String(from).slice(0,80)){assert(source.includes(from),'Missing edit anchor: '+label);assert.equal(source.indexOf(from),source.lastIndexOf(from),'Ambiguous edit anchor: '+label);return source.replace(from,to);}
function tree(source){return ts.createSourceFile('review.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function nodes(source,predicate){const sf=tree(source),found=[];const visit=n=>{if(predicate(n,sf))found.push(n);ts.forEachChild(n,visit);};visit(sf);return {sf,found};}
function nodeEdit(source,predicate,replacement,label){const {sf,found}=nodes(source,predicate);assert.equal(found.length,1,'Expected one AST edit: '+label);const n=found[0];return source.slice(0,n.getStart(sf))+(typeof replacement==='function'?replacement(n,sf):replacement)+source.slice(n.end);}
function declaration(source,name,initializer){return nodeEdit(source,n=>ts.isVariableDeclaration(n)&&n.name.getText()===name,(n,sf)=>n.getText(sf).slice(0,n.initializer.getStart(sf)-n.getStart(sf))+initializer,'variable '+name);}
function removeVariable(source,name){return nodeEdit(source,n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText()===name),'','remove '+name);}
function replaceFunction(source,name,body){return nodeEdit(source,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name,body,'function '+name);}
const helper='src/shared/api/api-read-values.ts';
put(helper,`import { WmsContractError } from "./wms-contract";

/** Parse a value actually supplied by the API; missing is distinct from zero. */
export function nullableApiNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?$/i.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Required response fields must never be fabricated to make a screen look complete. */
export function requiredApiNumber(value: unknown, field = "quantity"): number {
  const number = nullableApiNumber(value);
  if (number === null) throw new WmsContractError("WMS_FE_MISSING_API_VALUE", "Dữ liệu từ máy chủ chưa đầy đủ hoặc không hợp lệ (" + field + "). Vui lòng tải lại để kiểm tra.");
  return number;
}

export function requiredApiState<T extends string>(value: unknown, allowed: readonly T[], field = "status"): T {
  const state = typeof value === "string" ? value.trim().toUpperCase() : "";
  const known = allowed.find(candidate => candidate === state);
  if (known === undefined) throw new WmsContractError("WMS_FE_INVALID_API_STATE", "Chưa xác định được trạng thái từ máy chủ (" + field + "). Vui lòng tải lại để kiểm tra.");
  return known;
}

export function requiredApiIdentity(value: unknown, field = "id"): string {
  const id = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  if (!id) throw new WmsContractError("WMS_FE_MISSING_API_ID", "Phản hồi máy chủ thiếu định danh " + field + ". Vui lòng tải lại để kiểm tra.");
  return id;
}
`);
{
 const p='src/modules/dashboard/pages/DashboardPage.tsx';let s=load(p,'1ce7cc92cb55c230172e882f7df059a71031017f');
 for(const name of ['mapState','qaChartState','overviewStateMap','referenceState'])s=removeVariable(s,name);
 s=s.replace(/\s*type OverviewReferenceState,?\r?\n/,'\n');
 s=declaration(s,'chartStateOverride','liveChartState');
 s=s.replace(/\s+referenceState=\{referenceState\}/,'');
 s=replace(s,'String(overviewData?.issues.sku_pending_info ?? 0)','overviewData ? String(overviewData.issues.sku_pending_info) : EMPTY_TEXT');
 s=replace(s,'String(overviewData?.issues.import_error ?? 0)','overviewData ? String(overviewData.issues.import_error) : EMPTY_TEXT');
 put(p,s);
}
{
 const p='src/modules/dashboard/overview/DashboardSnapshot.tsx';let s=load(p,'5df230f18ba004aa74aac1b99554553badc8ea53');
 s=nodeEdit(s,n=>ts.isTypeAliasDeclaration(n)&&n.name.text==='OverviewReferenceState','','reference type');
 s=s.replace(/\n  referenceState,/, '');
 s=s.replace(/\n  referenceState\?: OverviewReferenceState;/,'');
 for(const name of ['referenceLoading','referenceEmpty','referenceFailed','referenceForbidden','referenceChartState','referenceOperationState'])s=removeVariable(s,name);
 s=declaration(s,'effectiveLoading','loading');s=declaration(s,'effectiveFailed','failed');s=declaration(s,'effectiveForbidden','forbidden');s=declaration(s,'effectiveRows','rows');
 s=s.replace(/referenceChartState\s*\?\?\s*/,'');
 s=declaration(s,'tasks','issues.slice(0, 5)');
 s=s.replace(/\s+data-reference-state=\{referenceState \?\? "live"\}/,'');
 s=nodeEdit(s,(n,sf)=>ts.isJsxExpression(n)&&n.expression&&ts.isConditionalExpression(n.expression)&&n.expression.condition.getText(sf)==='referenceOperationState','','remove artificial operation banner');
 s=nodeEdit(s,(n,sf)=>ts.isConditionalExpression(n)&&n.condition.getText(sf)==='!referenceEmpty && !referenceFailed',(n,sf)=>n.whenTrue.getText(sf),'real KPI rendering');
 s=nodeEdit(s,(n,sf)=>ts.isConditionalExpression(n)&&n.condition.getText(sf)==='referenceEmpty',(n,sf)=>n.whenFalse.getText(sf),'remove artificial empty state');
 s=declaration(s,'trendPoints',`rows.map((row, index) => {
    const closing = trend.find(item => item.date === row.date)?.closing;
    return closing === undefined || closing === null || !Number.isFinite(closing) ? null : pointFor(index, closing);
  })`);
 s=declaration(s,'d',`trendPoints.map((point, index) => point === null ? "" : \`\${index > 0 && trendPoints[index - 1] !== null ? "L" : "M"}\${point.x.toFixed(1)},\${point.y.toFixed(1)}\`).join(" ")`);
 s=declaration(s,'hoveredPoint',`hoveredIndex === null ? null : (trendPoints[hoveredIndex] ?? { x: pad.left + step * hoveredIndex + step / 2, y: pad.top + plotH / 2 })`);
 s=declaration(s,'hoveredStock',`hoveredRow ? trend.find(item => item.date === hoveredRow.date)?.closing ?? null : null`);
 s=replace(s,'trend.find((item) => item.date === row.date)?.closing ?? 0','trend.find((item) => item.date === row.date)?.closing ?? null');
 s=replace(s,'{trendPoints.map((point, index) => (','{trendPoints.map((point, index) => point === null ? null : (');
 assert(!/referenceState|referenceEmpty|referenceFailed|referenceOperationState|referenceChartState/.test(s),'Dashboard preview state remained');
 put(p,s);
}
{
 const p='src/modules/dashboard/overview/overview-data.ts';let s=load(p,'8b85e422939476ec5001a95d7550338425e8dfa2');
 s=replaceFunction(s,'fmt',`export function fmt(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : numberFormat().format(value);
}`);
 put(p,s);
}
{
 const p='src/modules/inventory/services/inventoryService.ts';let s=load(p,'c20fa80e5e1fd397fdcbb8ff80df4a3b74afd366');
 s='import { nullableApiNumber, requiredApiIdentity } from "@/shared/api/api-read-values";\n'+s;
 for(const field of ['available','onHand','serialQty','boxQty','ledgerTotal','variance','reservedQty'])s=replace(s,field+': number;',field+': number | null;');
 s=replaceFunction(s,'nullableNum',`function nullableNum(value: unknown): number | null { return nullableApiNumber(value); }`);
 const {sf,found}=nodes(s,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='normalizeBalance');assert.equal(found.length,1);let body=found[0].getText(sf);
 body=body.replace(/\bnum\(/g,'nullableNum(');
 body=replace(body,'"System scope"','""');
 body=replace(body,'id: text(\n      row.id ?? `${row.warehouse_id ?? "system"}-${row.product_id ?? row.sku}`,\n    ),','id: requiredApiIdentity(row.id ?? row.balance_id, "balance_id"),');
 body=replace(body,'stockStatus: text(row.stock_status, "AVAILABLE")','stockStatus: text(row.stock_status)');
 s=replaceFunction(s,'normalizeBalance',body);
 s=replace(s,'  qty: number;','  qty: number | null;');
 s=replace(s,'const qty = num(row.qty_change ?? row.qty_delta ?? row.quantity ?? row.qty);','const qty = nullableNum(row.qty_change ?? row.qty_delta ?? row.quantity ?? row.qty);');
 s=replace(s,'lotNo: text(row.lot_no ?? row.batch_no ?? row.stock_status ?? row.lot, "-")','lotNo: text(row.lot_no ?? row.batch_no ?? row.lot, "-")');
 s=replace(s,'        "Original",','        "",');
 s=replace(s,'row.status ?? row.posting_status ?? row.stock_status ?? "POSTED"','row.status ?? row.posting_status');
 s=replace(s,'doc?.code ??\n        row.movement_no','doc?.code');
 s=replace(s,'source.posted_at ?? row.posted_at ?? source.created_at','source.posted_at ?? row.posted_at');
 put(p,s);
}
{
 const p='src/modules/master-data/services/catalog-master.service.ts';let s=load(p,'9d02c68037dd7410e5f238272b25543383c4c5db');
 s='import { nullableApiNumber, requiredApiIdentity, requiredApiState } from "@/shared/api/api-read-values";\n'+s;
 s=replace(s,'const rawVersion = Number(row.version);','const rawVersion = nullableApiNumber(row.version);');
 s=replace(s,'id: text(row.id),','id: requiredApiIdentity(row.id),');
 s=replace(s,'status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",','status: requiredApiState(status, ["ACTIVE", "INACTIVE"] as const),');
 s=replace(s,'version: Number.isFinite(rawVersion) ? rawVersion : null,','version: rawVersion,');
 put(p,s);
}
{
 const p='src/modules/outbound/services/mvpOutboundService.ts';let s=load(p,'2049ba2771764f32df473a59b623c88337a961d3');
 s='import { requiredApiState, requiredApiNumber } from "@/shared/api/api-read-values";\n'+s;
 s=replaceFunction(s,'normalizeStatus',`function normalizeStatus(value: unknown): OutboundStatus {
  return requiredApiState(value, ["DRAFT", "SCANNING", "POSTED", "CANCELLED"] as const);
}`);
 s=replace(s,'const status = text(row.status, "ACTIVE").toUpperCase();','const status = requiredApiState(row.status, ["ACTIVE", "REMOVED", "POSTED"] as const);');
 s=replace(s,'quantity: num(row.quantity ?? 1) || 1,','quantity: requiredApiNumber(row.quantity, "item_match.quantity"),');
 s=replace(s,'status:\n      status === "REMOVED" || status === "POSTED"\n        ? (status as "REMOVED" | "POSTED")\n        : "ACTIVE",','status,');
 s=replace(s,'quantity: num(row.quantity ?? row.qty ?? row.quantity_delta),','quantity: requiredApiNumber(row.quantity ?? row.qty ?? row.qty_delta ?? row.quantity_delta, "movement.quantity"),');
 put(p,s);
}
for(const [p,s] of edits){const sf=tree(s);assert.equal(sf.parseDiagnostics.length,0,'TS syntax failed: '+p+' '+sf.parseDiagnostics.map(d=>d.messageText));fs.mkdirSync(p.slice(0,p.lastIndexOf('/')),{recursive:true});fs.writeFileSync(p,s);console.log('API_ONLY_EDIT',p);}
fs.writeFileSync('/tmp/nonreport-changed.json',JSON.stringify([...edits.keys()]));
