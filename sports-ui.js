(function(){
 'use strict';
 const id=name=>document.getElementById(name);
 function summary(){
   const percent=id('checkPercent').textContent;
   id('v3HomePercent').textContent=percent;
   id('v3HomeBar').style.width=percent;
   id('v3HomeCount').textContent=id('checkSummary').textContent;
   id('v3HomeWeek').textContent=id('selectedWeek').selectedOptions[0]?.textContent||'';
 }
 new MutationObserver(summary).observe(id('checkPercent'),{childList:true,characterData:true,subtree:true});
 id('selectedWeek').addEventListener('change',summary);id('startDate').addEventListener('input',summary);summary();
 function trend(){
   const points=Array.from({length:12},(_,i)=>({week:i+1,value:Number(state[`w${i+1}_weight`])})).filter(point=>Number.isFinite(point.value)&&point.value>0);
   const container=id('v3TrendBody');
   if(points.length<2){
     const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 4v16h16M8 15l4-5 4 3 4-7"/></svg>';
     container.innerHTML='<div class="v3-trend-empty">'+icon+'<strong>'+(points.length?'已记录 1 周':'还没有周记录')+'</strong><p>记录至少 2 周体重后，在这里查看趋势。</p></div>';return;
   }
   const values=points.map(point=>point.value),min=Math.min(...values)-.8,max=Math.max(...values)+.8;
   const coords=points.map(point=>({x:24+(point.week-1)/11*252,y:100-(point.value-min)/(max-min)*72,value:point.value}));
   const line=coords.map((point,i)=>(i?'L':'M')+point.x.toFixed(1)+' '+point.y.toFixed(1)).join(' ');
   container.innerHTML='<div class="v3-trend-meta"><span>'+points.length+' 周有效记录</span><span>单位：kg</span></div><svg class="v3-chart" viewBox="0 0 300 140" role="img" aria-label="基于实际每周体重记录的趋势图"><path d="M24 28H276M24 64H276M24 100H276" stroke="#e7eef5" stroke-dasharray="3 4"/><path d="'+line+'" fill="none" stroke="#91b8d7" stroke-width="3" stroke-linejoin="round"/>'+coords.map(point=>'<circle cx="'+point.x+'" cy="'+point.y+'" r="4" fill="#527c9c"/><text x="'+point.x+'" y="'+(point.y-10)+'" text-anchor="middle" fill="#7999b0" font-size="9">'+point.value+'</text>').join('')+'<text x="24" y="128" fill="#96acbb" font-size="10">第1周</text><text x="276" y="128" fill="#96acbb" text-anchor="end" font-size="10">第12周</text></svg>';
 }
 document.addEventListener('input',event=>{if(event.target.matches('[data-track][data-key="weight"]'))trend()});document.addEventListener('health-state-rendered',()=>{summary();trend()});trend();
})();
