import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8967);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
http.createServer(async(req,res)=>{try{
 let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({app:'Van Gogh Strike',version:'8.1.0'}));return;}
 if(url.endsWith('/'))url+='index.html';
 const file=path.resolve(root,'.'+url);if(!file.startsWith(root+path.sep))throw Error('Bad path');
 const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Van Gogh Strike is running at http://127.0.0.1:${port}`));
