      if(!response.ok)return[];
      const fallback=await response.json(),current=this.records();
      for(const record of fallback){if(!current.some(item=>this.sameRecoveredRecord(item,record)))current.push(record)}
      this.writeRecords(current.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)));
      return fallback;
    }catch(error){console.warn('No se pudo cargar el respaldo de bitácoras recuperadas.',error);return[]}
  },
  async seed({waitForCloud=false}={}){
    if(!localStorage.getItem(this.keys.users)){const r=await fetch('data/usuarios.json');this.write(this.keys.users,await r.json(),{sync:false})}
    if(!localStorage.getItem(this.keys.properties)){const r=await fetch('data/predios.json');this.write(this.keys.properties,await r.json(),{sync:false})}
    if(!localStorage.getItem(this.keys.settings))this.write(this.keys.settings,{nextFolio:1,theme:'light',logo:'',types:['Preventivo','Correctivo','Electricidad','Plomería','Pintura','Limpieza','Jardinería','Inspección','Otro'],responsibles:['Cristina','Jorge Tapia','Verónica','Isaac','Samuel','Sharon','Andrés','Aldo','Contratista']},{sync:false});
    try{
      const stored=await offlineItems();
      stored.forEach(item=>this.cacheRecord({...item.record,_pendingSync:true},{compact:true}));
    }catch(error){console.warn('No se pudo recuperar la cola sin conexión.',error)}
    await this.loadStaticFallbacks();
    const synchronize=async()=>{try{
      await this.syncAll();
      const properties=this.properties();
      if(!properties.includes('CAMPIRANO')){
        properties.push('CAMPIRANO');
        properties.sort((a,b)=>a.localeCompare(b,'es'));
        await this.saveShared(this.keys.properties,properties);
      }
      const settings=this.settings();
      settings.types=Array.from(new Set([...(settings.types||[]),'Preventivo','Correctivo','Programado']));
      await this.saveShared(this.keys.settings,settings);
      await this.flushPending();
      this.online=true;
      this.lastError='';
    }catch(error){
      this.setOffline(error);
    }};
    if(!this.seedTask)this.seedTask=synchronize().finally(()=>{this.seedTask=null});
    if(waitForCloud)await this.seedTask;
  },
  async syncAll(){
    const stateKeys=[this.keys.users,this.keys.properties,this.keys.settings,this.keys.reports];
    const states=await cloud(`state?keys=${encodeURIComponent(stateKeys.join(','))}`);
    const remoteState=new Map((states||[]).map(item=>[item.key,item.value]));
    for(const key of stateKeys){
      if(key===this.keys.reports&&remoteState.has(key)){
        const combined=new Map([...(this.read(key,[])),...(remoteState.get(key)||[])].map(report=>[report.id,report]));
        const merged=[...combined.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        this.write(key,merged,{sync:false});
        await this.syncState(key,merged);
      }else if(remoteState.has(key))this.write(key,remoteState.get(key),{sync:false});
      else await this.syncState(key,this.read(key,key===this.keys.settings?{}:[]));
    }

    const remote=await cloud('records')||[];
    const local=this.records();
    const combined=new Map();
    local.filter(record=>!record._staticFallback||!remote.some(item=>this.sameRecoveredRecord(item,record))).forEach(record=>combined.set(record.id,record));
    remote.forEach(record=>combined.set(record.id,newest(combined.get(record.id),record)));
    const merged=[...combined.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    this.writeRecords(merged);

    if(!localStorage.getItem('vp_cloudflare_migrated_v1')){
      const remoteIds=new Set(remote.map(record=>record.id));
      for(const record of local.filter(item=>item.id&&!remoteIds.has(item.id))){
        await this.saveRecord(record,{forceInsert:true,preserveFolio:true});
      }
      localStorage.setItem('vp_cloudflare_migrated_v1','1');
    }
  },
  async refreshRecords(){
    const remote=await cloud('records')||[];
    const combined=new Map(remote.map(record=>[record.id,record]));
    this.records().filter(record=>record._staticFallback&&!remote.some(item=>this.sameRecoveredRecord(item,record))).forEach(record=>combined.set(record.id,record));
    this.pending().forEach(item=>combined.set(item.record.id,newest(combined.get(item.record.id),item.record)));
    this.writeRecords([...combined.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)));
    this.online=true;
    this.lastError='';
    return remote;
  },
  async refreshSharedState(){
    const stateKeys=[this.keys.users,this.keys.properties,this.keys.settings,this.keys.reports];
    const states=await cloud(`state?keys=${encodeURIComponent(stateKeys.join(','))}`);
    (states||[]).forEach(item=>{
      if(item.key===this.keys.reports){
        const combined=new Map([...(this.signatureReports()),...(item.value||[])].map(report=>[report.id,report]));
        this.write(item.key,[...combined.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)),{sync:false});
      }else this.write(item.key,item.value,{sync:false});
    });
    this.online=true;
    this.lastError='';
    return states;
  },
  async syncState(key,value){
    await cloud(`state/${encodeURIComponent(key)}`,{
      method:'PUT',
      body:JSON.stringify(value)
    });
    this.online=true;
  },
  async saveShared(key,value){
    this.write(key,value,{sync:false});
    await this.syncState(key,value);
    return value;
  },
  records(){return this.read(this.keys.records)}, users(){return this.read(this.keys.users)}, properties(){return this.read(this.keys.properties)}, settings(){return this.read(this.keys.settings,{})}, signatureReports(){return this.read(this.keys.reports,[])},
  async saveSignatureReport(report){
    const reports=this.signatureReports(),index=reports.findIndex(item=>item.id===report.id);
    if(index<0)reports.unshift(report);else reports[index]=report;
    this.write(this.keys.reports,reports,{sync:false});
    try{await this.syncState(this.keys.reports,reports);return {...report,_pendingSync:false}}
    catch(error){this.setOffline(error);return {...report,_pendingSync:true}}
  },
  pending(){return this.read(this.keys.pending,[])},
  cacheRecord(record,{compact=false}={}){
    const all=this.records(),index=all.findIndex(item=>item.id===record.id);
    if(index<0)all.unshift(record);else all[index]=record;
    try{this.writeRecords(all)}
    catch(error){
      if(!compact)throw error;
      const light=all.map(item=>({...item,photos:[]}));
      this.write(this.keys.records,light,{sync:false});
    }
    return record;
  },
  async queueRecord(record,preserveFolio=false){
    const item={record:{...record,_pendingSync:true},preserveFolio,queuedAt:new Date().toISOString()};
    await offlinePut(item);
    try{
      const pending=this.pending(),index=pending.findIndex(entry=>entry.record.id===record.id);
      const lightweight={...item,record:{...item.record,photos:[]}};
      if(index<0)pending.push(lightweight);else pending[index]=lightweight;
      this.write(this.keys.pending,pending,{sync:false});
      this.cacheRecord(item.record,{compact:true});
    }catch(error){console.warn('La copia completa quedó protegida en el almacenamiento sin conexión.',error)}
    requestBackgroundSync();
    return item.record;
  },
  async persistRecord(record,{preserveFolio=false}={}){
    const payload={...record,_pendingSync:false};
    if(!preserveFolio)delete payload.folio;
    const saved=await cloud(`records/${encodeURIComponent(record.id)}`,{method:'PUT',body:JSON.stringify(payload)});
    return {...saved,_pendingSync:false};
  },
  async flushPending(){
    let queued=this.pending();
    try{
      const durable=await offlineItems();
      const combined=new Map(queued.map(item=>[item.record.id,item]));
      durable.forEach(item=>combined.set(item.record.id,item));
      queued=[...combined.values()];
    }catch(error){console.warn('No se pudo consultar la cola sin conexión.',error)}
    if(!queued.length)return[];
    const remaining=[],synced=[];
    for(const item of queued){
      try{
        const saved=await this.persistRecord(item.record,{preserveFolio:item.preserveFolio});
        this.cacheRecord(saved,{compact:true});await offlineDelete(item.record.id);synced.push(saved);
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
    try{
      const saved=await this.persistRecord(record,{preserveFolio:preserveFolio||exists});
      try{
        this.cacheRecord(saved);
        this.write(this.keys.pending,this.pending().filter(item=>item.record.id!==record.id),{sync:false});
      }catch(cacheError){
        console.warn('La bitácora se guardó en la nube, pero el almacenamiento local del teléfono está lleno.',cacheError);
      }
      this.online=true;this.lastError='';
      return saved;
    }catch(error){
      this.setOffline(error);
      return await this.queueRecord(record,preserveFolio||exists);
    }
  },
  async removeRecord(id){
    await cloud(`records/${encodeURIComponent(id)}`,{method:'DELETE'});
    this.write(this.keys.records,this.records().filter(item=>item.id!==id),{sync:false});
  },
  nextFolio(){const s=this.settings(),n=Number(s.nextFolio||1);s.nextFolio=n+1;this.write(this.keys.settings,s);return `VP-${String(n).padStart(6,'0')}`},
  audit(action,folio){const a=this.read('vp_audit');a.unshift({action,folio,at:new Date().toISOString(),by:this.read(this.keys.session,{}).nombre||'Sistema'});this.write('vp_audit',a.slice(0,500),{sync:false})}
};

if(typeof window!=='undefined'){
  const resumeSync=()=>{if(navigator.onLine)DB.flushPending().catch(error=>DB.setOffline(error))};
  window.addEventListener('online',resumeSync);
  window.addEventListener('focus',resumeSync);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resumeSync()});
  setInterval(resumeSync,30000);
}
