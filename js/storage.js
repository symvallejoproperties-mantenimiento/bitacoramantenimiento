const SUPABASE_URL='https://kzacbfbnfrfklqjicdwu.supabase.co';
const SUPABASE_KEY='sb_publishable_fJbqHul9JwA1vs5MExW_jQ_ij8609kH';

const cloudHeaders={
  apikey:SUPABASE_KEY,
  Authorization:`Bearer ${SUPABASE_KEY}`,
  'Content-Type':'application/json'
};

async function cloud(path,options={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    ...options,
    headers:{...cloudHeaders,...(options.headers||{})}
  });
  if(!response.ok){
    const detail=await response.text();
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }
  if(response.status===204)return null;
  const text=await response.text();
  return text?JSON.parse(text):null;
}

function newest(a,b){
  const aDate=new Date(a?.updatedAt||a?.createdAt||0).getTime();
  const bDate=new Date(b?.updatedAt||b?.createdAt||0).getTime();
  return bDate>aDate?b:a;
}

export const DB = {
  keys:{records:'vp_records',users:'vp_users',properties:'vp_properties',settings:'vp_settings',session:'vp_session'},
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
    this.write(this.keys.records,remote,{sync:false});
    this.online=true;
    this.lastError='';
    return remote;
  },
  async syncState(key,value){
    await cloud('app_state?on_conflict=key',{
      method:'POST',
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({key,value,updated_at:new Date().toISOString()})
    });
    this.online=true;
  },
  records(){return this.read(this.keys.records)}, users(){return this.read(this.keys.users)}, properties(){return this.read(this.keys.properties)}, settings(){return this.read(this.keys.settings,{})},
  async saveRecord(record,{forceInsert=false,preserveFolio=false}={}){
    const now=new Date().toISOString();
    record.updatedAt=record.updatedAt||now;
    const exists=!forceInsert&&this.records().some(item=>item.id===record.id);
    let rows;
    if(exists){
      rows=await cloud(`bitacoras?id=eq.${encodeURIComponent(record.id)}&select=id,folio,payload,updated_at`,{
        method:'PATCH',
        headers:{Prefer:'return=representation'},
        body:JSON.stringify({payload:record,updated_at:record.updatedAt})
      });
    }else{
      const insert={id:record.id,payload:record,created_at:record.createdAt||now,updated_at:record.updatedAt};
      if(preserveFolio&&record.folio)insert.folio=record.folio;
      rows=await cloud('bitacoras?select=id,folio,payload,updated_at',{
        method:'POST',
        headers:{Prefer:'return=representation'},
        body:JSON.stringify(insert)
      });
    }
    const saved=rows?.[0]?{...rows[0].payload,id:rows[0].id,folio:rows[0].folio,updatedAt:rows[0].updated_at}:record;
    const all=this.records(),index=all.findIndex(item=>item.id===saved.id);
    if(index<0)all.unshift(saved);else all[index]=saved;
    this.write(this.keys.records,all,{sync:false});
    this.online=true;
    return saved;
  },
  async removeRecord(id){
    await cloud(`bitacoras?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
    this.write(this.keys.records,this.records().filter(item=>item.id!==id),{sync:false});
  },
  nextFolio(){const s=this.settings(),n=Number(s.nextFolio||1);s.nextFolio=n+1;this.write(this.keys.settings,s);return `VP-${String(n).padStart(6,'0')}`},
  audit(action,folio){const a=this.read('vp_audit');a.unshift({action,folio,at:new Date().toISOString(),by:this.read(this.keys.session,{}).nombre||'Sistema'});this.write('vp_audit',a.slice(0,500),{sync:false})}
};
