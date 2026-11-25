/* МАТЕМАТИЧЕСКАЯ АБАКА — сервер (Google Apps Script, V8).
 * Это только «мозг» игры: хранит таблицу, принимает ответы, считает баллы и сам проверяет разрезания.
 * Интерфейс — отдельный сайт на GitHub Pages. Установка: см. инструкцию (Instruktsiya).
 * Вставьте ВЕСЬ этот файл в Код.gs, выполните setup, разверните как веб-приложение (доступ «Все»), выполните showLinks.
 * Секретные ссылки ведущей и команд никому, кроме их владельцев, не показывайте.
 */
var SITE_URL='https://rucheninap1.github.io/abaka/'; // адрес сайта с интерфейсом
function props_(){return PropertiesService.getScriptProperties();}
function cfg_(){var s=props_().getProperty('abaka');if(!s)throw Error('Выполните setup в редакторе Apps Script');return JSON.parse(s);}
function save_(c){props_().setProperty('abaka',JSON.stringify(c));}
function db_(){return SpreadsheetApp.openById(props_().getProperty('sheet'));}
function uid_(){return Utilities.getUuid();}
function lock_(fn){var l=LockService.getScriptLock();l.waitLock(30000);try{return fn();}finally{l.releaseLock();}}
function admin_(key){if(!key||key!==props_().getProperty('admin'))throw Error('Нет доступа ведущей');}
function team_(c,key){var t=c.teams.filter(function(t){return t.key===key;})[0];if(!t)throw Error('Ссылка команды недействительна');return t;}
function int_(n,min,max,label){n=Number(n);if(!Number.isInteger(n)||n<min||n>max)throw Error(label+': от '+min+' до '+max);return n;}
function plain_(v,max){v=String(v==null?'':v).trim();if(v.length>max)throw Error('Слишком длинный текст (максимум '+max+')');return v;}
function cell_(v){v=String(v==null?'':v);return /^[=+\-@]/.test(v)?"'"+v:v;}
function log_(c,action,data){db_().getSheetByName('Журнал').appendRow([new Date().toISOString(),c.id,action,JSON.stringify(data)]);}
function setup(){lock_(function(){
 if(!props_().getProperty('abaka')){
  var db=SpreadsheetApp.create('Математическая абака — управление');db.setSpreadsheetTimeZone('Europe/Moscow');
  var sh=db.getSheets()[0];sh.setName('Задачи');sh.appendRow(['Тема №','Название темы','Задача №','Условие','Проверка','Правильные ответы (варианты через |)']);sh.setFrozenRows(1);sh.setColumnWidth(4,480);sh.setColumnWidth(6,280);
  [['Сдачи',['Игра','ID запроса','Время сервера (мс)','Команда ID','Тема','Задача','Ответ JSON','Файл ID','Статус','Комментарий JSON']],['Ключи',['Игра','Задачи JSON']],['Журнал',['Время','Игра','Действие','Данные JSON']]].forEach(function(x){var s=db.insertSheet(x[0]);s.appendRow(x[1]);s.setFrozenRows(1);});
  props_().setProperties({sheet:db.getId(),folder:DriveApp.createFolder('Математическая абака — картинки').getId(),admin:uid_()+uid_()});
  save_({id:uid_(),themes:5,tasks:5,minutes:90,start:0,end:0,closed:false,teams:[1,2,3].map(function(n){return {id:String(n),name:'Команда '+n,key:uid_()+uid_()};})});
 }
 ensureTasks_(cfg_());
 });Logger.log('Закрытая таблица: '+db_().getUrl());Logger.log('Разверните веб-приложение и выполните showLinks.');}
function url_(){var u=ScriptApp.getService().getUrl()||'';return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)?u:'';}
function showLinks(){Logger.log('Таблица: '+db_().getUrl());var u=url_(),k=props_().getProperty('admin');
 if(!u){Logger.log('Сначала разверните веб-приложение (Развернуть → Новое развертывание → Веб-приложение), затем снова выполните showLinks.');return;}
 Logger.log('Адрес сервера (/exec): '+u);
 Logger.log('ВЕДУЩАЯ (секрет): '+SITE_URL+'#api='+encodeURIComponent(u)+'&admin='+k);
 Logger.log('Табло (можно показывать всем): '+SITE_URL+'#api='+encodeURIComponent(u));
 Logger.log('Ссылки команд — в пульте ведущей: «Настройки игры и ссылки команд» → «Ссылки для подключения».');}
