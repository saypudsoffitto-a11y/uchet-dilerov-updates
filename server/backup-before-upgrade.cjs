'use strict';
const release=require('./package.json').version;
async function backup(client,version=release){
 await client.execute('CREATE TABLE IF NOT EXISTS uchet_upgrade_backups (release TEXT PRIMARY KEY, revision INTEGER NOT NULL, store_json TEXT NOT NULL, backed_at TEXT NOT NULL)');
 await client.execute({sql:'INSERT INTO uchet_upgrade_backups (release, revision, store_json, backed_at) SELECT ?, revision, store_json, ? FROM uchet_store WHERE id = 1 ON CONFLICT(release) DO NOTHING',args:[version,new Date().toISOString()]});
 const rs=await client.execute({sql:'SELECT revision, store_json FROM uchet_upgrade_backups WHERE release = ?',args:[version]});
 const row=rs.rows?.[0];if(!row)throw new Error('Резервная копия общей базы не создана');
 const data=JSON.parse(String(row.store_json));if(!data.state||Number(data.revision)!==Number(row.revision))throw new Error('Резервная копия общей базы не прошла проверку');
 return {release:version,revision:Number(row.revision),verified:true};
}
async function main(){
 const url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN;
 if(Boolean(url)!==Boolean(authToken))throw new Error('Неполная конфигурация Turso');
 if(!url){console.log('File storage: production Turso upgrade backup is not applicable');return}
 const {createClient}=require('@tursodatabase/serverless/compat');const result=await backup(createClient({url,authToken}));
 console.log('Verified database backup before upgrade:',JSON.stringify(result));
}
if(require.main===module)main().catch(()=>{console.error('Не удалось проверить резервную копию общей базы. Запуск новой версии остановлен.');process.exitCode=1});
module.exports={backup};
