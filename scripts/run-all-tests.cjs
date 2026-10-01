'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function collect(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&e.name!=='node_modules'?collect(path.join(dir,e.name)):e.isFile()&&e.name.endsWith('.test.cjs')?[path.join(dir,e.name)]:[])}
const files=[...collect(path.join(root,'tests')),...collect(path.join(root,'server'))].sort();
for(const required of process.argv.slice(2))if(!files.some(f=>f.split(path.sep).includes(required)))throw new Error('Required test suite missing: '+required);
const r=spawnSync(process.execPath,['--test','--test-force-exit',...files],{cwd:root,stdio:'inherit'});
if(r.error)throw r.error;process.exit(r.status??1);
