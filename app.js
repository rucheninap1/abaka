
'use strict';
var $=function(id){return document.getElementById(id);}, S=null, auth={}, selected=null, busy=false, pollTimer=null, request=null, requestSignature='', initialized=false, lastRecords='', offset=0, lastSuccess=0;
var imageReviewId='',imageRequestToken=0;
var reviewSelection='',reviewDrafts={},reviewDetailSignature='',reviewPhotoId='',reviewPhotoData='',reviewPhotoToken=0;
var statusLabels={yes:'Верно',no:'Неверно',pending:'На проверке',cancelled:'Отменено',skipped:'Пропущено'};
function el(tag,text,cls){var e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function show(id,yes){$(id).classList.toggle('hidden',!yes);}
function toast(msg,error){$('toast').textContent=msg;$('toast').className='alert'+(error?' error':'');clearTimeout(toast.timer);toast.timer=setTimeout(function(){show('toast',false);},8000);}
var API='';
async function rpc(name,args){var res,j;
 try{res=await fetch(API,{method:'POST',body:JSON.stringify({fn:name,args:args||[]}),redirect:'follow'});}catch(e){throw new Error('Нет связи с сервером. Проверьте интернет.');}
 try{j=await res.json();}catch(e){throw new Error('Сервер ответил не так, как ожидалось. Проверьте адрес /exec и что доступ веб-приложения — «Все».');}
 if(!j.ok)throw new Error(j.error||'Ошибка сервера');return j.data;}
function siteBase(){return location.origin+location.pathname;}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function taskPuzzle(t){var id=t?Puzzle.parseMarker(t.text):'';return id&&Puzzle.DEFS[id]?Puzzle.DEFS[id]:null;}
function isSolution(a){return typeof a==='string'&&a.indexOf('{"boards"')===0;}
var puzzleCtl=null,puzzleKey='';
function running(){return S&&S.start&&!S.closed&&Date.now()+offset<S.end;}
function timeText(time){return new Date(time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Moscow'});}
function teamName(id){var t=S.teams.find(function(t){return t.id===id;});return t?t.name:id;}
function ownActive(){return (S.records||[]).filter(function(r){return r.status!=='cancelled';});}
function permitted(theme,n){if(!running())return false;var rs=ownActive();if(rs.some(function(r){return r.theme===theme&&r.n===n;}))return false;for(var i=1;i<n;i++)if(!rs.some(function(r){return r.theme===theme&&r.n===i;}))return false;return true;}
function topicName(theme){var t=(S.taskInfo||[]).find(function(t){return t.theme===theme;});return t?t.topic:(S.topics&&S.topics[theme])||'Тема '+theme;}
function makeButton(label,fn,cls){var b=el('button',label,cls);b.type='button';b.onclick=fn;return b;}
function td(row,text,tag){var c=el(tag||'td',text);row.append(c);return c;}
function tick(){if(!S)return;var remain=S.start?Math.max(0,Math.ceil((S.end-Date.now()-offset)/1000)):S.minutes*60;$('clock').textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');$('phase').textContent=!S.start?'До старта':running()?'Игра идёт':'Игра завершена';if(S.start&&!running()&&$('send'))$('send').disabled=true;if(lastSuccess&&Date.now()-lastSuccess>35000)$('connection').textContent='Нет свежего обновления. Проверяем связь…';}
async function refresh(){if(busy)return;schedule(false);try{var next=await rpc('getState',[auth]);if(S&&S.game!==next.game)resetView();S=next;offset=S.now-Date.now();lastSuccess=Date.now();$('connection').textContent='Обновлено в '+timeText(S.now);render();}catch(e){if(/Ссылка команды недействительна/.test(e.message)&&auth.team){lsSet('abaka_team_'+auth.game,'');history.replaceState(null,'',roomLink(auth.game));route();return;}$('connection').textContent='Не удалось обновить: '+e.message;if(!S)fatal(e.message);}finally{schedule(true);}}
function schedule(enabled){clearTimeout(pollTimer);if(enabled)pollTimer=setTimeout(refresh,(S&&S.admin?7000:12000)+Math.random()*3000);}
async function act(name,args,message){if(busy)return;busy=true;document.querySelectorAll('button').forEach(function(b){b.dataset.previousDisabled=String(b.disabled);b.disabled=true;});try{await rpc(name,args);if(message)toast(message);return true;}catch(e){toast(e.message,true);return false;}finally{busy=false;document.querySelectorAll('button').forEach(function(b){b.disabled=b.dataset.previousDisabled==='true';});await refresh();}}
function renderScores(){var table=el('table'),head=el('tr');['Место','Команда / участник','Задачи','Бонусы','Всего','Сдано','На проверке'].forEach(function(s){td(head,s,'th');});table.append(head);S.teams.forEach(function(t){var r=el('tr');[t.place,t.name,t.base,t.bonus,t.total,t.sent,t.pending].forEach(function(v){td(r,v);});table.append(r);});$('scoreboard').replaceChildren(table);show('provisional',S.provisional);}
function renderTeamBoards(){
 var container=$('teamBoards');container.replaceChildren();
 S.teams.forEach(function(team){
  var mine=!!(S.me&&S.me.id===team.id),card=el('article',undefined,'team-board'+(mine?' mine':''));
  card.append(el('h3',team.name+(mine?' · ваша команда':'')));
  var cells=team.cells||[],correct=cells.filter(function(c){return c.status==='yes';}).length;
  card.append(el('p',team.total+' баллов · верно '+correct+' из '+S.themes*S.tasksPerTheme+' · бонусы '+team.bonus,'team-meta'));
  var scroll=el('div',undefined,'scroll'),table=el('table'),caption=el('caption','Результаты команды «'+team.name+'»');
  caption.className='hidden';table.append(caption);
  var head=el('thead'),header=el('tr');td(header,'Блок','th').scope='col';
  for(var n=1;n<=S.tasksPerTheme;n++)td(header,n*10,'th').scope='col';
  head.append(header);table.append(head);var body=el('tbody'),lookup={};
  cells.forEach(function(c){if(['yes','no','pending','skipped'].includes(c.status))lookup[c.theme+':'+c.n]=c.status;});
  for(var theme=1;theme<=S.themes;theme++){
   var row=el('tr');td(row,topicName(theme),'th').scope='row';
   for(var n=1;n<=S.tasksPerTheme;n++){
    var status=lookup[theme+':'+n]||'empty',label=statusLabels[status]||'Не отправлено',symbol={yes:'✓',no:'✕',pending:'⌛',skipped:'↷',empty:'—'}[status];
    var cell=el('td'),mark=el('div',undefined,'team-cell '+status);
    mark.title=topicName(theme)+' · задача '+n+' ('+n*10+' баллов): '+label;
    mark.setAttribute('aria-label',mark.title);mark.append(el('span',symbol));
    cell.append(mark);row.append(cell);
   }
   body.append(row);
  }
  table.append(body);scroll.append(table);card.append(scroll);container.append(card);
 });
}
function renderBonuses(){var t=el('table'),h=el('tr');['Линия','Бонус','Кто получил'].forEach(function(s){td(h,s,'th');});t.append(h);S.lines.forEach(function(l){var r=el('tr');td(r,l.id[0]==='h'&&S.me?topicName(Number(l.id.slice(1))):l.label);td(r,'+'+l.base+' / первым +'+l.base*2);td(r,l.awards.length?l.awards.map(function(a){return teamName(a.team)+': +'+a.points+(a.first?' ★':'');}).join('; '):'Пока никто');t.append(r);});$('bonuses').replaceChildren(t);}
function renderRules(){$('rules').replaceChildren();['Поле: '+S.themes+' тем × '+S.tasksPerTheme+' задач. Время: '+S.minutes+' мин.','Все условия доступны после старта. Темы можно решать параллельно. Ответы внутри темы сдаются по порядку. После отправки открывается сдача следующей задачи — ждать проверки не нужно.','Одна попытка на задачу. Верный ответ даёт 10, 20, 30… баллов по номеру задачи; неверный или неполный — 0.','Все задачи темы верны: бонус +'+S.tasksPerTheme*10+'. Все задачи одного номера во всех темах верны: бонус равен цене задачи этого номера.','Первая команда, закрывшая каждую линию, получает её бонус в двойном размере. Время линии — время получения последнего ответа сервером. Проверка картинки позже не меняет это время. При одинаковом времени до миллисекунды первенство разделяется.','Бонусы до завершения ручной проверки предварительные. При исправлении оценки или отмене сдачи бонусы пересчитываются.','Места: сначала общая сумма баллов, затем сумма бонусов. Если оба показателя равны — общее место.','Числа: десятичная запятая или точка, обычные дроби вида 1/2. Наборы чисел: через точку с запятой; порядок не важен, количество повторений важно. Текст: без учёта регистра, ё/е и лишних пробелов. Нераспознанный ввод и картинки проверяет ведущая.'].forEach(function(s){$('rules').append(el('p',s));});}
function reviewRecords(){
 var filter=$('reviewFilter').value,team=$('reviewTeam').value;
 return S.records.filter(function(r){return (filter==='all'||r.status===filter)&&(team==='all'||r.team===team);}).slice().sort(function(a,b){return a.time-b.time;});
}
function renderReviews(){
 var selectedTeam=$('reviewTeam').value||'all';$('reviewTeam').replaceChildren();
 var option=el('option','Все команды');option.value='all';$('reviewTeam').append(option);
 S.teams.slice().sort(function(a,b){return Number(a.id)-Number(b.id);}).forEach(function(t){var o=el('option',t.name);o.value=t.id;$('reviewTeam').append(o);});
 $('reviewTeam').value=S.teams.some(function(t){return t.id===selectedTeam;})?selectedTeam:'all';
 var records=reviewRecords(),container=$('reviews');container.replaceChildren();
 var pending=S.records.filter(function(r){return r.status==='pending';}).length;
 $('reviewCount').textContent='На проверке: '+pending+' · показано: '+records.length;
 if(!records.some(function(r){return r.id===reviewSelection;}))reviewSelection=records.length?records[0].id:'';
 if(!records.length)container.append(el('p','Сдач в этой очереди нет.','review-empty'));
 records.forEach(function(r){
  var button=makeButton('',function(){reviewSelection=r.id;renderReviews();},'review-item'+(r.id===reviewSelection?' active':''));
  button.setAttribute('aria-current',r.id===reviewSelection?'true':'false');
  button.append(el('strong',teamName(r.team)),el('span',topicName(r.theme)+' · задача '+r.n+' · '+r.n*10+' баллов','queue-task'));
  var bar=el('div',undefined,'bar between');bar.append(el('span',statusLabels[r.status],'tag '+r.status),el('small',timeText(r.time)+(r.hasFile?' · фото':'')));button.append(bar);container.append(button);
 });
 renderReviewDetail(records.find(function(r){return r.id===reviewSelection;}));
}
function renderReviewDetail(r){
 var signature=JSON.stringify(r?[r,teamName(r.team),topicName(r.theme),(S.taskInfo||[]).find(function(t){return t.theme===r.theme&&t.n===r.n;})]:null);
 if(signature===reviewDetailSignature)return;reviewDetailSignature=signature;
 var token=++reviewPhotoToken,container=$('reviewDetail');container.replaceChildren();
 if(!r){container.append(el('div','Нет ответов для проверки. Новые сдачи появятся автоматически.','review-empty'));return;}
 var card=el('article',undefined,'review-detail'),heading=el('div',undefined,'review-heading');
 heading.append(el('h3',teamName(r.team)),el('p',topicName(r.theme)+' · задача '+r.n+' · '+r.n*10+' баллов'));
 var meta=el('div',undefined,'bar between');meta.append(el('span',statusLabels[r.status],'tag '+r.status),el('small','Получено в '+timeText(r.time)));heading.append(meta);card.append(heading);
 var body=el('div',undefined,'review-body');
 var pz0=taskPuzzle((S.taskInfo||[]).find(function(t){return t.theme===r.theme&&t.n===r.n;}));
 if(r.answer&&pz0&&isSolution(r.answer)){var pbox=el('div',undefined,'pz-readonly');body.append(pbox);PuzzleUI.mount(pbox,pz0,{readonly:true,solution:r.answer});body.append(el('p','Проверено автоматически: разрезание верное.','muted'));}
 else if(r.answer)body.append(el('p',r.answer,'answer'));
 if(r.hasFile){
  var photo=el('div',undefined,'review-photo');photo.id='reviewPhoto';photo.append(el('p','Загружаем фото…','muted'));body.append(photo);
 }else if(!r.answer)body.append(el('p','К этой сдаче не приложен ответ.','muted'));
 var task=(S.taskInfo||[]).find(function(t){return t.theme===r.theme&&t.n===r.n;});
 if(task){var details=el('details',undefined,'statement-details');details.append(el('summary','Посмотреть условие'),el('p',Puzzle.stripMarker(task.text),'statement'));body.append(details);}
 if(r.status==='skipped'){body.append(el('p','Команда пропустила эту задачу. Баллы не начисляются.'));var back=el('div',undefined,'bar');back.append(makeButton('Вернуть задачу команде',function(){if(confirm('Вернуть команде «'+teamName(r.team)+'» задачу '+r.n+', чтобы она решила её заново?'))saveReview(r.id,'cancelled');},'secondary'));body.append(back);card.append(body);}else if(r.status!=='cancelled'){
  var label=el('label','Комментарий команде (необязательно)','review-note-label');label.htmlFor='reviewNote';
  var note=el('input');note.id='reviewNote';note.className='review-note';note.placeholder='Например: части не совпадают по форме';note.value=Object.prototype.hasOwnProperty.call(reviewDrafts,r.id)?reviewDrafts[r.id]:(r.note||'');
  note.oninput=function(){reviewDrafts[r.id]=note.value;};body.append(label,note);
  var extra=el('details',undefined,'review-extra');extra.append(el('summary','Исправить статус или отменить сдачу'));
  var buttons=el('div',undefined,'bar');buttons.append(makeButton('⌛ На проверку',function(){saveReview(r.id,'pending');},'secondary'),makeButton('Отменить сдачу',function(){if(confirm('Отменить сдачу команды «'+teamName(r.team)+'», '+topicName(r.theme)+', задача '+r.n+'? Команда сможет отправить ответ заново.'))saveReview(r.id,'cancelled');},'secondary'));
  extra.append(buttons);body.append(extra);card.append(body);
  var actions=el('div',undefined,'review-actions');actions.append(makeButton('✓ Верно · +'+r.n*10,function(){saveReview(r.id,'yes');},'review-yes'),makeButton('✕ Неверно · 0',function(){saveReview(r.id,'no');},'review-no'));card.append(actions);
 }else{if(r.note)body.append(el('p',r.note));body.append(el('p','Сдача отменена. Команда может отправить ответ заново.','muted'));card.append(body);}
 container.append(card);if(r.hasFile)loadReviewPhoto(r,token);
}
async function saveReview(id,status){
 var note=$('reviewNote')?$('reviewNote').value:'';reviewDrafts[id]=note;
 var ok=await act('review',[auth.game,auth.admin,id,status,note],status==='cancelled'?'Сдача отменена':'Оценка сохранена');
 if(ok)delete reviewDrafts[id];
}
async function loadReviewPhoto(r,token){
 try{
  var src;if(reviewPhotoId===r.id&&reviewPhotoData)src=reviewPhotoData;
  else{var pic=await rpc('getPicture',[auth,r.id]);if(!['image/jpeg','image/png','image/webp'].includes(pic.type))throw Error('Неизвестный формат');src='data:'+pic.type+';base64,'+pic.data;if(token!==reviewPhotoToken)return;reviewPhotoId=r.id;reviewPhotoData=src;}
  if(token!==reviewPhotoToken)return;
  var box=$('reviewPhoto');box.replaceChildren();var img=el('img');img.alt='Ответ команды «'+teamName(r.team)+'», '+topicName(r.theme)+', задача '+r.n;img.src=src;img.onclick=function(){openPicture(r.id);};
  box.append(img,makeButton('Увеличить фото ↗',function(){openPicture(r.id);},'secondary'));
 }catch(e){if(token!==reviewPhotoToken)return;var box=$('reviewPhoto');box.replaceChildren(el('p','Фото не загрузилось: '+e.message,'muted'),makeButton('Повторить загрузку',function(){loadReviewPhoto(r,token);},'secondary'));}
}
function renderParticipant(){var me=S.teams.find(function(t){return t.id===S.me.id;});$('mySummary').replaceChildren();[['Всего',me.total],['За задачи',me.base],['Бонусы',me.bonus],['На проверке',me.pending]].forEach(function(x){var d=el('div');d.append(el('div',x[0],'muted'),el('b',x[1]));$('mySummary').append(d);});$('taskBoard').replaceChildren();if(!S.start){$('taskBoard').append(el('p','Игра ещё не началась. Условия появятся после старта ведущей.','muted'));show('answerPanel',false);return;}var table=el('table',undefined,'board'),h=el('tr');td(h,'Тема','th');for(var n=1;n<=S.tasksPerTheme;n++)td(h,n*10,'th');table.append(h);for(var a=1;a<=S.themes;a++){var row=el('tr');td(row,topicName(a)).className='task-name';for(var b=1;b<=S.tasksPerTheme;b++){(function(theme,n){var r=ownActive().find(function(r){return r.theme===theme&&r.n===n;}),button=makeButton(String(n*10),function(){if(selected&&(selected.theme!==theme||selected.n!==n)&&($('answer').value||$('picture').files.length)){if(!confirm('Перейти к другой задаче? Неотправленный ответ будет очищен.'))return;}selected={theme:theme,n:n};request=null;requestSignature='';$('answer').value='';$('picture').value='';renderParticipant();$('answerPanel').scrollIntoView({behavior:'smooth',block:'nearest'});},'task'+(r?' '+r.status:'')+(selected&&selected.theme===theme&&selected.n===n?' selected':''));button.append(el('small',r?statusLabels[r.status]:permitted(theme,n)?'Можно сдать':'Просмотр'));var c=el('td');c.append(button);row.append(c);})(a,b);}table.append(row);}$('taskBoard').append(table);renderAnswer();$('myHistory').replaceChildren();(S.records||[]).slice().reverse().forEach(function(r){var p=el('div',undefined,'record');p.append(el('b',topicName(r.theme)+' · '+r.n+' · '+statusLabels[r.status]),el('p',isSolution(r.answer)?'(разрезание принято автоматически)':(r.answer||'(картинка)'),'answer'),el('small',timeText(r.time)));if(r.note)p.append(el('p',r.note));if(r.hasFile)p.append(makeButton('Картинка',function(){openPicture(r.id);},'secondary'));$('myHistory').append(p);});}
function renderAnswer(){show('answerPanel',!!selected);if(!selected)return;var t=S.taskInfo.find(function(t){return t.theme===selected.theme&&t.n===selected.n;}),r=ownActive().find(function(r){return r.theme===selected.theme&&r.n===selected.n;}),pz=taskPuzzle(t);
 $('answerTitle').textContent=topicName(selected.theme)+' · задача '+selected.n+' · '+selected.n*10+' баллов';$('statement').textContent=t?Puzzle.stripMarker(t.text):'';
 var sk=!!r&&r.status==='skipped';show('existingAnswer',!!r&&(!pz||sk));$('existingAnswer').textContent=sk?'Вы пропустили эту задачу. Вернуться к ней нельзя, баллы за неё не начисляются.':r?(r.answer||'(ответ на картинке)'):'';
 show('textAnswer',!pz);show('puzzleBox',!!pz&&!r);$('send').textContent=pz?'Отправить решение':'Отправить ответ';show('sendNote',!pz);
 $('puzzleDone').replaceChildren();
 if(pz&&r&&isSolution(r.answer)){PuzzleUI.mount($('puzzleDone'),pz,{readonly:true,solution:r.answer});}
 if(pz&&!r){var key=S.game+'|'+selected.theme+'|'+selected.n;
  if(puzzleKey!==key||!puzzleCtl){puzzleKey=key;puzzleCtl=PuzzleUI.mount($('puzzleBox'),pz,{storageKey:'abaka_draft_'+key+'_'+(auth.team||'').slice(0,8)});}}
 show('answerForm',!r);$('send').disabled=busy||!permitted(selected.theme,selected.n);$('skip').disabled=busy||!running()||!permitted(selected.theme,selected.n);
 $('answerStatus').textContent=r?statusLabels[r.status]+(r.note?' — '+r.note:''):!running()?'Приём ответов закрыт.':!permitted(selected.theme,selected.n)?'Сначала отправь ответы на предыдущие задачи этой темы.':'';
 show('myPicture',!!(r&&r.hasFile));$('myPicture').onclick=r?function(){openPicture(r.id);}:null;}
function closePicture(){
 imageRequestToken++;imageReviewId='';$('imageDialog').close();$('image').removeAttribute('src');show('imageReviewActions',false);
}
async function openPicture(id){
 var token=++imageRequestToken,r=(S.records||[]).find(function(r){return r.id===id;});imageReviewId=id;
 $('image').removeAttribute('src');$('imageMessage').textContent='Загружаем фото…';show('imageReviewActions',false);
 $('imageHeading').textContent=r?(S.admin?teamName(r.team):S.me.name)+' · '+topicName(r.theme)+' · задача '+r.n:'Фото ответа';
 if(!$('imageDialog').open)$('imageDialog').showModal();
 try{
  var src;if(reviewPhotoId===id&&reviewPhotoData)src=reviewPhotoData;
  else{var pic=await rpc('getPicture',[auth,id]);if(!['image/jpeg','image/png','image/webp'].includes(pic.type))throw Error('Неизвестный формат');src='data:'+pic.type+';base64,'+pic.data;}
  if(token!==imageRequestToken)return;
  $('image').src=src;$('imageMessage').textContent='';
  var canReview=!!(S.admin&&r&&r.status!=='cancelled');show('imageReviewActions',canReview);
  if(canReview){
   $('imageReviewNote').value=Object.prototype.hasOwnProperty.call(reviewDrafts,id)?reviewDrafts[id]:(r.note||'');
   $('imageYes').textContent='✓ Верно · +'+r.n*10;$('imageNo').textContent='✕ Неверно · 0';
  }
 }catch(e){if(token===imageRequestToken)$('imageMessage').textContent='Фото не загрузилось: '+e.message;}
}
async function saveImageReview(status){
 if(busy||!S.admin||!imageReviewId)return;
 var id=imageReviewId,r=S.records.find(function(r){return r.id===id;});
 if(!r||r.status==='cancelled'){toast('Эта сдача уже отменена.',true);closePicture();return;}
 var note=$('imageReviewNote').value;reviewDrafts[id]=note;
 var ok=await act('review',[auth.game,auth.admin,id,status,note],'Оценка сохранена');
 if(ok){delete reviewDrafts[id];if(imageReviewId===id)closePicture();}
}
function readFile(file){return new Promise(function(resolve,reject){if(!file){resolve(null);return;}if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){reject(new Error('Выбери JPG, PNG или WebP до 4 МБ'));return;}var reader=new FileReader();reader.onerror=function(){reject(new Error('Не удалось прочитать файл'));};reader.onload=function(){resolve({type:file.type,data:String(reader.result).split(',')[1]});};reader.readAsDataURL(file);});}
$('reviewFilter').onchange=$('reviewTeam').onchange=function(){lastRecords='';renderHost();};$('closeImage').onclick=closePicture;$('imageDialog').oncancel=function(e){e.preventDefault();closePicture();};
$('imageYes').onclick=function(){saveImageReview('yes');};$('imageNo').onclick=function(){saveImageReview('no');};
$('imageReviewNote').oninput=function(){if(imageReviewId){reviewDrafts[imageReviewId]=this.value;if(reviewSelection===imageReviewId&&$('reviewNote'))$('reviewNote').value=this.value;}};
$('send').onclick=async function(){if(busy||!selected||!permitted(selected.theme,selected.n))return;var pzTask=taskPuzzle(S.taskInfo.find(function(t){return t.theme===selected.theme&&t.n===selected.n;})),answer,file;
if(pzTask){if(!puzzleCtl||!puzzleCtl.ok()){toast('Пока не получилось: '+(puzzleCtl?'решение неверное':'нарисуйте разрезание'),true);return;}answer=JSON.stringify(puzzleCtl.solution());file=null;if(!confirm('Отправить это решение на задачу '+selected.n+' темы «'+topicName(selected.theme)+'»? Оно уже проверено.'))return;}
else{answer=$('answer').value.trim();file=$('picture').files[0];if(!answer&&!file){toast('Введите ответ или приложите картинку',true);return;}if(!confirm('Отправить ответ на задачу '+selected.n+' темы «'+topicName(selected.theme)+'»? Это единственная попытка.'))return;}busy=true;var theme=selected.theme,n=selected.n;$('send').disabled=true;try{var signature=JSON.stringify([theme,n,answer,file?file.name:'',file?file.size:0,file?file.lastModified:0]);if(!request||signature!==requestSignature){request={id:crypto.randomUUID(),theme:theme,n:n,answer:answer,file:await readFile(file)};requestSignature=signature;}var result=await rpc('submitAnswer',[auth.game,auth.team,request]);toast('Ответ получен: '+statusLabels[result.status]);request=null;requestSignature='';$('answer').value='';$('picture').value='';}catch(e){toast(e.message+' При сбое связи можно повторить отправку.',true);}finally{busy=false;await refresh();}};

$('skip').onclick=async function(){if(busy||!selected||!running()||!permitted(selected.theme,selected.n))return;if(!confirm('Пропустить задачу '+selected.n+' темы «'+topicName(selected.theme)+'»? Вернуться к ней будет нельзя, баллы за неё не начисляются.'))return;busy=true;$('skip').disabled=true;$('send').disabled=true;var theme=selected.theme,n=selected.n;try{await rpc('submitAnswer',[auth.game,auth.team,{id:crypto.randomUUID(),theme:theme,n:n,skip:true}]);toast('Задача пропущена');request=null;requestSignature='';$('answer').value='';$('picture').value='';}catch(e){toast(e.message,true);}finally{busy=false;await refresh();}};

/* ===== игры, вход команд, линкер ведущей ===== */
var presets=window.ABAKA_PRESETS||[];
function enc(v){return encodeURIComponent(v);}
function linkBase(){return siteBase()+'#'+(API&&API!==window.ABAKA_API?'api='+enc(API)+'&':'');}
function roomLink(game){return linkBase()+'game='+enc(game);}
function teamLink(game,key){return roomLink(game)+'&team='+enc(key);}
function hostLink(game,key){return roomLink(game)+'&admin='+enc(key);}
function myGames(){try{return JSON.parse(lsGet('abaka_games')||'[]');}catch(e){return [];}}
function saveMyGame(game,admin,title){var l=myGames(),cur=l.find(function(g){return g.game===game;});if(cur&&cur.title===title&&cur.admin===admin)return;l=l.filter(function(g){return g.game!==game;});l.unshift({game:game,admin:admin,title:title||'Игра',at:cur?cur.at:Date.now()});lsSet('abaka_games',JSON.stringify(l.slice(0,30)));}
function copyText(text){var done=function(){toast('Ссылка скопирована');};
 if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done,function(){fallbackCopy(text);done();});}else{fallbackCopy(text);done();}}
function fallbackCopy(text){var t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();try{document.execCommand('copy');}catch(e){}t.remove();}
function fatal(msg){var f=$('fatal');f.replaceChildren(el('p',msg));f.append(makeButton('На главную',function(){location.hash='';route();},'secondary'));show('fatal',true);}
function resetView(){selected=null;request=null;requestSignature='';initialized=false;lastRecords='';closePicture();reviewSelection='';reviewDrafts={};reviewDetailSignature='';reviewPhotoToken++;reviewPhotoId='';reviewPhotoData='';$('answer').value='';$('picture').value='';puzzleCtl=null;puzzleKey='';$('puzzleBox').replaceChildren();}

/* таблица задач <-> текст */
function parseTasks(text){var out=[],first=true;String(text).replace(/\r/g,'').split('\n').forEach(function(line,i){if(!line.trim())return;var c=line.split('\t');
 if(first){first=false;if(isNaN(Number(c[0].trim())))return;}
 if(c.length<5)throw new Error('Строка '+(i+1)+': нужно 5–6 столбцов, разделённых табуляцией (вставляйте из Google-таблицы или Excel)');
 out.push({theme:Number(c[0]),topic:c[1].trim(),n:Number(c[2]),text:c[3].trim(),mode:c[4].trim(),key:(c[5]||'').trim()});});return out;}
function tasksToTsv(list){var rows=[['Тема №','Название темы','Задача №','Условие','Проверка','Правильные ответы (варианты через |)']];(list||[]).forEach(function(t){rows.push([t.theme,t.topic,t.n,t.text,t.mode,t.key]);});return rows.map(function(r){return r.join('\t');}).join('\n');}
function presetTsv(p){return tasksToTsv(p.tasks.map(function(r){return {theme:r[0],topic:r[1],n:r[2],text:r[3],mode:r[4],key:r[5]};}));}
function tasksInfo(area,info){try{var t=parseTasks(area.value);if(!t.length){info.textContent='Задач пока нет.';return;}var th=Math.max.apply(null,t.map(function(x){return x.theme;})),n=Math.max.apply(null,t.map(function(x){return x.n;}));var auto=t.filter(function(x){return x.mode!=='Вручную';}).length;info.textContent='Задач: '+t.length+' ('+th+' тем × '+n+'). Проверяются автоматически: '+auto+', вручную: '+(t.length-auto)+'.';info.className='muted';}catch(e){info.textContent=e.message;info.className='warn';}}
function fillPresets(sel,keep,area,info){sel.replaceChildren();if(keep){var o=el('option','— оставить как есть —');o.value='';sel.append(o);}presets.forEach(function(p){var o=el('option',p.name);o.value=p.id;sel.append(o);});
 sel.onchange=function(){var p=presets.find(function(p){return p.id===sel.value;});if(p){area.value=presetTsv(p);tasksInfo(area,info);}};area.oninput=function(){tasksInfo(area,info);};}

/* главная: создание игры */
async function showHome(){show('home',true);show('gameView',false);show('host',false);show('participant',false);show('joinBox',false);show('clockBox',false);$('connection').textContent='';$('role').textContent='Создание игры';document.title='Математическая абака';
 fillPresets($('newPreset'),false,$('newTasks'),$('newTasksInfo'));if(presets.length&&!$('newTasks').value){$('newTasks').value=presetTsv(presets[0]);}tasksInfo($('newTasks'),$('newTasksInfo'));
 renderMyGames();
 try{var i=await rpc('info');show('codeRow',!!i.needCode);if(i.needCode)$('newCode').value=lsGet('abaka_code')||'';}catch(e){fatal(e.message);}}
function renderMyGames(){var l=myGames(),box=$('myGames');box.replaceChildren();show('myGamesCard',l.length>0);
 l.forEach(function(g){var row=el('div',undefined,'record'),bar=el('div',undefined,'bar between');bar.append(el('b',g.title));var b=el('div',undefined,'bar');
  b.append(makeButton('Открыть пульт',function(){location.hash=hostLink(g.game,g.admin).split('#')[1];},''),makeButton('Копировать ссылку для команд',function(){copyText(roomLink(g.game));},'secondary'),makeButton('Убрать из списка',function(){if(confirm('Убрать «'+g.title+'» из списка на этом устройстве? Сама игра останется на сервере.')){lsSet('abaka_games',JSON.stringify(myGames().filter(function(x){return x.game!==g.game;})));renderMyGames();}},'secondary'));
  row.append(bar,b,el('small',new Date(g.at).toLocaleString('ru-RU'),'muted'));box.append(row);});}
$('createBtn').onclick=async function(){if(busy)return;var tasks;try{tasks=parseTasks($('newTasks').value);}catch(e){toast(e.message,true);return;}
 var title=$('newTitle').value.trim();if(!title){toast('Введите название игры',true);$('newTitle').focus();return;}
 busy=true;$('createBtn').disabled=true;
 try{var code=$('newCode').value;var r=await rpc('createGame',[code,{title:title,minutes:$('newMinutes').value,tasks:tasks}]);if(code)lsSet('abaka_code',code);saveMyGame(r.game,r.admin,title);history.pushState(null,'',hostLink(r.game,r.admin));busy=false;route();toast('Игра создана. Скопируйте ссылку и отправьте командам.');}
 catch(e){toast(e.message,true);}finally{busy=false;$('createBtn').disabled=false;}};

/* вход команды */
function renderJoin(){$('joinTitle').textContent='Игра «'+S.title+'»';
 $('joinInfo').textContent=(!S.start?'Игра ещё не началась. Войдите сейчас — задачи появятся сразу после старта. ':running()?'Игра идёт, можно успеть войти. ':'Игра завершена. ')+(S.teamCount?'Уже в игре: '+S.teamCount+'.':'');
 show('joinForm',!S.start||running());}
function enterTeam(key){auth={game:auth.game,team:key};history.replaceState(null,'',teamLink(auth.game,key));initialized=false;}
$('joinBtn').onclick=async function(){var name=$('teamName').value.trim();if(!name){toast('Введите название команды',true);return;}if(busy)return;busy=true;$('joinBtn').disabled=true;
 try{var r=await rpc('joinGame',[auth.game,name]);lsSet('abaka_team_'+auth.game,JSON.stringify({key:r.key,name:r.name}));enterTeam(r.key);toast('Вы в игре: «'+r.name+'»');}catch(e){toast(e.message,true);}finally{busy=false;$('joinBtn').disabled=false;await refresh();}};
$('teamName').onkeydown=function(e){if(e.key==='Enter')$('joinBtn').click();};

/* пульт ведущей */
function renderTeamList(){var box=$('teamList');$('teamCount').textContent='Команд: '+S.links.length;
 if(!S.links.length){box.replaceChildren(el('p','Пока ни одна команда не вошла. Отправьте ссылку на игру.','review-empty'));return;}
 var table=el('table'),head=el('tr');['№','Команда','Баллы','Сдано','Личная ссылка',''].forEach(function(s){td(head,s,'th');});table.append(head);
 S.links.forEach(function(l){var t=S.teams.find(function(x){return x.id===l.id;})||{total:0,sent:0,pending:0},r=el('tr');td(r,l.id);td(r,l.name);td(r,t.total);td(r,t.sent+(t.pending?' (на проверке: '+t.pending+')':''));
  var c=el('td');c.append(makeButton('Копировать',function(){copyText(teamLink(auth.game,l.key));},'secondary'));r.append(c);
  var a=el('td',undefined,'bar');a.append(makeButton('Переименовать',function(){var n=prompt('Новое название команды',l.name);if(n&&n.trim()&&n.trim()!==l.name)act('renameTeam',[auth.game,auth.admin,l.id,n.trim()],'Название изменено');},'secondary'));
  var rm=makeButton('Удалить',function(){if(confirm('Удалить команду «'+l.name+'»? Она сможет войти заново.'))act('removeTeam',[auth.game,auth.admin,l.id],'Команда удалена');},'secondary');rm.disabled=t.sent>0;rm.title=t.sent>0?'У команды есть сданные ответы':'';a.append(rm);r.append(a);table.append(r);});
 box.replaceChildren(table);}
function renderHost(){var draft=!S.start;show('draftSettings',draft);show('settingsSummary',!draft);
 $('settingsSummary').textContent=S.title+' · '+S.teamCount+' команд · '+S.themes+' тем × '+S.tasksPerTheme+' задач · '+S.minutes+' мин';
 if(!initialized){$('adminSettings').open=!S.start;$('setTitle').value=S.title;$('minutes').value=S.minutes;$('tasksText').value=tasksToTsv(S.tasksFull);fillPresets($('preset2'),true,$('tasksText'),$('tasksInfo'));tasksInfo($('tasksText'),$('tasksInfo'));initialized=true;}
 $('sheetLink').href=S.sheet;$('start').disabled=!draft||busy;$('finish').disabled=!running()||busy;$('roomLink').value=roomLink(auth.game);renderTeamList();
 var signature=JSON.stringify([S.records,S.teams.map(function(t){return t.name;}),S.taskInfo])+$('reviewFilter').value+$('reviewTeam').value;if(signature!==lastRecords){lastRecords=signature;renderReviews();}}
function render(){show('fatal',false);show('home',false);show('gameView',true);show('clockBox',true);var joined=!!(S.me||S.admin);show('host',!!S.admin);show('participant',!!S.me);show('joinBox',!joined);
 $('role').textContent=S.admin?'Пульт ведущей · '+S.title:S.me?S.me.name+' · '+S.title:S.title;document.title=S.title+' — Математическая абака';
 if(!joined)renderJoin();if(S.admin)saveMyGame(auth.game,auth.admin,S.title);if(S.me)$('myLink').value=teamLink(auth.game,auth.team);
 tick();renderScores();renderTeamBoards();renderBonuses();renderRules();if(S.admin)renderHost();if(S.me)renderParticipant();}
$('copyRoom').onclick=function(){copyText($('roomLink').value);};$('roomLink').onclick=function(){this.select();};$('copyMy').onclick=function(){copyText($('myLink').value);};$('myLink').onclick=function(){this.select();};
$('saveSettings').onclick=async function(){var tasks;try{tasks=parseTasks($('tasksText').value);}catch(e){toast(e.message,true);return;}var ok=await act('configure',[auth.game,auth.admin,{title:$('setTitle').value,minutes:$('minutes').value,tasks:tasks}],'Настройки сохранены');if(ok)initialized=false;};
$('start').onclick=function(){if(confirm('Начать игру? Условия зафиксируются, у команд начнётся отсчёт времени ('+S.minutes+' мин). Войти в игру можно и после старта.'))act('control',[auth.game,auth.admin,'start'],'Игра началась');};
$('finish').onclick=function(){if(confirm('Завершить игру и закрыть приём ответов? Проверять уже отправленные ответы можно и после завершения.'))act('control',[auth.game,auth.admin,'close'],'Приём ответов завершён');};
$('homeLink').onclick=function(e){e.preventDefault();location.hash='';};

/* подключение и маршрутизация по ссылке */
var apiOk=/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
function showApiSetup(){show('home',false);show('gameView',false);var f=$('fatal');f.replaceChildren();f.append(el('h2','Подключение к серверу'),el('p','Вставьте адрес веб-приложения Google Apps Script (заканчивается на /exec). Его даёт тот, кто настроил сервер.','muted'));
 var inp=el('input');inp.style.width='100%';inp.placeholder='https://script.google.com/macros/s/…/exec';f.append(inp,el('p'),makeButton('Подключиться',function(){var v=inp.value.trim();if(!apiOk.test(v)){toast('Нужен адрес вида https://script.google.com/macros/s/…/exec',true);return;}lsSet('abaka_api',v);route();},''));show('fatal',true);$('role').textContent='Нужна настройка';}
function route(){clearTimeout(pollTimer);var h=new URLSearchParams(location.hash.slice(1));
 if(h.get('api')&&apiOk.test(h.get('api')))lsSet('abaka_api',h.get('api'));
 API=(h.get('api')&&apiOk.test(h.get('api'))?h.get('api'):'')||window.ABAKA_API||lsGet('abaka_api')||'';
 S=null;resetView();show('fatal',false);
 if(!apiOk.test(API)){showApiSetup();return;}
 var game=h.get('game');if(!game){auth={};showHome();return;}
 show('home',false);
 if(h.get('admin'))auth={game:game,admin:h.get('admin')};
 else if(h.get('team'))auth={game:game,team:h.get('team')};
 else{var sv=null;try{sv=JSON.parse(lsGet('abaka_team_'+game)||'null');}catch(e){}
  if(sv&&sv.key){auth={game:game,team:sv.key};history.replaceState(null,'',teamLink(game,sv.key));}else auth={game:game};}
 refresh();}
window.addEventListener('hashchange',route);setInterval(tick,1000);route();
