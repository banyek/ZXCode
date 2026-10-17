import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeBasic, checkProgram, DiagnosticCodes, parseBasic, SourceDocument } from '@zxcode/core';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/lexical-rom.json',import.meta.url),'utf8'));
const parsed=(body)=>parseBasic(new SourceDocument('lexical',`10 ${body}`));
test('36 combined lexical contexts match original-ROM bytes and statement counts',()=>{
  for(const entry of fixture.cases){
    const result=checkProgram(new SourceDocument('rom',entry.source));
    assert.equal(result.kind,entry.statements===undefined?'error':'success',entry.source);
    if(result.kind==='success'){
      assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4,-1)).toString('hex'),entry.encoded,entry.source);
      assert.equal(result.encodedProgram.lines[0].statements.length,entry.statements,entry.source);
    }
  }
});
test('physical newline and EOF variants retain byte images and recovery boundaries',()=>{
  for(const entry of fixture.cases){
    if(entry.statements===undefined)continue;
    const images=[];
    for(const newline of ['\n','\r\n','\r']){
      const source=new SourceDocument('lines',entry.source+newline+'20 CLS'+newline);
      const input=parseBasic(source);
      assert.deepEqual(input.diagnostics,[],entry.source);
      assert.equal(input.syntax.lines[1].lineNumber,20);
      const result=checkProgram(source);
      assert.equal(result.kind,'success');
      images.push(result.encodedProgram.programBytes);
    }
    assert.deepEqual(images[0],images[1],entry.source);
    assert.deepEqual(images[0],images[2],entry.source);
  }
});
test('literal keyword bytes do not affect real IF/THEN/REM source ownership',()=>{
  const input=parsed('IF CODE "{BYTE 0xCB}" THEN PRINT "REM:THEN":REM{BYTE 0xFA}');
  assert.deepEqual(input.diagnostics,[]);
  const line=input.syntax.lines[0];
  assert.equal(line.tokens.filter((token)=>token.kind==='word'&&token.text==='THEN').length,1);
  assert.equal(line.tokens.filter((token)=>token.kind==='raw-tail').length,1);
  assert.equal(line.statements.length,1);
  assert.deepEqual(line.statements[0].thenStatements.map((node)=>node.kind),['print','rem']);
  const result=analyzeBasic(input);
  assert.equal(result.kind,'buildable');
  assert.deepEqual(result.analysis.program.lines[0].statements[0].thenStatements[1].bytes,[250]);
  const checked=checkProgram(input.source);
  assert.equal(checked.encodedProgram.lines[0].statements.length,3);
});
test('catalogue annotations never blindly tokenize keyword-looking variable names',()=>{
  const input=parsed('LET some THEN REM name=a: PRINT somethenremname');
  assert.deepEqual(input.diagnostics,[]);
  assert.equal(input.syntax.lines[0].tokens.filter((token)=>token.kind==='raw-tail').length,0);
  assert.ok(input.syntax.lines[0].tokens.some((token)=>token.text==='THEN'&&token.romToken?.byte===203));
  const result=analyzeBasic(input);
  assert.equal(result.kind,'buildable');
  const [letNode,print]=result.analysis.program.lines[0].statements;
  assert.equal(letNode.target.identity.key,'numeric:somethenremname');
  assert.equal(print.items[0].expression.identity.key,letNode.target.identity.key);
  const bytes=checkProgram(input.source).encodedProgram.programBytes;
  assert.ok(!bytes.includes(203));
  assert.ok(!bytes.includes(234));
});
test('encoded CR/STOP in REM retain one source statement and exact stored length',()=>{
  const input=parsed('REM x{BYTE 0x0D}{BYTE 0xE2}20 PRINT');
  assert.deepEqual(input.diagnostics,[]);
  assert.equal(input.source.lineCount,1);
  assert.equal(input.syntax.lines[0].statements.length,1);
  const result=checkProgram(input.source);
  assert.equal(result.kind,'success');
  const bytes=result.encodedProgram.programBytes;
  assert.equal(bytes[2]+256*bytes[3],bytes.length-4);
  assert.equal(result.encodedProgram.lines[0].statements.length,1);
  assert.equal(Buffer.from(bytes.slice(4,-1)).toString('hex'),'ea20780de23230205052494e54');
});
test('bad quote/escape snapshots preserve exact diagnostics and following statements',()=>{
  const source=new SourceDocument('positions','10 PRINT "{{""}}{INK 2}😀é": PRINT 2\r\n20 REM {UNKNOWN}\r\n30 CLS');
  const input=parseBasic(source);
  const result=analyzeBasic(input);
  assert.equal(result.kind,'invalid');
  const unsupported=result.analysis.diagnostics.filter((item)=>item.code===DiagnosticCodes.unsupportedCharacter);
  assert.deepEqual(unsupported.map((item)=>source.textInRange(item.range)),['😀','é']);
  assert.equal(input.syntax.lines[0].statements.at(-1).kind,'print');
  assert.equal(input.syntax.lines[2].statements[0].kind,'cls');
  assert.equal(source.textInRange(input.diagnostics.find((item)=>item.code===DiagnosticCodes.invalidEscape).range),'{UNKNOWN}');
  assert.equal(analyzeBasic(Object.freeze({...input,diagnostics:Object.freeze([])})).kind,'invalid');
  for(const body of ['PRINT """','PRINT "a""']){
    const incomplete=parsed(body+'\n20 CLS');
    assert.ok(incomplete.diagnostics.some((item)=>item.code===DiagnosticCodes.unterminatedString));
    assert.equal(incomplete.syntax.lines[1].statements[0].kind,'cls');
    assert.equal(analyzeBasic(Object.freeze({...incomplete,diagnostics:Object.freeze([])})).kind,'invalid');
  }
});
