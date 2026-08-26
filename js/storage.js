const SUPABASE_URL='https://kzacbfbnfrfklqjicdwu.supabase.co';
const SUPABASE_KEY='sb_publishable_fJbqHul9JwA1vs5MExW_jQ_ij8609kH';

const cloudHeaders={
  apikey:SUPABASE_KEY,
  Authorization:`Bearer ${SUPABASE_KEY}`,
  'Content-Type':'application/json'
};

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function cloud(path,options={}){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    try{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
        ...options,
        cache:'no-store',
        signal:controller.signal,
        headers:{...cloudHeaders,...(options.headers||{})}
      });
      if(!response.ok){
        const detail=await response.text();
        const error=new Error(`Supabase ${response.status}: ${detail}`);
        if(response.status<500&&response.status!==408&&response.status!==429)throw error;
        lastError=error;
      }else{
        if(response.status===204)return null;
        const text=await response.text();
        return text?JSON.parse(text):null;
      }
    }catch(error){
      lastError=error;
      if(error?.message?.startsWith('Supabase 4')&&!error?.message?.startsWith('Supabase 408')&&!error?.message?.startsWith('Supabase 429'))throw error;
    }finally{
      clearTimeout(timer);
    }
    if(attempt<2)await wait(700*(attempt+1));
  }
  throw lastError||new Error('No fue posible conectar con Supabase.');
}

function newest(a,b){
  const aDate=new Date(a?.updatedAt||a?.createdAt||0).getTime();
  const bDate=new Date(b?.updatedAt||b?.createdAt||0).getTime();
  return bDate>aDate?b:a;
}

