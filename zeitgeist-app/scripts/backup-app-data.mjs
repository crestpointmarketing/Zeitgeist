// Windows-local encrypted application-data backup. Auth credentials and Vault are excluded.
// Run from zeitgeist-app: node scripts/backup-app-data.mjs
// Restore with scripts/restore-app-data-drill.mjs and an exported schema snapshot.
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
nextEnv.loadEnvConfig(process.cwd());
if(process.platform!=='win32')throw Error('This backup encrypts its key with Windows DPAPI. Use a managed secret store on other platforms.');
const tables=['conversations','messages','watchlist_items','research_jobs','forecast_records','forecast_checks','forecast_intervals'];
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const backup={version:1,created_at:new Date().toISOString(),tables:{}};
for(const table of tables){
 const keys=table==='watchlist_items'?['user_id','ticker']:table==='forecast_checks'||table==='forecast_intervals'?['record_id']:['id'];
 const rows=[];
 for(let offset=0;;offset+=500){
  let query=client.from(table).select('*');
  for(const key of keys)query=query.order(key,{ascending:true});
  const {data,error}=await query.range(offset,offset+499);
  if(error)throw Error('Backup read failed: '+table);
  rows.push(...data);if(data.length<500)break;
 }
 backup.tables[table]=rows;
}
const path='reports/backups/'+backup.created_at.replace(/[:.]/g,'-');mkdirSync('reports/backups',{recursive:true});
const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),plain=Buffer.from(JSON.stringify(backup));
const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
const protectedKey=spawnSync(process.env.ZEITGEIST_PWSH||'pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$value=[Console]::In.ReadToEnd(); ConvertFrom-SecureString (ConvertTo-SecureString $value -AsPlainText -Force)"],{input:key.toString('base64'),encoding:'utf8',windowsHide:true});
if(protectedKey.status!==0)throw Error('DPAPI key protection failed');
writeFileSync(path+'.key',protectedKey.stdout.trim(),{mode:0o600});
writeFileSync(path+'.enc',JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}),{mode:0o600});
// Recover from the saved artifacts, not the original in-memory plaintext.
const recoveredKey=spawnSync(process.env.ZEITGEIST_PWSH||'pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$secret=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $cred=New-Object System.Net.NetworkCredential('', $secret); [Console]::Out.Write($cred.Password)"],{input:readFileSync(path+'.key','utf8'),encoding:'utf8',windowsHide:true});
if(recoveredKey.status!==0)throw Error('DPAPI recovery failed');
const stored=JSON.parse(readFileSync(path+'.enc','utf8')),decipher=createDecipheriv('aes-256-gcm',Buffer.from(recoveredKey.stdout,'base64'),Buffer.from(stored.iv,'base64'));decipher.setAuthTag(Buffer.from(stored.tag,'base64'));
const restored=Buffer.concat([decipher.update(Buffer.from(stored.data,'base64')),decipher.final()]);
if(!restored.equals(plain))throw Error('Encrypted round trip failed');
const summary={path,bytes:plain.length,sha256:createHash('sha256').update(restored).digest('hex'),counts:Object.fromEntries(tables.map(t=>[t,backup.tables[t].length])),scope:'Application rows only; no auth accounts, Vault, schema deployment, or point-in-time snapshot guarantee.'};
writeFileSync('reports/workspace-backup.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
