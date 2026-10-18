'use strict';
const vscode=require('vscode');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label) {for(let i=0;i<120;i++){if(await fn())return;await sleep(250);}throw new Error('Timeout: '+label);}
exports.run=async()=>{
  const report=process.env.MPASM_HOST_REPORT;
  const results=[];
  try {
    const ext=vscode.extensions.getExtension('local.mpasm-live');assert(ext);await ext.activate();
    const folder=vscode.workspace.workspaceFolders[0];
    const root=folder.uri.fsPath, uri=vscode.Uri.joinPath(folder.uri,'principal.asm');
    await vscode.workspace.getConfiguration('mpasm',folder.uri).update('mainFile','principal.asm',vscode.ConfigurationTarget.WorkspaceFolder);
    await vscode.workspace.getConfiguration('mpasm',folder.uri).update('delay',300,vscode.ConfigurationTarget.WorkspaceFolder);
    const doc=await vscode.workspace.openTextDocument(uri);await vscode.window.showTextDocument(doc);
    const original=doc.getText();
    assert.equal(doc.languageId,'mpasm');results.push('ASM reconocido como MPASM');
    if(process.env.MPASM_HOST_RESTRICTED==='1') {
      assert.equal(vscode.workspace.isTrusted,false);
      await vscode.commands.executeCommand('mpasm.build');
      await sleep(1500);
      await assert.rejects(fs.access(path.join(root,'build')));
      assert.equal(vscode.languages.getDiagnostics(uri).filter(d=>d.source==='MPASM').length,0);
      results.push('Modo restringido: edición habilitada, ensamblado y revisión deshabilitados');
      await fs.writeFile(report,JSON.stringify({success:true,results},null,2));return;
    }
    const completions=await vscode.commands.executeCommand('vscode.executeCompletionItemProvider',uri,new vscode.Position(6,8));
    assert(completions.items.some(i=>(typeof i.label==='string'?i.label:i.label.label)==='MOVLW'));
    assert(completions.items.some(i=>(typeof i.label==='string'?i.label:i.label.label)==='TRISD'));
    results.push('Autocompletado de instrucciones y registros oficiales');
    const range=new vscode.Range(0,0,doc.lineCount,0);
    const edit=new vscode.WorkspaceEdit();edit.replace(uri,range,original.replace('movlw VALUE','movlw NEVER_DEFINED'));
    await vscode.workspace.applyEdit(edit);
    await until(()=>vscode.languages.getDiagnostics(uri).some(d=>d.severity===vscode.DiagnosticSeverity.Error),'diagnóstico sin guardar');
    assert(doc.isDirty);assert(!(await fs.readFile(uri.fsPath,'utf8')).includes('NEVER_DEFINED'));
    results.push('Error visible sin guardar; archivo original intacto');
    const restore=new vscode.WorkspaceEdit();restore.replace(uri,new vscode.Range(0,0,doc.lineCount,0),original);await vscode.workspace.applyEdit(restore);
    await until(()=>!vscode.languages.getDiagnostics(uri).some(d=>d.severity===vscode.DiagnosticSeverity.Error),'corrección');
    results.push('Diagnóstico desaparece al corregir');
    await vscode.commands.executeCommand('mpasm.build');assert((await fs.readFile(path.join(root,'build','principal.hex'),'ascii')).includes(':00000001FF'));
    results.push('Comando de ensamblado genera HEX');
    const includeUri=vscode.Uri.joinPath(folder.uri,'local.inc'),inc=await vscode.workspace.openTextDocument(includeUri);await vscode.window.showTextDocument(inc);
    const incEdit=new vscode.WorkspaceEdit();incEdit.replace(includeUri,new vscode.Range(0,0,inc.lineCount,0),'VALUE EQU NOT_DEFINED\n');await vscode.workspace.applyEdit(incEdit);
    await until(()=>vscode.languages.getDiagnostics(includeUri).some(d=>d.severity===vscode.DiagnosticSeverity.Error),'error en include');
    results.push('Include sin guardar revisado a través del principal y diagnóstico en su archivo');
    await vscode.commands.executeCommand('mpasm.build');await assert.rejects(fs.access(path.join(root,'build','principal.hex')));
    results.push('Ensamblado fallido retira el HEX anterior');
    await fs.writeFile(report,JSON.stringify({success:true,results},null,2));
  }catch(error){await fs.writeFile(report,JSON.stringify({success:false,results,error:error.stack},null,2));throw error;}
};
