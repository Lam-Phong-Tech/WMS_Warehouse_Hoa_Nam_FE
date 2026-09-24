import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const changed = new Set();
function load(path, expected) {
  const source = fs.readFileSync(path, 'utf8');
  assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(source)+'\0').update(source).digest('hex'), expected, 'Concurrent edit: '+path);
  return source;
}
function parse(source) { return ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function put(path, source) {
  assert(path.startsWith('src/') && !path.includes('/reports/'));
  assert.equal(parse(source).parseDiagnostics.length, 0, 'Syntax: '+path);
  fs.writeFileSync(path, source); changed.add(path);
}
function rep(source, from, to, count=1) {
  assert.equal(source.split(from).length-1, count, 'Anchor: '+from);
  return source.replaceAll(from, to);
}
function edit(source, predicate, replacement, count=1) {
  const sf=parse(source), found=[];
  const visit=node=>{ if(predicate(node,sf)){found.push(node);return;} ts.forEachChild(node,visit); };
  visit(sf); assert.equal(found.length,count,'AST: '+predicate.toString());
  for(const node of found.sort((a,b)=>b.pos-a.pos)) source=source.slice(0,node.getStart(sf))+(typeof replacement==='function'?replacement(node,sf):replacement)+source.slice(node.end);
  return source;
}
{
 const path='src/shared/api/documentAttachmentService.ts';
 let source=load(path,'4a6f985c3ff10c6996d82984537ecd4f2a782452');
 source='import { nullableApiNumber, requiredApiIdentity, requiredApiState } from "@/shared/api/api-read-values";\n'+source;
 source=rep(source,'import { requireNonEmptyString } from "@/shared/api/wms-contract";','import { requireNonEmptyString, WmsContractError } from "@/shared/api/wms-contract";');
 source=rep(source,'file_size_bytes: number;','file_size_bytes: number | null;');
 source=edit(source,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='numberOrZero',`function attachmentFileSize(value: unknown): number | null {
   const size = nullableApiNumber(value);
   return size !== null && size >= 0 ? size : null;
 }
 function requireEvidenceFlag(value: unknown): boolean {
   if (typeof value !== "boolean") throw new WmsContractError("WMS_FE_MISSING_API_VALUE", "Phản hồi máy chủ chưa xác định yêu cầu chứng từ. Vui lòng tải lại để kiểm tra.");
   return value;
 }`);
 source=edit(source,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='rowsOf',`function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
   if (Array.isArray(value)) return value;
   if (value && typeof value === "object" && Array.isArray(value.data)) return value.data;
   throw new WmsContractError("WMS_FE_INVALID_API_ROWS", "Phản hồi máy chủ không có danh sách chứng từ hợp lệ. Vui lòng tải lại để kiểm tra.");
 }`);
 source=rep(source,'id: text(row.id),','id: requiredApiIdentity(row.id, "attachment.id"),');
 source=rep(source,'document_type: text(row.document_type) as DocumentAttachmentType,','document_type: requiredApiState(row.document_type, ["INBOUND", "OUTBOUND", "REVERSAL"] as const, "attachment.document_type"),',2);
 source=rep(source,'file_size_bytes: numberOrZero(row.file_size_bytes),','file_size_bytes: attachmentFileSize(row.file_size_bytes),');
 source=edit(source,(n,f)=>ts.isPropertyAssignment(n)&&n.name.getText(f)==='attachment_type','attachment_type: requiredApiState(row.attachment_type, ["SOURCE_DOCUMENT", "INVOICE", "DELIVERY_NOTE", "PHOTO", "OTHER"] as const, "attachment.attachment_type")');
 source=edit(source,(n,f)=>ts.isPropertyAssignment(n)&&n.name.getText(f)==='status'&&n.initializer.getText(f).includes('DocumentAttachment["status"]'),'status: requiredApiState(row.status, ["ACTIVE", "DELETED", "QUARANTINED"] as const, "attachment.status")');
 source=edit(source,(n,f)=>ts.isPropertyAssignment(n)&&n.name.getText(f)==='evidenceStatus','evidenceStatus: requiredApiState(result.meta?.evidence_status, ["PROVIDED", "PENDING", "NOT_REQUIRED"] as const, "attachment.evidence_status")');
 source=rep(source,'requiresEvidence: Boolean(result.meta?.requires_evidence),','requiresEvidence: requireEvidenceFlag(result.meta?.requires_evidence),');
 put(path,source);
}
{
 const path='src/shared/components/DocumentAttachmentsPanel.tsx';
 let source=load(path,'aec8ba8f52540741858e859c1ecee259b6cd193d');
 source='import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";\n'+source;
 source=rep(source,'function formatFileSize(bytes: number): string {','function formatFileSize(bytes: number | null): string {\n  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return EMPTY_TEXT;');
 source=rep(source,'const attachments = query.data?.attachments ?? EMPTY_ATTACHMENTS;','const attachments = query.isError ? EMPTY_ATTACHMENTS : (query.data?.attachments ?? EMPTY_ATTACHMENTS);');
 source=rep(source,'const evidenceStatus = query.data?.evidenceStatus ?? "NOT_REQUIRED";','const evidenceStatus = query.isSuccess ? query.data.evidenceStatus : null;');
 source=edit(source,(n,f)=>ts.isConditionalExpression(n)&&n.condition.getText(f)==='query.isLoading',(n,f)=>`${n.condition.getText(f)} ? ${n.whenTrue.getText(f)} : query.isError ? (<ApiErrorAlert error={query.error} onRetry={() => { void query.refetch(); }} />) : ${n.whenFalse.getText(f)}`);
 put(path,source);
}
{
 const path='src/modules/inventory/services/inventoryService.ts';
 let source=load(path,'dae41845adbfe745bece66dd7cc2133b063ba321');
 for(const name of ['originalQty','reversedQty','remainingReversibleQty','netQtyDelta','reversalCount']) source=rep(source,name+': number;',name+': number | null;');
 source=rep(source,'fullyReversed: boolean;','fullyReversed: boolean | null;');
 source=rep(source,'const effect = row.net_effect as RawRecord | undefined;','const effect = nested(row, "net_effect");');
 source=rep(source,'basis: text(effect.basis, "LEDGER"),','basis: text(effect.basis),');
 for(const name of ['original_qty','reversed_qty','remaining_reversible_qty','net_qty_delta','reversal_count']) source=rep(source,'Number(effect.'+name+' ?? 0)','nullableApiNumber(effect.'+name+')');
 source=rep(source,'fullyReversed: Boolean(effect.fully_reversed),','fullyReversed: typeof effect.fully_reversed === "boolean" ? effect.fully_reversed : null,');
 source=rep(source,'row.qty_change ?? row.qty_delta ?? row.quantity ?? row.qty,','row.qty_delta ?? row.qty_change ?? row.quantity ?? row.qty,');
 put(path,source);
}
{
 const path='src/modules/inventory/components/TraceModal.tsx';
 let source=load(path,'6976b7d3eec1528b5b7286218b8c43f2970e6317');
 source='import { nullableApiNumber } from "@/shared/api/api-read-values";\n'+source;
 source=rep(source,'function text(value: unknown, fallback = "-"): string {',`function quantityColor(value: number | null): string | undefined {
   return value === null ? undefined : value >= 0 ? SEMANTIC_LIGHT.successText : SEMANTIC_LIGHT.errorText;
 }
 function text(value: unknown, fallback = "-"): string {`);
 source=rep(source,'formatQuantity(Number(row.quantity ?? 0))','formatQuantity(nullableApiNumber(row.quantity))');
 source=rep(source,'const qty = Number(row.qty_delta ?? row.quantity ?? 0);','const qty = nullableApiNumber(row.qty_delta ?? row.quantity);');
 source=edit(source,(n,f)=>ts.isPropertyAssignment(n)&&n.name.getText(f)==='color'&&n.initializer.getText(f).startsWith('qty >= 0'),'color: quantityColor(qty)');
 source=rep(source,'qty >= 0 ? `+${formatQuantity(qty)}` : formatQuantity(qty)','qty !== null && qty >= 0 ? `+${formatQuantity(qty)}` : formatQuantity(qty)');
 source=rep(source,'formatQuantity(Number(row.quantity ?? row.qty ?? row.qty_actual ?? 0))','formatQuantity(nullableApiNumber(row.quantity ?? row.qty ?? row.qty_actual))');
 source=edit(source,(n,f)=>ts.isPropertyAssignment(n)&&n.name.getText(f)==='color'&&n.initializer.getText(f).includes('row.qty_delta >= 0'),'color: quantityColor(nullableApiNumber(row.qty_delta))');
 source=rep(source,'formatQuantity(Number(row.qty_delta))','formatQuantity(nullableApiNumber(row.qty_delta))');
 source=edit(source,(n,f)=>ts.isPropertyAssignment(n)&&n.name.getText(f)==='color'&&n.initializer.getText(f).includes('Number(movement.qty_change'),'color: quantityColor(nullableApiNumber(movement.qty_delta ?? movement.qty_change ?? movement.quantity))');
 source=rep(source,'Number(movement.qty_change ?? movement.quantity ?? 0)','nullableApiNumber(movement.qty_delta ?? movement.qty_change ?? movement.quantity)');
 source=rep(source,'trace.netEffect.reversedQty > 0','trace.netEffect.reversedQty !== null && trace.netEffect.reversedQty > 0');
 source=edit(source,(n,f)=>ts.isJsxAttribute(n)&&n.name.getText(f)==='tone'&&n.initializer?.getText(f).includes('trace.netEffect.fullyReversed'),'tone={trace.netEffect.fullyReversed === null || trace.netEffect.reversalCount === null ? "neutral" : trace.netEffect.fullyReversed ? "error" : "success"}');
 source=edit(source,(n,f)=>ts.isJsxAttribute(n)&&n.name.getText(f)==='label'&&n.initializer?.getText(f).includes('inventory.trace.stillEffective'),'label={trace.netEffect.fullyReversed === null || trace.netEffect.reversalCount === null ? t("inventory.trace.undetermined") : trace.netEffect.fullyReversed ? t("inventory.trace.fullyReversed") : t("inventory.trace.stillEffective", { count: trace.netEffect.reversalCount })}');
 source=rep(source,'rows={codeTrace.movements}','rows={codeTrace.movements.map((row, index) => withRowKey(row, `${submittedCode ?? ""}:${text(row.id ?? row.movement_id, "")}:${index}`))}');
 source=rep(source,'rowKey={(row) => text(row.id, String(Math.random()))}','rowKey={(row) => text(row.__rowKey)}');
 put(path,source);
}
put('src/shared/api/nonreport-read-integrity.test.ts',`import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/shared/api/http", () => ({ http: { get: vi.fn(), getPage: vi.fn() } }));
import { http } from "@/shared/api/http";
import { fetchDocumentAttachments } from "./documentAttachmentService";
import { traceStockMovementSource } from "@/modules/inventory/services/inventoryService";

// Only empty/malformed transport responses are used here; no runtime records or API writes.
describe("non-report read integrity", () => {
 beforeEach(() => { vi.mocked(http.get).mockReset(); vi.mocked(http.getPage).mockReset(); });
 it("does not invent evidence status for missing metadata", async () => {
   vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
   await expect(fetchDocumentAttachments("INBOUND", "scope")).rejects.toMatchObject({ code: "WMS_FE_INVALID_API_STATE" });
 });
 it("accepts an explicitly confirmed empty attachment list", async () => {
   vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: { evidence_status: "NOT_REQUIRED", requires_evidence: false } });
   await expect(fetchDocumentAttachments("OUTBOUND", "scope")).resolves.toEqual({ attachments: [], evidenceStatus: "NOT_REQUIRED", requiresEvidence: false });
 });
 it.each([undefined, null, "false", "true", 0, 1])("does not coerce a missing/invalid evidence flag: %s", async flag => {
   vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: { evidence_status: "PENDING", requires_evidence: flag } });
   await expect(fetchDocumentAttachments("REVERSAL", "scope")).rejects.toMatchObject({ code: "WMS_FE_MISSING_API_VALUE" });
 });
 it.each([null, {}, { data: null }])("does not disguise a malformed list as empty: %j", async data => {
   vi.mocked(http.getPage).mockResolvedValue({ data, meta: { evidence_status: "PENDING", requires_evidence: true } });
   await expect(fetchDocumentAttachments("REVERSAL", "scope")).rejects.toMatchObject({ code: "WMS_FE_INVALID_API_ROWS" });
 });
 it("keeps absent net-effect quantities and completion flag unknown", async () => {
   vi.mocked(http.get).mockResolvedValue({ net_effect: {} });
   const result = await traceStockMovementSource("scope");
   expect(result.netEffect).toMatchObject({ basis: "", originalQty: null, reversedQty: null, remainingReversibleQty: null, netQtyDelta: null, reversalCount: null, fullyReversed: null });
 });
 it("preserves explicit zero and negative API quantities", async () => {
   vi.mocked(http.get).mockResolvedValue({ net_effect: { original_qty: "0", reversed_qty: "0", remaining_reversible_qty: "0", net_qty_delta: "-1.5", reversal_count: "0", fully_reversed: false } });
   const result = await traceStockMovementSource("scope");
   expect(result.netEffect).toMatchObject({ originalQty: 0, reversedQty: 0, remainingReversibleQty: 0, netQtyDelta: -1.5, reversalCount: 0, fullyReversed: false });
 });
});
`);
cp.execFileSync('node_modules/.bin/prettier',['--write',...changed],{stdio:'inherit'});
cp.execFileSync('git',['diff','--check'],{stdio:'inherit'});
assert.equal(cp.execFileSync('git',['diff','--name-only','--','src/modules/reports'],{encoding:'utf8'}).trim(),'');
fs.writeFileSync('/tmp/nonreport-recheck-paths.json',JSON.stringify([...changed]));