function taskId_(a,b){return a+':'+b;}
function readDraft_(){var sh=db_().getSheetByName('Задачи');if(sh.getLastRow()<2)return [];return sh.getRange(2,1,sh.getLastRow()-1,6).getDisplayValues().filter(function(r){return r[0]&&r[2];}).map(function(r){return {theme:Number(r[0]),topic:r[1],n:Number(r[2]),text:r[3],mode:r[4]||'Вручную',key:r[5]};});}
function ensureTasks_(c){var sh=db_().getSheetByName('Задачи'),old=readDraft_(),seen={};old.forEach(function(t){seen[taskId_(t.theme,t.n)]=true;});var rows=[];for(var a=1;a<=c.themes;a++)for(var b=1;b<=c.tasks;b++)if(!seen[taskId_(a,b)])rows.push([a,'Тема '+a,b,'','Вручную','']);if(rows.length){var begin=sh.getLastRow()+1;sh.getRange(begin,4,rows.length,3).setNumberFormat('@');sh.getRange(begin,1,rows.length,6).setValues(rows);}
 var count=sh.getLastRow()-1;if(count){var rule=SpreadsheetApp.newDataValidation().requireValueInList(['Число','Текст','Набор чисел','Вручную','Разрезание'],true).setAllowInvalid(false).build();sh.getRange(2,5,count).setDataValidation(rule);} }
