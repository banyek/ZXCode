import {readSpectrumNumber} from "../source/spectrum-number.js";
import {spectrumCharacter} from "../source/characters.js";
interface VariableBase {readonly name:string;readonly key:string;readonly offset:number;readonly length:number;readonly dataOffset:number}
export type RuntimeVariable = VariableBase & (
  | {readonly kind:"number";readonly value:number}
  | {readonly kind:"string";readonly bytes:readonly number[]}
  | {readonly kind:"number-array";readonly dimensions:readonly number[];readonly values:readonly number[]}
  | {readonly kind:"character-array";readonly dimensions:readonly number[];readonly bytes:readonly number[]}
  | {readonly kind:"for";readonly value:number;readonly limit:number;readonly step:number;readonly loopLine:number;readonly loopStatement:number}
);
export interface RuntimeVariableIssue {readonly code:"truncated-record"|"invalid-name"|"invalid-number"|"invalid-array"|"unknown-tag"|"missing-terminator"|"trailing-bytes"|"duplicate-name";readonly offset:number;readonly message:string}
export interface RuntimeVariableTable {readonly kind:"decoded"|"unsupported";readonly bytes:readonly number[];readonly variables:readonly RuntimeVariable[];readonly issues:readonly RuntimeVariableIssue[]}
/** A complete bounded VARS..E_LINE image, ending in its original 0x80 marker. */
export function decodeBasicVariables(input:Uint8Array):RuntimeVariableTable {
  if(!(input instanceof Uint8Array)||input.length>65536)throw new TypeError("Expected at most 64 KiB of owned runtime variable bytes.");
  const bytes=Object.freeze(Array.from(input)),variables:RuntimeVariable[]=[],issues:RuntimeVariableIssue[]=[],keys=new Set<string>();
  let cursor=0,terminated=false;
  const issue=(code:RuntimeVariableIssue["code"],offset:number,message:string):void=>{issues.push(Object.freeze({code,offset,message}));};
  const word=(offset:number):number=>bytes[offset]!+bytes[offset+1]!*256;
  const numeric=(offset:number):number | undefined=>{
    if(offset+5>bytes.length){issue("truncated-record",offset,"Five-byte number extends beyond the supplied table.");return undefined;}
    const result=readSpectrumNumber(bytes.slice(offset,offset+5));
    if(result.kind==="error"){issue("invalid-number",offset,"Invalid original-ROM numeric storage.");return undefined;}return result.value;
  };
  while(cursor<bytes.length) {
    const start=cursor,tag=bytes[cursor++]!;
    if(tag===0x80) {terminated=true;if(cursor!==bytes.length)issue("trailing-bytes",cursor,"Bytes follow the variable-table terminator.");break;}
    const type=tag>>>5,letter=tag&31;
    if(type<2||type>7){issue("unknown-tag",start,"Unknown runtime variable record type.");break;}
    if(letter<1||letter>26){issue("invalid-name",start,"Runtime variable name does not begin with an ASCII letter.");break;}
    let name=String.fromCharCode(0x60+letter);
    if(type===5) {
      let final=false;const previousIssues=issues.length;
      while(cursor<bytes.length) {
        const value=bytes[cursor++]!,character=String.fromCharCode(value&127);
        if(!/^[A-Za-z0-9]$/.test(character)){issue("invalid-name",cursor-1,"Invalid long numeric variable name.");break;}
        name+=character.toLowerCase();if(value&128){final=true;break;}
      }
      if(!final){if(issues.length===previousIssues)issue("truncated-record",start,"Long variable name has no final character.");break;}
    }
    if(type===2||type===6)name+="$";
    const key=(type===4?"numeric-array":type===2||type===6?"string":"numeric")+":"+name;
    const dataStart=cursor;
    let variable:RuntimeVariable | undefined;
    if(type===3||type===5||type===7) {
      const payload=type===7?18:5;
      if(cursor+payload>bytes.length){issue("truncated-record",start,"Numeric/FOR record extends beyond the supplied table.");break;}
      const value=numeric(cursor);if(value===undefined)break;
      cursor+=payload;
      const base={name,key,offset:start,length:cursor-start,dataOffset:dataStart};
      if(type===7) {
        const limit=numeric(dataStart+5),step=numeric(dataStart+10);if(limit===undefined||step===undefined)break;
        variable=Object.freeze({...base,kind:"for",value,limit,step,loopLine:word(dataStart+15),loopStatement:bytes[dataStart+17]!});
      } else variable=Object.freeze({...base,kind:"number",value});
    } else {
      if(cursor+2>bytes.length){issue("truncated-record",start,"Missing string/array length word.");break;}
      const length=word(cursor);cursor+=2;
      const end=cursor+length;
      if(end>bytes.length){issue("truncated-record",start,"Length-prefixed record exceeds the supplied table.");break;}
      if(type===2) {
        variable=Object.freeze({name,key,offset:start,length:end-start,dataOffset:cursor,kind:"string",bytes:Object.freeze(bytes.slice(cursor,end))});cursor=end;
      } else {
        if(cursor>=end){issue("invalid-array",start,"Array record lacks a dimension count.");break;}
        const count=bytes[cursor++]!,dimensions:number[]=[];
        if(count===0||cursor+count*2>end){issue("invalid-array",start,"Invalid/truncated array dimension header.");break;}
        for(let index=0;index<count;index++){dimensions.push(word(cursor));cursor+=2;}
        const width=type===4?5:1,dataOffset=cursor,dataLength=end-cursor;
        let product=1;
        for(const dimension of dimensions) {if(dimension===0||product>Math.floor(dataLength/width)/dimension){product=-1;break;}product*=dimension;}
        if(product<1||product*width!==dataLength){issue("invalid-array",start,"Array dimensions and payload length disagree.");break;}
        const base={name,key,offset:start,length:end-start,dataOffset,dimensions:Object.freeze(dimensions)};
        if(type===4) {
          const values:number[]=[];let valid=true;
          while(cursor<end){const value=numeric(cursor);if(value===undefined){valid=false;break;}values.push(value);cursor+=5;}
          if(!valid)break;variable=Object.freeze({...base,kind:"number-array",values:Object.freeze(values)});
        } else variable=Object.freeze({...base,kind:"character-array",bytes:Object.freeze(bytes.slice(cursor,end))});
        cursor=end;
      }
    }
    if(variable!==undefined){if(keys.has(key))issue("duplicate-name",start,"Duplicate runtime variable identity is ambiguous.");keys.add(key);variables.push(variable);}
  }
  if(!terminated&&issues.length===0)issue("missing-terminator",cursor,"Variable table has no final 0x80 marker.");
  return Object.freeze({kind:issues.length===0&&terminated?"decoded":"unsupported",bytes,variables:Object.freeze(variables),issues:Object.freeze(issues)});
}
/** Escaped debugger text only; raw runtime strings need not be valid source literals. */
export function displayRuntimeString(bytes:readonly number[]):string {
  let value='"';
  for(const byte of bytes) {
    if(!Number.isSafeInteger(byte)||byte<0||byte>255)throw new RangeError("Runtime string display requires bytes.");
    const character=spectrumCharacter(byte)?.literalCharacter;
    value+=character===undefined?`\\x${byte.toString(16).toUpperCase().padStart(2,"0")}`:character==='"'||character==="\\"?"\\"+character:character;
  }
  return value+'"';
}
