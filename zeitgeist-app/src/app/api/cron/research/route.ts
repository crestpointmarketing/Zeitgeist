import {timingSafeEqual} from 'node:crypto';
import {runResearchQueue,scheduleDailyResearch} from '@/lib/research-queue';
import {requestErrorResponse} from '@/lib/api-access';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,expected=Buffer.from(`Bearer ${secret??''}`),actual=Buffer.from(request.headers.get('authorization')??'');
 if(!secret||secret.length<32||actual.length!==expected.length||!timingSafeEqual(actual,expected))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(new URL(request.url).searchParams.get('schedule')==='daily'?await scheduleDailyResearch():await runResearchQueue(),{headers:{'Cache-Control':'no-store'}});}catch(e){return requestErrorResponse(e);}
}
