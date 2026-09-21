const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const safeKey=value=>String(value||'').replace(/[^a-zA-Z0-9._/-]/g,'_').replace(/^\/+|\/+$/g,'');
const dataUri=value=>typeof value==='string'&&value.startsWith('data:')?value.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s):null;

function decodeDataUri(value){
  const match=dataUri(value);if(!match)return null;
  const type=match[1]||'application/octet-stream',raw=match[2]||'',binary=atob(raw),bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
  return{type,bytes};
}

async function storeAsset(database,recordId,label,value){
  const decoded=decodeDataUri(value);if(!decoded)return value;
  if(!decoded.bytes.byteLength)throw new Error('La imagen está vacía. Vuelve a capturar la firma antes de guardar.');
  if(decoded.bytes.byteLength>1900000)throw new Error('El archivo supera el límite gratuito de 1.9 MB. Reduce su tamaño antes de guardarlo.');
  const extension=decoded.type.split('/')[1]?.replace('jpeg','jpg').replace(/[^a-z0-9]/gi,'')||'bin';
  const key=`records/${safeKey(recordId)}/${safeKey(label)}-${crypto.randomUUID()}.${extension}`;
  // D1 can silently persist an ArrayBuffer as an empty BLOB in some Workers
  // runtimes. Base64 text is portable across D1 and is decoded when served.
  const payload=value.slice(value.indexOf(',')+1);
  await database.prepare('INSERT INTO media(key,record_id,mime,data,created_at) VALUES(?1,?2,?3,?4,?5)').bind(key,recordId,decoded.type,payload,new Date().toISOString()).run();
  const stored=await database.prepare('SELECT length(data) AS size FROM media WHERE key=?1').bind(key).first();
  if(Number(stored?.size)!==payload.length){await database.prepare('DELETE FROM media WHERE key=?1').bind(key).run();throw new Error('Cloudflare no confirmó la imagen completa. Intenta guardar nuevamente.');}
  return`/api/files/${key}`;
}

async function externalizeMedia(record,env){
  const clean={...record};
  if(Array.isArray(clean.photos))clean.photos=await Promise.all(clean.photos.map((photo,index)=>storeAsset(env.DB,clean.id,`photo-${index+1}`,photo)));
  for(const field of ['clientSignature','vpSignature','archivoOriginalPdf']){
    const value=clean[field];if(!dataUri(value))continue;
    const url=await storeAsset(env.DB,clean.id,field,value);
    if(field==='archivoOriginalPdf'){clean.archivoOriginalUrl=url;clean.archivoOriginalPdf=''}else clean[field]=url;
  }
  return clean;
}

async function records(request,env,segments){
  if(request.method==='GET'&&!segments.length){
    const result=await env.DB.prepare('SELECT id, folio, payload, created_at, updated_at FROM bitacoras ORDER BY created_at DESC').all();
    return json(result.results.map(row=>({...JSON.parse(row.payload),id:row.id,folio:row.folio,createdAt:row.created_at,updatedAt:row.updated_at})));
  }
  const id=safeKey(segments[0]);if(!id)return json({error:'Falta el identificador.'},400);
  if(request.method==='DELETE'){
    await env.DB.batch([
      env.DB.prepare('DELETE FROM media WHERE record_id = ?1').bind(id),
      env.DB.prepare('DELETE FROM bitacoras WHERE id = ?1').bind(id)
    ]);
    return new Response(null,{status:204});
  }
  if(request.method!=='PUT'&&request.method!=='POST')return json({error:'Método no permitido.'},405);
  const input=await request.json(),record=await externalizeMedia({...input,id},env),now=new Date().toISOString();
  let folio=record.folio;
  if(!folio){const counter=await env.DB.prepare("UPDATE counters SET value=value+1 WHERE name='folio' RETURNING value").first();folio=`VP-${String(counter.value).padStart(6,'0')}`}
  record.folio=folio;record.updatedAt=record.updatedAt||now;record.createdAt=record.createdAt||now;delete record._pendingSync;
  await env.DB.prepare(`INSERT INTO bitacoras(id,folio,payload,created_at,updated_at) VALUES(?1,?2,?3,?4,?5)
    ON CONFLICT(id) DO UPDATE SET folio=excluded.folio,payload=excluded.payload,updated_at=excluded.updated_at`)
    .bind(id,folio,JSON.stringify(record),record.createdAt,record.updatedAt).run();
  const folioNumber=Number(folio.match(/(\d+)$/)?.[1]||0);if(folioNumber)await env.DB.prepare("UPDATE counters SET value=MAX(value,?1) WHERE name='folio'").bind(folioNumber).run();
  return json(record);
}

async function state(request,env,segments,url){
  if(request.method==='GET'&&!segments.length){
    const keys=(url.searchParams.get('keys')||'').split(',').filter(Boolean);if(!keys.length)return json([]);
    const placeholders=keys.map((_,index)=>`?${index+1}`).join(','),result=await env.DB.prepare(`SELECT key,value,updated_at FROM app_state WHERE key IN (${placeholders})`).bind(...keys).all();
    return json(result.results.map(row=>({key:row.key,value:JSON.parse(row.value),updated_at:row.updated_at})));
  }
  const key=segments.join('/');if(!key)return json({error:'Falta la clave.'},400);
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT value FROM app_state WHERE key=?1').bind(key).first();return row?json(JSON.parse(row.value)):json(null,404)}
  if(request.method!=='PUT'&&request.method!=='POST')return json({error:'Método no permitido.'},405);
  const value=await request.json(),now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO app_state(key,value,updated_at) VALUES(?1,?2,?3)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(key,JSON.stringify(value),now).run();
  return json({key,value,updated_at:now});
}

async function files(request,env,segments){
  if(request.method!=='GET')return json({error:'Método no permitido.'},405);
  const key=segments.join('/'),object=await env.DB.prepare('SELECT mime,data FROM media WHERE key=?1').bind(key).first();if(!object)return json({error:'Archivo no encontrado.'},404);
  if(typeof object.data==='string'){
    if(!object.data.length)return json({error:'El archivo está vacío. Vuelve a capturar la firma desde Administración.'},404);
    const binary=atob(object.data),bytes=new Uint8Array(binary.length);
    for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
    return new Response(bytes,{headers:{'Content-Type':object.mime||'application/octet-stream','Cache-Control':'private, max-age=3600'}});
  }
  if(!object.data?.byteLength)return json({error:'El archivo está vacío. Vuelve a capturar la firma desde Administración.'},404);
  return new Response(object.data,{headers:{'Content-Type':object.mime||'application/octet-stream','Cache-Control':'private, max-age=3600'}});
}

export async function onRequest({request,env,params}){
  try{
    if(!env.DB)return json({error:'La base D1 no está enlazada.'},503);
    const path=Array.isArray(params.path)?params.path:[params.path].filter(Boolean),[resource,...segments]=path,url=new URL(request.url);
    if(resource==='health')return json({ok:true,database:'D1',files:'D1 compressed media'});
    if(resource==='records')return await records(request,env,segments);
    if(resource==='state')return await state(request,env,segments,url);
    if(resource==='files')return await files(request,env,segments);
    return json({error:'Ruta no encontrada.'},404);
  }catch(error){console.error(error);return json({error:'No fue posible completar la operación.',detail:error.message},500)}
}
