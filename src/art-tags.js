/** Original graphic homages, not reproductions of artworks or artist signatures.
 * Historical references and later-career allusions: docs/ARTIST-TAGS.md.
 */
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const path=(d,fill,stroke='none',width=0)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ink='#172d39',paper='#fff0cd';
const tags=[
 ['Vincent van Gogh','sunflower','Sunflower',['#efb93d','#c67a26','#417e68'],()=>{
  let s=path('M123 224 Q147 175 127 129 M136 190 Q82 202 83 163 Q116 157 136 190 M137 175 Q180 171 175 141 Q148 146 137 175','#427e65',ink,5);
  for(let i=0;i<13;i++){const a=i*360/13;s+=`<path d="M128 109 Q94 73 121 27 Q151 65 139 107Z" fill="${i%2?'#efb83a':'#ffd56b'}" stroke="${ink}" stroke-width="4" transform="rotate(${a} 128 108)"/>`;}
  s+=circle(128,108,36,'#925128')+path('M108 108 C102 79 150 78 151 108 C152 132 114 134 117 110 C118 98 136 100 135 112','none','#f7c04c',7);return s;}],
 ['Paul Gauguin','red_tree','Crimson vision',['#c95048','#e79861','#2a3839'],()=>path('M41 38 204 29 222 209 47 224 29 102Z','#c95048',paper,5)+path('M37 225 Q91 160 130 98 Q147 60 174 23 L195 24 Q164 71 150 104 L218 82 224 96 151 123 Q120 176 72 228Z','#283b38')+path('M109 158 Q76 124 44 110 L40 93 Q95 115 125 137Z','#283b38')+path('M67 197 86 182 98 202 80 213Z M167 183 181 164 200 190 177 204Z','#efbf83')],
 ['Paul Cézanne','mountain_apple','Mountain & apple',['#809fa8','#b8c2a1','#e29443'],()=>path('M26 168 119 53 159 106 179 89 235 171Z','#7c9fa6',ink,5)+path('M119 53 99 132 151 111 179 89 153 156 233 171 67 164Z','#b1bf9f')+path('M66 211 Q38 188 50 164 Q68 145 88 160 Q111 143 128 162 Q145 188 114 215 Q89 226 66 211Z','#de8940',ink,5)+path('M86 158 Q81 137 104 125','none','#605c38',7)+path('M90 143 Q119 124 137 137 Q116 157 90 143Z','#5d865c')],
 ['Georges Seurat','dot_sun','Divided sunlight',['#efb553','#65a5b5','#d57965'],()=>{
  let s=circle(128,124,79,ink);for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){if(row*row+col*col>18)continue;s+=circle(128+col*17,124+row*17,6.8,(row+col)%3===0?'#7ebbc2':(row-col)%2?'#e79268':'#f3ca71');}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;s+=circle((128+99*Math.cos(a)).toFixed(1),(124+99*Math.sin(a)).toFixed(1),8,i%2?'#78b8c5':'#f5be55');}return s;}],
 ['Paul Signac','dotted_sail','Colour under sail',['#65bccc','#ed9d5a','#fff0cd'],()=>{
  let s=path('M41 177 209 177 181 201 75 201Z','#285c80',paper,5)+path('M127 41 127 168 50 166Z',paper,ink,5)+path('M140 67 207 161 140 161Z','#e98958',ink,5)+path('M130 38 130 187','none',ink,6);
  for(let y=86;y<160;y+=20)for(let x=116-(y-65)*.53;x<124;x+=16)s+=circle(x,y,4.7,(x+y)%3>1?'#68afbd':'#e7b752');
  return s+path('M40 216 Q72 204 101 217 T157 217 T218 212','none','#80c9cb',7);}],
 ['Henri de Toulouse-Lautrec','poster_star','The cabaret star',['#e6bc66','#cf645b','#24313b'],()=>path('M52 30 206 38 198 222 42 213Z','#e8bd6a',paper,5)+path('m187 43 9 19 21 2-16 14 4 21-18-10-18 10 4-21-16-14 21-2Z','#c64f48')+circle(117,76,13,ink)+path('M98 59 131 58 135 65 89 66Z',ink)+path('M108 93 128 90 139 126 192 107 205 114 143 146 107 136 65 159 48 153 93 123Z',ink)+path('M109 134 88 169 122 166 104 206 123 209 138 160 130 133Z',ink)],
 ['Claude Monet','lily_bridge','Water-lily bridge',['#70aa8f','#96b7d1','#efa7b6'],()=>path('M30 144 Q128 42 226 144 L220 158 Q128 70 36 158Z','#638d65',paper,5)+path('M42 139 42 110 M77 115 77 86 M111 104 111 77 M147 104 147 77 M180 116 180 88 M212 140 212 114 M40 111 Q128 42 214 114','none','#2d695d',7)+path('M35 181 Q80 164 124 180 T222 181 M51 207 Q106 193 197 208','none','#a1c3d7',7)+path('M83 182 Q105 151 131 182 Q123 191 83 182 M156 211 Q179 181 206 209 Q197 219 156 211','#6dac84')+path('M104 180 Q81 164 95 147 Q105 151 108 164 Q111 137 124 144 Q136 157 120 173 Q145 155 146 174 Q129 187 104 180Z','#eca9bb',ink,3)],
 ['Pierre-Auguste Renoir','umbrella','Paris in the rain',['#648eac','#e3b575','#d6886c'],()=>path('M38 122 Q50 46 124 46 Q202 50 220 130 Q195 113 171 132 Q149 113 125 128 Q103 110 82 127 Q60 110 38 122Z','#618dab',paper,5)+path('M124 46 Q82 61 82 127 Q103 110 125 128 Q144 109 171 132 Q168 74 124 46Z','#c4b993',ink,3)+path('M127 39 127 183 Q129 218 107 218 Q89 218 91 199','none','#dfac6f',10)+path('M41 164 34 179 M70 197 63 211 M186 162 177 181 M217 186 211 199','none','#88b8c7',5)],
 ['Edgar Degas','ballet_ribbon','Ballet ribbons',['#e9b2a6','#9697bc','#e6d3b7'],()=>path('M91 107 Q57 125 73 191 Q80 218 98 211 Q123 200 118 151 L111 112Z','#dca99d',paper,5)+path('M146 101 Q117 122 131 181 Q141 218 160 207 Q184 190 166 127 L158 107Z','#baa5b7',paper,5)+path('M92 117 Q89 167 96 194 M144 113 Q146 160 155 192','none','#82597b',5)+path('M101 119 C62 53 78 31 121 75 C158 18 184 54 143 109 M121 75 Q145 106 186 82 M121 75 Q94 105 62 92','none','#f0d6b8',9)],
 ['Berthe Morisot','butterfly','The butterfly hunt',['#e1b2b0','#7aa58b','#d8cf92'],()=>path('M124 137 C78 18 21 43 46 123 Q58 154 113 151 C55 146 58 205 104 194 Q126 181 128 151 C141 218 196 202 194 168 Q190 147 141 149 C241 150 233 42 183 52 Q151 67 132 136Z','#d9a4ae',paper,5)+path('M114 131 Q63 70 60 93 Q64 124 114 137 M144 134 Q198 70 203 88 Q208 128 144 139Z','#86a994')+path('M123 137 134 154 M126 138 Q123 101 113 89 M132 139 Q144 108 154 99','none',ink,5)+path('M106 181 Q85 211 44 218','none','#cbd091',7)],
 ['Camille Pissarro','orchard','The orchard lane',['#729d68','#d9b46a','#d18054'],()=>path('M43 213 Q140 176 216 210 L213 226 42 226Z','#c2b579')+path('M116 218 Q153 192 153 155 L171 157 Q165 197 154 222Z','#e9d59b')+path('M71 194 75 99 M180 181 179 100 M129 167 128 65','none','#746044',10)+path('M36 121 Q20 91 53 73 Q71 47 97 69 Q128 74 113 111 Q109 139 78 132 Q43 145 36 121 M146 122 Q133 89 163 73 Q190 46 213 73 Q245 93 221 124 Q190 145 146 122 M96 76 Q78 47 104 30 Q132 15 153 37 Q181 50 159 79 Q125 100 96 76Z','#71935d',paper,4)+circle(63,95,7,'#dc9655')+circle(93,105,6,'#dfbb6e')+circle(121,51,7,'#dda65a')+circle(191,91,7,'#cd835a')+circle(204,115,6,'#e2b267')],
 ['Mary Cassatt','opera_glasses','A view from the loge',['#8faebf','#ddb98a','#ba7c87'],()=>path('M47 51 Q125 18 213 55 L200 211 Q128 187 52 218Z','#7e627c',paper,5)+path('M67 120 78 80 110 78 120 113 145 111 151 77 185 80 194 121 180 161 142 159 137 136 121 137 114 165 75 166Z','#d5b285',ink,6)+circle(95,141,25,ink)+circle(166,137,25,ink)+circle(95,141,16,'#7bb6c4')+circle(166,137,16,'#7bb6c4')+path('M86 134 94 130 M157 130 165 127','none',paper,5)+path('M177 170 Q202 211 171 222','none','#dfba8a',8)],
];

