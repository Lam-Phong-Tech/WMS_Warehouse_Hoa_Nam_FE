/** Report integration checks using intercepted API responses only; never writes to a live service. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const dir=path.resolve('reports-live-controls-tmp');
const port=5199;
const routes=[['/reports/inventory-flow','InventoryFlowReportPage','RPT-01'],['/reports/outbound-flow','OutboundFlowReportPage','RPT-01B'],['/reports/stock-reconcile','StockReconcileReportPage','RPT-02'],['/reports/traceability','TraceabilityReportPage','RPT-03'],['/reports/import-quality','ImportQualityReportPage','RPT-04'],['/reports/packing-label','PackingLabelReportPage','RPT-05'],['/reports/warranty','WarrantyReportPage','RPT-06'],['/reports/recipient','RecipientReportPage','RPT-07'],['/reports/pending-evidence','PendingEvidenceReportPage','RPT-08']];
let server,browser;
try {
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>');
  await fs.writeFile(path.join(dir,'entry.tsx'),`
import {createRoot} from 'react-dom/client';
import {useEffect} from 'react';
import {MemoryRouter,useNavigate,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppThemeProvider} from '/src/shared/ui/theme/AppThemeProvider';
import {useAuthStore} from '/src/shared/store/auth.store';
import {useLanguageStore} from '/src/shared/i18n/language.store';
import {ensureEnglishMessages} from '/src/shared/i18n/english-messages';
import {useThemeStore} from '/src/shared/ui/theme/theme.store';
${routes.map(([,name],i)=>`import Page${i} from '/src/modules/reports/pages/${name}';`).join('\n')}
import '/src/shared/ui/tokens/css-vars.css';
import '/src/shared/ui/tokens/css-vars-dark.css';
import '/src/shared/ui/tokens/operations.css';
import '/src/index.css';
import '/src/styles/hn-wms-page-normalize.css';
import '/src/styles/hn-wms-source-screen.css';
import '/src/shared/ui/operations-ui.css';
import '/src/styles/hn-responsive.css';
useAuthStore.setState({isSuperAdmin:true,isAuthenticated:true,isProfileLoaded:true,permissionCodes:[],currentContext:{warehouse_id:1,warehouse_name:'API warehouse'}});
useThemeStore.getState().setPreference('light');
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,gcTime:0}}});
const pages={${routes.map(([route],i)=>`${JSON.stringify(route)}:Page${i}`).join(',')}};
function Harness(){const loc=useLocation(),navigate=useNavigate();const language=useLanguageStore(s=>s.language);const Page=pages[loc.pathname]||Page8;
useEffect(()=>{window.reportReview={navigate:(url)=>{client.clear();navigate(url)},idle:()=>client.isFetching()===0,language:async(l)=>{await ensureEnglishMessages();useLanguageStore.getState().setLanguage(l)},theme:t=>useThemeStore.getState().setPreference(t)}},[navigate]);
return <div id="fixture" style={{width:'100%',marginInlineStart:'auto',minWidth:0}}><section className="hn-mvp-screen"><div style={{position:'fixed',left:-9999,top:0}} aria-hidden="true"><h1 id="reference-title" className="hn-report-page-title">Reference</h1><button id="reference-primary" style={{background:'var(--ops-primary)',color:'var(--ops-on-primary)'}}>Reference</button><nav className="hn-report-pagination"><button id="reference-page" aria-current="page">1</button></nav></div><Page key={loc.pathname+language}/></section></div>}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AppThemeProvider><MemoryRouter initialEntries={['/reports/pending-evidence?screen=RPT-08']}><Harness/></MemoryRouter></AppThemeProvider></QueryClientProvider>);
`);
  server=await createServer({server:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'});await server.listen();
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[], failures=[],requests=[];let populated=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/')){
      assert.equal(route.request().method(),'GET','No mutation allowed during read-only report audit');
      requests.push(url.pathname);
      const date=new Date().toISOString().slice(0,10),stamp=date+'T05:00:00Z';
      let data=url.pathname.includes('/reports/')?{rows:[],summary:{},totals:{}}:[];
      if(populated&&url.pathname.endsWith('/reports/document-history'))data={rows:Array.from({length:6},(_,i)=>({id:'api-review-'+i,document_no:'API-REVIEW-IN-'+i,doc_type:'INBOUND',status:'POSTED',posted_at:stamp,created_at:stamp,document_date:date,created_by_name:'API Actor',counterpart:'API Supplier',lines:[{product_code:'API-SKU-'+i,product_name:'API Product',posted_qty:i+1}]}))};
      if(populated&&url.pathname.endsWith('/reports/inventory-ledger'))data={rows:Array.from({length:6},(_,i)=>({source_id:'api-review-'+i,movement_no:'API-MOV-'+i,qty_delta:i+1,posted_at:stamp}))};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data,meta:{total:Array.isArray(data)?data.length:data.rows?.length??0,current_page:1,last_page:1,per_page:100,timestamp:stamp}})});
    }
    if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();return route.continue();
  });
  await page.goto('http://127.0.0.1:'+port+'/reports-live-controls-tmp/index.html');
  await page.waitForFunction(()=>Boolean(window.reportReview));
  const settled=async()=>{await page.waitForFunction(()=>window.reportReview.idle(),{},{timeout:30000});await page.waitForTimeout(180);};
  let emptyRoutes=0,geometryCases=0;
  for(const [route,,screen] of routes){
    const start=requests.length;
    await page.evaluate(url=>window.reportReview.navigate(url),route+'?screen='+screen+'&state=default&demo=true');await settled();
    const root=page.locator('[data-testid="wwhn-258-report-screen"]').first();
    await root.locator('h1.hn-report-page-title').waitFor({timeout:30000});
    const text=await root.innerText();
    assert(!/Dữ liệu minh họa|Dữ liệu mẫu|Sample data|Demo data/i.test(text),route+' displayed sample content');
    assert(requests.length>start,route+' did not request an API');
    for(const width of [1920,1366,1024,800]){
      await page.setViewportSize({width,height:1280});
      await page.evaluate(width=>{document.getElementById('fixture').style.width='calc(100% - '+(width>=980?300:0)+'px)'},width);await page.waitForTimeout(60);
      const result=await root.evaluate(root=>{
        const title=root.querySelector('h1.hn-report-page-title'),reference=document.querySelector('#reference-title');
        const a=getComputedStyle(title),b=getComputedStyle(reference);
        const bad=['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color'].filter(k=>a[k]!==b[k]);
        return {bad,overflow:root.scrollWidth>root.clientWidth+3,width:root.clientWidth,scrollWidth:root.scrollWidth};
      });
      if(result.bad.length||result.overflow)failures.push({route,width,...result});geometryCases++;
    }
    emptyRoutes++;
  }
  populated=true;
  await page.evaluate(()=>window.reportReview.navigate('/reports/pending-evidence?screen=RPT-08&state=empty&demo=true'));await settled();
  const root=page.locator('#rpt08-history-report');await root.locator('.rpt08-code-cell').first().waitFor();
  assert((await root.innerText()).includes('API-REVIEW-IN-0'),'API rows must win over a forged preview query');
  for(const language of ['vi','en']){
    await page.evaluate(l=>window.reportReview.language(l),language);await settled();
    for(const theme of ['light','dark']){
      await page.evaluate(t=>window.reportReview.theme(t),theme);
      for(const width of [1920,1366,1024,800,390]){
        await page.setViewportSize({width,height:1280});
        await page.evaluate(w=>{document.getElementById('fixture').style.width='calc(100% - '+(w>=980?300:0)+'px)'},width);await page.waitForTimeout(160);
        const combo=root.locator('.rpt08-select:not(.is-readonly) [role="combobox"]').first();
        const before=await root.locator('.rpt08-filter-card').boundingBox();await combo.click();await page.waitForTimeout(170);
        const after=await root.locator('.rpt08-filter-card').boundingBox();
        assert.equal(before.height,after.height,'Opening the dropdown must not reflow the report');
        assert.equal(before.width,after.width,'Opening the dropdown must not resize the report');
        const styles=await root.evaluate(root=>{
          const apply=getComputedStyle(root.querySelector('.rpt08-apply-button'));
          const ref=getComputedStyle(document.querySelector('#reference-primary'));
          const pager=getComputedStyle(root.querySelector('.rpt08-pagination [aria-current="page"]'));
          const pref=getComputedStyle(document.querySelector('#reference-page'));
          const menu=getComputedStyle(root.querySelector('.rpt08-select.is-open .rpt08-select__menu'));
          const card=getComputedStyle(root.querySelector('.rpt08-filter-card'));
          return {primary:apply.backgroundColor===ref.backgroundColor&&apply.color===ref.color,pager:pager.width===pref.width&&pager.height===pref.height&&pager.backgroundColor===pref.backgroundColor,menu:menu.backgroundColor===card.backgroundColor,opacity:menu.opacity,transition:menu.transitionProperty,overflow:root.scrollWidth>root.clientWidth+3};
        });
        if(!styles.primary||!styles.pager||!styles.menu||styles.overflow||styles.opacity!=='1')failures.push({language,theme,width,styles});
        await page.keyboard.press('Escape');await page.waitForTimeout(160);geometryCases++;
      }
    }
  }
  await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>{document.getElementById('fixture').style.width='calc(100% - 300px)'});
  const initial=await root.locator('.rpt08-code-cell').first().innerText();
  await root.locator('[data-page-direction="next"]').click();assert.equal(await root.locator('[aria-current="page"]').innerText(),'2');
  assert.notEqual(await root.locator('.rpt08-code-cell').first().innerText(),initial);
  await root.locator('[data-page-direction="previous"]').click();
  assert.equal(await root.locator('.rpt08-code-cell').first().innerText(),initial);
  await page.emulateMedia({reducedMotion:'reduce'});
  const combo=root.locator('.rpt08-select:not(.is-readonly) [role="combobox"]').first();await combo.click();
  assert.equal(await root.locator('.rpt08-select.is-open .rpt08-select__menu').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await page.keyboard.press('Escape');
  const result={emptyRoutes,geometryCases,apiRowsOverridePreview:true,pagination:true,dropdownReflow:false,reducedMotion:true,failures,errors:[...new Set(errors)]};
  console.log(JSON.stringify(result,null,2));
  await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/reports-live-controls.json',JSON.stringify(result,null,2));
  assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
} finally { await browser?.close();await server?.close();await fs.rm(dir,{recursive:true,force:true}); }
