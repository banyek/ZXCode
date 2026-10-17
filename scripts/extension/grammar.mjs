import {ROM_TOKENS} from '../../packages/core/dist/index.js';
const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function words(category) {
  const spellings=ROM_TOKENS.filter(t=>t.category===category && t.spelling!=='THEN' && t.spelling!=='REM').map(t=>t.spelling).sort((a,b)=>b.length-a.length);
  const branches=spellings.map(s=>s.split(' ').map(escape).join(s.endsWith(' #')?'[ \\t]*':'[ \\t]+')+(s.endsWith('#')?'':'(?![A-Za-z0-9$])'));
  return `(?i)(?<![A-Za-z0-9$])(?:${branches.join('|')})`;
}
export function createTextMateGrammar() {
  const body={patterns:[
    {include:'#strings'},
    {begin:':',beginCaptures:{0:{name:'punctuation.separator.statement.spectrum-basic'}},end:'$',patterns:[{include:'#rem-start'},{include:'#body'}]},
    {begin:'(?i)(?<![A-Za-z0-9$])THEN(?![A-Za-z0-9$])',beginCaptures:{0:{name:'keyword.control.then.spectrum-basic'}},end:'$',patterns:[{include:'#rem-start'},{include:'#body'}]},
    {match:words('statement'),name:'keyword.control.statement.spectrum-basic'},
    {match:words('function'),name:'support.function.spectrum-basic'},
    {match:words('value'),name:'constant.language.spectrum-basic'},
    {match:words('print-control'),name:'keyword.other.print.spectrum-basic'},
    {match:words('syntax'),name:'keyword.control.spectrum-basic'},
    {match:words('literal-prefix'),name:'keyword.other.literal.spectrum-basic'},
    {match:'(?i)(?<![A-Za-z0-9$])(?:AND|OR|NOT)(?![A-Za-z0-9$])|<=|>=|<>|[-+*/^=<>]',name:'keyword.operator.spectrum-basic'},
    {match:'(?<![A-Za-z0-9$])(?:(?:[0-9]+\\.(?:[ \\t]*[0-9])*|\\.(?:[ \\t]*[0-9])+)(?:[ \\t]*[Ee][ \\t]*[+-]?[ \\t]*[0-9]+)?|[0-9]+(?:[Ee][ \\t]*[+-]?[ \\t]*[0-9]+)?)(?![A-Za-z0-9$])',name:'constant.numeric.spectrum-basic'},
    {match:'[()]',name:'punctuation.section.group.spectrum-basic'},
    {match:'[;,\']',name:'punctuation.separator.item.spectrum-basic'}
  ]};
  return {
    name:'ZX Spectrum BASIC',scopeName:'source.zx-spectrum-basic',fileTypes:['zxbas'],
    patterns:[{include:'#program-line'},{match:'^[ \\t]*[0-9]+(?=[ \\t]|$)',name:'constant.numeric.line-number.spectrum-basic'},{include:'#body'}],
    repository:{
      'program-line':{begin:'^([ \\t]*)([0-9]+)([ \\t]+)',beginCaptures:{2:{name:'constant.numeric.line-number.spectrum-basic'}},end:'$',name:'meta.line.spectrum-basic',patterns:[{include:'#rem-start'},{include:'#body'}]},
      'rem-start':{begin:'\\G[ \\t]*((?i:REM))(?![A-Za-z0-9$])',beginCaptures:{1:{name:'punctuation.definition.comment.spectrum-basic'}},end:'$',name:'comment.line.rem.spectrum-basic',patterns:[{include:'#escapes'}]},
      strings:{begin:'"',end:'"(?!")|$',name:'string.quoted.double.spectrum-basic',patterns:[{match:'""',name:'constant.character.escape.quote.spectrum-basic'},{include:'#escapes'}]},
      escapes:{match:'\\{\\{|\\}\\}|\\{[^}\\r\\n]*\\}',name:'constant.character.escape.spectrum-basic'},
      body
    }
  };
}
