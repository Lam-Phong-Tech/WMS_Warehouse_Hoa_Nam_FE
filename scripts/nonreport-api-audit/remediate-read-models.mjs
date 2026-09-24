import fs from 'node:fs';
import cp from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import ts from 'typescript';
const changed = new Set();
const parse=(s,p='file.tsx')=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,p.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
function load(p,expected){const s=fs.readFileSync(p,'utf8');if(expected)assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex'),expected,'Source changed: '+p);return s;}
function put(p,s){assert(p.startsWith('src/')&&!p.includes('/reports/'));assert.equal(parse(s,p).parseDiagnostics.length,0,'Syntax: '+p);fs.writeFileSync(p,s);changed.add(p);}
function nodes(s,predicate){const sf=parse(s),out=[];const visit=n=>{if(predicate(n,sf)){out.push(n);return;}ts.forEachChild(n,visit);};visit(sf);return {sf,out};}
function edit(s,predicate,replacement,count=1){const {sf,out}=nodes(s,predicate);assert.equal(out.length,count,'Unexpected node count: '+replacement.toString().slice(0,90));for(const n of out.sort((a,b)=>b.pos-a.pos))s=s.slice(0,n.getStart(sf))+(typeof replacement==='function'?replacement(n,sf):replacement)+s.slice(n.end);return s;}
function fn(s,name,transform){return edit(s,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name,(n,f)=>typeof transform==='function'?transform(n.getText(f)):transform);}
function prop(s,name,value){return edit(s,(n,f)=>ts.isPropertyAssignment(n)&&n.name.getText(f)===name,`${name}: ${value}`);}
function member(s,iface,name,type){return edit(s,(n,f)=>ts.isPropertySignature(n)&&n.name.getText(f)===name&&ts.isInterfaceDeclaration(n.parent)&&n.parent.name.text===iface,`${name}: ${type};`);}
function rep(s,a,b,count=1){assert.equal(s.split(a).length-1,count,'Anchor: '+a);return s.replaceAll(a,b);}
const imports='import { nullableApiNumber, requiredApiNumber, requiredApiState, requiredApiIdentity, nullableApiBoolean, requiredApiBoolean, requiredApiRows, optionalApiState, requiredApiVersion } from "@/shared/api/api-read-values";\n';
{
 const p='src/shared/api/api-read-values.ts';let s=load(p);
 s+=`
/** Missing flags must not be reinterpreted as a server decision. */
export function nullableApiBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
export function requiredApiBoolean(value: unknown, field: string): boolean {
  const result = nullableApiBoolean(value);
  if (result === null) throw new WmsContractError("WMS_FE_MISSING_API_VALUE", "Chưa nhận đủ dữ liệu từ máy chủ (" + field + "). Vui lòng tải lại.");
  return result;
}
export function optionalApiState<T extends string>(value: unknown, allowed: readonly T[], field: string): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredApiState(value, allowed, field);
}
export function requiredApiRows<T>(value: unknown, field = "rows"): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown }).data)) return (value as { data: T[] }).data;
  throw new WmsContractError("WMS_FE_MISSING_API_VALUE", "Danh sách từ máy chủ chưa đầy đủ hoặc không hợp lệ (" + field + "). Vui lòng tải lại.");
}
export function requiredApiVersion(value: unknown, field = "If-Match"): number {
  const version = requiredApiNumber(value, field);
  if (!Number.isSafeInteger(version) || version <= 0) throw new WmsContractError("WMS_FE_MISSING_API_VALUE", "Chưa có phiên bản bản ghi hợp lệ từ máy chủ. Vui lòng tải lại trước khi thao tác.");
  return version;
}
`;
 put(p,s);
}
{
 const p='src/modules/warranty/services/warrantyService.ts';let s=imports+load(p,'e792e45c3c2e2a6943802db0b149d85fb77aca9a');
 s=fn(s,'rowsOf','function rowsOf<T>(value: T[] | { data?: T[] }): T[] { return requiredApiRows<T>(value, "warranty.rows"); }');
 s=fn(s,'numberOrUndefined','function numberOrUndefined(value: unknown): number | undefined { return nullableApiNumber(value) ?? undefined; }');
 s=fn(s,'canonicalStatus',b=>rep(b,'return "RECEIVED";\n  }','throw new WmsContractError("WMS_FE_INVALID_API_STATE", "Chưa xác định được trạng thái bảo hành từ máy chủ. Vui lòng tải lại.");\n  }'));
 s=fn(s,'normalizeWarrantyCase',b=>{
   b=edit(b,n=>ts.isVariableDeclaration(n)&&n.name.getText()==='identificationType','identificationType = optionalApiState(beIdentification, ["IDENTIFIED", "TEMP_ONLY"] as const, "warranty.identification")');
   b=prop(b,'priority','optionalApiState(row.priority, ["LOW", "MEDIUM", "HIGH", "URGENT"] as const, "warranty.priority")');
   b=prop(b,'version','numberOrUndefined(row.version)');
   b=prop(b,'id','requiredApiIdentity(row.warranty_case_id ?? row.id, "warranty_case_id")');
   return b;
 });
 s=fn(s,'normalizeWarrantyEvent',b=>{
  b=prop(b,'event_type','optionalApiState(row.event_type, ["RECEIVE", "CHECK", "REPAIR", "COMPLETE", "RETURN", "CANCEL", "NOTE", "TEMP_ONLY", "RECEIVED", "STATUS_CHANGE", "NOTE_ADDED", "PARTS_ORDERED", "PARTS_RECEIVED", "TEMP_RESOLUTION", "CUSTOMER_CONTACTED", "RETURNED"] as const, "warranty.event_type")');
  b=prop(b,'to_status','row.to_status == null && row.status == null ? undefined : canonicalStatus(row.to_status ?? row.status)');
  return b;
 });
 s=fn(s,'normalizeAttachment',b=>{
   b=prop(b,'file_size_bytes','nullableApiNumber(row.file_size_bytes ?? row.file_size)');
   b=prop(b,'attachment_type','optionalApiState(row.attachment_type, ["INTAKE", "DIAGNOSTIC", "RETURN", "OTHER"] as const, "warranty.attachment_type")');
   b=prop(b,'media_kind','optionalApiState(row.media_kind, ["IMAGE", "VIDEO"] as const, "warranty.media_kind")');
   b=prop(b,'status','optionalApiState(row.status, ["ACTIVE", "DELETED", "QUARANTINED"] as const, "warranty.attachment_status")');return b;
 });
 s=s.replace('const ifMatch = requirePositiveNumber(','const ifMatch = requiredApiVersion(');
 put(p,s);
 const t='src/modules/warranty/types/index.ts';let v=load(t,'8141c3b120480053bcdbcde9ee30523dd859b4ad');
 for(const [i,n,ty] of [['WarrantyCase','identification_type','WarrantyIdentificationType | undefined'],['WarrantyCase','priority','WarrantyPriority | undefined'],['WarrantyCase','version','number | undefined'],['WarrantyEvent','event_type','WarrantyEventType | undefined'],['WarrantyEvent','to_status','WarrantyCaseStatus | undefined'],['WarrantyAttachment','file_size_bytes','number | null'],['WarrantyAttachment','attachment_type','WarrantyAttachmentType | undefined'],['WarrantyAttachment','media_kind','"IMAGE" | "VIDEO" | undefined'],['WarrantyAttachment','status','"ACTIVE" | "DELETED" | "QUARANTINED" | undefined']])v=member(v,i,n,ty);
 put(t,v);
}
{
 const p='src/modules/inbound/services/inboundService.ts';let s=load(p,'69c33043706701d77282ea0db82b41f7b338d981');
 s=rep(s,'import { nullableApiNumber } from "@/shared/api/api-read-values";',imports.trim());
 s=fn(s,'num','function num(value: unknown): number { return requiredApiNumber(value, "inbound.quantity"); }');
 s=fn(s,'rowsOf','function rowsOf<T>(value: T[] | { data?: T[] }): T[] { return requiredApiRows<T>(value, "inbound.rows"); }');
 s=fn(s,'normalizeDocument',b=>{
  b=b.replaceAll('const expected = lines.length','const expected = row.lines != null || row.items != null').replaceAll('const scanned = lines.length','const scanned = row.lines != null || row.items != null');
  b=prop(b,'pendingProductInfo','nullableApiBoolean(row.pending_product_info) ?? undefined');
  b=prop(b,'pendingProductInfoCount','nullableApiNumber(row.pending_product_info_count) ?? undefined');return b;
 });
 s=fn(s,'normalizeLine',b=>{
  b=rep(b,'num(row.scanned_qty ?? row.qty_scanned ?? 0)','num(row.scanned_qty ?? row.qty_scanned)');
  b=prop(b,'infoComplete','nullableApiBoolean(row.product_info_complete) ?? undefined');
  b=prop(b,'validation','optionalApiState(row.validation, ["VALID", "INVALID", "UNKNOWN"] as const, "inbound.validation") ?? "UNKNOWN"');
  return b;
 });
 put(p,s);
 const t='src/modules/inbound/types/index.ts';let v=load(t);v=member(v,'InboundDocument','pendingProductInfo','boolean | undefined');v=member(v,'InboundDocument','pendingProductInfoCount','number | undefined');v=member(v,'InboundLine','infoComplete','boolean | undefined');put(t,v);
}
{
 const p='src/modules/outbound/services/mvpOutboundService.ts';let s=load(p,'14feba5ecdfd68bb3a9cf658d32fddff8658a96b');
 s=imports+s.replace(/import\s*\{[^}]*\}\s*from "@\/shared\/api\/api-read-values";\s*/,'');
 s=fn(s,'num','function num(value: unknown): number { return requiredApiNumber(value, "outbound.quantity"); }');
 s=fn(s,'rowsOf','function rowsOf<T>(value: T[] | { data?: T[] }): T[] { return requiredApiRows<T>(value, "outbound.rows"); }');
 s=fn(s,'rawLines','function rawLines(row: RawRecord): RawRecord[] { return requiredApiRows<RawRecord>(row.lines, "outbound.lines"); }');
 s=fn(s,'normalizeDocument',b=>{
  b=prop(b,'code','text(row.doc_no ?? row.document_no ?? row.code)');
  b=prop(b,'version','requiredApiVersion(row.version, "outbound.version")');return b;
 });
 put(p,s);
}
{
 const p='src/modules/master-data/services/mvp-master.service.ts';let s=imports+load(p,'6adafa3e085200a5c6802c583e12048f07524822');
 s=fn(s,'listCatalogRefs',`async function listCatalogRefs(endpoint: string, codeKey: string, nameKey: string): Promise<CatalogRefRecord[]> {
  const records: CatalogRefRecord[] = [];
  const ids = new Set<string>();
  for (let page = 1; ; page += 1) {
    const result = await http.getPage<Array<Record<string, unknown>>>(endpoint, { params: { page, per_page: 200 } });
    const rows = requiredApiRows<Record<string, unknown>>(result.data, "catalog.references");
    const meta = result.meta as Record<string, unknown>;
    const pagination = meta?.pagination && typeof meta.pagination === "object" ? meta.pagination as Record<string, unknown> : meta;
    for (const row of rows) {
      const id = requiredApiIdentity(row.id);
      if (ids.has(id)) throw new Error("Danh mục thay đổi trong lúc tải. Vui lòng tải lại.");
      ids.add(id);
      records.push({ id, code: String(row[codeKey] ?? ""), name: String(row[nameKey] ?? ""), status: optionalApiState(row.status, ["ACTIVE", "INACTIVE"] as const, "catalog.reference.status") });
    }
    const lastPage = nullableApiNumber(pagination?.last_page ?? pagination?.total_pages);
    const total = nullableApiNumber(pagination?.total);
    const perPage = nullableApiNumber(pagination?.per_page);
    if (lastPage !== null && page >= lastPage || total !== null && records.length >= total) return records;
    if (lastPage === null && total === null) {
      if (rows.length === 0 || perPage !== null && rows.length < perPage) return records;
      throw new Error("Máy chủ chưa trả đủ thông tin phân trang danh mục. Vui lòng tải lại.");
    }
    if (rows.length === 0 || page >= 1000) throw new Error("Danh mục tải chưa đầy đủ. Vui lòng tải lại.");
  }
}`);
 s=fn(s,'hasMvpSkuStock',`export async function hasMvpSkuStock(skuId: string): Promise<boolean> {
  const id = requiredApiIdentity(skuId, "sku_id");
  for (let page = 1; ; page += 1) {
    const result = await http.getPage<Array<{ on_hand_qty?: number | string }>>(API_ENDPOINTS.INVENTORY_BALANCES, { params: { product_id: id, page, per_page: 200 } });
    const rows = requiredApiRows<{ on_hand_qty?: number | string }>(result.data, "sku.stock");
    if (rows.some(row => requiredApiNumber(row.on_hand_qty, "on_hand_qty") !== 0)) return true;
    const meta = result.meta as Record<string, unknown>;
    const pagination = meta?.pagination && typeof meta.pagination === "object" ? meta.pagination as Record<string, unknown> : meta;
    const last = nullableApiNumber(pagination?.last_page ?? pagination?.total_pages);
    const total = nullableApiNumber(pagination?.total);
    const size = nullableApiNumber(pagination?.per_page);
    if (last !== null && page >= last || total === 0) return false;
    if (last === null && total !== null && size !== null && page * size >= total) return false;
    if (rows.length === 0 && total === null && last === null) return false;
    if (rows.length === 0 || last === null && (total === null || size === null) || page >= 1000) throw new Error("Chưa xác minh được tồn kho của SKU. Vui lòng tải lại trước khi sửa định danh.");
  }
}`);
 s=s.replaceAll('"If-Match": String(version)','"If-Match": String(requiredApiVersion(version))');put(p,s);
 const t='src/modules/master-data/types/mvp-master.types.ts';let v=load(t);v=edit(v,n=>ts.isInterfaceDeclaration(n)&&n.name.text==='CatalogRefRecord',(n,f)=>n.getText(f).replace(/}\s*$/,'  status?: "ACTIVE" | "INACTIVE";\n}'));put(t,v);
 const ui='src/modules/master-data/pages/ApiMasterScreens.tsx';let u=load(ui,'e072ea933b4d1f840a1239c73afb5f7a79de2b50');
 u=rep(u,'const identityLocked = Boolean(editing) && stockLockQuery.data === true;','const identityLocked = Boolean(editing) && (stockLockQuery.data !== false || Boolean(stockLockQuery.error) || stockLockQuery.isLoading);');
 u=fn(u,'SkuCatalogSelect',b=>rep(b,'const rows = options ?? [];','const rows = (options ?? []).filter(row => row.status === "ACTIVE" || row.id === value);'));
 // Errors belong beside the actual catalogue content, not an empty-list success state.
 u=rep(u,'const catalogs = catalogsQuery.data ?? EMPTY_CATALOGS;','const catalogs = catalogsQuery.error ? EMPTY_CATALOGS : catalogsQuery.data ?? EMPTY_CATALOGS;');
 const sf=parse(u),sites=[];const visit=n=>{if(ts.isJsxExpression(n)&&n.expression?.getText(sf)==='confirmDialog')sites.push(n);ts.forEachChild(n,visit);};visit(sf);
 assert(sites.length>0);const n=sites[0];u=u.slice(0,n.end)+'\n      {catalogsQuery.error ? <ApiErrorAlert error={catalogsQuery.error} onRetry={() => void catalogsQuery.refetch()} /> : null}\n      {modalOpen && editing && stockLockQuery.error ? <ApiErrorAlert error={stockLockQuery.error} onRetry={() => void stockLockQuery.refetch()} /> : null}'+u.slice(n.end);put(ui,u);
}
{
 const p='src/modules/master-data/services/sku-import.service.ts';let s=imports+load(p,'b7ab89245b669069b1cc373eba6c182d28369e5a');
 for(const name of ['normalizeSkuImportResult','normalizeSkuImportReport'])s=fn(s,name,b=>b.replace(/\bnum\((payload|raw)\.([a-z_]+)\)/g,'requiredApiNumber($1.$2, "$2")'));
 s=fn(s,'normalizeSkuImportResult',b=>{
  for(const [field,key] of [['dryRun','dry_run'],['committed','committed'],['partialWrite','partial_write']])b=prop(b,field,`requiredApiBoolean(payload.${key}, "import.${key}")`);
  return b;
 });
 s+=`\n/** A sent import without conclusive evidence must not be represented as a failed write. */
export class SkuImportOutcomeUnknownError extends Error {
  readonly outcomeUnknown = true;
  constructor(readonly cause: unknown) {
    super("Chưa xác định được kết quả nhập SKU. Yêu cầu đã gửi; hãy kiểm tra lịch sử nhập trước khi thực hiện lại.");
    this.name = "SkuImportOutcomeUnknownError";
  }
}\n`;
 s=fn(s,'importSkuExcel',b=>{
  b=rep(b,'return normalizeSkuImportResult(data);',`let result: SkuImportResult;
    try { result = normalizeSkuImportResult(data); } catch (error) { throw new SkuImportOutcomeUnknownError(error); }
    const expectedDryRun = options.dryRun ?? false;
    if (result.dryRun !== expectedDryRun || result.partialWrite || (expectedDryRun ? result.committed : !result.committed)) throw new SkuImportOutcomeUnknownError(new Error("Import outcome does not match requested mode"));
    return result;`);
  b=rep(b,'throw error;\n  }',`if (error instanceof SkuImportOutcomeUnknownError) throw error;
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (!options.dryRun && (status === undefined || status >= 500)) throw new SkuImportOutcomeUnknownError(error);
    throw error;
  }`);return b;
 });put(p,s);
 const ui='src/modules/master-data/components/SkuImportModal.tsx';let u=load(ui,'0b145576652745a4e56702d3fdb6b9a24ca406bf');
 u=rep(u,'  SkuImportUnavailableError,','  SkuImportUnavailableError,\n  SkuImportOutcomeUnknownError,');
 u=rep(u,'  const payloadGeneration = useRef(0);','  const payloadGeneration = useRef(0);\n  const [outcomeUnknown, setOutcomeUnknown] = useState(false);');
 u=rep(u,'    onSuccess: (result) => {\n      setCommitResult(result);','    onSuccess: (result) => {\n      if (result.committed !== true || result.dryRun !== false || result.partialWrite !== false) { setOutcomeUnknown(true); toast.warning(new SkuImportOutcomeUnknownError(null).message); return; }\n      setCommitResult(result);');
 u=rep(u,'    onError: (error) => {\n      if (error instanceof SkuImportFileChangedError)', '    onError: (error) => {\n      if (error instanceof SkuImportOutcomeUnknownError) { setOutcomeUnknown(true); setCommitResult(null); toast.warning(error.message); return; }\n      if (error instanceof SkuImportFileChangedError)');
 u=rep(u,'  const canCommit =\n    canImport &&','  const canCommit =\n    !outcomeUnknown &&\n    previewResult?.dryRun === true &&\n    previewResult?.committed === false &&\n    previewResult?.partialWrite === false &&\n    canImport &&');
 u=rep(u,'    if (previewMutation.isPending || commitMutation.isPending) return;','    if (previewMutation.isPending || commitMutation.isPending || outcomeUnknown) return;');
 const sf=parse(u),elements=[];const visit=n=>{if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(sf)==='UiDialog')elements.push(n);ts.forEachChild(n,visit);};visit(sf);assert.equal(elements.length,1);const end=elements[0].openingElement.end;
 u=u.slice(0,end)+'\n        {outcomeUnknown ? <UiAlert severity="warning">{new SkuImportOutcomeUnknownError(null).message}</UiAlert> : null}\n'+u.slice(end);put(ui,u);
}
// Repair tests for the current accessible login form; retain assertions and scenarios.
for(const p of ['src/modules/auth/pages/LoginPage.mfa.test.tsx','src/modules/auth/pages/LoginPage.transport-diagnostic.test.tsx']){
 let s=load(p);s=s.replaceAll('getByLabelText("Email")','getByLabelText("Tên đăng nhập")').replaceAll('getByLabelText(/email/i)','getByLabelText(/tên đăng nhập/i)');put(p,s);
}
{
 const p='src/modules/auth/pages/LoginPage.test.tsx';let s=load(p,'6ce7ab7163e9f972e17320d09bc4b53ad6bed994');
 s=rep(s,'screen.getByRole("checkbox", { name: /ghi nhớ đăng nhập/i })','screen.getByRole("textbox", { name: /tên đăng nhập/i })');
 s=rep(s,'screen.getByPlaceholderText(/your@gmail\\.com/i)','screen.getByRole("textbox", { name: /tên đăng nhập/i })');put(p,s);
}
{
 const p='src/modules/auth/components/SessionConfirmationGate.test.tsx';let s=load(p,'54945643fe8d4f1d42705a4e0e1e25989e6119db');
 s='import { QueryClient, QueryClientProvider } from "@tanstack/react-query";\n'+s;
 s=rep(s,'      <MemoryRouter initialEntries={["/"]}>','      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>\n      <MemoryRouter initialEntries={["/"]}>');
 s=rep(s,'      </MemoryRouter>,','      </MemoryRouter>\n      </QueryClientProvider>,');put(p,s);
}
// Drop only unused imports introduced by this guarded edit, never source declarations.
for(const p of changed){let s=fs.readFileSync(p,'utf8');const sf=parse(s,p),rem=[];const imports=sf.statements.filter(ts.isImportDeclaration);for(const n of imports){if(!ts.isStringLiteral(n.moduleSpecifier)||n.moduleSpecifier.text!=='@/shared/api/api-read-values')continue;const bindings=n.importClause?.namedBindings;if(!bindings||!ts.isNamedImports(bindings))continue;const names=bindings.elements.filter(e=>{const name=e.name.text;let count=0;const visit=node=>{if(ts.isIdentifier(node)&&node.text===name)count++;ts.forEachChild(node,visit);};visit(sf);return count>1;});rem.push({start:n.getStart(sf),end:n.end,value:names.length?'import { '+names.map(e=>e.getText(sf)).join(', ')+' } from "@/shared/api/api-read-values";':''});}for(const e of rem.sort((a,b)=>b.start-a.start))s=s.slice(0,e.start)+e.value+s.slice(e.end);fs.writeFileSync(p,s);}
cp.execFileSync('node_modules/.bin/prettier',['--write',...changed],{stdio:'inherit'});
cp.execFileSync('git',['diff','--check'],{stdio:'inherit'});
assert.equal(cp.execFileSync('git',['diff','--name-only','--','src/modules/reports'],{encoding:'utf8'}).trim(),'');
fs.writeFileSync('/tmp/read-model-changes.json',JSON.stringify([...changed]));
