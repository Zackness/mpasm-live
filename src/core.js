'use strict';
const fs = require('node:fs/promises');
const sync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFile} = require('node:child_process');

function parse(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const m = line.match(/^(Error|Warning|Message)\[(\d+)\]\s+(.+?)\s+(\d+)\s*:\s*(.*)$/i);
    return m ? [{kind:m[1][0].toUpperCase()+m[1].slice(1).toLowerCase(),code:m[2],file:m[3],line:Math.max(0,+m[4]-1),message:m[5]}] : [];
  });
}
function within(root, file) {
  const rel = path.relative(path.resolve(root),path.resolve(file));
  return rel === '' || (!rel.startsWith('..'+path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
function processor(text, fallback='18F4550') {
  const code = text.replace(/;[^\r\n]*/g,'');
  const match = code.match(/\bLIST\b[^\r\n]*?\bP\s*=\s*(?:PIC)?([0-9A-Za-z]+)/i) || code.match(/\bPROCESSOR\s+(?:PIC)?([0-9A-Za-z]+)/i);
  const value = (match?.[1] || fallback).replace(/^PIC/i,'');
  if (!/^[0-9A-Za-z]+$/.test(value)) throw new Error('Modelo de PIC inválido.');
  return value;
}
function discover(configured='', platform=process.platform) {
  if (platform !== 'win32') return undefined;
  const candidates = configured ? [configured] : [];
  if (!configured) {
    for (const drive of ['C:','D:','E:']) for (const pf of ['Program Files (x86)','Program Files']) {
      candidates.push(path.join(drive+'\\',pf,'Microchip','MPASM Suite','MPASMWIN.exe'));
      for (const v of ['v5.35','v5.30','v5.25','v5.20','v5.15','v5.10','v5.05','v5.00']) candidates.push(path.join(drive+'\\',pf,'Microchip','MPLABX',v,'mpasmx','mpasmx.exe'));
    }
    for (const dir of (process.env.PATH || '').split(path.delimiter)) if (dir) {
      candidates.push(path.join(dir,'MPASMWIN.exe'),path.join(dir,'mpasmx.exe'));
    }
  }
  return candidates.find(file => /^(mpasmwin|mpasmx)\.exe$/i.test(path.basename(file)) && sync.existsSync(file));
}
async function snapshot(root, overlays, excluded='build') {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(),'mpasm-live-'));
  let count=0;
  async function copy(dir) {
    for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
      if (entry.isSymbolicLink()) continue;
      const source=path.join(dir,entry.name), rel=path.relative(root,source);
      if (++count > 10000) throw new Error('Carpeta demasiado grande. Abre solo la carpeta de la práctica.');
      if (entry.isDirectory()) {
        if (['.git','.vscode','node_modules','build','dist'].includes(entry.name) || within(path.join(root,excluded),source)) continue;
        await copy(source);
      } else if (/\.(asm|s|inc|h)$/i.test(entry.name)) {
        const target=path.join(temp,rel); await fs.mkdir(path.dirname(target),{recursive:true});
        await fs.copyFile(source,target);
      }
    }
  }
  try {
    await copy(root);
    for (const [file,text] of overlays) if (within(root,file) && /\.(asm|s|inc|h)$/i.test(file)) {
      const target=path.join(temp,path.relative(root,file));
      await fs.mkdir(path.dirname(target),{recursive:true});
      await fs.writeFile(target,text,'utf8');
    }
    return temp;
  } catch(error) {await fs.rm(temp,{recursive:true,force:true});throw error;}
}
async function assemble({executable,root,entry,overlays=new Map(),fallback='18F4550',outputDirectory='build',build=false}) {
  root=path.resolve(root); entry=path.resolve(entry);
  if (!within(root,entry) || !/\.asm$/i.test(entry)) throw new Error('El principal debe ser un .asm dentro de la carpeta.');
  const destination=path.resolve(root,outputDirectory);
  if (!outputDirectory || destination===root || !within(root,destination)) throw new Error('La salida debe ser una subcarpeta del proyecto, por ejemplo build.');
  const text=overlays.get(entry) ?? await fs.readFile(entry,'utf8');
  const device=processor(text,fallback);
  const target=path.join(destination,path.relative(root,entry).replace(/\.asm$/i,''));
  if(build) {
    // Resolve existing ancestors before creating or removing output files.
    let ancestor=path.dirname(target);
    for(;;) {
      try {
        const real=await fs.realpath(ancestor),realRoot=await fs.realpath(root);
        if(!within(realRoot,real))throw new Error('La carpeta de salida apunta fuera del proyecto.');
        break;
      }catch(error) {
        if(error.code!=='ENOENT')throw error;
        const parent=path.dirname(ancestor);if(parent===ancestor)throw error;ancestor=parent;
      }
    }
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.rm(target+'.hex',{force:true});
    await fs.rm(target+'.build.json',{force:true});
  }
  const temp=await snapshot(root,overlays,outputDirectory);
  const input=path.join(temp,path.relative(root,entry)), stem=input.replace(/\.asm$/i,'');
  try {
    const execution=await new Promise((resolve,reject)=>{
      execFile(executable,['/q','/p'+device,path.basename(input)],{cwd:path.dirname(input),windowsHide:true,timeout:20000,maxBuffer:2*1024*1024},(error,stdout,stderr)=>{
        if(error && (typeof error.code==='string' || error.killed)) return reject(new Error(`No se pudo ejecutar MPASM: ${error.message}`));
        resolve({code:error?.code || 0,stdout,stderr});
      });
    });
    const raw=await fs.readFile(stem+'.err','latin1').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
    const issues=parse(raw).map(issue=>{
      const file=path.resolve(path.dirname(input),issue.file);
      return {...issue,file:within(temp,file)?path.join(root,path.relative(temp,file)):file};
    });
    const success=execution.code===0 && !issues.some(i=>i.kind==='Error');
    let hex;
    if(build) {
      await fs.writeFile(target+'.err',raw,'utf8');
      if(success) {
        for(const ext of ['.hex','.lst','.cod','.o']) {
          try {await fs.copyFile(stem+ext,target+ext);if(ext==='.hex')hex=target+ext;} catch(e) {if(e.code!=='ENOENT')throw e;}
        }
        if(hex) await fs.writeFile(target+'.build.json',JSON.stringify({entry,processor:device,createdAt:new Date().toISOString(),hex},null,2));
      }
    }
    if(!success && !issues.length) throw new Error(execution.stderr || execution.stdout || 'MPASM terminó sin diagnósticos. Revisa la instalación.');
    return {success,issues,hex,processor:device,raw,entry};
  } finally {await fs.rm(temp,{recursive:true,force:true});}
}
module.exports={parse,within,processor,discover,snapshot,assemble};
