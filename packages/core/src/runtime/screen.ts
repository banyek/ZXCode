/** Original 48K display memory, decoded to palette indices; no host graphics API. */
export function decodeSpectrumScreen(bytes:Uint8Array,flashPhase=false):Uint8Array {
  if(!(bytes instanceof Uint8Array)||bytes.length!==6912)throw new RangeError("A Spectrum screen contains exactly 6912 bytes.");
  const pixels=new Uint8Array(256*192);
  for(let y=0;y<192;y++)for(let x=0;x<256;x++) {
    const bitmap=((y&192)<<5)|((y&7)<<8)|((y&56)<<2)|(x>>>3);
    const attribute=bytes[6144+(y>>>3)*32+(x>>>3)]!,bright=(attribute&64)>>>3;
    const set=((bytes[bitmap]!>>>(7-(x&7)))&1)!==0;
    const ink=set!==((attribute&128)!==0&&flashPhase);
    pixels[y*256+x]=(ink?attribute&7:(attribute>>>3)&7)+bright;
  }
  return pixels;
}
