(() => {
  const search=document.getElementById('glasses-search'), category=document.getElementById('glasses-category'), reset=document.getElementById('glasses-reset'), count=document.getElementById('glasses-count');
  if(!search||!category||!reset||!count) return;
  const usecase=document.getElementById('glasses-usecase');
  const status=document.getElementById('glasses-status'), capability=document.getElementById('glasses-capability');
  const cards=[...document.querySelectorAll('[data-glasses-product]')];
  function filter(){let n=0;const q=search.value.trim().toLocaleLowerCase();for(const card of cards){const cap=(capability?.value||'').split(':');const show=(!usecase?.value||(card.dataset.useCases||'').split(' ').includes(usecase.value))&&(!status?.value||card.dataset.status===status.value)&&(!capability?.value||card.dataset[cap[0]]===cap[1])&&(!category.value||card.dataset.category===category.value)&&(!q||card.dataset.search.toLocaleLowerCase().includes(q));card.hidden=!show;if(show)n++;}count.textContent=n?`显示 ${n} / ${cards.length} 条产品 / 系列记录`:'没有匹配产品；可清除筛选或查看覆盖缺口。';}
  usecase?.addEventListener('change',filter);status?.addEventListener('change',filter);capability?.addEventListener('change',filter);search.addEventListener('input',filter);category.addEventListener('change',filter);reset.addEventListener('click',()=>{search.value='';category.value='';if(usecase)usecase.value='';if(status)status.value='';if(capability)capability.value='';filter();search.focus();});filter();
  const choices=[...document.querySelectorAll('[data-compare-choice]')], cells=[...document.querySelectorAll('[data-compare-model]')], compareStatus=document.getElementById('glasses-compare-status');
  function compare(event){let selected=choices.filter(c=>c.checked).map(c=>c.value);if(selected.length>4){event.target.checked=false;compareStatus.textContent='最多同时比较4款，请先取消一个型号。';return;}for(const cell of cells)cell.hidden=!selected.includes(cell.dataset.compareModel);if(compareStatus)compareStatus.textContent=selected.length<2?'当前少于2款；请再选择型号进行横向对比。':`当前对比 ${selected.length} 款；未知值不是0，也不代表不支持。`;}
  for(const choice of choices)choice.addEventListener('change',compare);
})();
