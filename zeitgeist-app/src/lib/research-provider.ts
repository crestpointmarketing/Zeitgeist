import 'server-only';
import { RequestError } from './api-access';
import { parseResearch } from './research-schema';
import type { ResearchModel } from './research-catalog';
import { parseForwardEvidence } from './forward-evidence';
export async function getResearch(ticker:string,model:ResearchModel){
  const base=process.env.DSA_BASE_URL, token=process.env.DSA_SERVICE_TOKEN;
  if(!base||!token) throw new RequestError('The research service is not configured.',503);
  const url=new URL(`/v1/research/${encodeURIComponent(ticker)}`,base);url.searchParams.set('model',model);
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new RequestError('The research service requires a secure connection.',503);
  try{
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(48_000)});
    if(response.status===429) throw new RequestError('Another experiment is running. Please retry shortly.',429);
    if(response.status===504) throw new RequestError('This model exceeded its time limit. Try a lighter model or retry later.',504);
    if(response.status===401 || response.status===403) throw new RequestError('The research service could not authenticate. The site administrator needs to check its connection settings.',503);
    if(response.status===400 || response.status===422) throw new RequestError('The research service rejected this stock or model request. Try another supported model or contact the site administrator.',503);
    if(!response.ok) throw new RequestError('Research could not be completed for this stock. Data may be unavailable or the experiment service may have failed. Please retry.',503);
    const raw=await response.json(),report=parseResearch(raw,ticker,model);
    return {...report,forward_evidence:report.kind==='prediction'?parseForwardEvidence(raw.forward_evidence,report):undefined};
  }catch(error){if(error instanceof RequestError)throw error;throw new RequestError('The research result was incomplete or unavailable. Please retry.',503);}
}
