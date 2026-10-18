import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySemanticRoundtrip} from '../scripts/compatibility/roundtrip.mjs';
test('supported semantic round trips preserve independently referenced BASIC images with explicit container normalization',()=>{
 const report=verifySemanticRoundtrip();assert.equal(report.cases.length,8);
 assert.equal(report.guarantee,'identical-basic-bytes');
 assert.equal(new Set(report.cases.map(item=>item.name)).size,8);
 assert.deepEqual(verifySemanticRoundtrip(),report);
});
