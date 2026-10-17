import { ROM_TOKENS, romTokenBySpelling } from "./rom-tokens.js";
import type { RomToken } from "./rom-tokens.js";
import { BUILTIN_SIGNATURES } from "./builtin-signatures.js";
import type { ExpectedExpressionType } from "./builtin-signatures.js";
import { commandAvailability } from "./target-profile.js";
export interface HelpParameter { readonly label: string; readonly type: ExpectedExpressionType }
export interface LanguageHelpEntry {
  readonly token: RomToken;
  readonly summary: string;
  readonly syntax: readonly string[];
  readonly parameters?: readonly HelpParameter[];
  readonly resultType?: "numeric" | "string";
  readonly remarks?: readonly string[];
  readonly links: readonly { readonly label: string; readonly url: string }[];
}
const manual = (chapter: number): string => `https://worldofspectrum.org/ZXBasicManual/zxmanchap${chapter}.html`;
// Descriptive placeholders/optional brackets are help notation, not a source grammar.
const commands: Readonly<Record<string, readonly [string, string, number]>> = {
  BEEP: ["BEEP duration,pitch", "Play a tone for the specified duration.",19],
  BORDER: ["BORDER colour", "Set the border colour.",16],
  BRIGHT: ["BRIGHT value", "Select normal, bright or unchanged brightness.",16],
  CAT: ["CAT", "Request an extension catalogue.",22],
  CIRCLE: ["CIRCLE [colour controls;] x,y,radius", "Draw a circle on the pixel display.",17],
  CLEAR: ["CLEAR [address]", "Clear variables and optionally set RAMTOP.",24],
  "CLOSE #": ["CLOSE #stream", "Close a stream connection.",22],
  CLS: ["CLS", "Clear the display area.",15],
  CONTINUE: ["CONTINUE", "Resume after a program stop or interruption.",2],
  COPY: ["COPY", "Send the display bitmap to the ZX printer.",21],
  DATA: ["DATA expression[,expression...]", "Supply expressions for subsequent READ operations.",6],
  "DEF FN": ["DEF FN f(parameters)=expression", "Define a single-letter numeric or string function.",9],
  DIM: ["DIM a(dimensions) | DIM a$(dimensions,length)", "Allocate an array; strings use a final character-length dimension.",12],
  DRAW: ["DRAW [colour controls;] dx,dy[,angle]", "Draw a line or arc relative to the graphics position.",17],
  ERASE: ["ERASE filename", "Request extension file deletion.",22],
  FLASH: ["FLASH value", "Select flashing, steady or unchanged display attributes.",16],
  FOR: ["FOR letter=start TO limit [STEP increment]", "Initialize a numeric loop control variable.",4],
  FORMAT: ["FORMAT name", "Request extension formatting.",22],
  "GO SUB": ["GO SUB line", "Enter a subroutine and retain a return address.",5],
  "GO TO": ["GO TO line", "Transfer execution to a numeric line target.",3],
  IF: ["IF condition THEN statements", "Execute the remaining line when the numeric condition is nonzero.",3],
  INK: ["INK colour", "Set the foreground colour parameter.",16],
  INPUT: ["INPUT items", "Read assignable targets with optional display items and LINE input.",15],
  INVERSE: ["INVERSE value", "Select normal or inverted character rendering.",16],
  LET: ["LET target=expression", "Assign a variable, array element or string slice.",2],
  LIST: ["LIST [line] | LIST #stream[,line]", "List BASIC from an optional starting line or to a stream.",2],
  LLIST: ["LLIST [line] | LLIST #stream[,line]", "List BASIC using printer-oriented output defaults.",21],
  LOAD: ["LOAD filename [DATA a() | SCREEN$ | CODE [start[,length]]]", "Load a program or a selected cassette data form.",20],
  LPRINT: ["LPRINT [items]", "Print items using the printer output stream.",21],
  MERGE: ["MERGE filename", "Combine a cassette BASIC program with stored lines.",20],
  MOVE: ["MOVE source,destination", "Request extension data movement.",22],
  NEW: ["NEW", "Remove the current BASIC program and variables.",2],
  NEXT: ["NEXT letter", "Advance a FOR control variable and test its limit.",4],
  "OPEN #": ["OPEN #stream,channel", "Connect a stream to a named channel.",22],
  OUT: ["OUT port,value", "Write a byte to an I/O port.",23],
  OVER: ["OVER value", "Select replacement or exclusive-or drawing.",16],
  PAPER: ["PAPER colour", "Set the background colour parameter.",16],
  PAUSE: ["PAUSE frames", "Wait in display frames; zero waits for a key.",18],
  PLOT: ["PLOT [colour controls;] x,y", "Mark a display pixel and set the graphics position.",17],
  POKE: ["POKE address,value", "Store a byte at a memory address.",24],
  PRINT: ["PRINT [items]", "Output expressions, separators and positioning or colour controls.",15],
  RANDOMIZE: ["RANDOMIZE [seed]", "Initialize the random-number generator.",11],
  READ: ["READ target[,target...]", "Assign values from the DATA expression stream.",6],
  REM: ["REM text", "Retain the rest of the physical line as uninterpreted data.",2],
  RESTORE: ["RESTORE [line]", "Reset the position used by READ.",6],
  RETURN: ["RETURN", "Continue after the most recent GO SUB.",5],
  RUN: ["RUN [line]", "Clear variables and begin execution at an optional line.",2],
  SAVE: ["SAVE filename [LINE line | DATA a() | SCREEN$ | CODE start,length]", "Write a program or selected data form to cassette.",20],
  STOP: ["STOP", "Stop BASIC execution with a report.",2],
  VERIFY: ["VERIFY filename [DATA a() | SCREEN$ | CODE [start[,length]]]", "Compare cassette data with current memory.",20]
};
const functions: Readonly<Record<string, readonly [string, number]>> = {
  ABS:["Return the unsigned magnitude.",9], ACS:["Return the inverse cosine in radians.",10], ASN:["Return the inverse sine in radians.",10], ATN:["Return the inverse tangent in radians.",10],
  ATTR:["Read a character cell's encoded display attributes.",16], "CHR$":["Construct a character from its numeric code.",14], CODE:["Read the first character code, or zero for an empty string.",14], COS:["Compute the cosine of a radian angle.",10], EXP:["Compute e raised to the argument.",10],
  IN:["Read a byte from an I/O port.",23], "INKEY$":["Read one currently pressed key, or an empty string.",18], INT:["Round down to an integer.",9], LEN:["Count characters in a string.",9], LN:["Compute the natural logarithm.",10],
  PEEK:["Read a byte from memory.",24], PI:["Return the ROM approximation of pi.",10], POINT:["Read a display pixel's ink/paper state.",17], RND:["Obtain the next pseudo-random fraction.",11], "SCREEN$":["Read a recognized screen character, or an empty string.",15],
  SGN:["Return minus one, zero or one according to sign.",9], SIN:["Compute the sine of a radian angle.",10], SQR:["Compute the nonnegative square root.",9], "STR$":["Convert a number to its printed string form.",9], TAN:["Compute the tangent of a radian angle.",10],
  USR:["Call machine code, or find a UDG address from a string.",14], VAL:["Evaluate a string as a numeric BASIC expression.",9], "VAL$":["Evaluate a string as a string-valued BASIC expression.",9]
};
const other: Readonly<Record<string, readonly [string, string, number]>> = {
  FN:["FN f(arguments)","Call a user-defined function; parentheses are required even with no arguments.",9],
  AT:["AT row,column","Position subsequent display output.",15], TAB:["TAB column","Advance output to a tab position.",15],
  BIN:["BIN binary-digits","Write a numeric literal in binary notation.",23], NOT:["NOT expression","Return one for zero and zero for nonzero.",13],
  AND:["value AND condition","Select a numeric or string value using a numeric condition.",13], OR:["value OR condition","Perform numeric conditional selection.",13],
  "<=":["left<=right","Compare matching numeric or string values.",13], ">=":["left>=right","Compare matching numeric or string values.",13], "<>":["left<>right","Test inequality of matching numeric or string values.",13],
  THEN:["IF condition THEN statements","Separate an IF condition from its line tail.",3], TO:["start TO end","Separate a FOR limit or string-slice bounds.",4], STEP:["STEP increment","Specify a FOR loop increment.",4], LINE:["INPUT LINE target | SAVE filename LINE line","Select line input or program autostart metadata.",15]
};
const signatures = new Map(BUILTIN_SIGNATURES.map((item) => [item.token.spelling, item]));
export const LANGUAGE_HELP: readonly LanguageHelpEntry[] = Object.freeze(ROM_TOKENS.map((token) => {
  const signature = signatures.get(token.spelling);
  const row = commands[token.spelling] ?? other[token.spelling];
  const functionRow = functions[token.spelling];
  if (row === undefined && (signature === undefined || functionRow === undefined)) throw new Error(`Missing help for ${token.spelling}`);
  const chapter = row?.[2] ?? functionRow![1];
  const parameters = signature?.arguments.map((type, index) => Object.freeze({ label: signature.arguments.length === 2 ? token.spelling === "POINT" ? ["x", "y"][index]! : ["row", "column"][index]! : "expression", type }));
  const syntax = row?.[0] ?? token.spelling + (signature!.arguments.length === 0 ? "" : signature!.arguments.length === 2 ? `(${parameters!.map((item) => item.label).join(",")})` : " expression");
  const required = commandAvailability(token.spelling)?.requiredCapability;
  return Object.freeze({ token, summary: row?.[1] ?? functionRow![0], syntax: Object.freeze([syntax]), links: Object.freeze([Object.freeze({label:`Sinclair BASIC manual, chapter ${chapter}`,url:manual(chapter)})]), ...(signature === undefined ? {} : { parameters: Object.freeze(parameters!), resultType: signature.result }), ...(required === undefined ? {} : { remarks: Object.freeze(["Requires Interface 1 or a compatible extension; syntax shown is the supported ROM operand shape."]) }) });
}));
const byByte = new Map(LANGUAGE_HELP.map((entry) => [entry.token.byte, entry]));
export function languageHelp(spelling: string): LanguageHelpEntry | undefined {
  const token = romTokenBySpelling(spelling);
  return token === undefined ? undefined : byByte.get(token.byte);
}
