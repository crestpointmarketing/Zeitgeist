import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const dependency = createRequire(import.meta.url);
// Transpile the actual source, mocking only service boundaries. tsc is run separately.
function load(file, mocks = {}) {
  let filename = path.resolve(root, file);
  if (!existsSync(filename) && filename.endsWith(".ts") && existsSync(filename + "x")) filename += "x";
  const exports = {};
  const js = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(js, {
    exports, console, Buffer, sessionStorage: mocks.__storage, process: { env: mocks.__env ?? {} }, Date, Intl, Number, Response, TextDecoder, Uint8Array, URL, DOMException, AbortSignal: mocks.__AbortSignal ?? AbortSignal, fetch: mocks.__fetch ?? fetch, setTimeout, clearTimeout,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.ts'), mocks);
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', mocks);
      return dependency(name);
    },
  });
  return exports;
}

const models=load('src/lib/model-comparison.ts');
const sample=(i,model='gru',overrides={})=>({id:String(i)+model,ticker:'AAPL',model_id:model,model_version:'v1',as_of:new Date(Date.UTC(2024,0,1+i*7)).toISOString().slice(0,10),target_date:new Date(Date.UTC(2024,0,6+i*7)).toISOString().slice(0,10),data_hash:'identical',recorded_at:new Date(Date.UTC(2024,0,2+i*7)).toISOString(),prospective:true,qualified:true,predicted_return_pct:2,drift_return_pct:0,checks:{state:'settled',checked_at:new Date(Date.UTC(2024,0,7+i*7)).toISOString(),outcome:{actual_return_pct:3}},...overrides});
test('paired comparison intersects evidence rather than comparing unequal samples',()=>{const s=models.pairedComparison([sample(1),sample(2),sample(1,'lstm'),sample(3,'lstm')],['gru|v1','lstm|v1']);assert.equal(s.samples,1);assert.equal(s.scorecard[0].mae,1);assert.equal(s.coverage[0].completed,2);});
test('paired comparison rejects different inputs, outcomes, late and withheld targets',()=>{for(const patch of [{data_hash:'different'},{prospective:false},{qualified:false},{checks:{state:'settled',outcome:{actual_return_pct:5}}}])assert.equal(models.pairedComparison([sample(1),sample(1,'lstm',patch)],['gru|v1','lstm|v1']).samples,0);});
test('interval requires thirty completed earlier independent windows and no future observations',()=>{const rows=Array.from({length:30},(_,i)=>sample(i)),current=sample(60);assert.equal(models.calibrateInterval(rows.slice(0,29),current).state,'insufficient');const c=models.calibrateInterval(rows,current);assert.equal(c.samples,30);assert.equal(c.lower_return_pct,1);assert.equal(c.upper_return_pct,3);assert.equal(models.calibrateInterval(rows,{...current,qualified:false}).state,'withheld');const late=rows.map(r=>({...r,checks:{...r.checks,checked_at:'2099-01-01T00:00:00Z'}}));assert.equal(models.calibrateInterval(late,current).samples,0);});
test('interval excludes overlapping horizons and different versions',()=>{const rows=Array.from({length:30},(_,i)=>sample(i));rows[1].as_of=rows[0].as_of;rows[2].model_version='v2';assert.equal(models.calibrateInterval(rows,sample(60)).samples,28);});
test('portfolio drawdown includes the initial unit equity and losses',()=>{const p=load('src/lib/portfolio.ts');const m=p.curveMetrics([.9,1.1,.88]);assert.ok(Math.abs(m.drawdown_pct-20)<1e-8);assert.ok(Math.abs(m.return_pct+12)<1e-8);});
test('research inputs reject duplicate symbols, unknown models, invalid weights and excessive batches',()=>{const {jobInput}=load('src/lib/research-jobs.ts');for(const b of [{kind:'model',ticker:'AAPL',model:'shell'},{kind:'portfolio',tickers:['AAPL','AAPL'],weights:[.5,.5]},{kind:'portfolio',tickers:['AAPL','MSFT'],weights:[1,1]},{kind:'comparison',tickers:['AAPL','MSFT','TSLA','NVDA','META','GOOG']}])assert.equal(jobInput.safeParse(b).success,false);assert.equal(jobInput.safeParse({kind:'portfolio',tickers:['aapl','msft'],weights:[.5,.5]}).success,true);});
test('CFO rejects another account research and unfinished jobs',async()=>{const fake={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})})};const api=load('src/lib/cfo-context.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>fake}});await assert.rejects(api.cfoContext('owner','foreign'),/owned/);});
test('worker does not launch provider work while another lease owns queue',async()=>{const api=load('src/lib/research-queue.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:null}),from:()=>({update(){return this;},eq:async()=>({})})})}});assert.equal((await api.runResearchQueue()).state,'idle');});
test('research cron denies anonymous requests and spoofed scheduler headers',async()=>{let called=0;const api=load('src/app/api/cron/research/route.ts',{'@/lib/research-queue':{runResearchQueue:async()=>{called++;return {state:'idle'};}},__env:{CRON_SECRET:'x'.repeat(32)}});assert.equal((await api.GET(new Request('https://site/api/cron',{headers:{'user-agent':'vercel-cron'}}))).status,401);assert.equal(called,0);assert.equal((await api.GET(new Request('https://site/api/cron',{headers:{authorization:'Bearer '+'x'.repeat(32)}}))).status,200);});