function activeTasks_(c){var tasks=readDraft_().filter(function(t){return t.theme>=1&&t.theme<=c.themes&&t.n>=1&&t.n<=c.tasks;}),seen={},topics={};tasks.forEach(function(t){var id=taskId_(t.theme,t.n);if(!Number.isInteger(t.theme)||!Number.isInteger(t.n))throw Error('Номера тем и задач должны быть целыми');if(seen[id])throw Error('Дублируется задача '+id);seen[id]=true;if(!t.topic.trim())throw Error('Введите название темы '+t.theme);if(topics[t.theme]&&topics[t.theme]!==t.topic)throw Error('В теме '+t.theme+' разные названия');topics[t.theme]=t.topic;if(!t.text.trim())throw Error('Нет условия задачи '+id);if(!['Число','Текст','Набор чисел','Вручную','Разрезание'].includes(t.mode))throw Error('Неизвестный тип проверки '+id);if(t.mode==='Разрезание'){var pid=Puzzle.parseMarker(t.text);if(!pid||!Puzzle.DEFS[pid])throw Error('В условии задачи '+id+' нет метки интерактивной задачи вида [[puzzle:b1t10]]');}else if(t.mode!=='Вручную'&&!t.key.trim())throw Error('Нет ответа на задачу '+id);if(t.text.length>20000||t.key.length>2000)throw Error('Слишком длинное условие или ключ '+id);validateKey_(t);});if(tasks.length!==c.themes*c.tasks)throw Error('В таблице не хватает задач');tasks.sort(function(a,b){return a.theme-b.theme||a.n-b.n;});return tasks;}
function frozenTasks_(c){var s=db_().getSheetByName('Ключи'),v=s.getDataRange().getValues();return v.slice(1).filter(function(r){return r[0]===c.id;}).map(function(r){return JSON.parse(r[1]);});}
function records_(c){var v=db_().getSheetByName('Сдачи').getDataRange().getValues();return v.slice(1).map(function(r,i){return {row:i+2,game:String(r[0]),id:String(r[1]),time:Number(r[2]),team:String(r[3]),theme:Number(r[4]),n:Number(r[5]),answer:r[6]?JSON.parse(r[6]):'',file:String(r[7]||''),status:String(r[8]),note:r[9]?JSON.parse(r[9]):''};}).filter(function(r){return r.game===c.id;});}
// Strict answer parsing. No eval, no guessing of units or mathematical expressions.
function number_(v){v=String(v).trim().replace(/\u2212/g,'-').replace(/,/g,'.');if(v.length>100)return null;var p=v.split('/');if(p.length>2)return null;var re=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;if(!p.every(function(s){return re.test(s.trim());}))return null;var a=Number(p[0]),b=p.length===2?Number(p[1]):1;if(!Number.isFinite(a)||!Number.isFinite(b)||!b)return null;var x=a/b;if((Number.isInteger(a)&&!Number.isSafeInteger(a))||(Number.isInteger(b)&&!Number.isSafeInteger(b)))return null;return Number.isFinite(x)?x:null;}
function text_(v){return String(v).normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ').trim();}
function set_(v){var parts=String(v).trim().split(/\s*;\s*/);if(parts.some(function(s){return !s.trim();}))return null;var nums=parts.map(number_);if(nums.some(function(x){return x===null;}))return null;return nums.sort(function(a,b){return a-b;});}
function equal_(a,b){return a===b;}
function validateKey_(t){if(t.mode==='Вручную'||t.mode==='Разрезание')return;var variants=t.key.split('|').map(function(v){return v.trim();});if(variants.some(function(v){return !v;}))throw Error('Пустой вариант ответа '+taskId_(t.theme,t.n));if(t.mode==='Число'&&variants.some(function(v){return number_(v)===null;}))throw Error('Некорректный числовой ключ '+taskId_(t.theme,t.n));if(t.mode==='Набор чисел'&&variants.some(function(v){return set_(v)===null;}))throw Error('В наборе разделяйте числа точкой с запятой: '+taskId_(t.theme,t.n));}
function judge_(t,answer,file){if(t.mode==='Разрезание')return 'yes';if(file||t.mode==='Вручную')return 'pending';var variants=t.key.split('|');if(t.mode==='Текст')return variants.some(function(k){return text_(k)===text_(answer);})?'yes':'pending';if(t.mode==='Число'){var a=number_(answer);if(a===null)return 'pending';return variants.some(function(k){return equal_(a,number_(k));})?'yes':'no';}var a=set_(answer);if(a===null)return 'pending';return variants.some(function(k){var b=set_(k);return a.length===b.length&&a.every(function(v,i){return equal_(v,b[i]);});})?'yes':'no';}
function calculate_(c,rs){
 var active=rs.filter(function(r){return r.status!=='cancelled';}),lines=[];
 var teams=c.teams.map(function(t){var own=active.filter(function(r){return r.team===t.id;}),good={};own.forEach(function(r){if(r.status==='yes')good[taskId_(r.theme,r.n)]=r;});var score=Object.keys(good).reduce(function(s,k){return s+good[k].n*10;},0);return {id:t.id,name:t.name,base:score,bonus:0,total:score,sent:own.length,pending:own.filter(function(r){return r.status==='pending';}).length,cells:own.map(function(r){return {theme:r.theme,n:r.n,status:r.status};}),good:good};});
 for(var a=1;a<=c.themes;a++){var ids=[];for(var b=1;b<=c.tasks;b++)ids.push(taskId_(a,b));lines.push({id:'h'+a,label:'Тема '+a,base:c.tasks*10,ids:ids});}
 for(var b=1;b<=c.tasks;b++){var ids=[];for(var a=1;a<=c.themes;a++)ids.push(taskId_(a,b));lines.push({id:'v'+b,label:'Столбец '+b,base:b*10,ids:ids});}
 lines.forEach(function(line){var finishers=teams.filter(function(t){return line.ids.every(function(k){return !!t.good[k];});}).map(function(t){return {team:t.id,time:Math.max.apply(null,line.ids.map(function(k){return t.good[k].time;}))};});var first=finishers.length?Math.min.apply(null,finishers.map(function(t){return t.time;})):null;line.awards=finishers.map(function(f){var points=line.base*(f.time===first?2:1),t=teams.filter(function(t){return t.id===f.team;})[0];t.bonus+=points;t.total+=points;return {team:f.team,time:f.time,points:points,first:f.time===first};});delete line.ids;});
 teams.sort(function(a,b){return b.total-a.total||b.bonus-a.bonus||Number(a.id)-Number(b.id);});teams.forEach(function(t,i){t.place=i&&t.total===teams[i-1].total&&t.bonus===teams[i-1].bonus?teams[i-1].place:i+1;delete t.good;});return {teams:teams,lines:lines,provisional:active.some(function(r){return r.status==='pending';})};
}
function state_(auth){auth=auth||{};var c=cfg_(),host=!!auth.admin,t=null;if(host)admin_(auth.admin);if(auth.team)t=team_(c,auth.team);var rs=records_(c),out=calculate_(c,rs);out.id=c.id;out.now=Date.now();out.start=c.start;out.end=c.end;out.closed=c.closed;out.themes=c.themes;out.tasksPerTheme=c.tasks;out.minutes=c.minutes;out.url=url_();
 if(host){out.admin=true;out.sheet=db_().getUrl();out.links=c.teams.map(function(t){return {name:t.name,key:t.key};});out.names=c.teams.map(function(t){return t.name;});out.records=rs.map(function(r){return {id:r.id,time:r.time,team:r.team,theme:r.theme,n:r.n,answer:r.answer,hasFile:!!r.file,status:r.status,note:r.note};});var tasks=c.start?frozenTasks_(c):readDraft_();out.taskInfo=tasks.map(function(t){return {theme:t.theme,n:t.n,topic:t.topic,text:t.text};});}
 if(t){out.me={id:t.id,name:t.name};out.records=rs.filter(function(r){return r.team===t.id;}).map(function(r){return {id:r.id,time:r.time,theme:r.theme,n:r.n,answer:r.answer,hasFile:!!r.file,status:r.status,note:r.note};});out.taskInfo=c.start?frozenTasks_(c).map(function(t){return {theme:t.theme,n:t.n,topic:t.topic,text:t.text};}):[];}
 return out;
}
function getState(auth){return lock_(function(){return state_(auth);});}
function configure(key,input){admin_(key);return lock_(function(){var c=cfg_();if(c.start)throw Error('Настройки меняются только до старта');var names=String(input.names||'').split('\n').map(function(n){return n.trim();}).filter(Boolean);if(names.length<1||names.length>32||new Set(names).size!==names.length||names.some(function(n){return n.length>60;}))throw Error('Нужно 1–32 разных названия, до 60 символов');c.themes=int_(input.themes,1,12,'Количество тем');c.tasks=int_(input.tasks,1,12,'Задач в теме');c.minutes=int_(input.minutes,1,300,'Длительность в минутах');c.teams=names.map(function(n,i){return {id:String(i+1),name:n,key:c.teams[i]?c.teams[i].key:uid_()+uid_()};});ensureTasks_(c);save_(c);log_(c,'Настройки',{themes:c.themes,tasks:c.tasks,minutes:c.minutes,names:names});return true;});}
function control(key,action){admin_(key);return lock_(function(){var c=cfg_();if(action==='start'){if(c.start)throw Error('Игра уже запускалась');var tasks=activeTasks_(c),s=db_().getSheetByName('Ключи');s.getRange(s.getLastRow()+1,1,tasks.length,2).setValues(tasks.map(function(t){return [c.id,JSON.stringify(t)];}));c.start=Date.now();c.end=c.start+c.minutes*60000;c.closed=false;}else if(action==='close'){if(!c.start)throw Error('Игра ещё не началась');c.closed=true;}else if(action==='new'){if(c.start&&!c.closed&&Date.now()<c.end)throw Error('Сначала завершите текущую игру');c.id=uid_();c.start=0;c.end=0;c.closed=false;c.teams.forEach(function(t){t.key=uid_()+uid_();});}else throw Error('Неизвестное действие');save_(c);log_(c,action,{});return true;});}
function submitAnswer(key,request){var receivedAt=Date.now();return lock_(function(){var c=cfg_(),t=team_(c,key),rs=records_(c),id=plain_(request.id,80);if(!/^[a-zA-Z0-9_-]{12,80}$/.test(id))throw Error('Некорректный ID запроса');var repeated=rs.filter(function(r){return r.id===id&&r.team===t.id;})[0];if(repeated)return {id:id,status:repeated.status};var now=receivedAt;if(!c.start||now<c.start||c.closed||now>=c.end)throw Error('Приём ответов закрыт');var theme=int_(request.theme,1,c.themes,'Тема'),n=int_(request.n,1,c.tasks,'Номер задачи'),own=rs.filter(function(r){return r.team===t.id&&r.status!=='cancelled';});if(own.some(function(r){return r.theme===theme&&r.n===n;}))throw Error('На эту задачу ответ уже отправлен');for(var j=1;j<n;j++)if(!own.some(function(r){return r.theme===theme&&r.n===j;}))throw Error('Сначала отправьте ответ на задачу '+j+' этой темы');var answer=plain_(request.answer,30000),fileData=request.file||null;if(!answer&&!fileData)throw Error('Введите ответ или приложите картинку');var task=frozenTasks_(c).filter(function(t){return t.theme===theme&&t.n===n;})[0];if(!task)throw Error('Задача не найдена');
 if(task.mode==='Разрезание'){var pz=Puzzle.DEFS[Puzzle.parseMarker(task.text)],sol;if(!pz)throw Error('Интерактивная задача не найдена');if(fileData)throw Error('Для этой задачи фото не нужно');
  try{sol=JSON.parse(answer);}catch(e){throw Error('Неверный формат решения');}
  var chk=Puzzle.check(pz,sol);if(!chk.ok)throw Error('Решение не прошло проверку: '+chk.msg+' (попытка не потрачена)');
  answer=JSON.stringify({boards:sol.boards.map(function(b){return {cuts:b.cuts.slice().sort(),paint:b.paint||[]};})});}
 else if(answer.length>4000)throw Error('Слишком длинный текст (максимум 4000)');var fileId='';if(fileData){var raw=String(fileData.data||''),mime=String(fileData.type||'');if(!['image/jpeg','image/png','image/webp'].includes(mime)||raw.length>5600000||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw Error('Картинка: JPG, PNG или WebP, до 4 МБ');var bytes=Utilities.base64Decode(raw);if(!bytes.length||bytes.length>4*1024*1024)throw Error('Картинка должна быть до 4 МБ');var b0=bytes.slice(0,12).map(function(b){return b&255;});var valid=mime==='image/jpeg'?b0[0]===255&&b0[1]===216&&b0[2]===255:mime==='image/png'?b0[0]===137&&b0[1]===80&&b0[2]===78&&b0[3]===71:b0[0]===82&&b0[1]===73&&b0[8]===87&&b0[9]===69;if(!valid)throw Error('Файл не соответствует формату картинки');var ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';fileId=DriveApp.getFolderById(props_().getProperty('folder')).createFile(Utilities.newBlob(bytes,mime,c.id+'_'+t.id+'_'+theme+'_'+n+'_'+id+'.'+ext)).getId();}
 var status=judge_(task,answer,fileId),sheet=db_().getSheetByName('Сдачи');sheet.appendRow([c.id,id,now,t.id,theme,n,JSON.stringify(answer),fileId,status,JSON.stringify('')]);return {id:id,status:status};});}
function review(key,id,status,note){admin_(key);if(!['yes','no','pending','cancelled'].includes(status))throw Error('Неизвестная оценка');note=plain_(note,1000);return lock_(function(){var c=cfg_(),r=records_(c).filter(function(r){return r.id===id;})[0];if(!r)throw Error('Сдача не найдена');if(r.status==='cancelled')throw Error('Сдача отменена; команда может отправить новый ответ');db_().getSheetByName('Сдачи').getRange(r.row,9,1,2).setValues([[status,JSON.stringify(note)]]);log_(c,'Проверка',{id:id,from:r.status,to:status,note:note});return true;});}
function getPicture(auth,id){return lock_(function(){var c=cfg_();auth=auth||{};var host=!!auth.admin,t=null;if(host)admin_(auth.admin);else t=team_(c,auth.team);var r=records_(c).filter(function(r){return r.id===id;})[0];if(!r||(!host&&r.team!==t.id)||!r.file)throw Error('Картинка недоступна');var blob=DriveApp.getFileById(r.file).getBlob();return {type:blob.getContentType(),data:Utilities.base64Encode(blob.getBytes())};});}


/* ===== веб-API: сайт обращается сюда POST-запросом {fn, args} ===== */
var API_={getState:getState,configure:configure,control:control,submitAnswer:submitAnswer,review:review,getPicture:getPicture};
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
 try{var req=JSON.parse(e.postData.contents),fn=Object.prototype.hasOwnProperty.call(API_,req.fn)?API_[req.fn]:null;
  if(!fn)throw Error('Неизвестный метод');
  return json_({ok:true,data:fn.apply(null,Array.isArray(req.args)?req.args:[])});
 }catch(err){return json_({ok:false,error:String(err&&err.message||err)});}
}
function doGet(){return ContentService.createTextOutput('Математическая абака: сервер работает. Игра: '+SITE_URL).setMimeType(ContentService.MimeType.TEXT);}


/* ===== движок и проверка разрезаний (тот же файл puzzle.js, что и на сайте) ===== */
/* Движок интерактивных задач на разрезание. Один и тот же код работает
 * в браузере (мгновенная проверка) и в Apps Script (окончательная проверка на сервере).
 * Поле: grid — массив строк; пробел = нет клетки, '#' = клетка, g/r/p = цветная клетка.
 * Рёбра: 'h:r:c' — линия НАД клеткой (r,c); 'v:r:c' — линия СЛЕВА от клетки (r,c). */
function createPuzzle(){
var P={};
var NB='Резать можно только по сторонам клеток. ';
P.DEFS={
 b1t10:{grid:['####','####','####',' ###'],rule:{type:'equal',parts:3},text:'Разрежьте фигуру на 3 равные части.'},
 b1t20:{grid:['##   #',' #####','##### ',' #### ','  #   '],rule:{type:'equal',parts:3},text:'Разрежьте фигуру на 3 равные части.'},
 b1t30:{grid:['#### ','#####','#### ','#####'],rule:{type:'equal',parts:3},text:'Разрежьте фигуру на 3 равные части.'},
 b1t40:{grid:['####  ',' #####',' ###  ',' ###  '],rule:{type:'equal',parts:3},text:'Разрежьте фигуру на 3 равные части.'},
 b2t10:{grid:[' ### ','#### ','#####',' ####'],rule:{type:'equal',parts:4},text:'Разрежьте фигуру на 4 равные части.'},
 b2t20:{grid:['  #  ','###  ','#### ','#####','###  '],rule:{type:'equal',parts:4},text:'Разрежьте фигуру на 4 равные части.'},
 b2t30:{grid:['  ##  ',' #### ','######','##### ',' ###'],rule:{type:'equal',parts:4},text:'Разрежьте фигуру на 4 равные части.'},
 b2t40:{grid:[' ##  ','  ###',' ####','#####','#####','   # '],rule:{type:'equal',parts:4},text:'Разрежьте фигуру на 4 равные части.'},
 b3t10:{grid:[' ####',' ####','#### '],rule:{type:'ways',ways:3,parts:2},boards:3,
  text:'Разрежьте фигуру на две одинаковые части тремя разными способами. На каждой из трёх картинок сделайте своё разрезание — способы должны отличаться.'},
 b3t20:{grid:['     ##','# #####','#######',' # ####','     # '],rule:{type:'paint',parts:2},
  text:'Закрасьте одну клетку фигуры, а незакрашенную часть разрежьте по линиям сетки на две одинаковые части.'},
 b3t30:{grid:['############','######g#####','#r########g#','###r########','############','########p###','##g#r#######','###########p','####g#r#####','############','#p#######p##','############'],
  rule:{type:'colors'},text:'Разрежьте фигуру на равные части так, чтобы в каждой части была ровно одна клетка каждого цвета.'},
 b3t40:{grid:['#####','###gg','####g','g##g#','#####','gg###','g####','#####','##g#g','#####','###gg','#####'],
  rule:{type:'distinct',parts:12,area:5,minDistinct:11},
  text:'Разрежьте фигуру на 12 фигур равной площади, чтобы в каждой части была ровно одна зелёная клетка. Хотя бы 11 фигур должны быть разными: их нельзя совместить наложением (можно поворачивать и переворачивать).'}
};
/* ряд b1t10 имеет 3 строки "####" и " ###" — выравниваем длину строк */
Object.keys(P.DEFS).forEach(function(id){var d=P.DEFS[id];d.id=id;d.text=NB+d.text;
 d.rows=d.grid.length;d.cols=Math.max.apply(null,d.grid.map(function(s){return s.length;}));
 d.grid=d.grid.map(function(s){return s.padEnd(d.cols);});
 d.has=function(r,c){return r>=0&&c>=0&&r<d.rows&&c<d.cols&&d.grid[r].charAt(c)!==' ';};
 d.color=function(r,c){var ch=d.grid[r].charAt(c);return ch==='#'||ch===' '?'':ch;};
 d.cells=[];for(var r=0;r<d.rows;r++)for(var c=0;c<d.cols;c++)if(d.has(r,c))d.cells.push(r*d.cols+c);
 d.boards=d.boards||1;});
P.ids=function(){return Object.keys(P.DEFS);};
P.parseMarker=function(text){var m=/\[\[puzzle:([a-z0-9_]+)\]\]/.exec(String(text||''));return m?m[1]:'';};
P.stripMarker=function(text){return String(text||'').replace(/\s*\[\[puzzle:[a-z0-9_]+\]\]\s*/g,' ').trim();};
/* допустимое ребро: между двумя клетками фигуры */
P.edgeOk=function(d,e){var m=/^([hv]):(\d+):(\d+)$/.exec(e);if(!m)return false;var r=+m[2],c=+m[3];
 return m[1]==='h'?d.has(r,c)&&d.has(r-1,c):d.has(r,c)&&d.has(r,c-1);};
/* части: клетки, связанные без пересечения разрезов; закрашенные клетки исключены */
P.components=function(d,cuts,paint){var cut={},pt={},seen={},out=[];
 (cuts||[]).forEach(function(e){cut[e]=1;});(paint||[]).forEach(function(i){pt[i]=1;});
 d.cells.forEach(function(s){if(seen[s]||pt[s])return;var comp=[],st=[s];seen[s]=1;
  while(st.length){var x=st.pop(),r=Math.floor(x/d.cols),c=x%d.cols;comp.push(x);
   [[r,c+1,'v:'+r+':'+(c+1)],[r,c-1,'v:'+r+':'+c],[r+1,c,'h:'+(r+1)+':'+c],[r-1,c,'h:'+r+':'+c]].forEach(function(n){
    var k=n[0]*d.cols+n[1];if(!d.has(n[0],n[1])||seen[k]||pt[k]||cut[n[2]])return;seen[k]=1;st.push(k);});}
  comp.sort(function(a,b){return a-b;});out.push(comp);});
 return out;};
/* канонический вид фигуры относительно поворотов и отражений */
P.canon=function(d,comp){var best=null;
 for(var t=0;t<8;t++){var pts=comp.map(function(x){var r=Math.floor(x/d.cols),c=x%d.cols,a=r,b=c;
   if(t&1){var q=a;a=-b;b=q;}if(t&2){a=-a;b=-b;}if(t&4)b=-b;return [a,b];});
  var mr=Math.min.apply(null,pts.map(function(p){return p[0];})),mc=Math.min.apply(null,pts.map(function(p){return p[1];}));
  var s=pts.map(function(p){return (p[0]-mr)+','+(p[1]-mc);}).sort().join(';');if(best===null||s<best)best=s;}
 return best;};
P.signature=function(comps){return comps.map(function(c){return c.join(',');}).sort().join('|');};
function colorCount(d,comp){var n={g:0,r:0,p:0};comp.forEach(function(x){var k=d.color(Math.floor(x/d.cols),x%d.cols);if(k)n[k]++;});return n;}
var NAMES={g:'зелёной',r:'красной',p:'фиолетовой'},COLORS_USED=function(d){var u={};d.cells.forEach(function(x){var k=d.color(Math.floor(x/d.cols),x%d.cols);if(k)u[k]=1;});return Object.keys(u);};
function plural(n,a,b,c){var m=n%100,k=n%10;return (m>10&&m<15)?c:k===1?a:(k>1&&k<5)?b:c;}
/* проверка одной картинки. Возвращает {ok, comps, msg, bad:[индексы частей с ошибкой]} */
P.analyzeBoard=function(d,st){st=st||{};var rule=d.rule,paint=st.paint||[],bad=[],msg='';
 var usePaint=rule.type==='paint';
 if(!usePaint&&paint.length)return {ok:false,comps:[],msg:'Закрашивать клетки в этой задаче не нужно.',bad:[]};
 if(usePaint){if(paint.length===0)return {ok:false,comps:P.components(d,st.cuts,[]),msg:'Сначала закрасьте одну клетку.',bad:[]};
  if(paint.length>1)return {ok:false,comps:P.components(d,st.cuts,paint),msg:'Закрасить нужно ровно одну клетку, сейчас закрашено '+paint.length+'.',bad:[]};}
 var comps=P.components(d,st.cuts,paint),n=comps.length;
 var want=rule.parts;
 if(rule.type==='colors'){want=d.cells.filter(function(x){return d.color(Math.floor(x/d.cols),x%d.cols)==='g';}).length;}
 if(n!==want){return {ok:false,comps:comps,msg:'Частей сейчас '+n+', нужно '+want+'.',bad:[]};}
 var sizes=comps.map(function(c){return c.length;}),area=rule.area||sizes[0];
 comps.forEach(function(c,i){if(c.length!==area)bad.push(i);});
 if(bad.length){return {ok:false,comps:comps,msg:'Площади частей разные ('+sizes.join(', ')+'). Нужно по '+area+' '+plural(area,'клетке','клетки','клеток')+' в каждой.',bad:bad};}
 if(rule.type==='distinct'){var cl={},kinds=0;
  comps.forEach(function(c,i){var cc=colorCount(d,c);if(cc.g!==1)bad.push(i);var k=P.canon(d,c);cl[k]=(cl[k]||0)+1;});
  if(bad.length)return {ok:false,comps:comps,msg:'В каждой части должна быть ровно одна зелёная клетка: нарушено в частях '+bad.map(function(i){return i+1;}).join(', ')+'.',bad:bad};
  kinds=Object.keys(cl).length;
  if(kinds<rule.minDistinct)return {ok:false,comps:comps,msg:'Разных фигур '+kinds+', нужно хотя бы '+rule.minDistinct+'.',bad:[],kinds:kinds};
  return {ok:true,comps:comps,msg:'Верно! Разных фигур: '+kinds+'.',bad:[],kinds:kinds};}
 var k0=P.canon(d,comps[0]);
 comps.forEach(function(c,i){if(P.canon(d,c)!==k0)bad.push(i);});
 if(bad.length)return {ok:false,comps:comps,msg:'Части одинаковой площади, но не все одинаковые по форме.',bad:bad};
 if(rule.type==='colors'){var used=COLORS_USED(d),probs=[];
  comps.forEach(function(c,i){var cc=colorCount(d,c);used.forEach(function(k){if(cc[k]!==1){bad.push(i);probs.push('в части '+(i+1)+' '+(cc[k]?'клеток '+NAMES[k].replace('ой','ого')+' цвета '+cc[k]:'нет '+NAMES[k]+' клетки'));}});});
  if(bad.length)return {ok:false,comps:comps,msg:'Части одинаковые, но цвета не те: '+probs.slice(0,2).join('; ')+'.',bad:bad.filter(function(v,i,a){return a.indexOf(v)===i;})};}
 return {ok:true,comps:comps,msg:'Верно! '+n+' '+plural(n,'часть','части','частей')+' по '+area+' '+plural(area,'клетке','клетки','клеток')+', все одинаковые.',bad:[]};};
/* проверка всего решения: sol={boards:[{cuts:[],paint:[]},…]} */
P.check=function(d,sol){var r={ok:false,msg:'',boards:[]};
 if(!sol||!Array.isArray(sol.boards)||sol.boards.length!==d.boards){r.msg='Неверный формат решения';return r;}
 var sigs=[];
 for(var i=0;i<sol.boards.length;i++){var b=sol.boards[i]||{},cuts=b.cuts,paint=b.paint||[];
  if(!Array.isArray(cuts)||cuts.length>3000||!Array.isArray(paint)||paint.length>5){r.msg='Неверный формат решения';return r;}
  for(var j=0;j<cuts.length;j++)if(typeof cuts[j]!=='string'||!P.edgeOk(d,cuts[j])){r.msg='Недопустимая линия разреза';return r;}
  for(j=0;j<paint.length;j++)if(!Number.isInteger(paint[j])||d.cells.indexOf(paint[j])<0){r.msg='Недопустимая закрашенная клетка';return r;}
  var a=P.analyzeBoard(d.rule.type==='ways'?subDef(d):d,{cuts:cuts,paint:paint});r.boards.push(a);
  if(!a.ok){r.msg=(d.boards>1?'Картинка '+(i+1)+': ':'')+a.msg;return r;}sigs.push(P.signature(a.comps));}
 if(d.rule.type==='ways'){for(var x=0;x<sigs.length;x++)for(var y=x+1;y<sigs.length;y++)if(sigs[x]===sigs[y]){r.msg='Способы '+(x+1)+' и '+(y+1)+' совпадают — нужны три разных разрезания.';return r;}}
 r.ok=true;r.msg='Верно!';return r;};
function subDef(d){if(d._sub)return d._sub;var s=Object.create(d);s.rule={type:'equal',parts:d.rule.parts};d._sub=s;return s;}
P.subDef=subDef;
return P;}
if(typeof module!=='undefined'&&module.exports)module.exports=createPuzzle();else var Puzzle=createPuzzle();
