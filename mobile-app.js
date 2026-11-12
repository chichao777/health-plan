(function () {
  'use strict';
  const id = name => document.getElementById(name);
  const titles = {profile:'个人档案',training:'训练安排',nutrition:'饮食标准',tracker:'指标追踪',weekly:'每周打卡'};
  function updateHeader() {id('appSubtitle').textContent = titles[document.body.dataset.activePage] || '个人档案'}
  new MutationObserver(updateHeader).observe(document.body,{attributes:true,attributeFilter:['data-active-page']});updateHeader();
  function updateSync() {
    const text = id('cloudStatus').textContent;
    id('appSyncLabel').textContent = text.includes('未登录') ? '登录同步' : text.includes('已同步') ? '已同步' : text.includes('离线') ? '离线' : /冲突|选择/.test(text) ? '待处理' : /失败|未完成|未配置|不可用/.test(text) ? '待同步' : '云端同步';
    id('appSyncButton').title = text;
  }
  new MutationObserver(updateSync).observe(id('cloudStatus'),{childList:true,characterData:true,subtree:true});updateSync();
  const syncDialog=id('cloudSync');
  function openSync(){
    if(!syncDialog.open){syncDialog.showModal();document.body.classList.add('sync-dialog-open')}
    id('appSyncButton').setAttribute('aria-expanded','true');
  }
  id('appSyncButton').addEventListener('click',openSync);
  id('closeCloudSync').addEventListener('click',()=>syncDialog.close());
  syncDialog.addEventListener('close',()=>{document.body.classList.remove('sync-dialog-open');id('appSyncButton').setAttribute('aria-expanded','false')});
  syncDialog.addEventListener('click',event=>{
    const bounds=syncDialog.getBoundingClientRect();
    if(event.target===syncDialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))syncDialog.close();
  });
  window.addEventListener('open-health-sync',openSync);
  window.addEventListener('hashchange',()=>{if(location.hash==='#cloudSync')openSync()});
  if(location.hash==='#cloudSync'||!id('cloudConflicts').hidden)openSync();
  function updateLoginView(){id('cloudLinkHelp').hidden=id('cloudLogin').hidden}
  new MutationObserver(updateLoginView).observe(id('cloudLogin'),{attributes:true,attributeFilter:['hidden']});updateLoginView();
  function makeWeekControl(containerId,label) {
    const box=document.createElement('div');box.className='app-week-switcher no-print';
    const prev=document.createElement('button');prev.type='button';prev.textContent='‹';prev.setAttribute('aria-label',label+'上一周');
    const select=document.createElement('select');select.setAttribute('aria-label',label+'选择周次');select.id=containerId+'Week';
    for(let n=1;n<=12;n++){const option=document.createElement('option');option.value=String(n);option.textContent=`第${n}周 · ${label==='训练' ? plan[n-1].phase.split('｜')[1] : '身体指标'}`;select.append(option)}
    const next=document.createElement('button');next.type='button';next.textContent='›';next.setAttribute('aria-label',label+'下一周');
    box.append(prev,select,next);
    select.addEventListener('change',()=>changeWeek(Number(select.value)));
    prev.addEventListener('click',()=>changeWeek(Number(select.value)-1));
    next.addEventListener('click',()=>changeWeek(Number(select.value)+1));
    return {box,select,prev,next};
  }
  const training=makeWeekControl('appTraining','训练'),tracking=makeWeekControl('appTracking','记录');
  id('weeklyPlans').before(training.box);
  id('trackingTable').closest('.table-wrap').before(tracking.box);
  function markWeeks() {
    const week=currentWeek();
    for(const control of [training,tracking]){control.select.value=String(week);control.prev.disabled=week===1;control.next.disabled=week===12}
    [...id('weeklyPlans').children].forEach((el,index)=>el.classList.toggle('app-current-week',index===week-1));
    [...id('trackingBody').children].forEach((el,index)=>el.classList.toggle('app-current-week',index===week-1));
  }
  function changeWeek(number){
    id('selectedWeek').value=String(Math.max(1,Math.min(12,number)));
    id('selectedWeek').dispatchEvent(new Event('change',{bubbles:true}));
  }
  id('selectedWeek').addEventListener('change',markWeeks);
  function labelTables(){
    document.querySelectorAll('.table-wrap table').forEach(table=>{
      const labels=[...table.querySelectorAll('thead th')].map(el=>el.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>{if(labels[index])cell.dataset.mobileLabel=labels[index]}));
    });markWeeks();
  }
  new MutationObserver(labelTables).observe(id('trackingBody'),{childList:true});
  new MutationObserver(markWeeks).observe(id('weeklyPlans'),{childList:true});labelTables();
  function localStatus(){id('saveStatus').classList.toggle('app-storage-error',/保存失败|不可用|请立即/.test(id('saveStatus').textContent));markWeeks()}
  new MutationObserver(localStatus).observe(id('saveStatus'),{childList:true,subtree:true});localStatus();
  let printDetails=[];
  window.addEventListener('beforeprint',()=>{printDetails=[...document.querySelectorAll('details:not([open])')];printDetails.forEach(el=>el.open=true)});
  window.addEventListener('afterprint',()=>{printDetails.forEach(el=>el.open=false);printDetails=[]});
  // Only compact chrome while a text keyboard is actually covering the screen.
  const viewport=window.visualViewport;
  if(viewport){
    const resize=()=>{
      const field=document.activeElement;
      const editing=field && (field.tagName==='TEXTAREA'||field.tagName==='INPUT'&&!['checkbox','button','file'].includes(field.type));
      document.body.classList.toggle('keyboard-open',!!editing && window.innerHeight-viewport.height>120);
    };
    viewport.addEventListener('resize',resize);document.addEventListener('focusin',resize);document.addEventListener('focusout',()=>setTimeout(resize,100));
  }
  let installation;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installation=event;id('appInstallButton').hidden=false});
  id('appInstallButton').addEventListener('click',async()=>{if(!installation)return;await installation.prompt();installation=null;id('appInstallButton').hidden=true});
  if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)id('appInstallTip').hidden=true;
  if('serviceWorker' in navigator && location.protocol==='https:'){
    const controlled=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)id('appUpdate').hidden=false});
  }
  id('appReload').addEventListener('click',()=>{
    if(document.activeElement?.matches('input,textarea'))document.activeElement.blur();
    const url=new URL(location.href);url.searchParams.set('v','20261112-app3');location.replace(url.href);
  });
})();
