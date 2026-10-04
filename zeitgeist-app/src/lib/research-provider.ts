import 'server-only';
import { RequestError } from './api-access';
import { parseResearch } from './research-schema';
import type { ResearchModel } from './research-catalog';
export async function getResearch(ticker:string,model:ResearchModel){
  const base=process.env.DSA_BASE_URL, token=process.env.DSA_SERVICE_TOKEN;
  if(!base||!token) throw new RequestError('The research service is not configured.',503);
  const url=new URL(`/v1/research/${encodeURIComponent(ticker)}`,base);url.searchParams.set('model',model);
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new RequestError('The research service requires a secure connection.',503);
  try{
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(48_000)});
    if(response.status===429) throw new RequestError('Another experiment is running. Please retry shortly.',429);
    if(response.status===504) throw new RequestError('This model exceeded its time limit. Try a lighter model or retry later.',504);
    if(!response.ok) throw new RequestError('Research unavailable. A supported USD US-listed security needs at least 400 complete sessions.',503);
    return parseResearch(await response.json(),ticker,model);
  }catch(error){if(error instanceof RequestError)throw error;throw new RequestError('The research result was incomplete or unavailable. Please retry.',503);}
}
