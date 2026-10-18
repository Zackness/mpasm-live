'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const flow=require('../src/flowchart');
function instruction(g,op){return g.nodes.find(n=>n.op===op);}
test('PIC18 skip omite una instrucción completa, incluido GOTO de dos palabras',()=>{
  const g=flow.graph(' ORG 0\n BTFSC PORTB,0\n GOTO destino\n MOVLW .1\ndestino\n RETURN',{summary:false});
  const decision=instruction(g,'BTFSC'),yes=g.edges.find(e=>e.from===decision.id && e.label.startsWith('Sí')),no=g.edges.find(e=>e.from===decision.id && e.label==='No');
  assert.equal(yes.to,instruction(g,'MOVLW').id);assert.equal(no.to,instruction(g,'GOTO').id);
  assert.equal(instruction(g,'MOVLW').address,6);
});
test('saltos, bucles, llamadas y retornos conservan su significado',()=>{
  const g=flow.graph(' ORG 0\ninicio\n CALL rutina\n BNZ inicio\n BRA $\nrutina\n RETLW .1',{summary:false});
  const call=instruction(g,'CALL'),ret=instruction(g,'RETLW'),branch=instruction(g,'BRA');
  assert(g.edges.some(e=>e.from===call.id && e.to===ret.id && e.kind==='call'));
  assert(g.edges.some(e=>e.from===call.id && e.label==='Al regresar'));
  assert(g.edges.some(e=>e.from===branch.id && e.to===branch.id));
  assert(!g.edges.some(e=>e.from===ret.id));
});
test('ORG separa segmentos y reconoce los vectores',()=>{
  const g=flow.graph(' ORG 0\n NOP\n ORG 08H\n RETFIE\n ORG 18H\n RETFIE',{summary:false});
  assert(g.nodes.some(n=>n.text.includes('Vector de interrupción alta')));
  assert(g.nodes.some(n=>n.text.includes('Vector de interrupción baja')));
  const nop=instruction(g,'NOP');assert(!g.edges.some(e=>e.from===nop.id && g.nodes.find(n=>n.id===e.to)?.op==='RETFIE'));
});
test('no inventa flujo de macros, includes o escrituras a PCL',()=>{
  const g=flow.graph(' #include "rutinas.inc"\nmiMacro MACRO\n NOP\n ENDM\n ORG 0\n miMacro\n MOVWF PCL\n CALL externa',{summary:false});
  const macro=instruction(g,'MIMACRO'),pcl=instruction(g,'MOVWF');assert.equal(macro.kind,'unknown');assert.equal(pcl.kind,'unknown');
  assert(!g.edges.some(e=>e.from===macro.id));assert(!g.edges.some(e=>e.from===pcl.id));
  assert(g.warnings.some(w=>w.message.includes('externa')));
});
test('ensamblado condicional es opaco; no mezcla las dos ramas',()=>{
  const g=flow.graph(' ORG 0\n IFDEF OPCION\n MOVLW 1\n ELSE\n MOVLW 2\n ENDIF\n RETURN');
  assert(!g.nodes.some(n=>n.op==='MOVLW'));assert(g.warnings.some(w=>w.message.includes('condicional')));
});
test('vista resumida agrupa procesos sin absorber etiquetas de destino',()=>{
  const code=' ORG 0\n MOVLW .1\n MOVWF LATD\netiqueta\n NOP\n NOP\n BRA etiqueta';
  const detail=flow.graph(code,{summary:false}),summary=flow.graph(code);
  assert(summary.nodes.length<detail.nodes.length);assert(summary.nodes.some(n=>n.labels?.includes('etiqueta')));
  const jump=instruction(summary,'BRA');assert(summary.edges.some(e=>e.from===jump.id && summary.nodes.find(n=>n.id===e.to)?.labels?.includes('etiqueta')));
});
test('destinos numéricos y relativos respetan HEX y DEC',()=>{
  const g=flow.graph(' RADIX DEC\n ORG 0\n BRA $+4\n NOP\n NOP\n GOTO 4',{summary:false});
  const nops=g.nodes.filter(n=>n.op==='NOP');assert.equal(g.edges.find(e=>e.from===instruction(g,'BRA').id).to,nops[1].id);
  assert.equal(g.edges.find(e=>e.from===instruction(g,'GOTO').id).to,nops[1].id);
});
test('SVG escapa texto del ASM y dibuja símbolos y llamadas',()=>{
  const svg=flow.svg(flow.graph(' ORG 0\n BTFSS PORTA,1\n CALL rutina\n BRA $\nrutina\n RETURN'),'<script>alert(1)</script>');
  assert(svg.includes('&lt;script&gt;'));assert(!svg.includes('<script>'));assert(svg.includes('<polygon'));assert(svg.includes('stroke-dasharray'));assert(svg.includes('data-node='));
});
