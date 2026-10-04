import 'server-only';
import {createAdminClient} from './supabase/admin';
import {RequestError, type requireAccount} from './api-access';
/** Service-only adapter: still uses the existing global/account limiter and current account metadata. */
export function backgroundAccount(userId:string):Awaited<ReturnType<typeof requireAccount>>{
 const admin=createAdminClient();
 const supabase={auth:{getUser:()=>admin.auth.admin.getUserById(userId)},rpc:(name:string,args:Record<string,unknown>)=>{
  if(name==='reserve_api_usage')return admin.rpc('reserve_background_usage',{p_user:userId,p_feature:args.feature});
  if(name==='release_api_usage')return admin.rpc('release_background_usage',{p_user:userId,p_lease:args.lease_id});
  throw new RequestError('Unsupported background account action.',500);
 }};
 return {supabase,user:{id:userId}} as unknown as Awaited<ReturnType<typeof requireAccount>>;
}
