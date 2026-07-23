export const DB = {
  keys:{records:'vp_records',users:'vp_users',properties:'vp_properties',settings:'vp_settings',session:'vp_session'},
  read(k,f=[]){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},
  write(k,v){localStorage.setItem(k,JSON.stringify(v));return v},
  async seed(){
    if(!localStorage.getItem(this.keys.users)){const r=await fetch('data/usuarios.json');this.write(this.keys.users,await r.json())}
    if(!localStorage.getItem(this.keys.properties)){const r=await fetch('data/predios.json');this.write(this.keys.properties,await r.json())}
    if(!localStorage.getItem(this.keys.settings))this.write(this.keys.settings,{nextFolio:1,theme:'light',logo:'',types:['Preventivo','Correctivo','Electricidad','Plomería','Pintura','Limpieza','Jardinería','Inspección','Otro'],responsibles:['Cristina','Jorge Tapia','Verónica','Isaac','Samuel','Sharon','Andrés','Aldo','Contratista']});
  },
  records(){return this.read(this.keys.records)}, users(){return this.read(this.keys.users)}, properties(){return this.read(this.keys.properties)}, settings(){return this.read(this.keys.settings,{})},
  saveRecord(record){const a=this.records(),i=a.findIndex(x=>x.id===record.id);if(i<0)a.unshift(record);else a[i]=record;this.write(this.keys.records,a);return record},
  removeRecord(id){this.write(this.keys.records,this.records().filter(x=>x.id!==id))},
  nextFolio(){const s=this.settings(),n=Number(s.nextFolio||1);s.nextFolio=n+1;this.write(this.keys.settings,s);return `VP-${String(n).padStart(6,'0')}`},
  audit(action,folio){const a=this.read('vp_audit');a.unshift({action,folio,at:new Date().toISOString(),by:this.read(this.keys.session,{}).nombre||'Sistema'});this.write('vp_audit',a.slice(0,500))}
};
