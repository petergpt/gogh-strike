import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CHARACTER_DESIGNS} from './character-designs/index.js';
import {refinePortraitMaterial} from './character-lighting.js';
import {downloadModel} from './model-download.js';
const portraits=new Map();
// A new asset revision avoids reusing partial responses cached by older builds.
const modelRevision='8.1.1';
const loader=new GLTFLoader();
// Only the four content-addressed character images are shared. Retaining GLB
// response buffers in Three's global cache would undo the memory saving.
const sharedImages=new Map();
loader.register(parser=>{
 const imageLoader=parser.textureLoader;
 let imageError;
 parser.textureLoader={
  isImageBitmapLoader:imageLoader.isImageBitmapLoader,
  load(url,onLoad,onProgress,onError){
   if(!/(?:^|\/)textures\/[a-f\d]{64}\.png$/.test(url))return imageLoader.load(url,onLoad,onProgress,onError);
   const key=`${imageLoader.isImageBitmapLoader?'bitmap':'texture'}:${url}`;
   let request=sharedImages.get(key);
   if(!request){
    request=Promise.resolve().then(()=>new Promise((resolve,reject)=>imageLoader.load(url,resolve,onProgress,reject)));
    sharedImages.set(key,request);
    request.catch(()=>{if(sharedImages.get(key)===request)sharedImages.delete(key);});
   }
   request.then(image=>onLoad(imageLoader.isImageBitmapLoader?image:image.clone()),error=>{imageError=error;onError?.(error);});
  }
 };
 return{name:'GoghSharedCharacterImages',afterRoot(){if(imageError)throw imageError;}};
});
let loading;
export function loadCharacterAssets(){
 if(!loading)loading=Promise.all(Object.values(CHARACTER_DESIGNS).map(async design=>{
  const buffer=await downloadModel(`/assets/characters/${design.id}-head.glb?v=${modelRevision}`,{
   name:design.id.replaceAll('-',' '),
   onRetry:error=>console.warn(`Retrying ${design.id} model download: ${error.message}`),
  });
  const gltf=await loader.parseAsync(buffer,'/assets/characters/');
  portraits.set(design.id,gltf.scene);
 })).catch(error=>{loading=undefined;throw error;});
 return loading;
}
export function createPortraitAsset(name){
 const id=CHARACTER_DESIGNS[name]?.id||name,source=portraits.get(id);
 if(!source)throw new Error(`Character portrait asset is missing: ${name}`);
 const root=source.clone(true),materialCopies=new Map(),textures=new Map();
 root.name=`${name} Blender portrait`;
 root.traverse(o=>{
  if(!o.isMesh)return;
  o.geometry=o.geometry.clone();
  const cloneMaterial=original=>{
   if(materialCopies.has(original))return materialCopies.get(original);
   const material=refinePortraitMaterial(original.clone());
   for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(material[key]){
    const originalTexture=material[key];if(!textures.has(originalTexture))textures.set(originalTexture,originalTexture.clone());material[key]=textures.get(originalTexture);
   }
   materialCopies.set(original,material);return material;
  };
  o.material=Array.isArray(o.material)?o.material.map(cloneMaterial):cloneMaterial(o.material);
  o.castShadow=true;o.receiveShadow=true;
 });
 let detail,distance;root.traverse(o=>{if(o.name.endsWith('_portrait_detail'))detail=o;if(o.name.endsWith('_portrait_distance'))distance=o;});if(distance)distance.visible=false;
 const lids=[];root.traverse(o=>{if(o.morphTargetDictionary?.Blink!==undefined)lids.push([o,o.morphTargetDictionary.Blink]);});
 const seed=Array.from(name).reduce((n,c)=>n+c.charCodeAt(0),0)*.137;
 let closeDetail=true;
 root.userData.updatePortrait=(time,alive=true,range=0)=>{
  if(detail&&distance){if(range>11)closeDetail=false;else if(range<9)closeDetail=true;detail.visible=closeDetail;distance.visible=!closeDetail;}
  const phase=(time+seed)%4.2,blink=alive&&phase<.19?Math.sin(Math.PI*phase/.19):0;
  for(const [mesh,index]of lids)mesh.morphTargetInfluences[index]=blink;
 };
 root.userData.blender=true;root.userData.designId=id;
 return root;
}
