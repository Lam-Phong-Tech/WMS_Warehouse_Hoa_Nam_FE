/** One-time, reviewed source migration. Never changes runtime data or API contracts. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const APPLY = process.argv.includes('--apply');
const VI_RE = /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1ea0-\u1ef9]/u;
const normal = (s) => s.trim().replace(/\s+/g, ' ');
const approved = new Map();
for (const line of fs.readFileSync('scripts/i18n-reviewed-translations.tsv', 'utf8').split(/\r?\n/)) {
  if (!line) continue;
  const [vi, en, extra] = line.split('\t');
  if (!vi || !en || extra !== undefined || VI_RE.test(en)) throw Error(`Invalid translation row: ${vi}`);
  if (approved.has(normal(vi)) && approved.get(normal(vi)) !== en) throw Error(`Conflicting translation: ${vi}`);
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join('|');
  if (vars(vi) !== vars(en)) throw Error(`Placeholder mismatch: ${vi}`);
  approved.set(normal(vi), en);
}
function loadCatalog(file, name) {
  const source = fs.readFileSync(file, 'utf8').replace(/^import \{ MESSAGES_UPDATED_(?:VI|EN) \} from [^;]+;\s*/m, '').replace(/^\s*updatedUi: MESSAGES_UPDATED_(?:VI|EN),\s*/m, '');
  const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const box = {exports: {}};
  vm.runInNewContext(output, box, {timeout: 1000});
  return box.exports[name];
}
function flatten(value, prefix = '', out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') out[full] = child;
    else if (child && typeof child === 'object') flatten(child, full, out);
  }
  return out;
}
const oldVi = flatten(loadCatalog('src/shared/i18n/messages.ts', 'MESSAGES_VI'));
const oldEn = flatten(loadCatalog('src/shared/i18n/messages.en.ts', 'MESSAGES_EN'));
const existing = new Map();
for (const [key, vi] of Object.entries(oldVi)) {
  if (oldEn[key] && !VI_RE.test(oldEn[key]) && !/[{]\w+[}]/.test(vi)) {
    if (!existing.has(normal(vi))) existing.set(normal(vi), key);
  }
}
const addedVi = {}, addedEn = {};
function messageKey(raw) {
  const vi = normal(raw), sourceCopy = raw.trim();
  if (approved.has(vi)) {
    const id = `text_${crypto.createHash('sha256').update(sourceCopy).digest('hex').slice(0, 12)}`;
    if (addedVi[id] && addedVi[id] !== sourceCopy) throw Error('Translation key collision');
    addedVi[id] = sourceCopy;
    addedEn[id] = approved.get(vi);
    return `updatedUi.${id}`;
  }
  return existing.get(vi);
}
const sources = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/^(i18n|test|__tests__|__mocks__|fixtures|mocks|generated)$/.test(entry.name)) walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(full) && !/\.(test|spec|d)\./.test(full) && !/vn-address-data/.test(full)) sources.push(full);
  }
}
walk('src');
// Enum dictionaries are already bilingual; nav-data contains lookup identities.
const excluded = /(?:src\/app\/layouts\/nav-data\.ts|src\/shared\/(?:api|constants|ui\/icons)\/|action-kinds\.tsx|(?:^|\/)[^/]*(?:-labels)\.ts$)/;
const program = ts.createProgram(sources, {target:ts.ScriptTarget.Latest, module:ts.ModuleKind.ESNext, jsx:ts.JsxEmit.ReactJSX, noResolve:true, allowJs:true});
const checker = program.getTypeChecker();
const issues = [], changed = [];
let migrated = 0;
function unwrap(n) {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n))) n = n.expression;
  return n;
}
function bilingualAncestor(node, source) {
  for (let p=node.parent; p && !ts.isSourceFile(p); p=p.parent) {
    if (ts.isCallExpression(p)) {
      const name = p.expression.getText(source);
      if (/\b(?:bilingual|useBilingual|copy|text|bi|localize|localizedText)$/.test(name) && p.arguments.length >= 2) {
        const a=p.arguments[0], b=p.arguments[1];
        if ((ts.isStringLiteralLike(a) && ts.isStringLiteralLike(b)) || /bilingual$/.test(name)) return true;
      }
    }
    if (ts.isConditionalExpression(p) && /\b(?:language|locale|isEn|isEnglish)\b/.test(p.condition.getText(source))) return true;
  }
  return false;
}
function isNonUi(node, source) {
  for (let p=node.parent; p && !ts.isSourceFile(p); p=p.parent) {
    if (ts.isTypeNode(p)) return true;
    if (ts.isCallExpression(p) && /^(?:console\.|assert|invariant)/.test(p.expression.getText(source))) return true;
  }
  const p=node.parent;
  if (ts.isPropertyAssignment(p) && p.name===node) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression===node) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
  if (ts.isJsxAttribute(p) && !/^(?:title|label|placeholder|alt|aria-(?:label|description)|helperText|description|emptyText|noOptionsText|loadingText|caption|tooltip|message|text|subtitle|name)$/.test(p.name.getText(source))) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) return true;
  if (ts.isCallExpression(p) && /\.(?:includes|indexOf|startsWith|endsWith|match|replace|replaceAll|split|test)$/.test(p.expression.getText(source))) return true;
  return bilingualAncestor(node, source);
}
function jsxText(raw) {
  const entities = {amp:'&',nbsp:'\u00a0',lt:'<',gt:'>',quot:'"',apos:"'",ndash:'–',mdash:'—',hellip:'…',copy:'©',times:'×'};
  const decoded = raw.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(all,name)=>name[0]==='#'?String.fromCodePoint(parseInt(name[1].toLowerCase()==='x'?name.slice(2):name.slice(1), name[1].toLowerCase()==='x'?16:10)):(entities[name]??all));
  const lines = decoded.split(/\r\n|\n|\r/);
  let last=0;
  lines.forEach((line,i)=>{if (/[^ \t]/.test(line))last=i;});
  return lines.map((line,i)=>{
    let text=line.replace(/\t/g,' ');
    if(i!==0)text=text.replace(/^ +/,'');
    if(i!==lines.length-1)text=text.replace(/ +$/,'');
    return text && i!==last ? text+' ' : text;
  }).join('');
}
function preserveSpaces(raw, call) {
  const leading=raw.match(/^\s*/)[0], trailing=raw.match(/\s*$/)[0];
  return [leading?JSON.stringify(leading):null,call,trailing?JSON.stringify(trailing):null].filter(Boolean).join(' + ');
}
function variableAbove(n) {
  for(let p=n.parent;p && !ts.isSourceFile(p);p=p.parent) {
    if(ts.isVariableDeclaration(p) && ts.isVariableDeclarationList(p.parent) && ts.isVariableStatement(p.parent.parent) && ts.isSourceFile(p.parent.parent.parent)) {
      const value=unwrap(p.initializer);
      return value && !ts.isArrowFunction(value) && !ts.isFunctionExpression(value) ? p : null;
    }
  }
  return null;
}
function isExported(d,source) {
  return Boolean(d.parent.parent.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)) || source.statements.some(s=>ts.isExportDeclaration(s)&&s.exportClause&&ts.isNamedExports(s.exportClause)&&s.exportClause.elements.some(e=>(e.propertyName??e.name).text===d.name.getText(source)));
}
for (const file of sources) {
  if (excluded.test(file)) continue;
  const source=program.getSourceFile(file);
  if(!source)continue;
  const content=source.text, edits=[], candidates=[], lazy=new Map();
  function add(start,end,text){edits.push({start,end,text});}
  function issue(node,text,kind){issues.push({file,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,kind,text});}
  function visit(n) {
    if(ts.isCallExpression(n) && /\b(?:bilingual|copy|text|bi|localize|localizedText)$/.test(n.expression.getText(source)) && n.arguments.length>=2 && ((ts.isStringLiteralLike(n.arguments[0])&&ts.isStringLiteralLike(n.arguments[1])) || /bilingual$/.test(n.expression.getText(source)))) return;
    let raw,vars;
    if(ts.isTemplateExpression(n)) {
      const parts=[n.head.text,...n.templateSpans.map(s=>s.literal.text)];
      if(parts.some(p=>VI_RE.test(p)) && !isNonUi(n,source)) {
        raw=parts.map((p,i)=>i===0?p:`{value${i-1}}${p}`).join('');
        vars=n.templateSpans.map(s=>s.expression);
      }
    } else if(ts.isJsxText(n)) raw=jsxText(n.text);
    else if(ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) raw=ts.isJsxAttribute(n.parent)?jsxText(n.text):n.text;
    if(raw!==undefined && VI_RE.test(raw) && !isNonUi(n,source)) {
      const key=messageKey(raw);
      if(!key) issue(n,raw,vars?'untranslated-template':'untranslated');
      else {
        const decl=variableAbove(n);
        if(decl && isExported(decl,source)) issue(n,raw,'exported-snapshot');
        else {
          candidates.push({node:n,raw,key,vars});
          if(decl)lazy.set(decl,`get${decl.name.getText(source)}`);
          if(vars) {vars.forEach(expr=>ts.forEachChild(expr,visit));return;}
        }
      }
    }
    ts.forEachChild(n,visit);
  }
  visit(source);
  const moduleDecls=source.statements.filter(ts.isVariableStatement).flatMap(s=>[...s.declarationList.declarations]);
  for(const decl of moduleDecls) {
    const init=unwrap(decl.initializer);
    if(!init || ts.isArrowFunction(init)||ts.isFunctionExpression(init)||isExported(decl,source))continue;
    const text=init.getText(source);
    if(/\b(?:Object\.(?:entries|values)|tStatic)\s*\(/.test(text) && /(?:LABELS|tStatic)/.test(text)) lazy.set(decl,`get${decl.name.getText(source)}`);
  }
  let grew=true;
  while(grew){
    grew=false;
    const symbols=new Set([...lazy.keys()].map(d=>checker.getSymbolAtLocation(d.name)));
    for(const decl of moduleDecls){
      const init=unwrap(decl.initializer);
      if(lazy.has(decl)||!init||ts.isArrowFunction(init)||ts.isFunctionExpression(init)||isExported(decl,source))continue;
      let depends=false;
      const check=(n)=>{if(ts.isIdentifier(n)&&symbols.has(checker.getSymbolAtLocation(n)))depends=true;if(ts.isShorthandPropertyAssignment(n)&&symbols.has(checker.getShorthandAssignmentValueSymbol(n)))depends=true;ts.forEachChild(n,check);};check(init);
      if(depends){lazy.set(decl,`get${decl.name.getText(source)}`);grew=true;}
    }
  }
  const lazySymbols=new Map([...lazy].map(([d,name])=>[checker.getSymbolAtLocation(d.name),{decl:d,name}]));
  function references(n){
    if(ts.isTypeQueryNode(n)&&ts.isIdentifier(n.exprName)){
      const target=lazySymbols.get(checker.getSymbolAtLocation(n.exprName));
      if(target){add(n.getStart(source),n.end,`ReturnType<typeof ${target.name}>`);return;}
    }
    if(ts.isShorthandPropertyAssignment(n)){
      const target=lazySymbols.get(checker.getShorthandAssignmentValueSymbol(n));
      if(target){add(n.getStart(source),n.end,`${n.name.text}: ${target.name}()`);return;}
    }
    if(ts.isIdentifier(n)){
      const target=lazySymbols.get(checker.getSymbolAtLocation(n));
      if(target && n!==target.decl.name && !(ts.isPropertyAssignment(n.parent)&&n.parent.name===n))add(n.getStart(source),n.end,`${target.name}()`);
    }
    ts.forEachChild(n,references);
  }
  references(source);
  for(const [decl,name] of lazy){
    if(!ts.isIdentifier(decl.name)||decl.parent.declarations.length!==1)throw Error(`Unsupported constant declaration in ${file}`);
    const stmt=decl.parent.parent;
    if(content.includes(`function ${name}(`) || new RegExp(`\\bconst ${name}\\b`).test(content))throw Error(`Factory name collision: ${name}`);
    add(stmt.getStart(source),decl.initializer.getStart(source),`function ${name}()${decl.type?`: ${decl.type.getText(source)}`:''} { return `);
    add(decl.initializer.end,stmt.end,'; }');
  }
  const activeTemplates=[];
  for(const item of candidates.sort((a,b)=>(a.node.end-a.node.pos)-(b.node.end-b.node.pos))){
    const {node:n,raw,key,vars}=item;
    let args='';
    if(vars){
      args=', { '+vars.map((expr,i)=>{
        const start=expr.getStart(source),end=expr.end;
        let exprText=content.slice(start,end);
        const nested=edits.filter(e=>e.start>=start&&e.end<=end).sort((a,b)=>b.start-a.start);
        for(const e of nested)exprText=exprText.slice(0,e.start-start)+e.text+exprText.slice(e.end-start);
        return `value${i}: String(${exprText})`;
      }).join(', ')+' }';
      activeTemplates.push({start:n.getStart(source),end:n.end});
    }
    const call=`tUi(${JSON.stringify(key)}${args})`;
    const result=preserveSpaces(raw,call);
    add(ts.isJsxText(n)?n.pos:n.getStart(source),n.end,ts.isJsxText(n)||ts.isJsxAttribute(n.parent)?`{${result}}`:result);
    migrated++;
  }
  const finalEdits=edits.filter(e=>!activeTemplates.some(t=>e.start>=t.start&&e.end<=t.end&&(e.start!==t.start||e.end!==t.end)));
  if(candidates.length) {
    if(/\btUi\b/.test(content))throw Error(`Translation import alias collision in ${file}`);
    const imports=source.statements.filter(ts.isImportDeclaration);
    const after=imports.length?imports.at(-1).end:0;
    finalEdits.push({start:after,end:after,text:'\nimport { tStatic as tUi } from "@/shared/i18n/useT";'});
  }
  if(!finalEdits.length)continue;
  let next=content, lastStart=Infinity;
  for(const e of finalEdits.sort((a,b)=>b.start-a.start||b.end-a.end)){
    if(e.end>lastStart)throw Error(`Overlapping edits in ${file} at ${e.start}`);
    next=next.slice(0,e.start)+e.text+next.slice(e.end);lastStart=e.start;
  }
  const checked=ts.createSourceFile(file,next,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  if(checked.parseDiagnostics.length)throw Error(`Invalid transformed syntax: ${file}: ${checked.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);
  changed.push(file);
  if(APPLY)fs.writeFileSync(file,next);
  console.log(JSON.stringify({file,translated:candidates.length,delayedConstants:[...lazy.values()]}));
}
if(APPLY && Object.keys(addedVi).length){
  for(const [lang,data] of [['vi',addedVi],['en',addedEn]]) {
    const name=`MESSAGES_UPDATED_${lang.toUpperCase()}`;
    const filename=`src/shared/i18n/messages.updated.${lang}.ts`;
    const previous=fs.existsSync(filename)?loadCatalog(filename,name):{};
    const merged=Object.fromEntries(Object.entries({...previous,...data}).sort(([a],[b])=>a.localeCompare(b)));
    fs.writeFileSync(filename,`/** UI copy for the aligned warehouse screens; keys are stable across wording changes. */\nexport const ${name} = ${JSON.stringify(merged,null,2)} as const;\n`);
    const root=`src/shared/i18n/messages${lang==='vi'?'':'.en'}.ts`;
    let text=fs.readFileSync(root,'utf8');
    if(!text.includes(`import { ${name} }`)){
      text=`import { ${name} } from "./messages.updated.${lang}";\n`+text;
      text=text.replace(/(export const MESSAGES_(?:VI|EN)(?:: MessageTree)? = \{)/,`$1\n  updatedUi: ${name},`);
      fs.writeFileSync(root,text);
    }
  }
}
console.log(JSON.stringify({changedFiles:changed.length,translatedOccurrences:migrated,newMessages:Object.keys(addedVi).length,remainingCandidates:issues.length}));
for(const issue of issues) console.log(JSON.stringify(issue));
if(APPLY)fs.writeFileSync('i18n-migration-review.json',JSON.stringify({changed,translatedOccurrences:migrated,newMessages:Object.keys(addedVi).length,issues},null,2));
