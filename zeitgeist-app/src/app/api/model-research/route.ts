import { requireAccount, readJson, reserveUsage, RequestError, requestErrorResponse } from '@/lib/api-access';
import { validateStockTicker } from '@/lib/stock-utils';
import { isResearchModel } from '@/lib/research-catalog';
import { getResearch } from '@/lib/research-provider';
export const maxDuration=60;
export async function POST(request:Request){
  let release:(()=>Promise<void>)|undefined;
  try{
    const {supabase}=await requireAccount();
    const body=await readJson(request,1024);
    if(!body||typeof body!=='object'||!('ticker' in body)||typeof body.ticker!=='string'||!('model' in body)||!isResearchModel(body.model)) throw new RequestError('Choose a supported research model and stock.',400);
    const ticker=validateStockTicker(body.ticker);
    if(!ticker.isValid)throw new RequestError('Provide a valid US stock ticker.',400);
    release=await reserveUsage(supabase,'stock');
    const data=await getResearch(ticker.formattedTicker,body.model);
    return Response.json({success:true,data},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return requestErrorResponse(error);}finally{await release?.();}
}
