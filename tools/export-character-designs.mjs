import {writeFile,mkdir} from 'node:fs/promises';
import {FACTIONS} from '../src/factions.js';
await mkdir(new URL('../build/characters/',import.meta.url),{recursive:true});
const cast=FACTIONS.flatMap(f=>f.roster.map(a=>({id:a.design.id,name:a.shortName,fullName:a.name,team:f.id,role:a.role,look:a.look,signature:a.design.signature,silhouette:a.design.silhouette})));
await writeFile(new URL('../build/characters/designs.json',import.meta.url),JSON.stringify(cast,null,2));
console.log(`Exported ${cast.length} authored character profiles.`);
