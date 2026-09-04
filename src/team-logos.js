/** Original emblems for the game's fictional crews; not historical insignia. */
const wrap=(name,art)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><title>${name}</title>${art}</svg>`;
const rays=Array.from({length:32},(_,i)=>{const a=-Math.PI/2+i*Math.PI/16,r=i%4===0?47:i%2?34:41;return `${60+Math.cos(a)*r},${52+Math.sin(a)*r}`;}).join(' ');

export const TEAM_LOGOS=Object.freeze([
 Object.freeze({id:0,name:'The Yellow House',description:'An expressive sun over an Arles-inspired studio roof, finished with a paintbrush.',
  svg:wrap('The Yellow House',`
   <g stroke-linejoin="round" stroke-linecap="round">
    <polygon points="${rays}" fill="#edb742" stroke="#263b35" stroke-width="4"/>
    <circle cx="60" cy="52" r="29" fill="#ffdb79" stroke="#bc7c37" stroke-width="3"/>
    <path d="M49 35c-16 8-12 30 5 32 16 3 23-15 12-22-8-5-17 2-13 10" fill="none" stroke="#c48236" stroke-width="5"/>
    <path d="m34 81 52 1 3 32-53-1Z" fill="#eebd56" stroke="#263b35" stroke-width="6"/>
    <path d="m18 86 42-31 43 29-9 10-34-23-34 25Z" fill="#263b35" stroke="#fff0b1" stroke-width="3"/>
    <path d="m42 91 8-1v10h-8Zm15 5 12-1 1 19H57Zm19-6 7 1v9h-7Z" fill="#263b35"/>
    <path d="m82 109 20-46" fill="none" stroke="#263b35" stroke-width="12"/>
    <path d="m82 109 20-46" fill="none" stroke="#fff0b1" stroke-width="6"/>
    <path d="m98 66 6-15 11 5-7 15Z" fill="#c89344" stroke="#263b35" stroke-width="3"/>
    <path d="M104 51q-2-13 13-25 5 21-2 30Z" fill="#ffdf83" stroke="#263b35" stroke-width="4"/>
    <path d="m25 117 23 4 31-1 22-7" fill="none" stroke="#edb742" stroke-width="5"/>
   </g>`)}),
 Object.freeze({id:1,name:'The Independents',description:'An open painted frame, a brush escaping its edge, and a flash of light.',
  svg:wrap('The Independents',`
   <g stroke-linejoin="round" stroke-linecap="round">
    <path d="m89 18-65 8-8 75 79 12 17-49" fill="none" stroke="#16374c" stroke-width="20"/>
    <path d="m89 18-65 8-8 75 79 12 17-49" fill="none" stroke="#78cbdc" stroke-width="12"/>
    <path d="m78 24-48 6-7 65 65 10" fill="none" stroke="#b8edf0" stroke-width="3"/>
    <path d="m33 94 48-50 10 9-49 49Z" fill="#e8eee0" stroke="#16374c" stroke-width="5"/>
    <path d="m74 51 10-12 14 12-10 11Z" fill="#7bb5c5" stroke="#16374c" stroke-width="4"/>
    <path d="M84 39q3-17 24-19 1 20-10 31Z" fill="#b8edf0" stroke="#16374c" stroke-width="5"/>
    <path d="m96 33 4 7" fill="none" stroke="#5b9eb7" stroke-width="3"/>
    <path d="m111 4 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#f1f4d7"/>
    <path d="m10 112 8-3 3 9-8 4Z" fill="#78cbdc"/>
    <circle cx="105" cy="115" r="4" fill="#78cbdc"/>
   </g>`)}),
]);

export function getTeamLogo(team=0){return TEAM_LOGOS[typeof team==='object'?team?.id:Number(team)]||TEAM_LOGOS[0];}
export function teamLogoSVG(team){return getTeamLogo(team).svg;}
const dataCache=new Map();
export function teamLogoDataURI(team){const logo=getTeamLogo(team);if(!dataCache.has(logo.id))dataCache.set(logo.id,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(logo.svg));return dataCache.get(logo.id);}
