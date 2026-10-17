'use strict';
// Install synchronously after main registers its handlers, before ready/loadFile.
// Keep the real sync IPC and server protocol; only host imports/watchers are off.
module.exports=function isolateNativeFixtures(){
 const {app,ipcMain}=require('electron');
 if(app.isReady())throw Error('Fixture isolation must be installed before app ready');
 for(const channel of ['stock:loadBundledProducts','clients:loadBundledNewMatRos','newmatros:setWatch','newmatros:chooseIni','newmatros:rereadIni','stock:chooseCsv']){
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel,()=>({ok:false,canceled:true,error:'Disabled in isolated fixture QA'}));
 }
};
