import {compress} from './camera.js';

export function gallery(inputs,zone,preview){
  const pickers=Array.isArray(inputs)?inputs:[inputs];
  let images=[];
  const draw=()=>{
    preview.innerHTML=images.map((x,i)=>`<figure><img src="${x}" data-view="${i}" alt="Evidencia ${i+1}"><button type="button" data-del="${i}" aria-label="Eliminar evidencia ${i+1}">×</button></figure>`).join('')+`<span class="photo-count">${images.length} fotografía${images.length===1?'':'s'} de 8</span>`;
  };
  const add=async files=>{
    for(const file of Array.from(files||[])){
      if(file.type.startsWith('image/')&&images.length<8)images.push(await compress(file));
    }
    draw();
  };
  pickers.filter(Boolean).forEach(input=>input.addEventListener('change',async()=>{
    await add(input.files);
    input.value='';
  }));
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('over')};
  zone.ondragleave=()=>zone.classList.remove('over');
  zone.ondrop=e=>{e.preventDefault();zone.classList.remove('over');add(e.dataTransfer.files)};
  preview.onclick=e=>{
    if(e.target.dataset.del!==undefined){images.splice(+e.target.dataset.del,1);draw()}
    else if(e.target.dataset.view!==undefined){const d=document.createElement('dialog');d.className='lightbox';d.innerHTML=`<img src="${images[+e.target.dataset.view]}" alt="Vista ampliada"><button aria-label="Cerrar">×</button>`;document.body.append(d);d.showModal();d.onclick=()=>d.remove()}
  };
  draw();
  return{get:()=>images,set:v=>{images=v||[];draw()}};
}
