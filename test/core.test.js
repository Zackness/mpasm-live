'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const core=require('../src/core');
const executable=core.discover(process.env.MPASM_TEST_EXE || '');
const source=`        LIST P=18F4550
        #include <p18f4550.inc>
        #include "local.inc"
        ORG 0
start
        movlw VALUE
        movwf 0x20, ACCESS
loop
        bra loop
        END
`;
async function fixture(fn) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'MPASM prueba con espacios á-'));
  try {await fs.writeFile(path.join(root,'otra prueba.asm'),source);await fs.writeFile(path.join(root,'local.inc'),'VALUE EQU .42\n');await fn(root,path.join(root,'otra prueba.asm'));}
  finally {await fs.rm(root,{recursive:true,force:true});}
}
test('diagnósticos con espacios, mayúsculas y números de línea',()=>{
  const [issue]=core.parse('Error[113] C:\\Mi carpeta\\PRUEBA.ASM 6 : Symbol not previously defined (VALUE)');
  assert.equal(issue.line,5);assert.equal(issue.code,'113');assert.equal(issue.file,'C:\\Mi carpeta\\PRUEBA.ASM');
  assert.equal(core.parse('banner').length,0);
});
test('dispositivo de LIST prevalece; comentarios no seleccionan el PIC',()=>{
  assert.equal(core.processor('; LIST P=16F84A\n LIST R=DEC, P=18F4550'),'18F4550');
  assert.equal(core.processor(' processor pic16f877a'),'16f877a');
  assert.throws(()=>core.processor('', '18F4550 /x'));
});
test('límites de carpetas y configuración de salida',async()=>{
  assert(!core.within('C:/practica','C:/practica2/a.asm'));
  await fixture(async(root,entry)=>{
    await assert.rejects(core.assemble({executable,root,entry,outputDirectory:'../escape'}),/subcarpeta/);
    await assert.rejects(core.assemble({executable,root,entry,outputDirectory:'.'}),/subcarpeta/);
  });
});
test('snapshot copia includes y buffers sin modificar originales',async()=>{
  await fixture(async(root,entry)=>{
    const temp=await core.snapshot(root,new Map([[entry,'nuevo contenido']]));
    try {assert.equal(await fs.readFile(path.join(temp,path.basename(entry)),'utf8'),'nuevo contenido');assert.equal(await fs.readFile(entry,'utf8'),source);assert.equal(await fs.readFile(path.join(temp,'local.inc'),'utf8'),'VALUE EQU .42\n');}
    finally {await fs.rm(temp,{recursive:true,force:true});}
  });
});
test('MPASM real: HEX, buffers sin guardar, includes y HEX antiguo',{skip:!executable},async()=>{
  await fixture(async(root,entry)=>{
    const run=options=>core.assemble({executable,root,entry,...options});
    const good=await run({build:true});
    assert(good.success);assert(good.hex);assert.match(await fs.readFile(good.hex,'ascii'),/:00000001FF/);
    const bad=await run({overlays:new Map([[entry,source.replace('movlw VALUE','movlw UNKNOWN_SYMBOL')]])});
    assert(!bad.success);assert(bad.issues.some(i=>i.code==='113' && i.line===5 && i.file.toLowerCase()===entry.toLowerCase()));
    assert.equal(await fs.readFile(entry,'utf8'),source);
    const fixed=await run({});assert(fixed.success);
    const included=await run({overlays:new Map([[path.join(root,'local.inc'),'VALUE EQU MISSING_NAME\n']])});
    assert(!included.success);assert(included.issues.some(i=>path.basename(i.file).toLowerCase()==='local.inc'));
    const failedBuild=await run({build:true,overlays:new Map([[entry,source.replace('movlw VALUE','movlw UNKNOWN_SYMBOL')]])});
    assert(!failedBuild.success);await assert.rejects(fs.access(good.hex));
    assert.deepEqual((await fs.readdir(root)).sort(),['build','local.inc','otra prueba.asm']);
  });
});
test('MPASM real: errores de lanzamiento se propagan',{skip:!executable},async()=>{
  await fixture(async(root,entry)=>{await assert.rejects(core.assemble({executable:path.join(root,'missing.exe'),root,entry}),/No se pudo ejecutar/);});
});
test('salida mediante enlace externo no elimina archivos ajenos',async()=>{
  await fixture(async(root,entry)=>{
    const outside=await fs.mkdtemp(path.join(os.tmpdir(),'mpasm-outside-'));
    try {
      await fs.writeFile(path.join(outside,'otra prueba.hex'),'PRESERVAR');
      await fs.symlink(outside,path.join(root,'external'),process.platform==='win32'?'junction':'dir');
      await assert.rejects(core.assemble({executable,root,entry,build:true,outputDirectory:'external'}),/fuera del proyecto/);
      assert.equal(await fs.readFile(path.join(outside,'otra prueba.hex'),'utf8'),'PRESERVAR');
    }finally{await fs.rm(path.join(root,'external'),{force:true,recursive:true});await fs.rm(outside,{recursive:true,force:true});}
  });
});
