'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const picas=require('../src/picas');
const exe=picas.discover(process.env.PICAS_TEST_EXE || '');
test('PIC-AS reconoce diagnósticos XC8 de archivo y de proyecto',()=>{
  const issues=picas.parse('C:\\Mi practica\\main.s:12:3: error: (800) undefined symbol\n::: warning: (1311) configuration missing\nmain.s:4:: advisory: (1) note','main.s');
  assert.equal(issues.length,3);assert.equal(issues[0].line,11);assert.equal(issues[0].column,2);assert.equal(issues[0].kind,'Error');assert.equal(issues[1].file,'main.s');assert.equal(issues[1].kind,'Warning');
});
test('PIC-AS no permite redirigir salidas ni introducir fuentes con opciones adicionales',()=>{
  assert.deepEqual(picas.validateArgs(['-Wl,-presetVec=0h']),['-Wl,-presetVec=0h']);
  for(const arg of ['-oC:/outside','-mcpu=other','@options','other.s','-c','-E'])assert.throws(()=>picas.validateArgs([arg]));
});
test('PIC-AS real: revisión sin guardar, enlace HEX y retirada del HEX tras error',{skip:!exe || !picas.devicePack('18F4550')},async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'picas prueba á-'));
  try {
    const entry=path.join(root,'prueba.S'),source=await fs.readFile(path.join(__dirname,'../examples/picas.s'),'utf8');
    await fs.writeFile(entry,source);const run=opts=>picas.assemble({executable:exe,root,entry,extraArgs:['-Wl,-presetVec=0h'],...opts});
    const good=await run({build:true});assert(good.success);assert(good.hex);assert.match(await fs.readFile(good.hex,'ascii'),/:00000001FF/);
    const bad=await run({overlays:new Map([[entry,source.replace('movlw 42','movlw MISSING_SYMBOL')]])});assert(!bad.success);assert(bad.issues.some(i=>i.kind==='Error' && i.file.toLowerCase()===entry.toLowerCase()));assert.equal(await fs.readFile(entry,'utf8'),source);
    assert((await run({})).success);
    const failure=await run({build:true,overlays:new Map([[entry,source.replace('movlw 42','bad_opcode 42')]])});assert(!failure.success);await assert.rejects(fs.access(good.hex));
    await assert.rejects(picas.assemble({executable:exe,root,entry,build:true,outputDirectory:'../escape'}),/subcarpeta/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
