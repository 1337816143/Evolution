(()=>{'use strict';
const root=document.querySelector('#conversation-archive');if(!root)return;
const $=s=>root.querySelector(s);
const text=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=String(value??'');if(cls)n.className=cls;return n;};
const sections=[['requirements','需求与约束'],['process','过程与改动'],['decisions','取舍与纠正'],['results','结果与验证边界'],['openQuestions','待办与缺口'],['artifacts','成果与附件索引']];
const data=JSON.parse(document.querySelector('#ca-public-data').textContent);
let active=data,privateMode=data.privacy==='private';
function validate(d){if(!d||d.schema!=='evolution.conversation-archive.v1'||d.privacy!=='private'||!Array.isArray(d.records)||d.records.length>2000||!Array.isArray(d.sources)||d.sources.length>5000)throw new Error('不是受支持的私有归档包。');const ids=new Set();for(const r of d.records){for(const k of ['id','title','category','status','summary','date'])if(typeof r[k]!=='string'||r[k].length>8000)throw new Error('档案字段不完整：'+k);if(ids.has(r.id))throw new Error('存在重复档案ID。');ids.add(r.id);for(const [k] of sections)if(!Array.isArray(r[k])||r[k].length>200||r[k].some(x=>typeof x!=='string'||x.length>20000))throw new Error('档案内容格式错误：'+k);if(!Array.isArray(r.sources)||r.sources.some(x=>typeof x!=='string'))throw new Error('来源格式错误。');}const sources=new Set();for(const s of d.sources){if(!s||typeof s.id!=='string'||typeof s.title!=='string'||typeof s.locator!=='string'||sources.has(s.id))throw new Error('来源目录不完整或重复。');sources.add(s.id);}for(const r of d.records)for(const id of r.sources)if(!sources.has(id))throw new Error('缺少来源：'+id);return d;}
function message(s){$('#ca-status').textContent=s;}
function options(selector,key,label){const sel=$(selector);sel.replaceChildren(new Option(label,''));for(const value of [...new Set(active.records.map(r=>r[key]))].sort())sel.add(new Option(value,value));}
function selectData(d,isPrivate){active=d;privateMode=isPrivate;$('#ca-query').value='';options('#ca-category','category','全部主题');options('#ca-stage','status','全部状态');$('#ca-clear-private').hidden=!isPrivate;$('#ca-mode').textContent=isPrivate?'私有档案已在本机载入 · 不上传':'公开方法目录 · 私有档案尚未载入';$('#ca-mode').className=isPrivate?'ca-privacy-mark':'ca-status';$('#ca-grid').classList.toggle('ca-private-loaded',isPrivate);render();}
function render(){const q=$('#ca-query').value.trim().toLocaleLowerCase(),category=$('#ca-category').value,stage=$('#ca-stage').value,pending=$('#ca-only-pending').checked;
const records=active.records.filter(r=>(!category||r.category===category)&&(!stage||r.status===stage)&&(!pending||r.openQuestions.length>0)&&(!q||JSON.stringify(r).toLocaleLowerCase().includes(q)));
const grid=$('#ca-grid');grid.replaceChildren();$('#ca-count').textContent=`${privateMode?'私有主题档案':'公开方法条目'}：${records.length} / ${active.records.length}。搜索只作用于当前载入的数据。`;
if(!records.length){grid.append(text('p','没有匹配条目。清除关键词或切换筛选条件。','ca-empty'));return;}
const sourceMap=new Map(active.sources.map(s=>[s.id,s]));
for(const r of records){const article=text('article','',`ca-card${privateMode?' ca-import-private':''}`);article.dataset.archiveId=r.id;
const tags=text('div','','ca-tags');for(const value of [r.category,r.status,r.date])tags.append(text('span',value,'ca-tag'));article.append(tags,text('h2',r.title),text('p',r.summary));
const detail=document.createElement('details');detail.append(text('summary','展开需求、过程、结果与来源'));
for(const [key,label] of sections){if(!r[key]?.length)continue;detail.append(text('h3',label));const lines=text('div','','ca-lines');for(const line of r[key])lines.append(text('p',line));detail.append(lines);}
detail.append(text('h3','来源与可追溯性'));for(const id of r.sources){const s=sourceMap.get(id);if(s)detail.append(text('p',`${id} · ${s.title}｜${s.locator}`,'ca-source'));}
article.append(detail);
if(!privateMode&&typeof r.href==='string'&&/^(?:\.\.\/)?(?:pages|reports)\/[a-z0-9-]+\.html$/.test(r.href)){const a=text('a','打开已有模块 →');a.href=r.href;article.append(a);}grid.append(article);}}
async function importFile(){const file=$('#ca-file').files[0];if(!file)return;if(file.size>8*1024*1024){message('文件超过8 MB，未读取。请使用结构化归档JSON，而不是原始聊天大包。');$('#ca-file').value='';return;}try{const d=validate(JSON.parse(await file.text()));selectData(d,true);message(`已载入 ${d.records.length} 份私有主题档案。只在当前页面内存中使用；刷新、关闭或点击清除即可移除。`);}catch(error){message('未载入：'+error.message);}finally{$('#ca-file').value='';}}
$('#ca-file').addEventListener('change',importFile);$('#ca-clear-private').addEventListener('click',()=>{selectData(data,data.privacy==='private');message(data.privacy==='private'?'当前是离线私有归档文件。关闭文件即可结束查看。':'已清除本机载入的私有档案，恢复公开方法目录。');});
for(const selector of ['#ca-query','#ca-category','#ca-stage','#ca-only-pending'])$(selector).addEventListener('input',render);
$('#ca-reset').addEventListener('click',()=>{$('#ca-query').value='';$('#ca-category').value='';$('#ca-stage').value='';$('#ca-only-pending').checked=false;render();});
$('#ca-expand').addEventListener('click',()=>{const ds=[...root.querySelectorAll('.ca-card details')],open=ds.some(d=>!d.open);ds.forEach(d=>d.open=open);$('#ca-expand').textContent=open?'收起全部':'展开全部';});
selectData(data,privateMode);
})();
