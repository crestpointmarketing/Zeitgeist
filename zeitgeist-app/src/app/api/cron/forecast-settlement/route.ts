import { timingSafeEqual } from 'node:crypto';
import { reconcileForecasts } from '@/lib/forward-reconciliation';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,header=request.headers.get('authorization')??'';
 if(!secret||secret.length<32||Buffer.byteLength(header)!==Buffer.byteLength(`Bearer ${secret}`)||!timingSafeEqual(Buffer.from(header),Buffer.from(`Bearer ${secret}`)))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await reconcileForecasts(),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Settlement is temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
