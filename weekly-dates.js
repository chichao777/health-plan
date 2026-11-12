function updateWeeklyOptionDates(){
  const start=document.getElementById('startDate').value || '2026-11-08';
  const first=new Date(start+'T12:00:00');
  if(Number.isNaN(first.getTime()))return;
  first.setDate(first.getDate()-first.getDay());
  const format=date=>String(date.getMonth()+1).padStart(2,'0')+'/'+String(date.getDate()).padStart(2,'0');
  [...document.getElementById('selectedWeek').options].forEach((option,index)=>{
    const sunday=new Date(first);sunday.setDate(first.getDate()+index*7);
    const saturday=new Date(sunday);saturday.setDate(sunday.getDate()+6);
    option.textContent=`第${index+1}周 ${format(sunday)}-${format(saturday)}`;
  });
}
document.getElementById('startDate').addEventListener('input',updateWeeklyOptionDates);
updateWeeklyOptionDates();

document.addEventListener('health-state-rendered',updateWeeklyOptionDates);
