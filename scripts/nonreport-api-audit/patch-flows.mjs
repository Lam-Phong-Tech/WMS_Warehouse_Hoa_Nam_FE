import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const changed = new Set(JSON.parse(fs.readFileSync('/tmp/nonreport-changed.json','utf8')));
function parse(source,path='source.tsx'){return ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
function load(path,expected){const original=cp.execFileSync('git',['show','HEAD:'+path],{encoding:'utf8'}); if(expected){const hash=crypto.createHash('sha1').update('blob '+Buffer.byteLength(original)+'\0').update(original).digest('hex');assert.equal(hash,expected,'Concurrent change: '+path);} return fs.readFileSync(path,'utf8');}
function put(path,source){assert(path.startsWith('src/')&&!path.includes('/reports/'));assert.equal(parse(source,path).parseDiagnostics.length,0,'Invalid syntax: '+path);fs.writeFileSync(path,source);changed.add(path);console.log('API_ONLY_EDIT',path);}
function rep(source,from,to,expected=1){assert.equal(source.split(from).length-1,expected,'Unexpected anchor count: '+from);return source.replaceAll(from,to);}
function propertyPath(node){const names=[];for(let n=node;n;n=n.parent)if(ts.isPropertyAssignment(n))names.unshift(n.name.getText().replace(/^['"]|['"]$/g,''));return names.join('.');}
for(const path of ['src/shared/i18n/messages.ts','src/shared/i18n/messages.en.ts']){
 let source=load(path); const sf=parse(source,path); const removals=[];const substitutions=[];
 const visit=n=>{
  if(ts.isPropertyAssignment(n)){
   const key=propertyPath(n);
   if(key==='catalog.data'||key==='catalog.longText'){
    let end=n.end;while(/\s/.test(source[end]??'')&&end<source.length)end++;
    if(source[end]===',')end++;
    removals.push({start:n.getStart(sf),end,value:''});return;
   }
   if(key.startsWith('catalog.')&&ts.isStringLiteral(n.initializer)&&n.initializer.text.includes('a1b2c3-fixture'))substitutions.push({start:n.initializer.getStart(sf),end:n.initializer.end,value:JSON.stringify(path.endsWith('.en.ts')?'Unable to load data from the server.':'Không tải được dữ liệu từ máy chủ.')});
  }
  ts.forEachChild(n,visit);
 };
 visit(sf);assert.equal(removals.length,2,'Expected only catalog sample text and business fixture object: '+path);
 assert.equal(substitutions.length,1,'Expected one simulated request id: '+path);
 for(const edit of [...removals,...substitutions].sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
 put(path,source);
}
{
 const path='src/modules/dashboard/pages/DashboardPage.tsx';let source=load(path);const sf=parse(source,path);let hits=[];
 const visit=n=>{if(ts.isPropertyAssignment(n)&&n.name.getText(sf)==='spark'&&n.getText(sf).includes('flowRows.reduce'))hits.push(n);ts.forEachChild(n,visit);};visit(sf);assert.equal(hits.length,1,'Expected one fabricated zero-opening sparkline');
 const n=hits[0];source=source.slice(0,n.initializer.getStart(sf))+'type === "ALL" ? trendRows.map((row) => row.closing) : []'+source.slice(n.initializer.end);put(path,source);
}
{
 const path='src/modules/inbound/services/inboundService.ts';let source=load(path,'28886d9d57347e122ff89c52a8d7b558e159377d');
 source='import { requiredApiNumber } from "@/shared/api/api-read-values";\n'+source;
 source=rep(source,'const posted = status === "POSTED" ? expected : 0;','const posted = status === "POSTED" ? scanned : 0;',2);
 source=rep(source,'version: num(row.version ?? row.lock_version ?? 1),','version: requiredApiNumber(row.version ?? row.lock_version, "inbound.version"),');
 put(path,source);
}
{
 const path='src/modules/outbound/services/mvpOutboundService.ts';let source=load(path);
 source=rep(source,'import { requiredApiState, requiredApiNumber } from "@/shared/api/api-read-values";','import { requiredApiState, requiredApiNumber, nullableApiNumber } from "@/shared/api/api-read-values";');
 const sf=parse(source,path),hits=[];const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='optionalNum')hits.push(n);ts.forEachChild(n,visit);};visit(sf);assert.equal(hits.length,1);
 const n=hits[0];source=source.slice(0,n.getStart(sf))+'function optionalNum(value: unknown): number | undefined { return nullableApiNumber(value) ?? undefined; }'+source.slice(n.end);
 put(path,source);
}
fs.writeFileSync('/tmp/nonreport-changed.json',JSON.stringify([...changed]));
