import {writeFileSync} from 'node:fs';
const [mode,ready]=process.argv.slice(2);
if(mode==='failure') {process.stderr.write('fixture runtime failure\n');process.exit(7);}
if(mode==='success') process.exit(0);
if(mode==='ignore-stop') process.on('SIGTERM',()=>{});
if(ready) writeFileSync(ready,'ready');
setInterval(()=>{},1000);
