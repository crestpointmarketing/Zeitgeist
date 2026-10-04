// Restore an encrypted app-data snapshot into isolated local PostgreSQL. Never connects to production.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,writeFileSync} from 'node:fs';
import {createDecipheriv} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const summary=JSON.parse(readFileSync(process.argv[2]||'reports/workspace-backup.json','utf8'));
const recovery=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$secret=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $cred=New-Object System.Net.NetworkCredential('', $secret); [Console]::Out.Write($cred.Password)"],{input:readFileSync(summary.path+'.key','utf8'),encoding:'utf8',windowsHide:true});
if(recovery.status!==0)throw Error('Recovery key unavailable');
const encrypted=JSON.parse(readFileSync(summary.path+'.enc','utf8')),d=createDecipheriv('aes-256-gcm',Buffer.from(recovery.stdout,'base64'),Buffer.from(encrypted.iv,'base64'));d.setAuthTag(Buffer.from(encrypted.tag,'base64'));
const backup=JSON.parse(Buffer.concat([d.update(Buffer.from(encrypted.data,'base64')),d.final()]));
const schema=JSON.parse(readFileSync('reports/backups/schema-workspace.json','utf8')),db=new PGlite();
await db.waitReady;
const rows=[];
for(const [table,meta] of Object.entries(schema)){
 if(!/^[a-z_]+$/.test(table))throw Error('Invalid table name');
 const fields=meta.columns.map(c=>`"${c.name}" ${c.type}${c.not_null?' not null':''}`);
 await db.exec(`create table ${table} (${[...fields,...meta.constraints].join(',')});`);
 const payload=JSON.stringify(backup.tables[table]);
 await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1::jsonb)`,[payload]);
 let canonical='value';for(const c of meta.columns.filter(c=>c.type==='timestamp with time zone'))canonical=`jsonb_set(${canonical},'{${c.name}}',coalesce(to_jsonb((value->>'${c.name}')::timestamptz),'null'::jsonb))`;
 const check=await db.query(`select count(*)::int as count, not exists(select to_jsonb(t) from ${table} t except select ${canonical} from jsonb_array_elements($1::jsonb)) as equal from ${table}`,[payload]);
 if(!check.rows[0].equal||check.rows[0].count!==backup.tables[table].length){const diff=await db.query(`select distinct e.key from ${table} t cross join lateral jsonb_each(to_jsonb(t)) e cross join jsonb_array_elements($1::jsonb) s where s->>'id'=to_jsonb(t)->>'id' and e.value is distinct from s->e.key`,[payload]);console.log({table,fields:diff.rows});throw Error('Restored content differs: '+table);}
 rows.push({table,count:check.rows[0].count,exact:true});
}
for(const [child,column,parent,parentColumn] of [['messages','conversation_id','conversations','id'],['forecast_checks','record_id','forecast_records','id'],['forecast_intervals','record_id','forecast_records','id'],['conversations','research_context_job','research_jobs','id']])await db.exec(`alter table ${child} add foreign key (${column}) references ${parent}(${parentColumn})`);
await db.close();
const result={at:new Date().toISOString(),database:'Isolated local PostgreSQL (PGlite)',tables:rows,application_foreign_keys:true,source_sha256:summary.sha256,limitations:['Does not restore Supabase Auth accounts, Vault, RLS policies or hosting.','Data export is not a transaction-consistent PITR backup.']};
writeFileSync('reports/workspace-restore.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
