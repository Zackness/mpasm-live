'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const tm=require('vscode-textmate');
const onig=require('vscode-oniguruma');
test('gramática PIC-AS colorea instrucciones, directivas, registros, etiquetas y comentarios',async()=>{
  const wasm=fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));await onig.loadWASM(wasm.buffer.slice(wasm.byteOffset,wasm.byteOffset+wasm.byteLength));
  const registry=new tm.Registry({onigLib:Promise.resolve({createOnigScanner:p=>new onig.OnigScanner(p),createOnigString:s=>new onig.OnigString(s)}),loadGrammar:async scope=>scope==='source.picas'?tm.parseRawGrammar(fs.readFileSync(path.join(__dirname,'../syntaxes/picas.json'),'utf8'),'picas.json'):null});
  const grammar=await registry.loadGrammar('source.picas');
  const scopes=line=>grammar.tokenizeLine(line).tokens.map(t=>({text:line.slice(t.startIndex,t.endIndex),scopes:t.scopes.join(' ')}));
  for(const [line,word,scope] of [['    MOVLW 0x2A','MOVLW','keyword.control.picas'],['    PSECT code,class=CODE','PSECT','keyword.control.directive'],['    #include <xc.inc>','#include','keyword.control.directive'],['    BSF LATC,0,0','LATC','support.variable.register'],['inicio:','inicio','entity.name.function.label'],['; prueba','; prueba','comment.line'],['    MOVLW 0x2A','0x2A','constant.numeric']])assert(scopes(line).some(t=>t.text.includes(word) && t.scopes.includes(scope)),line);
  assert(scopes('    #define led LATC,0,0 ; comentario').some(t=>t.scopes.includes('comment.line')));
});
