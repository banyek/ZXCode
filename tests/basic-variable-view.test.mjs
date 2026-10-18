import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeBasicVariables} from '../packages/core/dist/index.js';
import {runtimeVariableNodes} from '../packages/runner/dist/index.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/runtime-variables-rom.json',import.meta.url)));
const inspection=()=>({stop:{},variablesAddress:fixture.variablesAddress,editLineAddress:fixture.editLineAddress,table:decodeBasicVariables(Buffer.from(fixture.variablesHex,'hex'))});
test('runtime view exposes exact stored scalar values and paged authentic array coordinates',()=>{
 const roots=runtimeVariableNodes(inspection()),get=name=>roots.find(node=>node.name===name);
 assert.equal(get('a').display,'123');assert.equal(get('s$').display,'"hi\\x0D\\xFF"');assert.equal(get('e$').address,undefined);
 const array=get('n');assert.equal(array.childCount,4);assert.deepEqual(array.children(1,2).map(node=>[node.name,node.display]),[['(1,2)','-2'],['(2,1)','0.5']]);assert.equal(array.children(0,1)[0].address,fixture.variablesAddress+43);
 assert.deepEqual(get('c$').children(2,2).map(node=>[node.name,node.display]),[['(1,3)','" "'],['(2,1)','"X"']]);
 assert.deepEqual(get('i').children().map(node=>[node.name,node.display]),[['limit','2'],['step','1'],['loop line','50'],['loop statement','2']]);
 assert.throws(()=>array.children(-1,1));assert.ok(Object.isFrozen(roots));
});
test('unsupported variable memory exposes one explicit unavailable view rather than a misleading prefix list',()=>{
 const original=inspection();const nodes=runtimeVariableNodes({...original,table:decodeBasicVariables(Uint8Array.from([...original.table.bytes,0]))});
 assert.equal(nodes.length,1);assert.equal(nodes[0].type,'unavailable');assert.equal(nodes[0].address,fixture.variablesAddress);
});
