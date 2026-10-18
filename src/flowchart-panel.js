'use strict';
const vscode=require('vscode');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const flow=require('./flowchart');
function open(context,document) {
  const panel=vscode.window.createWebviewPanel('mpasm.flowchart','Flujo: '+path.basename(document.fileName),vscode.ViewColumn.Beside,{enableScripts:true,localResourceRoots:[]});
  let summary=true,model,svg,version;
  const render=()=>{
    version=document.version;
    model=flow.graph(document.getText(),{summary});
    svg=flow.svg(model,path.basename(document.fileName)+' · '+(summary?'Vista resumida':'Vista detallada'));
    const nonce=randomBytes(24).toString('base64');
    const warnings=model.warnings.map(w=>`<li>L${w.line+1}: ${flow.escape(w.message)}</li>`).join('');
    panel.webview.html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:var(--vscode-font-family);padding:16px}header{position:sticky;top:0;background:var(--vscode-editor-background);padding:10px;z-index:1}button,select{padding:7px;margin:4px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:1px solid var(--vscode-contrastBorder,transparent)}.chart{overflow:auto;border:1px solid #64748b;max-height:75vh}.chart svg{display:block}li{margin-bottom:6px}#stale{color:var(--vscode-editorWarning-foreground)}small{display:block;margin:8px 0}</style></head><body><header><h2>Diagrama de flujo MPASM</h2><button data-action="toggle">${summary?'Ver detalle':'Resumir'}</button><button data-action="refresh">Actualizar</button><button data-action="export">Exportar SVG</button><button data-action="zoomOut">−</button><button data-action="zoomIn">+</button><button data-action="fit">Ajustar ancho</button><select id="jump" aria-label="Ir a etiqueta"><option value="">Ir a etiqueta / subrutina…</option>${model.nodes.filter(n=>n.labels?.length).map(n=>`<option value="${n.id}">${flow.escape(n.labels.join(', '))}</option>`).join('')}</select><small>${model.nodes.length} bloques · ${model.edges.length} conexiones. Verde: entrada/retorno · Rombo: decisión · Doble borde: llamada · Naranja: flujo no resuelto. Flecha discontinua: llamada; «Al regresar» supone que la rutina retorna.</small><small>Basado en símbolos ISO 5807; sin certificación de conformidad. Refleja el código, no verifica su lógica ni expande includes/macros.</small><strong id="stale"></strong></header><details ${warnings?'open':''}><summary>${model.warnings.length} observaciones de interpretación</summary><ul>${warnings || '<li>No se detectaron casos pendientes en el archivo.</li>'}</ul></details><div class="chart">${svg}</div><script nonce="${nonce}">const api=acquireVsCodeApi();let zoom=0.75;const svg=document.querySelector('svg'),chart=document.querySelector('.chart');const resize=()=>{svg.style.width=(1400*zoom)+'px';svg.style.height='auto';};resize();document.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const action=b.dataset.action;if(action==='zoomIn')zoom=Math.min(3,zoom+0.15);else if(action==='zoomOut')zoom=Math.max(0.15,zoom-0.15);else if(action==='fit')zoom=chart.clientWidth/1400;else api.postMessage({action});resize();}));document.querySelectorAll('[data-node]').forEach(n=>{const jump=()=>api.postMessage({action:'source',id:n.dataset.node});n.addEventListener('click',jump);n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jump();}});});document.querySelector('#jump').addEventListener('change',e=>{const n=document.querySelector('[data-node="'+e.target.value+'"]');if(n)n.scrollIntoView({block:'center'});});window.addEventListener('message',e=>{if(e.data.action==='stale')document.querySelector('#stale').textContent='El código cambió. Pulsa Actualizar antes de navegar o exportar.';});</script></body></html>`;
  };
  try{render();}catch(error){panel.dispose();throw error;}
  const changed=vscode.workspace.onDidChangeTextDocument(e=>{if(e.document===document && e.contentChanges.length)panel.webview.postMessage({action:'stale'});});
  const messages=panel.webview.onDidReceiveMessage(async message=>{
    try {
      if(!message || typeof message.action!=='string')return;
      if(message.action==='toggle'){summary=!summary;render();return;}
      if(message.action==='refresh'){render();return;}
      if(document.version!==version){vscode.window.showWarningMessage('El código cambió. Actualiza el diagrama primero.');return;}
      if(message.action==='source') {
        const node=model.nodes.find(n=>n.id===message.id);if(!node)return;
        const editor=await vscode.window.showTextDocument(document,{viewColumn:vscode.ViewColumn.One,preserveFocus:false});
        const line=Math.min(node.line,document.lineCount-1);editor.selection=new vscode.Selection(line,0,line,0);editor.revealRange(document.lineAt(line).range,vscode.TextEditorRevealType.InCenter);
      }
      if(message.action==='export') {
        const uri=await vscode.window.showSaveDialog({defaultUri:vscode.Uri.file(document.fileName.replace(/\.asm$/i,'')+'.flujo.svg'),filters:{'Diagrama SVG':['svg']}});
        if(!uri)return;
        if(!/\.svg$/i.test(uri.fsPath)){vscode.window.showWarningMessage('Guarda el diagrama con extensión .svg.');return;}
        await vscode.workspace.fs.writeFile(uri,Buffer.from(svg,'utf8'));vscode.window.showInformationMessage('Diagrama SVG guardado.');
      }
    }catch(error){vscode.window.showErrorMessage('Diagrama: '+error.message);}
  });
  panel.onDidDispose(()=>{changed.dispose();messages.dispose();});
  context.subscriptions.push(panel);
  return {nodes:model.nodes.length,edges:model.edges.length,warnings:model.warnings.length};
}
module.exports={open};
