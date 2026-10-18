'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
async function main() {
  const executable=process.argv[2];
  if(!executable)throw new Error('Uso: node scripts/test-host.js "ruta a Code.exe"');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mpasm-host-'));
  const practice=path.join(root,'practice'),profile=path.join(root,'user');
  await fs.mkdir(practice);await fs.mkdir(path.join(profile,'User'),{recursive:true});
  const restricted=process.argv.includes('--restricted');
  await fs.writeFile(path.join(profile,'User','settings.json'),JSON.stringify({'update.mode':'none','extensions.autoUpdate':false,'workbench.startupEditor':'none','security.workspace.trust.startupPrompt':'never'}));
  await fs.writeFile(path.join(practice,'principal.asm'),'        LIST P=18F4550\n        #include <p18f4550.inc>\n        #include "local.inc"\n        ORG 0\nstart\n        nop\n        movlw VALUE\n        movwf 0x20, ACCESS\nloop\n        bra loop\n        END\n');
  await fs.writeFile(path.join(practice,'local.inc'),'VALUE EQU .42\n');
  const report=path.join(root,'report.json');
  const args=['--extensionDevelopmentPath='+path.resolve(__dirname,'..'),'--extensionTestsPath='+path.resolve(__dirname,'../test/host'),'--user-data-dir='+profile,'--extensions-dir='+path.join(root,'extensions'),...(!restricted?['--disable-workspace-trust']:[]),'--skip-welcome','--skip-release-notes',practice];
  const child=spawn(executable,args,{windowsHide:true,env:{...process.env,MPASM_HOST_REPORT:report,MPASM_HOST_RESTRICTED:restricted?'1':''},stdio:'ignore'});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('Timeout del host. Revisa '+root));},120000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);resolve();});});
  const result=JSON.parse(await fs.readFile(report,'utf8').catch(()=>{throw new Error('VS Code no produjo un informe. Revisa '+root);}));
  console.log(JSON.stringify(result,null,2));
  await fs.mkdir(path.resolve(__dirname,'../.test-output'),{recursive:true});
  await fs.writeFile(path.resolve(__dirname,`../.test-output/host-${restricted?'restricted':'trusted'}-results.json`),JSON.stringify(result,null,2));
  if(!result.success)process.exitCode=1;
  await fs.rm(root,{recursive:true,force:true}).catch(()=>{});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
