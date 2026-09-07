(() => {
  'use strict';
  const root=document.getElementById('game-goal');
  if(!root) return;
  const key='evolution.ai3d.goal.spotlight2026.v1';
  const checks=[...root.querySelectorAll('[data-goal-check]')];
  const status=document.getElementById('goal-local-status');
  function progress(){document.getElementById('goal-check-count').textContent=`${checks.filter(c=>c.checked).length} / ${checks.length} 项本机自查（不是官方完成进度）`;}
  function data(){return {schema:'evolution.ai3d.goal-checklist.v1',goalId:root.dataset.goalId,goalRevision:Number(root.dataset.goalRevision),goalUpdatedAt:root.dataset.goalUpdated,savedAt:new Date().toISOString(),storage:'local-browser-only',notOfficialEvidence:true,checks:Object.fromEntries(checks.map(c=>[c.dataset.goalCheck,c.checked]))};}
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.schema==='evolution.ai3d.goal-checklist.v1'&&saved.goalId===root.dataset.goalId&&saved.checks&&typeof saved.checks==='object'){for(const c of checks)c.checked=saved.checks[c.dataset.goalCheck]===true;}}catch{status.textContent='本机记录暂不可读；网站目标与仓库状态不受影响。';}
  progress();
  for(const c of checks)c.addEventListener('change',()=>{progress();try{localStorage.setItem(key,JSON.stringify(data()));status.textContent='已保存到本浏览器；未同步GitHub，未改变平台/仓库验收结果。';}catch{status.textContent='浏览器禁止保存；勾选仅在当前页面有效，请导出留存。';}});
  document.getElementById('goal-export-local').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data(),null,2)+'\n'],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='spotlight2026-local-checklist.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已导出本机自查；文件不是报名、审核或公开日志的回执。';});
  document.getElementById('goal-clear-local').addEventListener('click',()=>{if(!window.confirm('只清空本浏览器的参赛自查勾选？不会删除网站目标、原练习记录或任何仓库文件。'))return;for(const c of checks)c.checked=false;try{localStorage.removeItem(key);}catch{}progress();status.textContent='本机自查已清空；网站目标与原实验室练习记录保持不变。';});
  document.getElementById('goal-copy-log').addEventListener('click',async()=>{const text=document.getElementById('goal-log-template').textContent;try{await navigator.clipboard.writeText(text);status.textContent='已复制日志草稿模板；仍需按真实进度编辑并在TapTap发布。';}catch{const range=document.createRange();range.selectNodeContents(document.getElementById('goal-log-template'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='自动复制不可用，已选中模板；请手动复制。';}});
  function reveal(){const id=decodeURIComponent(location.hash.slice(1));const target=document.getElementById(id);if(!target||!root.contains(target))return;let el=target;while(el&&el!==root){if(el.tagName==='DETAILS')el.open=true;el=el.parentElement;}requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}
  root.addEventListener('click',event=>{const a=event.target.closest('a[href^="#goal-"]');if(a)setTimeout(reveal,0);});
  window.addEventListener('hashchange',reveal);reveal();
})();
