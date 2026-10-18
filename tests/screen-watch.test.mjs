import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeSpectrumScreen,decodeBasicVariables} from '../packages/core/dist/index.js';
import {selectBasicWatch} from '../packages/runner/dist/index.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/runtime-variables-rom.json',import.meta.url)));
const inspection=()=>({variablesAddress:fixture.variablesAddress,table:decodeBasicVariables(Buffer.from(fixture.variablesHex,'hex'))});
test('48K screen interleaving, ink/paper, bright and explicit flash phases',()=>{
 const bytes=new Uint8Array(6912);
 // Independently enumerated first-byte addresses across scanline/third boundaries.
 for(const [y,address] of [[0,0],[7,1792],[8,32],[63,2016],[64,2048],[128,4096],[191,6112]]){
  bytes.fill(0);bytes[address]=128;bytes[6144+Math.floor(y/8)*32]=128+64+2+4*8;
  const first=decodeSpectrumScreen(bytes),second=decodeSpectrumScreen(bytes,true);
  assert.equal(first[y*256],10);assert.equal(first[y*256+1],12);
  assert.equal(second[y*256],12);assert.equal(second[y*256+1],10);
  bytes[address]=0;assert.equal(first[y*256],10);
 }
 assert.throws(()=>decodeSpectrumScreen(new Uint8Array(6911)));
});
test('watch selectors use canonical BASIC names and bounded numeric array coordinates',()=>{
 const value=inspection();
 assert.equal(selectBasicWatch(value,'LONG NAME').display,'-456');
 assert.equal(selectBasicWatch(value,'s$').display,'"hi\\x0D\\xFF"');
 assert.equal(selectBasicWatch(value,'i').display,'1');
 assert.equal(selectBasicWatch(value,'N(2,1)').display,'0.5');
 assert.equal(selectBasicWatch(value,'n(2,2)').display,'65536');
 for(const expression of ['RND','USR 0','a+1','n(0,1)','n(3,1)','n(1)','n(1+1,1)','n(1,1): a','s$(1)','missing','n()'])assert.throws(()=>selectBasicWatch(value,expression),expression);
 assert.throws(()=>selectBasicWatch({...value,table:decodeBasicVariables(Uint8Array.of(0))},'a'));
});
