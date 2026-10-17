import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeBasic, checkProgram, decodeSpectrumText, DiagnosticCodes, formatSpectrumTextContent, parseBasic, SourceDocument, SPECTRUM_GRAPHIC_NOTATIONS } from '@zxcode/core';
const parsed = (body) => parseBasic(new SourceDocument('escapes', `10 ${body}`));
function contentBytes(body) {
  const result = analyzeBasic(parsed(body));
  assert.equal(result.kind,'buildable',body);
  const statement = result.analysis.program.lines[0].statements[0];
  return statement.kind==='rem' ? statement.bytes : statement.items[0].expression.bytes;
}
test('source escapes match 281 independently assembled original-ROM framing observations', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/escapes-rom.json',import.meta.url),'utf8'));
  for (const entry of fixture.cases) {
    const result = checkProgram(new SourceDocument('reference',entry.source));
    assert.equal(result.kind,entry.statements===undefined?'error':'success',entry.source);
    if (result.kind==='success') assert.equal(Buffer.from(result.encodedProgram.programBytes.slice(4,-1)).toString('hex'),entry.encoded,entry.source);
    else assert.ok(result.diagnostics.some((item)=>item.code===DiagnosticCodes.unrepresentableStringByte),entry.source);
  }
});
test('graphics notation activates only in string/REM literal contexts', () => {
  for (const entry of SPECTRUM_GRAPHIC_NOTATIONS) {
    assert.deepEqual(contentBytes(`PRINT "${entry.canonicalText}"`),[entry.byte]);
    assert.deepEqual(contentBytes(`REM${entry.canonicalText}`),[entry.byte]);
  }
  assert.equal(checkProgram(parsed('PRINT {BYTE 0x31}').source).kind,'error');
  const raw=parsed('PRINT "PRINT"');
  assert.equal(raw.syntax.lines[0].statements[0].items[0].expression.value,'PRINT');
});
test('literal delimiters and backslashes preserve bytes without recursive expansion', () => {
  assert.deepEqual(contentBytes('PRINT "{{INK 2}}"'),Array.from(Buffer.from('{INK 2}')));
  assert.deepEqual(contentBytes('PRINT "{BYTE 0x7B}INK 2{BYTE 0x7D}"'),Array.from(Buffer.from('{INK 2}')));
  assert.deepEqual(contentBytes('PRINT "a""{BYTE 0x22}b"'),Array.from(Buffer.from('a""b')));
  assert.deepEqual(contentBytes('PRINT "\\n\\xFF"'),Array.from(Buffer.from('\\n\\xFF')));
  assert.deepEqual(contentBytes('REM "{{UDG A}}"'),Array.from(Buffer.from(' "{UDG A}"')));
});
test('raw and control payload byte 13 are diagnosed in strings and remain exact in REM', () => {
  for (const escape of ['{BYTE 0x0D}','{ENTER}','{AT 13,2}','{TAB 13}','{INK 13}']) {
    const input=parsed(`PRINT "a${escape}b"`);
    assert.deepEqual(input.diagnostics,[]);
    const result=analyzeBasic(input);
    assert.equal(result.kind,'invalid');
    const error=result.analysis.diagnostics.find((item)=>item.code===DiagnosticCodes.unrepresentableStringByte);
    assert.equal(input.source.textInRange(error.range),escape);
  }
  assert.deepEqual(contentBytes('REM{BYTE 0x0D}{AT 13,2}'),[13,22,13,2]);
});
test('byte source formatting round-trips all values through valid BASIC contexts', () => {
  for (let byte=0;byte<256;byte++) {
    const decoded=decodeSpectrumText(Uint8Array.of(byte));
    for (const context of ['string','rem']) {
      const formatted=formatSpectrumTextContent(decoded.atoms,context);
      if(context==='string'&&byte===13){assert.equal(formatted.kind,'error');continue;}
      assert.equal(formatted.kind,'success',byte);
      assert.deepEqual(contentBytes(context==='string'?`PRINT "${formatted.text}"`:`REM${formatted.text}`),[byte],`${context} ${byte}`);
    }
  }
  const bytes=Uint8Array.from({length:256},(_,byte)=>byte);
  const formatted=formatSpectrumTextContent(decodeSpectrumText(bytes).atoms,'rem');
  assert.equal(formatted.kind,'success');
  assert.deepEqual(contentBytes(`REM${formatted.text}`),Array.from(bytes));
});
test('canonical named packets and literal brace/quote content round-trip as bytes', () => {
  for (const bytes of [[16,2,65,23,2,1,144,143,255],[22,34,58,34,123,125],[97,98,99],[36,49],[92,110],[94,96,127]]) {
    for(const context of ['string','rem']) {
      const formatted=formatSpectrumTextContent(decodeSpectrumText(Uint8Array.from(bytes)).atoms,context);
      assert.equal(formatted.kind,'success');
      assert.deepEqual(contentBytes(context==='string'?`PRINT "${formatted.text}"`:`REM${formatted.text}`),bytes);
    }
  }
  assert.equal(formatSpectrumTextContent([{kind:'byte',value:144}],'string').text,'{UDG A}');
  assert.equal(formatSpectrumTextContent([{kind:'byte',value:143}],'string').text,'{BLOCK 15}');
  assert.equal(formatSpectrumTextContent([{kind:'control',name:'TAB',parameters:[2,1]}],'string').text,'{TAB 258}');
  assert.equal(formatSpectrumTextContent([{kind:'text',value:'abc'}],'rem').text,'{BYTE 0x61}bc');
});
test('escape/source parts retain UTF-16 coordinates and byte identities without Unicode carriers', () => {
  const input=parsed('PRINT "a{INK 2}{{£{UDG A}é"');
  assert.deepEqual(input.diagnostics,[]);
  const literal=input.syntax.lines[0].statements[0].items[0].expression;
  assert.equal(literal.value,undefined);
  assert.equal(literal.parts.find((part)=>part.kind==='atom').atom.name,'INK');
  const result=analyzeBasic(input);
  assert.equal(result.kind,'invalid');
  const diagnostic=result.analysis.diagnostics.find((item)=>item.code===DiagnosticCodes.unsupportedCharacter);
  assert.equal(input.source.textInRange(diagnostic.range),'é');
  assert.ok(Object.isFrozen(literal.parts));
});
test('malformed escape snapshots recover and retain intrinsic error state', () => {
  for(const text of ['{UNKNOWN}','{BYTE FF}','{BYTE 0xF}','{BYTE 0x100}','{INK}','{INK -1}','{INK 256}','{INK 02}','{AT 1}','{AT 1,2,3}','{TAB 65536}','{UDG V}','{BLOCK 16}','{INK 2','}']) {
    const input=parsed(`PRINT "${text}": PRINT 2`);
    assert.ok(input.diagnostics.some((item)=>item.code===DiagnosticCodes.invalidEscape),text);
    assert.equal(input.syntax.lines[0].statements.at(-1).kind,'print');
    assert.equal(analyzeBasic(Object.freeze({...input,diagnostics:Object.freeze([])})).kind,'invalid',text);
    const rem=parsed(`REM ${text}`);
    assert.equal(analyzeBasic(Object.freeze({...rem,diagnostics:Object.freeze([])})).kind,'invalid',text);
  }
});
