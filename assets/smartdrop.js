(() => {
'use strict';
const root=document.getElementById('smartdrop'); if(!root)return;
const d=JSON.parse(document.getElementById('smartdrop-data').textContent);
const $=id=>document.getElementById('sd-'+id);
const allowed=['overview','schemes','animations','current','records','library'];
let tab='overview',route='A',clock=0,playing=false,last=0,localFile=null,localURL=null,records=[];
const duration=3000,storage='evolution.smartdrop.measurements.v1';
const active=()=>route==='P07'?{id:'P07',kind:'bench',title:'A5-P0.7支持式转印台架',steps:d.latestSteps,risk:d.risks.join(' ')}:d.routes.find(r=>r.id===route);
function show(id){if(!allowed.includes(id))id='overview';tab=id;root.querySelectorAll('.sd-section').forEach(s=>s.hidden=s.id!=='sd-'+id);root.querySelectorAll('[data-sd-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.sdTab===id)));if(id!=='animations')playing=false;try{history.replaceState(null,'','#'+id)}catch{}transport();}
root.querySelectorAll('[data-sd-tab]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.sdTab)));
root.querySelectorAll('[data-sd-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.sdGo)));
root.querySelectorAll('[data-sd-route]').forEach(b=>b.addEventListener('click',()=>{select(b.dataset.sdRoute);show('animations')}));
function download(name,content,type='application/json'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function select(id){if(id!=='P07'&&!d.routes.some(r=>r.id===id))return;route=id;clock=0;playing=false;$('route-select').value=id;$('fault').value='none';$('scene-steps').replaceChildren();active().steps.forEach((s,i)=>{const b=document.createElement('button');b.textContent=String(i+1);b.title=s;b.onclick=()=>{clock=i*duration;playing=false;render()};$('scene-steps').append(b)});render();}
function pos(){const a=active(),idx=Math.min(a.steps.length-1,Math.floor(clock/duration)),u=Math.min(1,(clock%duration)/duration);return{a,idx,u:u*u*(3-2*u)}}
function failAt(){return route==='P07'?2:({template:5,card:2,film:6,vacuum:2,parallel:2,xy:6,accumulate:3,robot:1,holes:1}[active().kind]??2)}
function transport(){$('play').textContent=playing?'暂停':'播放';$('seek').value=String(clock/(active().steps.length*duration-1)*1000);}
const cv=$('canvas'),g=cv.getContext('2d');const C={ink:'#183944',teal:'#128489',gold:'#e5a05c',old:'#429a85',plate:'#bdd5db',frame:'#d7e5e8',purple:'#9272b6',line:'#65828d',bad:'#c34c4d'};
function box(x,y,w,h,c,r=4){g.fillStyle=c;g.beginPath();g.roundRect(x,y,w,h,r);g.fill()}
function text(s,x,y,n=14,c=C.ink,align='left'){g.font=`${n}px system-ui,"Microsoft YaHei",sans-serif`;g.fillStyle=c;g.textAlign=align;g.fillText(s,x,y)}
function line(x,y,X,Y,c=C.line,w=2){g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.stroke()}
function arrow(x,y,X,Y,c=C.teal){line(x,y,X,Y,c,3);const a=Math.atan2(Y-y,X-x);g.fillStyle=c;g.beginPath();g.moveTo(X,Y);g.lineTo(X-9*Math.cos(a-.45),Y-9*Math.sin(a-.45));g.lineTo(X-9*Math.cos(a+.45),Y-9*Math.sin(a+.45));g.closePath();g.fill()}
function bead(x,y,c=C.gold){box(x-11,y,8,31,c,1);box(x+3,y,8,31,c,1)}
function ring(x,y,r,c){g.strokeStyle=c;g.lineWidth=5;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke()}
const matrix=[[1,1,1,1,2],[1,0,0,0,2],[1,1,1,0,2],[1,0,0,0,2],[1,0,2,2,2]];
function render(){const {a,idx,u}=pos(),chosen=Number($('color').value),fault=$('fault').value==='fail',failed=fault&&idx>=failAt();g.clearRect(0,0,960,470);box(0,0,960,470,'#f6fbfa');box(16,17,272,423,'#fff',12);box(302,17,642,423,'#fff',12);
 text('当前图案 · 5×5概览',35,45,15);text(chosen===2?'橙色：本次；绿色：已完成旧色':'橙色：本次；灰色：其他位置',35,72,12,C.line);
 for(let r=0;r<5;r++)for(let c=0;c<5;c++){const x=54+c*45,y=113+r*47;box(x-17,y-17,35,35,'#edf5f4',5);const v=matrix[r][c];if(v===chosen){ring(x,y,9,C.gold);if(failed&&r===0&&c===4){line(x-13,y-13,x+13,y+13,C.bad,3)}}else if(v&&chosen===2)ring(x,y,9,C.old);else{g.fillStyle='#a8bfc5';g.beginPath();g.arc(x,y,2,0,Math.PI*2);g.fill()}}
 text('只解释动作，不用于制造或测力',35,365,12,C.line);text('完整原动画：资料页载入本机P0.7',35,393,12,C.line);
 text(a.title,325,47,16);text('橙：本色豆  绿：旧豆/底板柱  蓝：机构',325,74,12,C.line);
 const xs=[444,490,536,582,628],plateY=190,B=362;
 const transfer=idx>=Math.max(4,a.steps.length-3),ret=idx>=a.steps.length-2?u:0;
 function bottom(){box(367,B,516,11,'#aacaac',2);for(const x of xs){box(x-3,B-20,6,20,C.old,1);if(chosen===2&&xs.indexOf(x)%2)bead(x,B-31,C.old)}text('普通底板：固定，不能碰乱旧色',372,402,12,C.old)}
 function face(y=plateY){box(372,y,445,12,C.plate,2)}
 if(a.kind==='bench'){
   const S=idx<4?26:idx===4?26-20.45*u:idx<6?5.55:idx===6?5.55+20.45*u:26;
   const Y=B-S*6,q=idx<1?0:idx===1?6*u:6,drawer=idx<3?0:idx===3?u:1,t=idx<5?0:idx===5?(failed?.8:2.1*u):2.1;
   line(358,103,358,B,'#a9c5cc',8);line(872,103,872,B,'#a9c5cc',8);box(345,Y-52,540,15,C.plate);face(Y);box(397,Y-25-t*6,364,9,C.teal);
   bottom();for(let i=0;i<xs.length;i++)if(i%2===0){line(xs[i],Y-23-t*6,xs[i],Y+(1.65-t)*6,C.teal,5);if(idx<6)bead(xs[i],t>1.65?B-31:Y);}
   if(drawer<1){const X=377-drawer*245,cy=Y+35+q*6;box(X,cy,396,8,'#90b8cd');box(X,cy-30,9,38,'#90b8cd');box(X+387,cy-30,9,38,'#90b8cd');arrow(X+220,cy+17,X+130,cy+17)}
   if(idx>=5)arrow(825,Y-9,825,Y-38);text(`面高S ${S.toFixed(2)} / 降杯 ${q.toFixed(1)} / 退针 ${t.toFixed(2)} mm`,326,112,12,C.line);text('手轮试验台；不得把动画当同步机构',372,423,12,C.line);
 }else if(['template','xy','accumulate'].includes(a.kind)){
   face();bottom();const fill=idx>=2,back=plateY-37-ret*26;box(399,back,365,9,a.kind==='template'?C.teal:C.frame);
   for(let i=0;i<xs.length;i++){if(i%2===0){line(xs[i],back+7,xs[i],plateY+10-ret*25,C.teal,5);if(fill)bead(xs[i],transfer?(ret>.7?B-31:plateY+12):plateY-31)}else if(a.kind==='accumulate'&&idx>=3)bead(xs[i],plateY-31,C.old)}
   if(a.kind==='xy'&&idx===1){const x=xs[Math.floor(u*4)];box(x-13,286,26,19,C.teal);arrow(x,285,x,220);text('移动写针：保留历史，不满足同步主线',371,130,13,C.bad)}
   else if(idx<4){arrow(348,147,440,147);text('撒豆/清扫仍可能漏位，需要人工检查',372,130,13,C.line)}
   else{arrow(800,270,800,317);text(transfer?'先套柱，再退针；面板保持不动':'固定轴翻转，软件补偿一次镜像',372,130,13)}
   if(ret>0){arrow(778,back+20,778,back-13);if(a.kind!=='template')box(390,back-22,380,10,C.purple)}
 }else if(['card','parallel'].includes(a.kind)){
   bottom();const lift=idx===2?u*38:idx>2&&idx<4?38:0;face(149);box(380,295-lift,405,13,a.kind==='card'?'#e6c276':C.plate);text(a.kind==='card'?'整张孔卡选择：实心托杆，孔位让杆穿过':'固定滑舌选择：先到端位，再共同升针',326,115,13);
   for(let i=0;i<xs.length;i++){const selected=i%2===0,Y=selected?234-lift:234;line(xs[i],Y,xs[i],Y-67,C.teal,5);if(a.kind==='parallel')box(xs[i]-15+(selected?12:0),285-lift,27,9,selected?C.gold:'#d3e0e4');if(!selected){g.fillStyle='#fff';g.beginPath();g.arc(xs[i],301-lift,5,0,Math.PI*2);g.fill()}if(idx>=4&&selected)bead(xs[i],idx>=6?B-31:120);}
   arrow(819,298,819,252);if(idx>=6){box(387,175,395,9,C.purple);text('后续仍沿用磁退针：磁路没有被孔卡解决',372,338,12,C.line)}
 }else if(a.kind==='film'){
   bottom();text('同色密排拆成棋盘格两子批，不是一色一次',326,113,13,C.bad);const y=idx<3?217:idx<5?168:idx===5?168+(B-31-168)*u:B-31;
   box(375,250,360,18,C.plate);for(let i=0;i<xs.length;i++)if(i%2===0){if(idx>=2)bead(xs[i],y);if(idx<4){g.fillStyle='#fff';g.fillRect(xs[i]-12,250,24,12)}}
   if(idx>=3){const raised=idx>=6?u*54:0;line(372,y-raised,755,y,failed?C.bad:'#a0bfd5',5);if(failed)bead(xs[0],y-raised);text('膜保持／剥离均待验证，可能带起新豆和旧豆',372,149,12,C.line)}
 }else if(a.kind==='vacuum'){
   bottom();text('吸豆端面材料，不能直接盖住中心通孔',326,113,13);const y=idx<3?215:idx<5?180:idx===5?180+(B-35-180)*u:B-35;box(375,y-27,400,12,C.purple);
   for(let i=0;i<xs.length;i++){line(xs[i],y-15,xs[i],y,C.purple,3);if(idx<3||i%2===0)bead(xs[i],idx>=6?B-31:y);if(i%2===0)arrow(xs[i]-18,y-8,xs[i]-18,y-30,C.purple)}
   line(775,y-20,830,y-20,C.purple,4);box(821,y-20,34,44,C.purple);text(failed?'漏气：不能认定吸力已建立':'密封、限漏、供豆和真空源均未定型',372,157,12,failed?C.bad:C.line);
 }else if(a.kind==='robot'){
   bottom();text('历史路线：相机、散料盘、逐颗取放',326,112,13,C.bad);box(381,284,155,14,C.plate);for(let i=0;i<3;i++)bead(410+i*37,250);line(374,155,832,155,C.frame,12);const x=idx<3?431:idx===3?431+255*u:686;box(x-17,162,34,42,C.teal);line(x,204,x,238,C.teal,5);if(idx>=2&&idx<5)bead(x,227);if(idx>=4)bead(686,B-31);box(602,120,38,21,C.ink);text('CCD',621,136,10,'white','center');
 }else{
   bottom();text('旧概念未闭合：整豆孔与格距接近、缺孔壁',326,113,13,C.bad);for(let j=0;j<3;j++){box(373,173+j*45,415,12,C.plate);for(const x of xs){g.fillStyle='#fff';g.fillRect(x-25,172+j*45,50,13)}}for(let i=0;i<3;i++)bead(444+i*46,idx<2?134:247+u*65);text('不能依靠自由落体保证每颗豆套柱',372,323,13,C.bad);
 }
 if(failed){box(337,417,565,28,'#fff0ed',6);text('故障停在本步：先处理，不得继续或强行抬盒',620,436,14,C.bad,'center')}
 $('scene-title').textContent=`${a.id} · 第${idx+1}/${a.steps.length}步：${a.steps[idx]}`;
 $('scene-detail').textContent=a.steps[idx];$('scene-risk').textContent=(failed?'故障模式已停止。':'概览动画是预设轨迹，不是实体或物理仿真。 ')+a.risk;
 $('scene-steps').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===idx));transport();
}
$('route-select').onchange=()=>select($('route-select').value);$('color').onchange=render;
$('fault').onchange=()=>{clock=$('fault').value==='fail'?(failAt()+.62)*duration:0;playing=false;render()};
$('play').onclick=()=>{if($('fault').value==='fail'&&clock>=(failAt()+.62)*duration)return;if(clock>=active().steps.length*duration-1)clock=0;playing=!playing;transport()};
$('prev').onclick=()=>{clock=Math.max(0,pos().idx-1)*duration;playing=false;render()};$('next').onclick=()=>{clock=Math.min(active().steps.length-1,pos().idx+1)*duration;playing=false;render()};$('restart').onclick=()=>{clock=0;playing=false;$('fault').value='none';render()};$('seek').oninput=()=>{clock=Number($('seek').value)/1000*(active().steps.length*duration-1);playing=false;render()};
function tick(t){const dt=last?Math.min(t-last,100):0;last=t;if(playing&&tab==='animations'&&!document.hidden){clock+=dt*Number($('speed').value);if($('fault').value==='fail'&&clock>=(failAt()+.62)*duration){clock=(failAt()+.62)*duration;playing=false}if(clock>=active().steps.length*duration-1){clock=active().steps.length*duration-1;playing=false}render()}requestAnimationFrame(tick)}
function status(id,msg,bad=false){$(id).textContent=msg;$(id).className='sd-form-status '+(bad?'bad':'good')}
function recordsView(){const list=$('record-list');list.replaceChildren();if(!records.length){list.textContent='本机暂无记录；项目公开状态保持待测。';return}const p=document.createElement('p');p.textContent=`本机共${records.length}组用户自报记录，尚未经审核。不会自动改变项目关卡。`;list.append(p);for(const r of records.slice(-5).reverse()){const q=document.createElement('p');q.textContent=`${r.gate} · ${r.specimen}：${r.tested}次 / 失败${r.failed} / ${r.seconds}秒；证据引用：${r.evidence}`;list.append(q)}}
try{const saved=JSON.parse(localStorage.getItem(storage)||'[]');if(Array.isArray(saved))records=saved.filter(r=>r&&typeof r.specimen==='string'&&Number.isInteger(r.tested)&&Number.isInteger(r.failed)&&r.tested>0&&r.failed>=0&&r.failed<=r.tested).slice(-1000)}catch{}
$('record-form').onsubmit=e=>{e.preventDefault();try{const f=new FormData(e.currentTarget),r={};for(const k of ['gate','specimen','evidence','notes'])r[k]=String(f.get(k)||'').trim();for(const k of ['tested','failed','seconds']){const raw=String(f.get(k)||'').trim();if(!raw)throw Error('请填写实际数量和用时');r[k]=Number(raw)}if(!f.get('real'))throw Error('必须确认是实际测量');if(!d.gates.some(g=>g.id===r.gate)||!r.specimen||!r.evidence)throw Error('关卡、样件和证据引用不能空');if(!Number.isInteger(r.tested)||r.tested<1||r.tested>1000000||!Number.isInteger(r.failed)||r.failed<0||r.failed>r.tested||!Number.isFinite(r.seconds)||r.seconds<=0)throw Error('数量或用时无效；失败不能超过测试数');r.recordedAt=new Date().toISOString();r.source='USER_SELF_REPORTED_PHYSICAL';r.status='NOT_REVIEWED';const next=[...records,r].slice(-1000);localStorage.setItem(storage,JSON.stringify(next));records=next;recordsView();status('record-status','已保存到本浏览器；未上传，未批准任何关卡。');}catch(err){status('record-status',err.message,true)}};
$('export-records').onclick=()=>download('smartdrop-review-packet.json',JSON.stringify({schema:'evolution.smartdrop.measurement-review.v1',project:'smartdrop',baseRevision:d.revision,hardwareRevision:d.hardwareRevision,createdAt:new Date().toISOString(),records,publication:'PRIVATE_REVIEW_REQUIRED',note:'证据字段只是本机文件名引用；请另附实际证据。不得把自报记录自动记为验收通过。'},null,2));
const costKeys=['tools','template','consumable','copies','prep','wait','batch','manual'];
function cost(){const v={};for(const k of costKeys){const raw=$('cost-'+k).value.trim();if(!raw){$('cost-result').textContent='待填齐；空白不是0，不给出成本或省时结论。';return}v[k]=Number(raw);if(!Number.isFinite(v[k])||v[k]<0){$('cost-result').textContent='请输入有限的非负数。';return}}if(!Number.isInteger(v.copies)||v.copies<1){$('cost-result').textContent='复用次数必须是正整数。';return}const per=(v.tools+v.template)/v.copies+v.consumable,hand=v.prep/v.copies+v.batch,save=v.manual-hand;$('cost-result').textContent=`按本次输入摊销：每件材料/工具 ${per.toFixed(2)} 元；平均动手 ${hand.toFixed(2)} 分钟；对比逐颗手拼 ${save>=0?'减少':'增加'} ${Math.abs(save).toFixed(2)} 分钟。首次制版等待 ${v.wait.toFixed(2)} 分钟另计，不能从交付等待中隐藏。这是输入演算，不是报价或实测报告。`;}
for(const k of costKeys)$('cost-'+k).oninput=cost;
function closeLocal(){const box=$('local-container');box.replaceChildren();if(localURL)URL.revokeObjectURL(localURL);localURL=null;localFile=null;$('open-local').disabled=true;$('clear-local').disabled=true;}
$('local-file').onchange=async()=>{closeLocal();const file=$('local-file').files?.[0];if(!file)return;try{if(file.size>50000000)throw Error('文件超过本模块50 MB校验上限');status('local-status','正在本机读取并计算SHA-256，文件不会上传…');if(!crypto.subtle)throw Error('当前浏览器没有安全上下文SHA-256接口，请使用线上HTTPS页或localhost');const bytes=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');const known=d.artifacts.find(a=>a.sha256===hash&&a.bytes===file.size);if(!known)throw Error('指纹不在本版原件清单中；为避免误打开未知脚本，不执行此文件。新版本请更新项目清单。');localFile=file;localURL=URL.createObjectURL(file);$('clear-local').disabled=false;$('open-local').disabled=known.kind!=='html';status('local-status',`指纹匹配：${known.version}。仅保留在本机内存，未上传。`);if(known.kind!=='html'){const a=document.createElement('a');a.className='sd-button';a.href=localURL;a.download=known.name;a.textContent='导出已校验的本机原件';$('local-container').append(a)}}catch(err){status('local-status',err.message,true)}};
$('open-local').onclick=()=>{if(!localFile||!localURL)return;$('local-container').replaceChildren();const p=document.createElement('p');p.className='sd-notice';p.textContent='以下是在隔离框架里运行的原HTML。它的历史下载来自本机文件，不代表附件已公开托管；原件内本机存储功能可能受隔离限制。';const frame=document.createElement('iframe');frame.className='sd-frame';frame.title='已校验的SmartDrop原始离线工作台';frame.setAttribute('sandbox','allow-scripts allow-downloads allow-modals');frame.src=localURL;$('local-container').append(p,frame)};
$('clear-local').onclick=()=>{closeLocal();$('local-file').value='';status('local-status','本机原件已关闭并释放；没有删除磁盘文件。')};
window.SmartDropProject={show,select,state:()=>({tab,route,clock,playing,records:records.length}),seek:(i,u=.5)=>{clock=Math.min(active().steps.length*duration-1,Math.max(0,(i+u)*duration));playing=false;render()},version:d.revision};
recordsView();select('A');show(allowed.includes(location.hash.slice(1))?location.hash.slice(1):'overview');requestAnimationFrame(tick);
})();
