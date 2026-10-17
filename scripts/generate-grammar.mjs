import {writeFileSync} from 'node:fs';
import {createTextMateGrammar} from './extension/grammar.mjs';
writeFileSync(new URL('../packages/extension/syntaxes/zx-spectrum-basic.tmLanguage.json',import.meta.url),JSON.stringify(createTextMateGrammar(),null,2)+'\n');
