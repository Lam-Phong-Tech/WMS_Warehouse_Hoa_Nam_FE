import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
const prefix='src/modules/reports/';
const jobs=[
 ['inventory-flow/InboundFlowReport.tsx','81fb4d25d76154c3728f3735216a24bb2f7eea4c','inbound-warehouse-card'],
 ['inventory-flow/OutboundFlowReport.tsx','ce55d7bddd3bcb273f202ed43df0aa2862000257','outbound-warehouse-card'],
 ['stock-reconcile/StockReconcileReport.tsx','4a243ee15d8999f94dd1c3c60ece05cc28e838de','rpt02-warehouse'],
 ['movement-trace/MovementTraceReport.tsx','3703724fda7ffad6066db329023d5a8607c4caed','trace-warehouse-card'],
 ['recipient-agency/RecipientAgencyReport.tsx','55f6a77c241b313f509a58a1ffd207b7e7fdf4cc','rpt07-warehouse-card'],
 ['io-history/IoHistoryReport.tsx','6e07f981f1ada24ba12718650d9ab7a64b8970fc','io-warehouse-info'],
 ['io-history/rpt08/controls.tsx','c3233c921c381642296e6e55688f6e6ffa88c583','rpt08-warehouse-menu'],
 ['import-match/ImportQualityBaseline.tsx','fb57f79588922c44e7acdee66a238de1ea9dffb8',null],
 ['packing-label/PackingLabelPrintReport.tsx','f096d8dc3ca6476abab40c29154f9ad2b657afd9',null],
 ['warranty-components/WarrantyComponentsReport.tsx','094593cda6a486c3cd3cdbd314e0e9b8d6ba8e15',null],
];
function assert(value,message){if(!value)throw new Error(message)}
function attr(node,name){return node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText()===name)}
function hasClass(node,name){const p=attr(node,'className');return p&&ts.isStringLiteral(p.initializer)&&p.initializer.text.split(/\s+/).includes(name)}
for(const [file,sha,cardClass] of jobs){
 const p=prefix+file,bytes=fs.readFileSync(p);
 assert(crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')===sha,'Concurrent change: '+file);
 let source=bytes.toString();const tree=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[];
 const visit=node=>{if(ts.isJsxElement(node))nodes.push(node);ts.forEachChild(node,visit)};visit(tree);
 let holder;const edits=[];
 if(cardClass){
  const candidates=nodes.filter(node=>hasClass(node,cardClass));assert(candidates.length===1,'Expected one card: '+file);
  const card=candidates[0];holder=card.parent;assert(ts.isJsxElement(holder),'Expected actions parent: '+file);
  edits.push([card.getStart(tree),card.end,'<ReportWarehouseCard />']);
 }else{
  if(file.startsWith('packing-label/'))holder=nodes.find(node=>hasClass(node,'hn-pkg-label__header-actions'));
  else{
   const buttons=nodes.filter(node=>node.openingElement.tagName.getText(tree)==='UiButton'&&attr(node,'onClick')?.getText(tree).includes('exportXlsx'));
   assert(buttons.length===1,'Expected unique export toolbar: '+file);holder=buttons[0].parent;
  }
  assert(holder&&ts.isJsxElement(holder),'Missing toolbar: '+file);
  edits.push([holder.closingElement.getStart(tree),holder.closingElement.getStart(tree),'\n<ReportWarehouseCard />\n']);
 }
 const cls=attr(holder,'className');
 if(cls){assert(ts.isStringLiteral(cls.initializer),'Dynamic toolbar class: '+file);edits.push([cls.getStart(tree),cls.end,'className="'+cls.initializer.text+' hn-report-warehouse-actions"']);}
 else edits.push([holder.openingElement.tagName.end,holder.openingElement.tagName.end,' className="hn-report-warehouse-actions"']);
 for(const [a,b,value] of edits.sort((x,y)=>y[0]-x[0]))source=source.slice(0,a)+value+source.slice(b);
 if(file==='io-history/rpt08/controls.tsx'){
  const old='export function HeaderActions({\n  warehouse,\n';assert(source.includes(old),'Header signature changed');
  source=source.replace(old,'export function HeaderActions({\n');
 }
 // Remove only now-unused icon imports caused by replacing the old card markup.
 for(const name of ['DownOutlined','StockOutlined','RightOutlined','HomeOutlined']){
  if((source.match(new RegExp('\\b'+name+'\\b','g'))||[]).length===1){
   source=source.replace(new RegExp('^  '+name+',\\r?\\n','m'),'');
  }
 }
 source='import { ReportWarehouseCard } from "@/modules/reports/components/ReportWarehouseCard";\n'+source;
 fs.writeFileSync(p,source);console.log('Unified warehouse card:',p);
}
