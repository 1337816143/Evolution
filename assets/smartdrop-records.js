(() => {
'use strict';
// This store is browser-local. It never uploads evidence or approves a gate.
const DB='evolution.smartdrop.measurements.v2';
const LEGACY='evolution.smartdrop.measurements.v1';
const SIGNAL='evolution.smartdrop.measurements.changed';
function normalize(raw,gates){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('记录必须是对象');
  const r={};
  for(const [key,max] of [['specimen',100],['evidence',160],['notes',2000]]){
    if(key==='notes'&&raw[key]===undefined){r[key]='';continue}
    if(typeof raw[key]!=='string')throw Error(key+'格式无效');
    r[key]=raw[key].trim();
    if(r[key].length>max||(key!=='notes'&&!r[key]))throw Error(key+'为空或过长');
  }
  if(typeof raw.gate!=='string'||!gates.includes(raw.gate))throw Error('未知关卡');
  r.gate=raw.gate;
  if(!Number.isInteger(raw.tested)||raw.tested<1||raw.tested>1000000||!Number.isInteger(raw.failed)||raw.failed<0||raw.failed>raw.tested||!Number.isFinite(raw.seconds)||raw.seconds<=0)throw Error('数量或用时无效');
  for(const key of ['tested','failed','seconds'])r[key]=raw[key];
  if(typeof raw.recordedAt!=='string'||!Number.isFinite(Date.parse(raw.recordedAt)))throw Error('记录日期无效');
  r.recordedAt=raw.recordedAt;
  r.source='USER_SELF_REPORTED_PHYSICAL';r.status='NOT_REVIEWED';
  return r;
}
function transaction(db,names,mode,work){return new Promise((resolve,reject)=>{
  const tx=db.transaction(names,mode);let value;
  tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(tx.error||Error('本机存储事务未完成'));
  try{work(tx,v=>{value=v})}catch(error){try{tx.abort()}catch{}reject(error)}
})}
function readAll(db,name){return transaction(db,[name],'readonly',(tx,set)=>{const request=tx.objectStore(name).getAll();request.onsuccess=()=>set(request.result)})}
async function digest(value){
  if(!globalThis.crypto?.subtle)throw Error('缺少安全哈希接口，旧记录未被修改；请使用HTTPS页面');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function create(gates){
  let db=null,opening=null;
  const listeners=new Set();let channel=null;
  try{if(globalThis.BroadcastChannel){channel=new BroadcastChannel(DB);channel.onmessage=()=>listeners.forEach(fn=>fn())}}catch{}
  if(globalThis.addEventListener)globalThis.addEventListener('storage',event=>{if(event.key===SIGNAL||event.key===LEGACY)listeners.forEach(fn=>fn())});
  function notify(){try{channel?.postMessage('changed')}catch{}try{localStorage.setItem(SIGNAL,crypto.randomUUID())}catch{}listeners.forEach(fn=>fn())}
  function legacyText(){try{return localStorage.getItem(LEGACY)}catch{throw Error('浏览器拒绝读取旧记录，不能把它当作空白；旧存储未修改，请检查网站存储权限后重试')}}
  async function open(){
    if(db)return db;
    if(opening)return opening;
    opening=new Promise((resolve,reject)=>{
      if(!globalThis.indexedDB){reject(Error('本浏览器无法使用事务存储；旧记录仍保留，未保存新记录'));return}
      const request=indexedDB.open(DB,1);
      let blocked=false;
      request.onupgradeneeded=()=>{for(const [name,keyPath] of [['records','id'],['quarantine','id'],['imports','id']])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath})};
      request.onblocked=()=>{blocked=true;reject(Error('存储升级被其他页面阻挡，请关闭旧页面后重试；旧记录未修改'))};
      request.onerror=()=>reject(request.error||Error('无法打开本机事务存储'));
      request.onsuccess=()=>{if(blocked){request.result.close();return}db=request.result;db.onversionchange=()=>{db.close();db=null;opening=null};resolve(db)};
    }).catch(error=>{opening=null;throw error});
    return opening;
  }
  async function migrate(){
    const current=await open(),text=legacyText();
    if(text===null)return;
    const snapshot='v1:'+await digest(text);
    const imports=await readAll(current,'imports');if(imports.some(item=>item.id===snapshot))return;
    const entries=[],counts=new Map();let source;
    try{source=JSON.parse(text);if(!Array.isArray(source))throw Error('旧记录不是数组')}
    catch(error){source=null;entries.push({store:'quarantine',value:{id:snapshot,reason:'旧存储无法解析：'+error.message,raw:text,sourceKey:LEGACY}})}
    if(source)for(const raw of source){
      const body=JSON.stringify(raw),hash=await digest(body),rank=counts.get(hash)||0;counts.set(hash,rank+1);
      const id='legacy:'+hash+':'+rank;
      try{entries.push({store:'records',value:{id,record:{id,...normalize(raw,gates)},original:raw,origin:'legacy-v1'}})}
      catch(error){entries.push({store:'quarantine',value:{id,reason:error.message,raw,sourceKey:LEGACY}})}
    }
    // One transaction copies every row and its original snapshot. No v1 write,
    // deletion, count cap, or partial-success marker is permitted.
    await transaction(current,['records','quarantine','imports'],'readwrite',(tx)=>{
      for(const entry of entries){const store=tx.objectStore(entry.store),request=store.get(entry.value.id);request.onsuccess=()=>{if(!request.result)store.add(entry.value)}}
      tx.objectStore('imports').put({id:snapshot,sourceKey:LEGACY,raw:text,copiedAt:new Date().toISOString()});
    });
  }
  async function snapshot(){
    await migrate();const current=await open();
    return transaction(current,['records','quarantine'],'readonly',(tx,set)=>{
      const recordRequest=tx.objectStore('records').getAll(),quarantineRequest=tx.objectStore('quarantine').getAll();
      const finish=()=>{if(recordRequest.readyState!=='done'||quarantineRequest.readyState!=='done')return;
        const records=[],quarantine=[...quarantineRequest.result];
        for(const item of recordRequest.result){try{if(!item||typeof item.id!=='string'||!item.id.trim())throw Error('记录ID格式无效');records.push({id:item.id,...normalize(item.record,gates)})}catch(error){quarantine.push({id:item?.id??null,reason:error.message,raw:item,sourceKey:DB})}}
        records.sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id));
        set({records,quarantine,storageSchema:'evolution.smartdrop.local-store.v2'});
      };recordRequest.onsuccess=finish;quarantineRequest.onsuccess=finish;
    });
  }
  async function add(raw){
    const record=normalize(raw,gates);await migrate();const current=await open();
    if(!globalThis.crypto?.randomUUID)throw Error('缺少唯一记录ID接口，新记录未保存');
    const id=crypto.randomUUID();
    await transaction(current,['records'],'readwrite',tx=>tx.objectStore('records').add({id,record:{id,...record},origin:'browser-entry'}));
    notify();return id;
  }
  return {snapshot,add,onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)},legacyBackup:legacyText};
}
globalThis.SmartDropRecords={create,normalize,legacyKey:LEGACY,databaseName:DB};
})();