export const DB = {
  keys:{records:'vp_records',users:'vp_users',properties:'vp_properties',settings:'vp_settings',session:'vp_session',pending:'vp_pending_sync'},
  online:false,
  lastError:'',
  read(k,f=[]){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},
  write(k,v,{sync=true}={}){
    localStorage.setItem(k,JSON.stringify(v));
    if(sync&&[this.keys.users,this.keys.properties,this.keys.settings].includes(k)){
      this.syncState(k,v).catch(error=>this.setOffline(error));
    }
    return v;
  },
  setOffline(error){this.online=false;this.lastError=error?.message||String(error);console.warn('Modo local:',error)},
  async seed(){
    if(!localStorage.getItem(this.keys.users)){const r=await fetch('data/usuarios.json');this.write(this.keys.users,await r.json(),{sync:false})}
    if(!localStorage.getItem(this.keys.properties)){const r=await fetch('data/predios.json');this.write(this.keys.properties,await r.json(),{sync:false})}
    if(!localStorage.getItem(this.keys.settings))this.write(this.keys.settings,{nextFolio:1,theme:'light',logo:'',types:['Preventivo','Correctivo','Electricidad','Plomería','Pintura','Limpieza','Jardinería','Inspección','Otro'],responsibles:['Cristina','Jorge Tapia','Verónica','Isaac','Samuel','Sharon','Andrés','Aldo','Contratista']},{sync:false});
    try{
      await this.syncAll();
      await this.flushPending();
      this.online=true;
      this.lastError='';
    }catch(error){
      this.setOffline(error);
    }
  },
  async syncAll(){
    const stateKeys=[this.keys.users,this.keys.properties,this.keys.settings];
    const states=await cloud(`app_state?select=key,value&key=in.(${stateKeys.join(',')})`);
    const remoteState=new Map((states||[]).map(item=>[item.key,item.value]));
    for(const key of stateKeys){
      if(remoteState.has(key))this.write(key,remoteState.get(key),{sync:false});
      else await this.syncState(key,this.read(key,key===this.keys.settings?{}:[]));
    }

    const rows=await cloud('bitacoras?select=id,folio,payload,updated_at&order=created_at.desc');
    const remote=(rows||[]).map(row=>({...row.payload,id:row.id,folio:row.folio,updatedAt:row.updated_at||row.payload?.updatedAt}));
    const local=this.records();
    const combined=new Map();
    local.forEach(record=>combined.set(record.id,record));
    remote.forEach(record=>combined.set(record.id,newest(combined.get(record.id),record)));
    const merged=[...combined.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    this.write(this.keys.records,merged,{sync:false});

    if(!localStorage.getItem('vp_cloud_migrated')){
      const remoteIds=new Set(remote.map(record=>record.id));
      for(const record of local.filter(item=>item.id&&!remoteIds.has(item.id))){
        await this.saveRecord(record,{forceInsert:true,preserveFolio:true});
      }
      localStorage.setItem('vp_cloud_migrated','1');
    }
  },
  async refreshRecords(){
    const rows=await cloud('bitacoras?select=id,folio,payload,updated_at&order=created_at.desc');
    const remote=(rows||[]).map(row=>({...row.payload,id:row.id,folio:row.folio,updatedAt:row.updated_at||row.payload?.updatedAt}));
    const combined=new Map(remote.map(record=>[record.id,record]));
    this.pending().forEach(item=>combined.set(item.record.id,newest(combined.get(item.record.id),item.record)));
    this.write(this.keys.records,[...combined.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)),{sync:false});
    this.online=true;
    this.lastError='';
    return remote;
  },
  async refreshSharedState(){
    const stateKeys=[this.keys.users,this.keys.properties,this.keys.settings];
    const states=await cloud(`app_state?select=key,value&key=in.(${stateKeys.join(',')})`);
    (states||[]).forEach(item=>this.write(item.key,item.value,{sync:false}));
    this.online=true;
    this.lastError='';
    return states;
  },
  async syncState(key,value){
    await cloud('app_state?on_conflict=key',{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({key,value,updated_at:new Date().toISOString()})
    });
    this.online=true;
  },
  async saveShared(key,value){
    this.write(key,value,{sync:false});
    await this.syncState(key,value);
    return value;
  },
  records(){return this.read(this.keys.records)}, users(){return this.read(this.keys.users)}, properties(){return this.read(this.keys.properties)}, settings(){return this.read(this.keys.settings,{})},
  pending(){return this.read(this.keys.pending,[])},
  cacheRecord(record){
    const all=this.records(),index=all.findIndex(item=>item.id===record.id);
    if(index<0)all.unshift(record);else all[index]=record;
    this.write(this.keys.records,all,{sync:false});
    return record;
  },
  queueRecord(record,preserveFolio=false){
    const pending=this.pending(),item={record:{...record,_pendingSync:true},preserveFolio,queuedAt:new Date().toISOString()};
    const index=pending.findIndex(entry=>entry.record.id===record.id);
    if(index<0)pending.push(item);else pending[index]=item;
    this.write(this.keys.pending,pending,{sync:false});
    this.cacheRecord(item.record);
    return item.record;
  },
  async persistRecord(record,{preserveFolio=false}={}){
    const insert={id:record.id,payload:{...record,_pendingSync:false},created_at:record.createdAt||new Date().toISOString(),updated_at:record.updatedAt||new Date().toISOString()};
    if(preserveFolio&&record.folio)insert.folio=record.folio;
    const rows=await cloud('bitacoras?on_conflict=id&select=id,folio,payload,updated_at',{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(insert)
    });
    return rows?.[0]?{...rows[0].payload,id:rows[0].id,folio:rows[0].folio,updatedAt:rows[0].updated_at,_pendingSync:false}:{...record,_pendingSync:false};
  },
  async flushPending(){
    const queued=this.pending();
    if(!queued.length)return[];
    const remaining=[],synced=[];
    for(const item of queued){
      try{
        const saved=await this.persistRecord(item.record,{preserveFolio:item.preserveFolio});
        this.cacheRecord(saved);synced.push(saved);
      }catch(error){remaining.push(item);this.setOffline(error)}
    }
    this.write(this.keys.pending,remaining,{sync:false});
    if(!remaining.length){this.online=true;this.lastError=''}
    return synced;
  },
  async saveRecord(record,{forceInsert=false,preserveFolio=false}={}){
    const now=new Date().toISOString();
    record.updatedAt=record.updatedAt||now;
    const exists=!forceInsert&&this.records().some(item=>item.id===record.id);
    this.cacheRecord({...record,_pendingSync:true});
    try{
      const saved=await this.persistRecord(record,{preserveFolio:preserveFolio||exists});
      this.cacheRecord(saved);
      this.write(this.keys.pending,this.pending().filter(item=>item.record.id!==record.id),{sync:false});
      this.online=true;this.lastError='';
      return saved;
    }catch(error){
      this.setOffline(error);
      return this.queueRecord(record,preserveFolio||exists);
    }
  },
  async removeRecord(id){
    await cloud(`bitacoras?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
    this.write(this.keys.records,this.records().filter(item=>item.id!==id),{sync:false});
  },
  nextFolio(){const s=this.settings(),n=Number(s.nextFolio||1);s.nextFolio=n+1;this.write(this.keys.settings,s);return `VP-${String(n).padStart(6,'0')}`},
  audit(action,folio){const a=this.read('vp_audit');a.unshift({action,folio,at:new Date().toISOString(),by:this.read(this.keys.session,{}).nombre||'Sistema'});this.write('vp_audit',a.slice(0,500),{sync:false})}
};

if(typeof window!=='undefined')window.addEventListener('online',()=>DB.flushPending().catch(error=>DB.setOffline(error)));
