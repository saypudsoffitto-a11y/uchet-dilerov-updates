'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const version=require('../app/package.json').version,repo=process.env.GITHUB_REPOSITORY;
if(!repo)throw new Error('Repository required');
const dir=path.resolve('release-assets'),url=n=>`https://github.com/${repo}/releases/download/${version}/${n}`;
function asset(name){const data=fs.readFileSync(path.join(dir,name));if(data.length<1000000)throw new Error('Invalid release asset: '+name);return {url:url(name),sha256:createHash('sha256').update(data).digest('hex')}}
const win=asset(`Uchet-dilerov-Setup-${version}-x64.exe`),mac=asset(`Uchet-dilerov-macOS-${version}-arm64.dmg`),zip=asset(`Uchet-dilerov-macOS-${version}-arm64.zip`);asset(`Uchet-dilerov-Portable-${version}-x64.exe`);
const notes=fs.readFileSync('RELEASE_NOTES.md','utf8').split('# Учёт дилеров 8.9.78')[0].trim();
fs.writeFileSync(path.join(dir,'latest.json'),JSON.stringify({version,...win,notes},null,2)+'\n');fs.writeFileSync(path.join(dir,'latest-macos.json'),JSON.stringify({version,platform:'darwin',arch:'arm64',...mac,zipUrl:zip.url,zipSha256:zip.sha256,notes},null,2)+'\n');