const escapeXML=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const group=(content,transform)=>`<g transform="${transform}">${content}</g>`;
const line=(d,color,width)=>path(d,'none',color,width);
const polygon=(points,fill,stroke='none',width=0)=>`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const oval=(x,y,rx,ry,fill,angle=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${angle} ${x} ${y})"/>`;
// Explicit lengths keep the lettering composed even when an OS substitutes a font.
// Typography is generated here; there are no external fonts, images or filters.
function lettering(label,x,y,width,size,{fill=paper,outline=ink,stroke=7,angle=0,anchor='middle',shadow=true}={}){
 const text=(dx,dy,color,edge,weight)=>`<text x="${x+dx}" y="${y+dy}" text-anchor="${anchor}" textLength="${width}" lengthAdjust="spacingAndGlyphs" font-family="Impact, Haettenschweiler, Arial Black, sans-serif" font-size="${size}" font-weight="900" letter-spacing="1" fill="${color}" stroke="${edge}" stroke-width="${weight}" paint-order="stroke fill" stroke-linejoin="round">${escapeXML(label)}</text>`;
 return group((shadow?text(4,5,ink,ink,stroke+2):'')+text(0,0,fill,outline,stroke),`rotate(${angle} ${x} ${y})`);
}
function speckle(cx,cy,rx,ry,colors,count=18,seed=1,radius=3){
 let s='';for(let i=0;i<count;i++){const t=i*2.399963229728653+seed,scale=Math.sqrt((i+.4)/count);s+=circle((cx+Math.cos(t)*rx*scale).toFixed(2),(cy+Math.sin(t)*ry*scale).toFixed(2),(radius+(i%3)*.8).toFixed(1),colors[i%colors.length]);}return s;
}
const fullTags={
 sunflower:{taunt:'STILL BLOOMING',draw(){
  let s=path('M22 137 Q59 31 172 30 Q278 6 400 62 L478 119 459 185 490 232 450 295 474 351 423 435 328 460 290 485 207 461 110 477 80 423 25 389 44 310 11 248Z','#274d65',paper,7);
  s+=line('M79 107 C98 61 176 57 164 96 C153 127 121 119 134 100 M297 62 C354 41 438 85 406 116 C380 139 344 112 369 103 M355 234 C417 179 475 248 425 278 C390 302 347 274 375 256','#679da7',16);
  s+=line('M53 173 Q67 145 84 136 M428 156 453 173 M373 320 Q431 305 447 289','#e8b751',11);
  s+=path('M215 391 Q255 286 216 227 M239 337 Q288 273 358 300 Q340 367 239 354 M232 331 Q144 351 115 300 Q173 274 232 331','#56805a',ink,7);
  s+=line('M239 341 331 311 M216 326 143 309','#aac283',5);
  for(let i=0;i<17;i++){const a=i*360/17;s+=group(path('M207 171 Q166 125 187 64 L208 92 226 62 Q249 117 228 171Z',i%3===0?'#c67a26':i%2?'#efb93d':'#ffdb75',ink,5)+line('M211 158 210 106','#a5652b',4),`rotate(${a} 218 196)`);}
  s+=circle(218,196,67,'#98552e')+circle(218,196,54,'#573d2e')+speckle(218,196,48,47,['#e3a545','#b47430','#f1c96c'],33,2,3);
  s+=line('M198 215 C169 173 239 150 246 190 C257 222 213 239 207 212 C201 195 227 187 227 206','#e8b850',7);
  s+=lettering('STILL',382,168,156,75,{angle:10,fill:'#efb93d'});
  s+=path('M35 383 466 343 482 431 58 484 34 456Z',ink,paper,5)+lettering('BLOOMING',258,432,417,76,{angle:-6,fill:'#ffd16b',stroke:3});
  return s+line('M83 468 117 464 M353 449 434 440','#efb93d',7);
 }},
 red_tree:{taunt:'YOUR REALITY NEEDS WORK',draw(){
  let s=polygon('42,46 451,27 473,164 455,245 485,430 358,469 151,457 36,477 24,347 48,224 20,121','#c95048',paper,8);
  s+=polygon('38,88 231,69 298,130 185,232 31,244','#e79861');
  s+=path('M26 462 Q188 292 260 178 Q318 103 403 25 L454 30 Q354 132 326 181 L457 131 470 164 314 216 Q231 340 108 472Z','#2a3839');
  s+=path('M243 265 Q163 194 49 186 L43 156 Q174 161 271 225Z','#2a3839');
  s+=path('M151 183 Q94 83 39 111 Q41 173 151 183 M327 175 Q417 59 449 95 Q468 157 327 175','#809066',ink,5);
  s+=line('M72 137 145 177 M418 112 339 164','#efbc83',5);
  s+=oval(192,280,24,30,'#ecb86d',-20)+oval(403,283,30,26,'#e79861',17)+line('M195 254 201 240 M404 259 412 244',ink,5);
  s+=lettering('YOUR REALITY',231,109,357,52,{fill:ink,outline:'#e79861',stroke:3,angle:-3,shadow:false});
  s+=lettering('NEEDS',156,352,211,68,{angle:-7,fill:'#efbf83'});
  s+=lettering('WORK',334,448,264,101,{angle:6,fill:paper});
  return s+line('M63 407 153 393 M370 205 428 180','#efbf83',7)+circle(87,296,9,'#efbf83')+circle(437,323,7,ink);
 }},
 mountain_apple:{taunt:'STILL LIFE. YOUR MOVE.',draw(){
  let s=polygon('41,89 397,30 451,114 434,296 481,447 141,476 24,405 53,270','#ece1ba',ink,7);
  s+=polygon('52,106 218,61 196,216 32,251','#b8c2a1')+polygon('205,76 397,43 443,157 325,220','#809fa8');
  s+=polygon('29,283 218,83 293,170 341,135 466,291','#6c8f9a',ink,7);
  s+=polygon('218,83 192,217 278,170 341,135 307,250 463,291 80,283','#b8c2a1');
  s+=polygon('218,83 230,156 202,189 192,217 169,226','#e8d4a2')+polygon('311,205 341,135 354,176 401,239','#52788a');
  s+=line('M45 308 373 292 M118 283 137 252 M351 270 378 275','#dca767',10);
  s+=polygon('52,322 406,288 474,441 144,467 32,402','#b59869',ink,5)+polygon('231,314 389,302 431,418 256,442 190,389','#f3e6c8');
  s+=path('M76 373 Q51 316 96 296 Q130 280 160 299 Q189 278 222 305 Q252 346 211 390 Q190 418 145 408 Q103 425 76 373Z','#e29443',ink,7);
  s+=path('M151 305 Q145 270 181 253','none','#615939',9)+path('M157 281 Q189 247 222 266 Q209 292 157 281Z','#698257',ink,4);
  s+=path('M90 332 Q91 310 117 311 L133 379 Q105 386 90 354Z','#f0bf64');
  s+=lettering('STILL LIFE.',266,118,336,69,{angle:-8,fill:paper});
  s+=lettering('YOUR MOVE.',274,463,377,67,{angle:-5,fill:'#efc774'});
  return s;
 }},
 dot_sun:{taunt:'POINT TAKEN',draw(){
  let s=path('M58 80 Q158 16 294 47 L424 34 464 137 441 248 483 375 397 448 209 478 50 422 32 277 56 197Z',ink,paper,7);
  // Large separate colour marks carry the technique; their scale survives wall distance.
  const colors=['#efb553','#65a5b5','#d57965','#fff0cd'];
  for(let y=81,row=0;y<431;y+=22,row++)for(let x=67,col=0;x<450;x+=22,col++){
   const distance=Math.hypot(x-257,y-252);if(distance<194&&!(x<109&&y<123))s+=circle(x+(row%2)*7,y,6+(row+col)%3,colors[(row*3+col)%4]);
  }
  s+=circle(261,252,123,ink)+circle(261,252,108,'#efb553')+speckle(261,252,93,92,['#d57965','#65a5b5','#fff0cd'],58,5,5);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;s+=circle(261+146*Math.cos(a),252+146*Math.sin(a),9,colors[i%4]);}
  s+=path('M26 82 414 48 428 159 41 188Z',ink,paper,5)+lettering('POINT',225,145,341,107,{angle:-5,fill:'#efb553'});
  s+=path('M98 350 475 324 482 432 101 476 76 432Z',ink,paper,5)+lettering('TAKEN',283,431,336,104,{angle:-5,fill:'#65a5b5'});
  return s+circle(63,458,13,'#d57965')+circle(41,434,7,'#efb553');
 }},
 dotted_sail:{taunt:'EAT MY WAKE',draw(){
  let s=path('M29 385 Q120 306 144 245 L230 35 295 63 331 196 448 269 486 334 460 418 355 470 137 478 39 448Z','#eddfbb',ink,7);
  s+=path('M28 371 C123 279 188 296 252 337 S383 396 466 293 L486 381 Q428 463 342 455 C221 435 176 383 91 443 L39 444Z','#65bccc',ink,6);
  s+=path('M47 405 C112 354 173 337 237 376 S377 434 451 376','none','#285c80',18)+line('M77 437 Q153 393 226 421 T430 428','#fff0cd',8);
  s+=path('M228 66 221 318 78 292Z',paper,ink,7)+path('M244 101 416 310 245 315Z','#ed9d5a',ink,7);
  for(let row=0;row<7;row++)for(let col=0;col<7;col++){const y=158+row*20,x=206-col*17;if(x>228-(y-66)*.56)s+=circle(x,y,5.5,row%2?'#65bccc':'#e0b66b');}
  s+=line('M231 54 230 339',ink,8)+path('M89 323 414 334 366 369 154 369Z','#285c80',paper,5);
  s+=line('M260 159 331 260 M280 276 363 301','#f9d39d',9);
  s+=lettering('EAT MY',337,119,262,66,{angle:9,fill:'#ed9d5a'});
  s+=lettering('WAKE',255,440,353,112,{angle:-8,fill:paper});
  return s+speckle(419,391,50,29,['#65bccc','#fff0cd','#ed9d5a'],12,4,4);
 }},
 poster_star:{taunt:"YOU'RE THE WARMUP",draw(){
  let s=polygon('51,25 463,57 438,156 475,229 434,466 81,481 95,394 38,316 63,168','#e6bc66',ink,8);
  s+=polygon('69,51 444,79 427,174 55,146','#24313b')+polygon('97,366 447,328 434,447 74,466','#cf645b',ink,5);
  s+=polygon('304,107 335,196 432,168 373,251 450,318 347,314 323,391 276,317 188,343 216,260 153,204 245,199','#cf645b',ink,7);
  s+=circle(265,191,20,paper)+path('M233 164 281 162 291 172 223 177Z',ink);
  s+=path('M246 217 279 210 301 260 392 235 418 247 306 297 243 276 167 324 136 316 219 260Z',ink);
  s+=path('M247 279 214 340 260 333 233 387 263 391 287 323 278 282Z',paper,ink,6);
  s+=path('M114 298 132 321 136 357 113 391 96 382 111 351 105 327Z',ink);
  s+=lettering("YOU'RE THE",254,129,340,67,{angle:4,fill:'#e6bc66',stroke:2});
  s+=lettering('WARMUP',264,427,362,86,{angle:-6,fill:paper});
  return s+line('M351 136 377 105 M386 172 421 160 M144 215 161 238',ink,8);
 }},
 lily_bridge:{taunt:'OUT OF FOCUS',draw(){
  let s=path('M44 106 C18 77 67 59 110 65 L153 39 220 54 287 33 356 64 424 53 451 92 477 160 447 209 479 286 446 354 469 404 405 450 314 449 249 477 169 451 81 467 39 407 60 346 28 289 49 217 25 166Z','#355d63',paper,7);
  for(const [y,color,w] of [[106,'#96b7d1',21],[154,'#70aa8f',26],[207,'#87b6b0',17],[253,'#96b7d1',21],[311,'#70aa8f',27],[351,'#769fac',14],[407,'#96b7d1',24]])s+=line(`M63 ${y} Q180 ${y-22} 266 ${y+3} T446 ${y-7}`,color,w);
  s+=path('M46 246 Q241 67 459 219 L454 246 Q241 107 51 275Z','#70aa8f',ink,7);
  s+=line('M62 225 63 181 M120 183 121 132 M185 155 185 107 M252 151 252 99 M320 158 320 107 M384 183 384 133 M438 219 438 167','#c2d7b1',9)+line('M62 181 Q245 21 439 167','#70aa8f',14);
  s+=oval(139,333,66,23,'#70aa8f',-7)+oval(365,340,67,20,'#54795f',5)+oval(276,424,77,19,'#54795f',-3);
  s+=path('M135 333 Q90 300 107 279 Q130 283 143 309 Q147 264 167 276 Q185 295 160 324 Q208 292 203 319 Q187 343 135 333Z','#efa7b6',ink,4);
  s+=line('M94 368 161 365 M338 364 399 365 M192 442 330 442','#c6d9d5',6);
  s+=lettering('OUT OF',243,121,323,84,{angle:-3,fill:'#cfe4d2'});
  s+=lettering('FOCUS',279,434,332,111,{angle:4,fill:'#efa7b6'});
  return s;
 }},
 umbrella:{taunt:'THROWING BETTER SHADE',draw(){
  let s=path('M31 243 Q29 63 216 30 Q426 15 482 235 Q440 191 395 228 Q351 190 304 228 Q257 187 213 227 Q167 187 122 228 Q75 192 31 243Z','#648eac',paper,8);
  s+=path('M217 31 Q110 76 122 228 Q167 187 213 227 Q255 190 304 228 Q308 95 217 31Z','#e3b575',ink,5)+path('M217 31 Q389 41 395 228 Q351 190 304 228 Q308 95 217 31Z','#7c929c',ink,5);
  s+=line('M217 24 236 359 Q242 417 197 434 Q159 446 147 410','#e3b575',19)+line('M222 245 231 343',paper,4);
  s+=path('M60 293 460 270 448 444 78 466Z','#233b4b',paper,6);
  s+=lettering('THROWING',259,151,338,67,{angle:-5,fill:paper});
  s+=lettering('BETTER',262,339,312,71,{angle:-3,fill:'#e3b575'});
  s+=lettering('SHADE',262,423,352,106,{angle:-3,fill:'#d6886c'});
  return s+line('M57 264 42 286 M87 481 77 493 M482 279 471 307 M42 347 28 371 M453 462 447 481','#88b8c7',9);
 }},
 ballet_ribbon:{taunt:'MIND YOUR TURNOUT',draw(){
  let s=path('M77 52 394 34 417 131 479 190 438 275 465 382 408 461 95 478 66 396 22 330 65 230 35 152Z','#e6d3b7',ink,7);
  s+=path('M50 147 385 84 457 180 113 282Z','#9697bc')+path('M69 378 429 268 444 409 107 455Z','#d8a596');
  s+=line('M69 156 C175 26 269 78 237 175 C192 304 121 362 178 427 C230 486 399 385 393 285 C389 187 274 137 251 219 C225 308 331 372 375 323','#825b7b',20);
  s+=line('M69 156 C175 26 269 78 237 175 C192 304 121 362 178 427 C230 486 399 385 393 285 C389 187 274 137 251 219 C225 308 331 372 375 323','#f3d8c5',10);
  // A single graceful figure is the focal point; the ribbons create the larger gesture.
  s+=circle(289,168,20,ink)+path('M285 193 Q260 222 245 260 L283 279 316 232 321 195Z','#e9b2a6',ink,6);
  s+=path('M248 247 220 268 218 291 Q275 314 323 277 L287 251Z','#f4e2c9',ink,5);
  s+=line('M284 208 Q246 184 217 153 M307 211 Q345 177 341 138',ink,11)+line('M249 293 225 345 184 361 M282 295 308 341 362 325',ink,11);
  s+=lettering('MIND YOUR',248,104,347,64,{angle:-4,fill:'#e9b2a6'});
  s+=path('M39 398 466 366 474 438 69 485Z',ink,paper,5)+lettering('TURNOUT',259,439,388,83,{angle:-5,fill:'#e6d3b7',stroke:2});
  return s;
 }},
 butterfly:{taunt:"CAN'T PIN ME DOWN",draw(){
  let s=path('M100 78 413 42 452 328 411 440 59 458 39 316Z','#7aa58b',ink,6)+path('M90 81 398 58 427 345 398 422 79 441 57 322Z','#ecdfba');
  s+=line('M68 344 Q119 332 129 267 M368 425 Q348 377 399 322 M97 215 Q52 156 71 113','#7aa58b',17);
  s+=path('M241 264 C189 99 61 76 66 193 Q64 280 228 284 C117 245 104 359 183 365 Q241 365 245 291 C271 407 389 340 350 292 Q328 266 269 284 C416 278 492 133 389 105 Q306 100 253 253Z','#e1b2b0',ink,7);
  s+=path('M223 254 C162 170 111 131 101 182 Q99 232 223 269 M274 254 C361 143 416 134 418 171 Q414 221 274 269Z','#7aa58b');
  s+=path('M205 305 Q145 284 147 325 Q157 350 210 321 M278 306 Q327 281 332 310 Q321 338 278 326Z','#d8cf92');
  s+=line('M240 260 253 293 M244 261 Q237 208 217 189 M252 262 Q274 211 296 196',ink,9);
  s+=line('M363 268 Q432 235 473 188 M367 274 Q449 276 476 243','#7aa58b',5);
  s+=lettering("CAN'T PIN",235,118,335,63,{angle:-6,fill:'#e1b2b0'});
  s+=path('M29 378 433 346 461 435 59 483Z','#7aa58b',ink,5)+lettering('ME DOWN',245,437,374,80,{angle:-6,fill:paper});
  return s;
 }},
 orchard:{taunt:'RIPE FOR DEFEAT',draw(){
  let s=path('M47 113 Q87 45 174 62 L278 34 410 71 468 135 446 273 482 387 440 461 66 475 33 387 54 280 23 221Z','#e4d49e',ink,7);
  s+=polygon('49,291 266,232 456,283 477,431 425,467 61,460 36,379','#729d68');
  s+=path('M195 473 264 254 277 254 308 469Z','#d9b46a')+line('M94 446 240 280 M422 443 299 278','#9da96a',11);
  const tree=(x,y,scale)=>group(line('M0 139 0 49 M0 91 -30 64 M0 105 33 72','#725638',12)+path('M-64 63 Q-73 23 -37 8 Q-22 -24 17 -16 Q55 -21 69 13 Q93 45 58 70 Q27 100 1 80 Q-43 93 -64 63Z','#729d68',ink,5)+speckle(2,37,54,40,['#d9b46a','#fff0cd','#d18054'],16,7,4),`translate(${x} ${y}) scale(${scale})`);
  s+=tree(135,135,1.35)+tree(371,162,1.06)+tree(278,177,.66);
  s+=path('M46 376 Q36 335 76 322 Q112 310 135 334 Q177 315 195 345 Q222 382 178 416 Q133 442 109 424 Q66 440 46 376Z','#d18054',ink,7)+line('M119 337 Q116 309 142 294',ink,8)+path('M128 320 Q151 291 179 307 Q169 329 128 320Z','#729d68',ink,4);
  s+=lettering('RIPE FOR',257,116,348,72,{angle:-3,fill:'#d9b46a'});
  s+=path('M111 374 464 354 474 439 134 478Z',ink,paper,5)+lettering('DEFEAT',289,439,319,93,{angle:-4,fill:'#d9b46a',stroke:2});
  return s;
 }},
 opera_glasses:{taunt:'SEEN ENOUGH',draw(){
  let s=path('M33 56 Q252 11 472 61 L462 409 418 475 84 474 42 421Z','#ba7c87',ink,8);
  s+=path('M42 70 Q96 69 128 90 Q109 216 72 247 L48 412 38 319Z','#77536c')+path('M470 70 Q416 62 382 91 Q409 223 446 247 L464 411 479 291Z','#77536c');
  s+=path('M100 85 Q253 40 409 89 L404 352 Q255 315 108 361Z','#ddb98a',ink,5);
  s+=path('M97 194 132 136 206 138 222 201 275 198 301 138 374 133 414 187 401 288 324 319 272 267 233 269 193 318 113 291Z','#ddb98a',ink,9);
  s+=circle(168,254,72,ink)+circle(342,247,72,ink)+circle(168,254,56,'#8faebf')+circle(342,247,56,'#8faebf');
  s+=path('M125 251 Q149 213 190 230 Q208 264 184 285 Q146 288 125 251 M299 244 Q322 206 364 223 Q382 257 358 278 Q320 281 299 244Z','#547d8c');
  s+=line('M139 232 163 220 M313 225 337 213',paper,10)+line('M224 232 285 228',ink,19);
  s+=path('M355 296 Q412 341 391 377 Q376 398 353 385','none','#ddb98a',11)+path('M44 369 Q253 317 468 369 L452 424 Q252 387 64 437Z','#77536c',paper,5);
  s+=lettering('SEEN',250,128,307,90,{angle:1,fill:paper});
  s+=lettering('ENOUGH',256,432,389,94,{angle:-2,fill:'#ddb98a'});
  return s;
 }},
};
function svgDocument(size,title,body){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"><title>${escapeXML(title)}</title><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;}
export const ARTIST_TAGS=Object.freeze(tags.map(([artist,id,name,palette,draw])=>{
 const full=fullTags[id],compactSVG=svgDocument(256,name,draw());
 return Object.freeze({artist,id,name,palette,taunt:full.taunt,svg:svgDocument(512,`${name} — ${full.taunt}`,full.draw()),compactSVG,stampSVG:compactSVG});
}));
const byArtist=Object.fromEntries(ARTIST_TAGS.map(tag=>[tag.artist,tag]));
const byId=Object.fromEntries(ARTIST_TAGS.map(tag=>[tag.id,tag]));
export function getArtistTag(artist){const key=typeof artist==='string'?artist:artist?.artistName||artist?.identity?.name||artist?.name;return byArtist[key]||byId[key]||ARTIST_TAGS[0];}
const dataCache=new Map();
export function tagDataURI(artist,variant='full'){
 const tag=getArtistTag(artist),compact=variant==='compact'||variant==='stamp',key=`${tag.id}:${compact?'compact':'full'}`;
 if(!dataCache.has(key))dataCache.set(key,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(compact?tag.compactSVG:tag.svg));
 return dataCache.get(key);
}
