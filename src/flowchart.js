'use strict';
// Source-level PIC18 control flow. Never executes code or guesses macro expansion.
const NORMAL=new Set(('ADDLW ADDWF ADDWFC ANDLW ANDWF BCF BSF BTG CLRF CLRWDT COMF DAW DECF INCF IORLW IORWF LFSR MOVF MOVFF MOVLB MOVLW MOVWF MULLW MULWF NEGF NOP POP PUSH RLCF RLNCF RRCF RRNCF SETF SUBFWB SUBLW SUBWF SUBWFB SWAPF TBLRD TBLWT XORLW XORWF').split(' '));
const SKIP={BTFSC:'¿El bit indicado es 0?',BTFSS:'¿El bit indicado es 1?',CPFSEQ:'¿f = WREG?',CPFSGT:'¿f > WREG (sin signo)?',CPFSLT:'¿f < WREG (sin signo)?',DECFSZ:'Decrementar f; ¿resultado = 0?',DCFSNZ:'Decrementar f; ¿resultado ≠ 0?',INCFSZ:'Incrementar f; ¿resultado = 0?',INFSNZ:'Incrementar f; ¿resultado ≠ 0?',TSTFSZ:'¿f = 0?'};
const BRANCH={BC:'¿C = 1?',BNC:'¿C = 0?',BN:'¿N = 1?',BNN:'¿N = 0?',BOV:'¿OV = 1?',BNOV:'¿OV = 0?',BZ:'¿Z = 1?',BNZ:'¿Z = 0?'};
const RETURNS=new Set(['RETURN','RETLW','RETFIE']);
const CONTROL=new Set([...Object.keys(SKIP),...Object.keys(BRANCH),...RETURNS,'GOTO','BRA','CALL','RCALL','RESET','SLEEP']);
const DIRECTIVES=new Set('LIST PROCESSOR CONFIG __CONFIG EQU SET VARIABLE CONSTANT RADIX ERRORLEVEL TITLE SUBTITLE SPACE PAGE EXPAND NOEXPAND GLOBAL EXTERN LOCAL END ENDIF ENDC'.split(' '));
function number(value) {
  const s=value.trim();
  if(/^0x[\da-f]+$/i.test(s))return parseInt(s.slice(2),16);
  if(/^[\da-f]+h$/i.test(s))return parseInt(s.slice(0,-1),16);
  if(/^h'[\da-f]+'$/i.test(s))return parseInt(s.slice(2,-1),16);
  if(/^\d+$/.test(s))return parseInt(s,16); // MPASM default radix is hexadecimal.
  if(/^\.\d+$/.test(s))return +s.slice(1);
}
function stripComment(line) {
  let quote='';for(let i=0;i<line.length;i++){const c=line[i];if(quote){if(c===quote)quote='';}else if(c==='"' || c==="'")quote=c;else if(c===';')return line.slice(0,i);}return line;
}
function parse(source) {
  const instructions=[],labels=new Map(),entries=[],warnings=[];
  let pending=[],address=0,segment=0,block='',conditional=0,radix='HEX';
  const lines=source.split(/\r?\n/);
  if(lines.length>15000)throw new Error('El archivo supera 15000 líneas. Genera diagramas de módulos más pequeños.');
  function warn(line,message){warnings.push({line,message});}
  function add(op,args,line,kind) {
    const item={id:'n'+instructions.length,op,args,line,address,segment,radix,labels:pending,kind};
    for(const label of pending){const key=label.toUpperCase();if(labels.has(key))warn(line,'Etiqueta duplicada: '+label);else labels.set(key,instructions.length);}
    pending=[];instructions.push(item);
    address=address===undefined?undefined:address+(['CALL','GOTO','MOVFF','LFSR'].includes(op)?4:2);
    return item;
  }
  for(let line=0;line<lines.length;line++) {
    const code=stripComment(lines[line]).trim();if(!code)continue;
    let match=code.match(/^(?:([A-Za-z_]\w*)\s*:\s*)?([#A-Za-z_][\w#]*)([+*\-]*)\s*(.*)$/);
    if(!match){add('NO RESUELTO',code,line,'unknown');warn(line,'Expresión no interpretada.');address=undefined;continue;}
    let label=match[1],op=match[2].toUpperCase(),args=(match[3]+match[4]).trim();
    if(!label && !NORMAL.has(op) && !CONTROL.has(op) && !DIRECTIVES.has(op) && !/^#?(INCLUDE|IF|IFDEF|IFNDEF|ELSE|ENDIF|DEFINE|UNDEFINE)$/.test(op) && !['ORG','CBLOCK','MACRO','ENDM','RADIX'].includes(op)) {
      const next=args.match(/^([A-Za-z_]\w*)\s*(.*)$/);
      if(next && (NORMAL.has(next[1].toUpperCase()) || CONTROL.has(next[1].toUpperCase()) || ['EQU','SET','MACRO','CODE','UDATA','RES'].includes(next[1].toUpperCase()))) {label=match[2];op=next[1].toUpperCase();args=next[2];}
      else if(!args && !/^\s/.test(lines[line])){label=match[2];op='';}
    }
    if(block){if(op===block){block='';if(op==='ENDM')address=undefined;}continue;}
    if(op==='MACRO'){block='ENDM';warn(line,'Las macros no se expanden: sus llamadas se marcan como no resueltas.');continue;}
    if(op==='CBLOCK'){block='ENDC';continue;}
    if(/^#?IF(N?DEF)?$/.test(op)){if(!conditional){add('CONDICIONAL',code,line,'unknown');warn(line,'Ensamblado condicional no evaluado; se omite su contenido.');}conditional++;address=undefined;continue;}
    if(conditional){if(/^#?IF(N?DEF)?$/.test(op))conditional++;if(/^#?ENDIF$/.test(op))conditional--;continue;}
    if(op==='END')break;
    if(op==='ORG') {
      address=radix==='HEX'?number(args):/^\d+$/.test(args)?Number(args):number(args);segment++;
      entries.push({index:instructions.length,line,address});
      if(address===undefined)warn(line,'ORG no resuelto: no se conectan segmentos por dirección.');continue;
    }
    if(op==='RADIX'){radix=args.toUpperCase();if(!['HEX','DEC'].includes(radix))warn(line,'Radix no soportado; se omite la resolución de direcciones numéricas.');continue;}
    if(/^#?INCLUDE$/.test(op)){warn(line,'Include no expandido: '+args+'. El diagrama representa este archivo; las etiquetas externas quedan pendientes.');if(!/^[<"]?p(?:10|12|16|18)[a-z0-9]+\.inc[>"]?$/i.test(args)){add('INCLUDE',args,line,'unknown');address=undefined;}continue;}
    if(DIRECTIVES.has(op))continue;
    if(label)pending.push(label);
    if(!op)continue;
    if(['CODE','UDATA','UDATA_ACS','RES','DB','DW','DE','DT','FILL','ALIGN','#DEFINE','#UNDEFINE'].includes(op)) {add(op,args,line,'unknown');warn(line,'Directiva o datos no interpretados: '+op);address=undefined;continue;}
    let kind=NORMAL.has(op)?'process':SKIP[op] || BRANCH[op]?'decision':['CALL','RCALL'].includes(op)?'call':RETURNS.has(op)?'terminal':CONTROL.has(op)?'jump':'unknown';
    if((/^(MOVWF|CLRF|SETF|ADDWF|SUBWF|INCF|DECF|RLCF|RRCF|MOVFF)$/.test(op) && /(?:^|,)\s*(?:PCL|0xFF9|0FF9H)\s*(?:,|$)/i.test(args))) {kind='unknown';warn(line,'Posible escritura a PCL: destino de ejecución calculado.');}
    if(op==='SLEEP'){kind='unknown';warn(line,'SLEEP: continuación tras despertar no modelada.');}
    if(kind==='unknown') {warn(line,'Flujo no resuelto en '+op+'; no se supone una continuación.');address=undefined;}
    add(op,args,line,kind);
  }
  if(block || conditional)warn(lines.length-1,'Bloque de ensamblado sin cerrar.');
  return {instructions,labels,entries,warnings,radix};
}
function graph(source,{summary=true}={}) {
  const parsed=parse(source),{instructions,labels,entries,warnings}=parsed;
  const nodes=instructions.map(i=>({...i,text:[...i.labels.map(l=>l+':'),`${i.op}${i.args?' '+i.args:''}`],condition:SKIP[i.op] || BRANCH[i.op]})),edges=[];
  let extra=0;
  const unknown=(item,reason)=>{const id='u'+extra++;nodes.push({id,kind:'unknown',line:item.line,text:[reason],segment:item.segment});warnings.push({line:item.line,message:reason});return id;};
  function next(i,offset=1){const target=instructions[i+offset];return target && target.segment===instructions[i].segment?target.id:undefined;}
  function destination(item) {
    const operand=item.args.split(',')[0].trim();
    if(labels.has(operand.toUpperCase()))return instructions[labels.get(operand.toUpperCase())].id;
    if(operand==='$')return item.id;
    const rel=operand.match(/^\$\s*([+-])\s*(0x[\da-f]+|\.[0-9]+|[\da-f]+h?|h'[\da-f]+')$/i);
    const numeric=value=>item.radix==='DEC' && /^\d+$/.test(value)?+value:['DEC','HEX'].includes(item.radix)?number(value):undefined;
    const num=numeric(operand);
    let address=rel && item.address!==undefined?item.address+(rel[1]==='+'?1:-1)*numeric(rel[2]):num;
    const targets=address===undefined?[]:instructions.filter(i=>i.address===address);
    return targets.length===1?targets[0].id:unknown(item,'Destino no resuelto: '+operand);
  }
  function edge(from,to,label='',kind='flow'){if(to)edges.push({from:from.id || from,to,label,kind});}
  instructions.forEach((item,i)=>{
    if(item.kind==='unknown')return;
    if(RETURNS.has(item.op))return;
    if(SKIP[item.op]) {edge(item,next(i,2) || unknown(item,'Salto condicional fuera del segmento'),'Sí · omitir');edge(item,next(i) || unknown(item,'Siguiente instrucción no disponible'),'No');}
    else if(BRANCH[item.op]){edge(item,destination(item),'Sí');edge(item,next(i) || unknown(item,'Continuación fuera del segmento'),'No');}
    else if(['GOTO','BRA'].includes(item.op))edge(item,destination(item),'Saltar');
    else if(['CALL','RCALL'].includes(item.op)){edge(item,destination(item),'Llamar','call');edge(item,next(i) || unknown(item,'Retorno fuera del segmento'),'Al regresar');}
    else if(item.op==='RESET'){const reset=instructions.find(i=>i.address===0);edge(item,reset?.id || unknown(item,'Vector de reinicio no resuelto'),'Reinicio');}
    else edge(item,next(i) || unknown(item,'Fin de segmento: continuación desconocida'));
  });
  const starts=entries.length?entries:[{index:0,line:0,address:undefined}];
  starts.forEach((entry,i)=>{const target=instructions[entry.index];if(!target)return;const id='entry'+i;nodes.push({id,kind:'terminal',line:entry.line,text:[entry.address===0?'Entrada de reinicio':entry.address===8?'Vector de interrupción alta':entry.address===24?'Vector de interrupción baja':`Entrada ${entry.address===undefined?'de archivo':'ORG 0x'+entry.address.toString(16).toUpperCase()}`]});edge(id,target.id);});
  if(summary) {
    // Merge only a single predecessor/successor chain; never swallow a label or branch target.
    for(let i=0;i<instructions.length-1;i++) {
      const a=nodes.find(n=>n.id===instructions[i].id);if(!a || a.kind!=='process')continue;
      for(let j=i+1;j<instructions.length;j++) {
        const b=nodes.find(n=>n.id===instructions[j].id),out=edges.filter(e=>e.from===a.id),incoming=b && edges.filter(e=>e.to===b.id);
        if(!b || b.kind!=='process' || b.labels.length || a.segment!==b.segment || out.length!==1 || out[0].to!==b.id || incoming.length!==1 || a.text.length+b.text.length>9)break;
        a.text.push(...b.text);a.endLine=b.line;
        edges.splice(edges.indexOf(out[0]),1);for(const e of edges)if(e.from===b.id)e.from=a.id;
        nodes.splice(nodes.indexOf(b),1);
      }
    }
  }
  nodes.sort((a,b)=>a.line-b.line || (a.id.startsWith('entry')?-1:b.id.startsWith('entry')?1:0));
  if(!nodes.length)warnings.push({line:0,message:'No se encontraron instrucciones representables en este archivo.'});
  return {nodes,edges,warnings,summary};
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svg(model,title='Diagrama MPASM') {
  if(model.nodes.length>2000)throw new Error('Diagrama demasiado grande. Usa la vista resumida o divide el archivo.');
  const width=1400,center=700,positions=new Map();let y=110;
  for(const node of model.nodes){const limit=node.kind==='decision'?40:66,wrap=text=>String(text).match(new RegExp('.{1,'+limit+'}','gu')) || [''];const lines=[...(node.condition?[node.condition]:[]),...node.text].flatMap(wrap),height=Math.max(node.kind==='decision'?180:60,lines.length*(node.kind==='decision'?28:19)+40);positions.set(node.id,{x:center,y,width:node.kind==='decision'?590:520,height,lines});y+=height+90;}
  const footer=model.warnings.flatMap(w=>(`L${w.line+1}: ${w.message}`).match(/.{1,150}/gu) || []),height=y+footer.length*18+90;
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(title)}"><defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 Z" fill="#475569"/></marker></defs><rect width="100%" height="100%" fill="#f8fafc"/><g font-family="Segoe UI,Arial,sans-serif"><text x="30" y="32" font-size="20" fill="#0f172a">${escape(title)}</text><text x="30" y="58" font-size="12" fill="#475569">Símbolos basados en ISO 5807 · Análisis estático del archivo · Sin certificación de conformidad</text>`];
  model.edges.forEach((edge,i)=>{
    const a=positions.get(edge.from),b=positions.get(edge.to);if(!a || !b)return;
    const ai=a.y+a.height,forward=b.y>ai;
    let d,lx,ly;
    if(forward && b.y-ai<100 && edge.kind!=='call'){d=`M${center},${ai} L${center},${b.y}`;lx=center+8;ly=ai+30;}
    else if(edge.from===edge.to){const lane=90+(i%13)*18,x=center-a.width/2,top=a.y+a.height*0.25,bottom=a.y+a.height*0.75;d=`M${x},${top} L${lane},${top} L${lane},${bottom} L${x},${bottom}`;lx=lane+4;ly=top-7;}
    else {const left=!forward || edge.label.startsWith('No'),lane=left?70+(i%13)*18:width-70-(i%13)*18,side=left?-1:1;const ax=center+side*a.width/2,bx=center+side*b.width/2,ay=a.y+a.height/2,by=b.y+b.height/2;d=`M${ax},${ay} L${lane},${ay} L${lane},${by} L${bx},${by}`;lx=left?lane+4:lane-160;ly=ay-7;}
    parts.push(`<path d="${d}" fill="none" stroke="#475569" stroke-width="1.5" ${edge.kind==='call'?'stroke-dasharray="7 5"':''} marker-end="url(#arrow)"/><text x="${lx}" y="${ly}" font-size="12" fill="#334155">${escape(edge.label)}</text>`);
  });
  for(const node of model.nodes){const p=positions.get(node.id),x=p.x-p.width/2,fill=node.kind==='unknown'?'#fff1da':node.kind==='decision'?'#e0f2fe':node.kind==='terminal'?'#dcfce7':'#ffffff';let shape;
    if(node.kind==='decision')shape=`<polygon points="${center},${p.y} ${x+p.width},${p.y+p.height/2} ${center},${p.y+p.height} ${x},${p.y+p.height/2}"/>`;
    else shape=`<rect x="${x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="${node.kind==='terminal'?p.height/2:0}"/>`;
    parts.push(`<g data-node="${node.id}" tabindex="0" role="button" aria-label="Ir a línea ${node.line+1}" style="cursor:pointer"><title>Línea ${node.line+1}${node.endLine!==undefined?'–'+(node.endLine+1):''} · Pulsa para ir al código</title><g fill="${fill}" stroke="#334155" stroke-width="1.6" ${node.kind==='unknown'?'stroke-dasharray="6 4"':''}>${shape}</g>`);
    if(node.kind==='call')parts.push(`<path d="M${x+18},${p.y} V${p.y+p.height} M${x+p.width-18},${p.y} V${p.y+p.height}" stroke="#334155" fill="none"/>`);
    p.lines.forEach((line,i)=>parts.push(`<text x="${center}" y="${p.y+p.height/2-(p.lines.length-1)*9.5+i*19+5}" text-anchor="middle" font-size="13" fill="#0f172a">${escape(line)}</text>`));parts.push('</g>');
  }
  if(footer.length){parts.push(`<text x="30" y="${y}" font-size="16" fill="#0f172a">Observaciones de interpretación</text>`);footer.forEach((line,i)=>parts.push(`<text x="30" y="${y+28+i*18}" font-size="12" fill="#475569">${escape(line)}</text>`));}
  parts.push('</g></svg>');return parts.join('');
}
module.exports={parse,graph,svg,escape};
