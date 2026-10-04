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
      if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name + '.ts'), mocks);
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', mocks);
      return dependency(name);
    },
  });
  return exports;
}

const forward=load('src/lib/forward-results.ts');
const dates=['2026-09-25','2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02'];
function realized(){return {ticker:'AAPL',origin:dates[0],target:dates[5],source:'DSA / Yahoo Finance (adjusted)',retrieved_at:'2026-10-02T21:00:00Z',bars:dates.map((d,i)=>({o:50+i,h:51+i,l:49+i,c:50+i,v:1000,t:Date.parse(d+'T20:00:00Z')}))};}
const origin={ticker:'AAPL',as_of:dates[0],target_date:dates[5],target_close:'2026-10-02T20:00:00Z',last_close:100};
const now=Date.parse('2026-10-02T21:01:00Z');
test('realized returns use one adjustment basis after a split, without rewriting the saved forecast',()=>{
 const result=forward.validateSettlement(realized(),origin,now);
 assert.ok(Math.abs(result.actual_return_pct-10)<1e-10);assert.equal(result.adjustment_ratio,.5);assert.equal(origin.last_close,100);
});
test('settlement rejects early, missing, wrong-date, wrong-symbol and stale evidence',()=>{
 assert.throws(()=>forward.validateSettlement(realized(),origin,Date.parse('2026-10-02T20:19:00Z')));
 for(const change of [d=>d.bars.pop(),d=>d.target='2026-10-01',d=>d.ticker='MSFT',d=>d.bars[5].t-=86400000,d=>d.bars[2].c=0,d=>d.retrieved_at='2026-10-01T21:00:00Z']){const d=realized();change(d);assert.throws(()=>forward.validateSettlement(d,origin,now));}
});
function record(overrides={}){return {model_id:'lstm',model_version:'v1',prospective:true,qualified:true,predicted_return_pct:2,drift_return_pct:3,checks:{state:'settled',outcome:{actual_return_pct:4}},...overrides};}
test('forward scores exclude late, withheld, pending and flat direction denominators',()=>{
 const s=forward.forwardScorecard([record(),record({prospective:false,predicted_return_pct:999}),record({qualified:false,predicted_return_pct:null}),record({checks:{state:'pending',outcome:null}}),record({predicted_return_pct:0,checks:{state:'settled',outcome:{actual_return_pct:0}}})])[0];
 assert.equal(s.settled,2);assert.equal(s.mae,1);assert.equal(s.flat_mae,2);assert.equal(s.drift_mae,2);assert.equal(s.direction_samples,1);assert.equal(s.direction_hit_pct,100);assert.equal(s.withheld,1);assert.equal(s.pending,1);assert.equal(s.late,1);
 const empty=forward.forwardScorecard([record({checks:{state:'pending'}})])[0];assert.equal(empty.mae,null);
 assert.equal(forward.forwardScorecard([record(),record({model_version:'v2'})]).length,2);
});
test('frozen evidence checks the actual model inputs and trailing drift baseline',()=>{
 const api=load('src/lib/forward-evidence.ts');
 const bars=Array.from({length:400},(_,i)=>({o:100,h:101,l:99,c:100,v:0,t:Date.parse('2026-10-02T20:00:00Z')-(399-i)*86400000}));
 const e={bars,next_open:'2026-10-05T13:30:00Z',target_close:'2026-10-09T20:00:00Z',target_date:'2026-10-09',drift_return_pct:0};
 const r={as_of:'2026-10-02',history_bars:400,last_close:100,target_date:'2026-10-09'};
 assert.equal(api.parseForwardEvidence(e,r).bars.length,400);
 assert.throws(()=>api.parseForwardEvidence({...e,drift_return_pct:1},r));assert.throws(()=>api.parseForwardEvidence(e,{...r,last_close:101}));
 assert.equal(api.parseForwardEvidence(undefined,r),undefined);
});
test('cron fails closed and never runs from a spoofed user agent or missing secret',async()=>{
 let calls=0;const common={'@/lib/forward-reconciliation':{reconcileForecasts:async()=>{calls++;return {state:'complete'};}}};
 const route=load('src/app/api/cron/forecast-settlement/route.ts',{...common,__env:{CRON_SECRET:'x'.repeat(32)}});
 for(const headers of [{},{'user-agent':'vercel-cron/1.0'},{authorization:'Bearer wrong'}])assert.equal((await route.GET(new Request('https://example/api/cron',{headers}))).status,401);
 assert.equal(calls,0);assert.equal((await route.GET(new Request('https://example/api/cron',{headers:{authorization:'Bearer '+'x'.repeat(32)}}))).status,200);assert.equal(calls,1);
 const missing=load('src/app/api/cron/forecast-settlement/route.ts',common);assert.equal((await missing.GET(new Request('https://example'))).status,401);
});
test('recording uses first-write insert semantics and stores only server-validated evidence',async()=>{
 const writes=[];const admin={from:()=>({upsert:async(row,options)=>{writes.push({row,options});return {};},select(){return this;},eq(){return this;},single:async()=>({data:{id:'saved-id'}})})};
 const api=load('src/lib/forecast-recording.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>admin}});
 const r={kind:'prediction',model:'lstm',version:'v1',ticker:'AAPL',as_of:'2026-10-02',generated_at:'2026-10-04T10:00:00Z',last_close:100,data_hash:'abc',prediction:{forecast:{return_pct:2}}};
 const e={target_date:'2026-10-09',next_open:'2026-10-05T13:30:00Z',target_close:'2026-10-09T20:00:00Z',drift_return_pct:1,bars:[{c:100}]};
 assert.equal((await api.recordForecast('owner',r,e)).state,'saved');assert.equal(writes[0].options.ignoreDuplicates,true);assert.equal(writes[0].row.user_id,'owner');assert.equal(writes[0].row.input_payload.sha256.length,64);assert.ok(!('recorded_at' in writes[0].row));
 assert.equal((await api.recordForecast('owner',r)).state,'unavailable');assert.equal((await api.recordForecast('owner',{...r,kind:'risk'},e)).state,'not_applicable');
});
test('storage failure is explicitly reported while preserving the experiment',async()=>{
 const api=load('src/lib/forecast-recording.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>{throw Error('secret storage detail');}}});
 assert.equal((await api.recordForecast('owner',{kind:'prediction'},{bars:[]})).state,'unavailable');
});
test('cron avoids concurrent reconciliation workers',async()=>{
 const api=load('src/lib/forward-reconciliation.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:null}),from:()=>{throw Error('must not query');}})}});
 assert.equal((await api.reconcileForecasts()).state,'busy');
});

function reconciliationMock(rows,{readError=null,writeError=null}={}){
 const writes=[],finishes=[];
 return {writes,finishes,admin:{rpc:async(name,args)=>{if(name==='claim_forecast_reconciliation')return {data:'lease-token'};finishes.push(args);return {};},from:()=>({
  select(){return this;},eq(){return this;},lte(){return this;},order(){return this;},limit:async()=>({data:rows,error:readError}),
  update(value){this.value=value;return this;},then(resolve){writes.push(this.value);return Promise.resolve({data:writeError?null:[{record_id:'id'}],error:writeError}).then(resolve);}
 })}};
}
const due=(ticker='AAPL')=>({record_id:ticker,attempts:0,record:{...origin,ticker,prospective:true}});
test('reconciliation groups symbols, caps provider calls and defers missing evidence',async()=>{
 const mock=reconciliationMock([due(),due(),due('MSFT'),due('NVDA')]);let calls=0;
 const api=load('src/lib/forward-reconciliation.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>mock.admin},__env:{DSA_BASE_URL:'https://bridge.example',DSA_SERVICE_TOKEN:'secret'},__fetch:async()=>{calls++;return new Response('{}',{status:502});}});
 const result=await api.reconcileForecasts();assert.equal(calls,2);assert.equal(result.checked,3);assert.equal(result.deferred,3);assert.equal(result.settled,0);
 assert.equal(mock.finishes[0].p_lease,'lease-token');assert.ok(mock.writes.every(w=>!('state' in w)&&!('outcome' in w)&&w.attempts===1&&Date.parse(w.next_check_at)>Date.now()));
});
test('reconciliation stores verified outcomes and records read failures honestly',async()=>{
 const mock=reconciliationMock([due()]);const payload={...realized(),retrieved_at:new Date().toISOString()};
 const api=load('src/lib/forward-reconciliation.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>mock.admin},__env:{DSA_BASE_URL:'https://bridge.example',DSA_SERVICE_TOKEN:'secret'},__fetch:async()=>Response.json(payload)});
 assert.equal((await api.reconcileForecasts()).settled,1);assert.equal(mock.writes[0].state,'settled');assert.ok(Math.abs(mock.writes[0].outcome.actual_return_pct-10)<1e-10);
 const failed=reconciliationMock([],{readError:Error('db unavailable')});const broken=load('src/lib/forward-reconciliation.ts',{'server-only':{},'./supabase/admin':{createAdminClient:()=>failed.admin}});
 await assert.rejects(()=>broken.reconcileForecasts());assert.equal(failed.finishes[0].p_summary.state,'failed');
});
test('records route scopes the database read to the signed-in owner and caps exported history',async()=>{
 const filters=[];const query={select(columns){assert.ok(!columns.includes('input_payload'));assert.ok(!columns.includes('report_payload'));return this;},eq:(...args)=>{filters.push(args);return query;},gte:(...args)=>{filters.push(args);return query;},order(){return this;},limit(n){assert.equal(n,500);return this;},then:fn=>Promise.resolve({data:[],count:510}).then(fn)};
 const api=load('src/app/api/forecasts/records/route.ts',{'@/lib/api-access':{requireAccount:async()=>({supabase:{from:()=>query},user:{id:'owner'}}),RequestError:Error,requestErrorResponse:()=>Response.json({success:false},{status:400})}});
 const response=await api.GET(new Request('https://example/api/forecasts/records?ticker=aapl&user_id=someone-else'));
 assert.equal(response.status,200);assert.ok(filters.some(([key,value])=>key==='user_id'&&value==='owner'));assert.ok(filters.some(([key,value])=>key==='ticker'&&value==='AAPL'));assert.equal((await response.json()).data.truncated,true);
});

