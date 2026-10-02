import './validate.mjs';
import {cp,mkdir,rm} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('dist/',root);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['index.html','app.js','styles.css','assets','data','docs'])await cp(new URL(name,root),new URL(name,out),{recursive:true});
await cp(new URL('.nojekyll',root),new URL('.nojekyll',out));
console.log('Static output ready in dist/. No bundler, runtime dependency, backend or secrets.');
