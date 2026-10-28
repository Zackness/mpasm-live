'use strict';
const fs=require('node:fs/promises');
const sync=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const core=require('./core');
const versions=dir=>{try{return sync.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));}catch{return [];}};
function discover(configured='',platform=process.platform) {
  if(platform!=='win32')return;
  const candidates=configured?[configured]:[];
  if(!configured) {
    for(const drive of ['C:','D:','E:'])for(const pf of ['Program Files','Program Files (x86)']) {
      const root=path.join(drive+'\\',pf,'Microchip','xc8');
      for(const version of versions(root))candidates.push(path.join(root,version,'pic-as','bin','pic-as.exe'),path.join(root,version,'bin','pic-as.exe'));
    }
    for(const dir of (process.env.PATH || '').split(path.delimiter))if(dir)candidates.push(path.join(dir,'pic-as.exe'));
  }
  return candidates.find(file=>/^pic-as\.exe$/i.test(path.basename(file)) && sync.existsSync(file));
}
function devicePack(device,configured='') {
  if(configured)return sync.existsSync(path.join(configured,'pic','include','proc',`pic${device.toLowerCase()}.inc`))?configured:undefined;
  const roots=[path.join(os.homedir(),'.mchp_packs','Microchip'),path.join(os.homedir(),'.mchp-packs','Microchip')];
  for(const root of roots)for(const family of versions(root))for(const version of versions(path.join(root,family))) {
    const pack=path.join(root,family,version,'xc8');
    if(sync.existsSync(path.join(pack,'pic','include','proc',`pic${device.toLowerCase()}.inc`)))return pack;
  }
}
function parse(text,defaultFile) {
  return text.split(/\r?\n/).flatMap(line=>{
    const m=line.match(/^(.*?):(\d*):(?:(\d*):)?\s*(fatal error|error|warning|advisory|note):\s*(?:\((\d+)\)\s*)?(.*)$/i);
    if(!m)return [];
    return [{kind:/error/i.test(m[4])?'Error':/warning/i.test(m[4])?'Warning':'Message',code:m[5] || 'PIC-AS',file:m[1] || defaultFile,line:Math.max(0,Number(m[2] || 1)-1),column:Math.max(0,Number(m[3] || 1)-1),message:m[6]}];
  });
}
function validateArgs(args) {
  if(!Array.isArray(args) || args.some(a=>typeof a!=='string' || !/^-/.test(a) || /^(-o|-E$|-S$|-c$|--output|--outdir|-x|-mcpu|-mdfp)/i.test(a) || /[\r\n\0]/.test(a)))throw new Error('Argumentos PIC-AS inválidos. No se permiten cambios de salida, dispositivo, lenguaje o modo de compilación.');
  return args;
}
async function assemble({executable,root,entry,overlays=new Map(),fallback='18F4550',outputDirectory='build',build=false,packPath='',extraArgs=[],sources=[]}) {
  root=path.resolve(root);entry=path.resolve(entry);
  if(!core.within(root,entry) || !/\.(s|asm)$/i.test(entry))throw new Error('El principal PIC-AS debe ser .s, .S o .asm dentro de la carpeta.');
  const destination=path.resolve(root,outputDirectory),target=path.join(destination,path.relative(root,entry).replace(/\.(s|asm)$/i,''));
  if(!outputDirectory || destination===root || !core.within(root,destination))throw new Error('La salida debe ser una subcarpeta del proyecto.');
  const device=core.processor(overlays.get(entry) ?? await fs.readFile(entry,'utf8'),fallback),pack=devicePack(device,packPath);
  if(packPath && !pack)throw new Error('El DFP seleccionado no contiene el dispositivo '+device+'. Selecciona su carpeta xc8.');
  validateArgs(extraArgs);
  const additional=sources.map(file=>path.resolve(root,file));
  if(additional.some(file=>!core.within(root,file) || !/\.(s|asm)$/i.test(file)))throw new Error('Las fuentes adicionales deben ser .s/.S/.asm dentro de la carpeta.');
  if(build) {
    let ancestor=path.dirname(target);
    for(;;){try{if(!core.within(await fs.realpath(root),await fs.realpath(ancestor)))throw new Error('La salida apunta fuera del proyecto.');break;}catch(e){if(e.code!=='ENOENT')throw e;ancestor=path.dirname(ancestor);}}
    await fs.mkdir(path.dirname(target),{recursive:true});
    for(const ext of ['.hex','.elf','.build.json'])await fs.rm(target+ext,{force:true});
  }
  const temp=await core.snapshot(root,overlays,outputDirectory);
  try {
    const inputs=[entry,...additional.filter(file=>file!==entry)].map(file=>path.join(temp,path.relative(root,file)));
    const out=path.join(temp,build?'picas-output.hex':'picas-check.o');
    const args=[`-mcpu=${device}`,...(pack?[`-mdfp=${pack}`]:[]),'-xassembler-with-cpp',...(!build?['-c']:[]),...extraArgs,'-I'+path.dirname(inputs[0]),'-I'+temp,'-o',out,...(build?inputs:[inputs[0]])];
    const result=await new Promise((resolve,reject)=>execFile(executable,args,{cwd:temp,windowsHide:true,timeout:30000,maxBuffer:4*1024*1024},(error,stdout,stderr)=>{if(error && (typeof error.code==='string'||error.killed))return reject(new Error('No se pudo ejecutar PIC-AS: '+error.message));resolve({code:error?.code || 0,raw:stdout+'\n'+stderr});}));
    const issues=parse(result.raw,inputs[0]).map(i=>{const file=path.resolve(temp,i.file);return {...i,source:'PIC-AS',file:core.within(temp,file)?path.join(root,path.relative(temp,file)):file};});
    const success=result.code===0 && !issues.some(i=>i.kind==='Error');let hex;
    if(build) {
      await fs.writeFile(target+'.log',result.raw,'utf8');
      if(success){for(const ext of ['.hex','.elf','.map','.sym'])try{await fs.copyFile(out.replace(/\.hex$/,ext),target+ext);if(ext==='.hex')hex=target+ext;}catch(e){if(e.code!=='ENOENT')throw e;}
        if(hex)await fs.writeFile(target+'.build.json',JSON.stringify({entry,processor:device,toolchain:'picas',createdAt:new Date().toISOString(),hex},null,2));}
    }
    if(!success && !issues.length)throw new Error(result.raw || 'PIC-AS terminó sin diagnósticos.');
    return {success,issues,hex,processor:device,raw:result.raw,entry};
  }finally{await fs.rm(temp,{recursive:true,force:true});}
}
module.exports={discover,devicePack,parse,assemble,validateArgs};
