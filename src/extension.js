'use strict';
const vscode=require('vscode');
const path=require('node:path');
const fs=require('node:fs/promises');
const core=require('./core');
const ARCHIVE='https://www.microchip.com/en-us/tools-resources/archives/mplab-ecosystem';
const TEMPLATE=`        LIST P=18F4550
        #include <p18f4550.inc>

; Base de ensamblado: configura CONFIG, oscilador y pines para tu placa.
        ORG 0x0000
        goto inicio

inicio
        nop
bucle
        bra bucle
        END
`;
exports.activate=function(context) {
  const diagnostics=vscode.languages.createDiagnosticCollection('MPASM');
  const output=vscode.window.createOutputChannel('MPASM Live');
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,20);
  status.command='mpasm.configure'; status.text='$(circuit-board) MPASM';
  const timers=new Map(), revisions=new Map(), reports=new Map(), builds=new Map();
  let queue=Promise.resolve(), disposed=false, missingShown=false;
  const key=file=>path.resolve(file).toLowerCase();
  const config=uri=>vscode.workspace.getConfiguration('mpasm',uri);
  function visibleStatus(text,tooltip) {status.text='$(circuit-board) '+text;status.tooltip=tooltip || text;status.show();}
  function permitted() {
    if(process.platform!=='win32') {vscode.window.showWarningMessage('MPASM clásico requiere Windows. En WSL abre la carpeta en una ventana local de Windows.');return false;}
    if(!vscode.workspace.isTrusted) {vscode.window.showWarningMessage('Confía en esta carpeta para ejecutar MPASM.');return false;}
    return true;
  }
  async function configure() {
    if(!permitted())return;
    const found=core.discover(config().get('executable'));
    const choices=[...(found?[{label:'Usar MPASM detectado',description:found,id:'auto'}]:[]),{label:'Seleccionar MPASMWIN.exe o mpasmx.exe',id:'browse'},{label:'Obtener instalador oficial de Microchip',id:'download'}];
    const choice=await vscode.window.showQuickPick(choices,{title:'Configurar MPASM Live',placeHolder:'MPASM no se incluye dentro de esta extensión.'});
    let selected;
    if(choice?.id==='auto')selected=found;
    if(choice?.id==='browse') {
      const files=await vscode.window.showOpenDialog({canSelectMany:false,filters:{'Ensamblador MPASM':['exe']},title:'Selecciona MPASMWIN.exe o mpasmx.exe'});
      if(files)selected=core.discover(files[0].fsPath);
      if(files && !selected)throw new Error('Selecciona MPASMWIN.exe o mpasmx.exe.');
    }
    if(choice?.id==='download') {
      await vscode.env.openExternal(vscode.Uri.parse(ARCHIVE));
      const action=await vscode.window.showInformationMessage('Descarga un instalador que incluya MPASM, acepta su licencia e instálalo. MPLAB X 5.40 y posteriores no incluyen MPASM. Después vuelve aquí.','Volver a detectar');
      if(action)await configure(); return;
    }
    if(selected) {
      await vscode.workspace.getConfiguration('mpasm').update('executable',selected,vscode.ConfigurationTarget.Global);
      visibleStatus('MPASM listo',selected);missingShown=false;
      vscode.window.showInformationMessage('MPASM configurado. Abre un .asm o crea una práctica.');
      vscode.workspace.textDocuments.forEach(schedule);
    }
  }
  function target(doc) {
    if(!doc || doc.uri.scheme!=='file')throw new Error('Abre y guarda un archivo .asm dentro de una carpeta.');
    const folder=vscode.workspace.getWorkspaceFolder(doc.uri);
    const root=folder?.uri.fsPath || path.dirname(doc.uri.fsPath);
    const principal=config(doc.uri).get('mainFile');
    const entry=principal?path.resolve(root,principal):doc.uri.fsPath;
    if(!core.within(root,entry) || !/\.asm$/i.test(entry))throw new Error('Selecciona un archivo principal .asm dentro de la carpeta.');
    return {root,entry,uri:vscode.Uri.file(entry)};
  }
  function renderReports() {
    diagnostics.clear();
    const grouped=new Map();
    for(const issues of reports.values()) for(const issue of issues) {
      const file=key(issue.file);
      if(!grouped.has(file))grouped.set(file,{uri:vscode.Uri.file(issue.file),items:[],seen:new Set()});
      const group=grouped.get(file),id=`${issue.line}:${issue.code}:${issue.message}`;
      if(group.seen.has(id))continue;group.seen.add(id);
      const doc=vscode.workspace.textDocuments.find(d=>key(d.uri.fsPath || '')===file);
      const line=doc?Math.min(issue.line,Math.max(0,doc.lineCount-1)):issue.line;
      const range=doc?doc.lineAt(line).range:new vscode.Range(line,0,line,1);
      const severity=issue.kind==='Error'?vscode.DiagnosticSeverity.Error:issue.kind==='Warning'?vscode.DiagnosticSeverity.Warning:vscode.DiagnosticSeverity.Information;
      const item=new vscode.Diagnostic(range,issue.message,severity);item.source='MPASM';item.code=issue.code;
      group.items.push(item);
    }
    for(const group of grouped.values())diagnostics.set(group.uri,group.items);
  }
  function request(doc,build=false) {
    if(!vscode.workspace.isTrusted || process.platform!=='win32')return Promise.resolve();
    let selected;
    try {selected=target(doc);}catch(error){if(build)vscode.window.showWarningMessage(error.message);return Promise.resolve();}
    const {root,entry,uri}=selected,id=key(entry),revision=(revisions.get(id)||0)+1;
    revisions.set(id,revision);
    const overlays=new Map(vscode.workspace.textDocuments.filter(d=>d.uri.scheme==='file' && core.within(root,d.uri.fsPath) && /\.(asm|inc)$/i.test(d.fileName)).map(d=>[path.resolve(d.uri.fsPath),d.getText()]));
    const versions=vscode.workspace.textDocuments.filter(d=>d.uri.scheme==='file' && core.within(root,d.uri.fsPath)).map(d=>[d,d.version]);
    queue=queue.then(async()=>{
      if(disposed || (!build && revisions.get(id)!==revision))return;
      const executable=core.discover(config(uri).get('executable'));
      if(!executable) {
        visibleStatus('MPASM sin configurar','Pulsa para localizar el ensamblador.');
        if(build || !missingShown) {
          missingShown=true;
          const action=await vscode.window.showInformationMessage('MPASM Live necesita el ensamblador de Microchip.','Configurar');
          if(action)await configure();
        } return;
      }
      visibleStatus(build?'Ensamblando…':'Revisando…',entry);
      if(build)builds.delete(id);
      const result=await core.assemble({executable,root,entry,overlays,fallback:config(uri).get('processor'),outputDirectory:config(uri).get('outputDirectory'),build});
      const current=versions.every(([d,v])=>!d.isClosed && d.version===v) && revisions.get(id)===revision;
      if(!disposed && current) {reports.set(id,result.issues);renderReports();}
      if(build) {
        output.clear();output.appendLine(`Principal: ${entry}\nDispositivo: ${result.processor}\nEnsamblador: ${executable}`);
        for(const issue of result.issues)output.appendLine(`${issue.file}:${issue.line+1}: ${issue.kind}[${issue.code}] ${issue.message}`);
        output.show(true);
        if(!result.success) {
          visibleStatus('Error al ensamblar','HEX anterior retirado de la carpeta de salida.');
          vscode.window.showErrorMessage('No se generó un HEX válido. Abre Problemas (Ctrl+Shift+M).');
        } else if(result.hex) {
          builds.set(id,{hex:result.hex,stale:!current});
          visibleStatus(current?'HEX actualizado':'HEX anterior a los cambios',result.hex);
          output.appendLine('HEX: '+result.hex);
          vscode.window.showInformationMessage(current?'HEX generado. Ya puedes cargarlo en Proteus o tu programador.':'HEX generado, pero el código cambió durante el ensamblado. Vuelve a ensamblar.');
        } else {visibleStatus('Falta enlazado');vscode.window.showWarningMessage('El módulo se ensambló sin HEX. Los proyectos reubicables necesitan enlazado; esta versión admite programas absolutos.');}
      } else if(!disposed && current) {
        const n=result.issues.filter(i=>i.kind==='Error').length;
        visibleStatus(n?`${n} error(es)`:'Código revisado',entry+' — ensambla para actualizar el HEX.');
      }
    }).catch(error=>{output.appendLine(error.stack || error.message);visibleStatus('MPASM: revisar salida',error.message);if(build)vscode.window.showErrorMessage(error.message);});
    return queue;
  }
  function schedule(doc) {
    if(disposed || doc.uri.scheme!=='file' || !/\.(asm|inc)$/i.test(doc.fileName))return;
    let selected;try{selected=target(doc);}catch{return;}
    const id=key(selected.entry);
    revisions.set(id,(revisions.get(id)||0)+1);
    for(const record of builds.values())record.stale=true;
    visibleStatus('Código cambiado','Ensambla para actualizar el HEX.');
    clearTimeout(timers.get(id));
    if(!config(doc.uri).get('liveChecking') || !vscode.workspace.isTrusted || process.platform!=='win32')return;
    timers.set(id,setTimeout(()=>{timers.delete(id);request(doc);},config(doc.uri).get('delay')));
  }
  async function build() {
    if(!permitted())return;
    const doc=vscode.window.activeTextEditor?.document;
    let selected;try{selected=target(doc);}catch(error){vscode.window.showWarningMessage(error.message);return;}
    // Save only source documents belonging to this practice.
    for(const d of vscode.workspace.textDocuments)if(d.uri.scheme==='file' && d.isDirty && core.within(selected.root,d.uri.fsPath) && /\.(asm|inc)$/i.test(d.fileName))if(!await d.save())return;
    clearTimeout(timers.get(key(selected.entry)));
    await request(doc,true);
  }
  async function selectMain(useActive=false) {
    const doc=vscode.window.activeTextEditor?.document;
    let folder=doc?vscode.workspace.getWorkspaceFolder(doc.uri):vscode.workspace.workspaceFolders?.[0];
    if(!folder)throw new Error('Abre la carpeta de tu práctica primero.');
    let uri=useActive?doc?.uri:undefined;
    if(!useActive) {
      const files=await vscode.workspace.findFiles(new vscode.RelativePattern(folder,'**/*.{asm,ASM}'),'**/{build,node_modules,.git}/**',500);
      const choice=await vscode.window.showQuickPick(files.map(uri=>({label:path.relative(folder.uri.fsPath,uri.fsPath),uri})),{title:'Selecciona el archivo principal de la práctica'});
      uri=choice?.uri;
    }
    if(!uri)return;
    if(!/\.asm$/i.test(uri.fsPath) || !core.within(folder.uri.fsPath,uri.fsPath))throw new Error('Elige un .asm dentro de la carpeta.');
    await config(folder.uri).update('mainFile',path.relative(folder.uri.fsPath,uri.fsPath).split(path.sep).join('/'),vscode.ConfigurationTarget.WorkspaceFolder);
    reports.clear();diagnostics.clear();
    visibleStatus('Principal: '+path.basename(uri.fsPath));
    vscode.window.showInformationMessage('Principal seleccionado: '+path.basename(uri.fsPath));
    const main=await vscode.workspace.openTextDocument(uri);await vscode.window.showTextDocument(main);schedule(main);
  }
  async function newPractice() {
    const parents=await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:'Selecciona dónde crear la práctica'});
    if(!parents)return;
    const name=await vscode.window.showInputBox({title:'Nombre de la nueva práctica',value:'Practica nueva',validateInput:v=>!v.trim() || /[<>:"/\\|?*]/.test(v) || /[. ]$/.test(v) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(v)?'Usa un nombre válido de carpeta.':undefined});
    if(!name)return;
    const root=path.join(parents[0].fsPath,name);
    await fs.mkdir(root); // Existing practices are never overwritten.
    await fs.mkdir(path.join(root,'.vscode'));
    await fs.writeFile(path.join(root,'main.asm'),TEMPLATE);
    await fs.writeFile(path.join(root,'.vscode','settings.json'),JSON.stringify({'mpasm.processor':'18F4550','mpasm.mainFile':'main.asm','mpasm.outputDirectory':'build'},null,2));
    await fs.writeFile(path.join(root,'.gitignore'),'build/\n');
    await vscode.commands.executeCommand('vscode.openFolder',vscode.Uri.file(root),{forceNewWindow:true});
  }
  const instructions={
    MOVLW:'MOVLW k — carga un literal de 8 bits en WREG.',MOVWF:'MOVWF f [,a] — copia WREG al registro f.',MOVF:'MOVF f [,d [,a]] — mueve f al destino WREG (0) o f (1).',MOVFF:'MOVFF origen,destino — copia un registro a otro.',
    CLRF:'CLRF f [,a] — pone el registro a cero.',BSF:'BSF f,b [,a] — activa el bit b.',BCF:'BCF f,b [,a] — borra el bit b.',BTFSC:'BTFSC f,b [,a] — salta la siguiente instrucción si el bit es cero.',BTFSS:'BTFSS f,b [,a] — salta si el bit es uno.',
    GOTO:'GOTO etiqueta — salto absoluto.',BRA:'BRA etiqueta — salto relativo.',CALL:'CALL etiqueta — llama una subrutina.',RETURN:'RETURN — regresa de una subrutina.',RETFIE:'RETFIE — regresa de una interrupción.',NOP:'NOP — no realiza ninguna operación.',
    LIST:'LIST P=18F4550 — selecciona el dispositivo.',ORG:'ORG dirección — establece la dirección del código absoluto.',END:'END — termina el archivo fuente.',EQU:'nombre EQU valor — define una constante.',CONFIG:'CONFIG opción=valor — bits de configuración; consulta el archivo .inc del PIC.',CBLOCK:'CBLOCK dirección / ENDC — asigna nombres a registros consecutivos.'
  };
  let symbols;
  async function allSymbols(doc) {
    const exe=core.discover(config(doc.uri).get('executable'));
    const device=core.processor(doc.getText(),config(doc.uri).get('processor'));
    const cacheKey=exe+'|'+device;
    if(symbols?.key===cacheKey)return symbols.values;
    let values=[];
    if(exe) {
      const text=await fs.readFile(path.join(path.dirname(exe),'p'+device.toLowerCase()+'.inc'),'latin1').catch(()=> '');
      values=[...text.matchAll(/^([A-Za-z_]\w*)\s+EQU\s+([^;\r\n]+)/gm)].map(m=>({name:m[1],detail:m[2].trim()}));
    }
    symbols={key:cacheKey,values};return values;
  }
  context.subscriptions.push(diagnostics,output,status,
    vscode.workspace.onDidChangeTextDocument(e=>{if(e.contentChanges.length)schedule(e.document);}),
    vscode.workspace.onDidOpenTextDocument(schedule),
    vscode.workspace.onDidCloseTextDocument(doc=>{try{const id=key(target(doc).entry);clearTimeout(timers.get(id));timers.delete(id);revisions.set(id,(revisions.get(id)||0)+1);reports.delete(id);renderReports();}catch{}}),
    vscode.workspace.onDidGrantWorkspaceTrust(()=>vscode.workspace.textDocuments.forEach(schedule)),
    vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('mpasm')){symbols=undefined;reports.clear();diagnostics.clear();vscode.workspace.textDocuments.forEach(schedule);}}),
    vscode.languages.registerCompletionItemProvider('mpasm',{async provideCompletionItems(doc,pos){if(doc.lineAt(pos.line).text.slice(0,pos.character).includes(';'))return [];const values=await allSymbols(doc);return [...Object.entries(instructions).map(([label,detail])=>Object.assign(new vscode.CompletionItem(label,vscode.CompletionItemKind.Keyword),{detail})),...values.map(s=>Object.assign(new vscode.CompletionItem(s.name,vscode.CompletionItemKind.Constant),{detail:'MPASM '+s.detail}))];}}),
    vscode.languages.registerHoverProvider('mpasm',{async provideHover(doc,pos){const range=doc.getWordRangeAtPosition(pos);if(!range)return;const word=doc.getText(range).toUpperCase();if(instructions[word])return new vscode.Hover(instructions[word],range);const symbol=(await allSymbols(doc)).find(s=>s.name.toUpperCase()===word);if(symbol)return new vscode.Hover(`${symbol.name} EQU ${symbol.detail}`,range);}}),
    {dispose(){disposed=true;for(const timer of timers.values())clearTimeout(timer);}}
  );
  const commands={
    'mpasm.build':build,'mpasm.configure':configure,'mpasm.newPractice':newPractice,
    'mpasm.selectMain':()=>selectMain(false),'mpasm.useActive':()=>selectMain(true),
    'mpasm.check':()=>request(vscode.window.activeTextEditor?.document),
    'mpasm.help':()=>vscode.commands.executeCommand('markdown.showPreview',vscode.Uri.joinPath(context.extensionUri,'README.md')),
    'mpasm.openHex':async()=>{const selected=target(vscode.window.activeTextEditor?.document),record=builds.get(key(selected.entry));if(!record || record.stale){vscode.window.showWarningMessage('Ensambla primero: no hay un HEX actualizado verificado en esta sesión.');return;}await vscode.commands.executeCommand('revealFileInOS',vscode.Uri.file(record.hex));}
  };
  for(const [name,fn] of Object.entries(commands))context.subscriptions.push(vscode.commands.registerCommand(name,async()=>{try{return await fn();}catch(error){output.appendLine(error.stack || error.message);vscode.window.showErrorMessage(error.message);}}));
  if(context.globalState.get('version')!=='0.2.0') {
    context.globalState.update('version','0.2.0');
    vscode.window.showInformationMessage('MPASM Live: configura tu ensamblador o abre una práctica.','Configurar','Guía').then(action=>{if(action)vscode.commands.executeCommand(action==='Guía'?'mpasm.help':'mpasm.configure');});
  }
  vscode.workspace.textDocuments.forEach(schedule);
};
