import type {LedgerRecord} from './forward-results';
import {forwardScorecard} from './forward-results';
const modelKey=(r:LedgerRecord)=>`${r.model_id}|${r.model_version}`;
const sampleKey=(r:LedgerRecord)=>`${r.ticker}|${r.as_of}|${r.target_date}|${r.data_hash}`;
const completed=(r:LedgerRecord)=>r.prospective&&r.qualified&&r.predicted_return_pct!==null&&r.checks?.state==='settled'&&!!r.checks.outcome;
/** Intersection across every selected model, with identical evidence and observed outcomes. */
export function pairedComparison(records:LedgerRecord[],selected:string[]){
 const keys=[...new Set(selected)],models=new Map(keys.map(k=>[k,new Map(records.filter(r=>modelKey(r)===k&&completed(r)).map(r=>[sampleKey(r),r]))]));
 if(keys.length<2)return {samples:0,scorecard:[],coverage:[]};
 const common=[...(models.get(keys[0])?.keys()??[])].filter(k=>keys.every(m=>models.get(m)!.has(k)));
 const consistent=common.filter(k=>{const rows=keys.map(m=>models.get(m)!.get(k)!);return rows.every(r=>Math.abs(r.checks!.outcome!.actual_return_pct-rows[0].checks!.outcome!.actual_return_pct)<1e-8);});
 return {samples:consistent.length,scorecard:forwardScorecard(keys.flatMap(m=>consistent.map(k=>models.get(m)!.get(k)!))),coverage:keys.map(m=>{const rows=records.filter(r=>modelKey(r)===m&&r.prospective);return {model:m,recorded:rows.length,published:rows.filter(r=>r.qualified).length,completed:rows.filter(completed).length};})};
}
export type Calibration={state:'ready'|'insufficient'|'withheld';samples:number;nominal_coverage:number;lower_return_pct:number|null;upper_return_pct:number|null;sample_ids:string[]};
/** Use only outcomes already known at recording time, separated by their full horizon.
 * This is an empirical error band, not a coverage guarantee for nonstationary markets. */
export function calibrateInterval(records:LedgerRecord[],current:LedgerRecord):Calibration{
 const base={samples:0,nominal_coverage:80,lower_return_pct:null,upper_return_pct:null,sample_ids:[] as string[]};
 if(!current.prospective||!current.qualified||current.predicted_return_pct===null)return {...base,state:'withheld'};
 const available=records.filter(r=>modelKey(r)===modelKey(current)&&completed(r)&&r.target_date<current.as_of&&r.checks?.checked_at&&r.checks.checked_at<current.recorded_at).sort((a,b)=>a.as_of.localeCompare(b.as_of)||a.ticker.localeCompare(b.ticker));
 const independent:LedgerRecord[]=[];for(const r of available){if(!independent.length||r.as_of>=independent.at(-1)!.target_date)independent.push(r);}
 const samples=independent.slice(-100),ids=samples.map(r=>r.id);
 if(samples.length<30)return {...base,state:'insufficient',samples:samples.length,sample_ids:ids};
 const errors=samples.map(r=>Math.abs(r.predicted_return_pct!-r.checks!.outcome!.actual_return_pct)).sort((a,b)=>a-b);
 const q=errors[Math.ceil((errors.length+1)*.8)-1];
 return {...base,state:'ready',samples:samples.length,sample_ids:ids,lower_return_pct:Math.max(-100,current.predicted_return_pct-q),upper_return_pct:current.predicted_return_pct+q};
}
