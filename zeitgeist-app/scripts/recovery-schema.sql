-- Read-only schema export for scripts/restore-app-data-drill.mjs.
-- Save the JSON cell as reports/backups/schema-workspace.json (private local artifact).
select jsonb_object_agg(t.table_name,jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) order by a.attnum)
 from pg_attribute a where a.attrelid=('public.'||t.table_name)::regclass and a.attnum>0 and not a.attisdropped),
 'constraints',(select coalesce(jsonb_agg(pg_get_constraintdef(c.oid)),'[]'::jsonb) from pg_constraint c
 where c.conrelid=('public.'||t.table_name)::regclass and c.contype in ('p','u','c')))) as schema_backup
from information_schema.tables t where t.table_schema='public' and t.table_name in
 ('conversations','messages','watchlist_items','research_jobs','forecast_records','forecast_checks','forecast_intervals');
