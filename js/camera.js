const blobFromCanvas=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
const dataUrlFromBlob=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});

export async function compress(file,{max=1100,targetBytes=120*1024,minQuality=.4}={}){
  const image=await new Promise((resolve,reject)=>{const source=new Image(),url=URL.createObjectURL(file);source.onload=()=>{URL.revokeObjectURL(url);resolve(source)};source.onerror=error=>{URL.revokeObjectURL(url);reject(error)};source.src=url});
  let scale=Math.min(1,max/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height)),quality=.68,blob=null,type='image/webp';
  for(let attempt=0;attempt<6;attempt++){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d',{alpha:false}).drawImage(image,0,0,canvas.width,canvas.height);
    blob=await blobFromCanvas(canvas,type,quality);
    if(!blob||blob.type!==type){type='image/jpeg';blob=await blobFromCanvas(canvas,type,quality)}
    if(blob&&blob.size<=targetBytes)break;
    if(quality>minQuality)quality=Math.max(minQuality,quality-.08);else scale*=.82;
  }
  if(!blob)throw new Error('No fue posible comprimir la fotografía.');
  return dataUrlFromBlob(blob);
}

export function imageBytes(data){const encoded=String(data||'').split(',')[1]||'';return Math.ceil(encoded.length*3/4)}
