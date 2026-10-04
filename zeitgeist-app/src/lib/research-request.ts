import type { ResearchModel } from './research-catalog';
export async function requestResearch(ticker:string,model:ResearchModel,signal:AbortSignal,request=fetch){
  const deadline=AbortSignal.timeout(55_000);
  try{
    const response=await request('/api/model-research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker,model}),signal:AbortSignal.any([signal,deadline])});
    let body;try{body=await response.json();}catch{throw Error('The research service returned an unreadable response. Please retry.');}
    if(!response.ok||!body?.success)throw Error(typeof body?.error?.message==='string'?body.error.message:response.status===401?'Sign in to run research.':'Research unavailable. Please retry later.');
    if(signal.aborted)throw signal.reason;
    try{const {parseResearch}=await import('./research-schema');return parseResearch(body.data,ticker,model);}catch{throw Error('The result is incomplete, outdated or does not match this model. Please run again.');}
  }catch(error){if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(deadline.aborted)throw Error('The model exceeded 55 seconds. Your previous result is kept. Try a lighter model.');throw error;}
}
