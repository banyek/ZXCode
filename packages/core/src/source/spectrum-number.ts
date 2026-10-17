export type SpectrumNumberRead = {readonly kind:"success";readonly value:number} | {readonly kind:"error";readonly reason:"invalid-storage"};
/** Exact projection of a stored original-ROM five-byte value, without evaluating source. */
export function readSpectrumNumber(storage:readonly number[]):SpectrumNumberRead {
  if(storage.length!==5||storage.some(byte=>!Number.isSafeInteger(byte)||byte<0||byte>255))return Object.freeze({kind:"error",reason:"invalid-storage"});
  const [exponent,a,b,c,d]=storage as readonly [number,number,number,number,number];
  if(exponent===0&&(a!==0&&a!==255||d!==0))return Object.freeze({kind:"error",reason:"invalid-storage"});
  const value=exponent===0?b+c*256-(a===255?65536:0):(a&128?-1:1)*(1+((a&127)*2**24+b*65536+c*256+d)/2**31)*2**(exponent-129);
  return Object.freeze({kind:"success",value});
}
