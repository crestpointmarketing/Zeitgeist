import 'server-only';
import {RequestError} from './api-access';
export async function bridgeJson(path:string,body?:unknown,timeout=30_000):Promise<unknown>{
 const base=process.env.DSA_BASE_URL,token=process.env.DSA_SERVICE_TOKEN;
 if(!base||!token)throw new RequestError('Research service is not configured.',503);
 const url=new URL(path,base);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new RequestError('Research service requires a secure connection.',503);
 try{const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new RequestError(r.status===429?'Research worker is busy.':'Market evidence is unavailable. The task can be retried.',r.status===429?429:503);return await r.json();}catch(e){if(e instanceof RequestError)throw e;throw new RequestError('Research service timed out or returned incomplete evidence.',503);}
}
