export function signature(canvas){
  const c=canvas.getContext('2d');let drawing=false,last;
  const pos=e=>{const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e;return{x:(p.clientX-r.left)*canvas.width/r.width,y:(p.clientY-r.top)*canvas.height/r.height}};
  const start=e=>{e.preventDefault();drawing=true;last=pos(e)};
  const move=e=>{if(!drawing)return;e.preventDefault();const p=pos(e);c.strokeStyle='#173c3a';c.lineWidth=2.5;c.lineCap='round';c.beginPath();c.moveTo(last.x,last.y);c.lineTo(p.x,p.y);c.stroke();last=p};
  ['mousedown','touchstart'].forEach(x=>canvas.addEventListener(x,start,{passive:false}));
  ['mousemove','touchmove'].forEach(x=>canvas.addEventListener(x,move,{passive:false}));
  addEventListener('mouseup',()=>drawing=false);canvas.addEventListener('touchend',()=>drawing=false);
  return{clear:()=>c.clearRect(0,0,canvas.width,canvas.height),data:()=>canvas.toDataURL('image/png')};
}
