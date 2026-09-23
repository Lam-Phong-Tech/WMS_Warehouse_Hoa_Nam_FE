import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import ts from 'typescript';
const tracked=cp.execFileSync('git',['ls-files','src','public'],{encoding:'utf8'}).trim().split('\n');
const test=/\.(?:test|spec)\.|\/(?:test|tests|__tests__|__mocks__|__fixtures__)\//;
const files=tracked.filter(p=>/\.(?:tsx?|jsx?|json|html)$/.test(p)&&!p.includes('/reports/')&&!test.test(p));
const codeFiles=files.filter(p=>/\.[jt]sx?$/.test(p));
const emit=(kind,p,node,sf,extra={})=>console.log(JSON.stringify({kind,path:p,line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1,text:node.getText(sf).replace(/\s+/g,' ').slice(0,850),...extra}));
const unwrap=n=>{while(n&&(ts.isAsExpression(n)||ts.isParenthesizedExpression(n)||ts.isSatisfiesExpression(n)))n=n.expression;return n;};
const literal=n=>n&&(ts.isStringLiteral(n)||ts.isNumericLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||n.kind===ts.SyntaxKind.TrueKeyword||n.kind===ts.SyntaxKind.FalseKeyword);
const domain=/\b(?:id|code|sku|sku_id|skuCode|serial|serialNumber|quantity|qty|qty_on_hand|expected|scanned|total|totalRows|version|status|warehouseId|createdAt|updatedAt|postedAt|balance|inbound|outbound)\b/i;
const imports=new Map();let arrays=0,overlays=0;
for(const p of codeFiles){
 const code=fs.readFileSync(p,'utf8'),sf=ts.createSourceFile(p,code,ts.ScriptTarget.Latest,true,p.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const deps=[];
 const visit=n=>{
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))deps.push(n.moduleSpecifier.text);
  if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0]))deps.push(n.arguments[0].text);
  if(ts.isArrayLiteralExpression(n)&&n.elements.length>0){
   const values=n.elements.map(unwrap);const objects=values.filter(ts.isObjectLiteralExpression);
   const recordObjects=objects.filter(o=>o.properties.some(v=>ts.isPropertyAssignment(v)&&domain.test(v.name.getText(sf))&&literal(unwrap(v.initializer))));
   if(recordObjects.length>0||values.length>=3&&values.every(v=>ts.isNumericLiteral(v))){arrays++;emit('literal-array',p,n,sf,{elements:n.elements.length});}
  }
  if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)){
   const open=ts.isJsxElement(n)?n.openingElement:n;const tag=open.tagName.getText(sf);
   if(/Modal|Dialog|Drawer/.test(tag)){overlays++;emit('overlay',p,open,sf);}
   for(const a of open.attributes.properties){if(!ts.isJsxAttribute(a)||!a.initializer)continue;
    if(/^(?:data|rows|dataSource|count|total|value|defaultValue|percentage|quantity|status|name)$/.test(a.name.getText(sf))){
     const init=ts.isJsxExpression(a.initializer)?unwrap(a.initializer.expression):a.initializer;
     if(literal(init)&&!ts.isStringLiteral(init)||init&&ts.isArrayLiteralExpression(init)&&init.elements.length>0)emit('jsx-fixed-value',p,a,sf);
    }
   }
  }
  if(ts.isJsxText(n)&&/\d|Minh Anh|Hoa Nam|Nguyễn|Trần|Đang hoạt động/.test(n.getText(sf))&&n.getText(sf).trim())emit('jsx-literal-text',p,n,sf);
  if(ts.isBinaryExpression(n)&&[ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.BarBarToken].includes(n.operatorToken.kind)){
   const r=unwrap(n.right);
   if(r&&((literal(r)&&r.getText(sf)!=='""'&&r.getText(sf)!=="''")||ts.isObjectLiteralExpression(r)||ts.isArrayLiteralExpression(r)&&r.elements.length>0||/Date\(|dayjs\(|\.now\(/.test(r.getText(sf))))
    if(p.includes('/modules/')||p.includes('/shared/api/'))emit('fallback-review',p,n,sf);
  }
  if(ts.isPropertyAssignment(n)&&domain.test(n.name.getText(sf))){
   const init=unwrap(n.initializer);
   if(literal(init)&&n.parent&&ts.isObjectLiteralExpression(n.parent))emit('domain-literal',p,n,sf);
  }
  if(ts.isCallExpression(n)&&/(?:http|api|axios)\.(?:get|post|patch|put|delete)|useQuery|useMutation/.test(n.expression.getText(sf)))emit('api-query',p,n,sf);
  ts.forEachChild(n,visit);
 };
 visit(sf);imports.set(p,deps);
}
const resolved=new Map();
const resolve=(p,dep)=>{const stem=dep.startsWith('@/')?'src/'+dep.slice(2):dep.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(p),dep)):'';if(!stem)return null;return [stem,...['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx'].map(s=>stem+s)].find(s=>tracked.includes(s))||null;};
for(const [p,deps] of imports)resolved.set(p,deps.map(d=>resolve(p,d)).filter(Boolean));
for(const [p,deps] of resolved)console.log(JSON.stringify({kind:'import-graph',path:p,dependencies:deps}));
console.log(JSON.stringify({kind:'audit-totals',runtimeFiles:files.length,codeFiles:codeFiles.length,literalArrays:arrays,overlaySites:overlays,sha:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}));
