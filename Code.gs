/* МАТЕМАТИЧЕСКАЯ АБАКА — сервер (Google Apps Script, V8).
 * Один сервер обслуживает сколько угодно игр. Ведущая создаёт игру на сайте, команды входят по ссылке игры
 * и вводят название — сервер сам заводит команду, принимает ответы, проверяет их и считает баллы.
 * Установка: вставьте ВЕСЬ этот файл в Код.gs → «Развернуть» → «Новое развертывание» → «Веб-приложение»
 * (выполнять от имени: Я; доступ: Все). Таблица и папка для фото создаются автоматически при первом обращении.
 * Необязательно: чтобы игры могла создавать только ваша ведущая, задайте в «Свойствах скрипта» ключ creator = код.
 */
var SITE_URL='https://rucheninap1.github.io/abaka/'; // адрес сайта с интерфейсом
function props_(){return PropertiesService.getScriptProperties();}
function uid_(){return Utilities.getUuid();}
function lock_(fn){var l=LockService.getScriptLock();l.waitLock(30000);try{return fn();}finally{l.releaseLock();}}
function ensure_(){var l=LockService.getScriptLock();l.waitLock(30000);try{if(props_().getProperty('sheet'))return;
 var db=SpreadsheetApp.create('Математическая абака — игры');db.setSpreadsheetTimeZone('Europe/Moscow');
 var sh=db.getSheets()[0];sh.setName('Игры');sh.appendRow(['ID игры','Ключ ведущей','Название','Минут','Старт (мс)','Конец (мс)','Завершена','Создана','Задачи JSON']);sh.setFrozenRows(1);
 [['Команды',['Игра','ID команды','Название','Ключ','Создана']],['Сдачи',['Игра','ID запроса','Время сервера (мс)','Команда ID','Тема','Задача','Ответ JSON','Файл ID','Статус','Комментарий JSON']],['Журнал',['Время','Игра','Действие','Данные JSON']]].forEach(function(x){var s=db.insertSheet(x[0]);s.appendRow(x[1]);s.setFrozenRows(1);});
 props_().setProperties({sheet:db.getId(),folder:DriveApp.createFolder('Математическая абака — картинки').getId()});
 }finally{l.releaseLock();}}
function setup(){ensure_();Logger.log('Сервер готов. Таблица: '+db_().getUrl());Logger.log('Адрес сервера (/exec): '+url_());Logger.log('Сайт: '+SITE_URL);}
function db_(){var id=props_().getProperty('sheet');if(!id)throw Error('Сервер не настроен: откройте адрес /exec один раз или выполните setup');return SpreadsheetApp.openById(id);}
function url_(){var u=ScriptApp.getService().getUrl()||'';return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)?u:'';}
function showLinks(){ensure_();Logger.log('Таблица: '+db_().getUrl());Logger.log('Адрес сервера (/exec): '+url_());Logger.log('Откройте сайт: '+SITE_URL+'#api='+encodeURIComponent(url_())+' — и нажмите «Создать игру».');}
function int_(n,min,max,label){n=Number(n);if(!Number.isInteger(n)||n<min||n>max)throw Error(label+': от '+min+' до '+max);return n;}
function plain_(v,max){v=String(v==null?'':v).trim();if(v.length>max)throw Error('Слишком длинный текст (максимум '+max+')');return v;}
function cell_(v){v=String(v==null?'':v);return /^[=+\-@]/.test(v)?"'"+v:v;}
function log_(game,action,data){db_().getSheetByName('Журнал').appendRow([new Date().toISOString(),game,action,JSON.stringify(data)]);}
function taskId_(a,b){return a+':'+b;}
var MODES_=['Число','Текст','Набор чисел','Вручную','Разрезание'];

/* ---------- игры и команды ---------- */
function game_(id){id=String(id||'');var sh=db_().getSheetByName('Игры'),n=sh.getLastRow(),i=-1;
 if(n>=2){var ids=sh.getRange(2,1,n-1,1).getValues();for(var k=0;k<ids.length;k++)if(String(ids[k][0])===id){i=k;break;}}
 if(i<0)throw Error('Игра не найдена. Проверьте ссылку.');
 var r=sh.getRange(i+2,1,1,9).getValues()[0],tasks=JSON.parse(r[8]||'[]');
 return {row:i+2,id:String(r[0]),admin:String(r[1]),title:String(r[2]),minutes:Number(r[3]),start:Number(r[4]),end:Number(r[5]),closed:r[6]===true||String(r[6])==='TRUE',tasks:tasks,
  themes:Math.max.apply(null,tasks.map(function(t){return t.theme;}).concat([1])),tasksN:Math.max.apply(null,tasks.map(function(t){return t.n;}).concat([1]))};}
function teams_(gid){var sh=db_().getSheetByName('Команды'),n=sh.getLastRow();if(n<2)return [];
 return sh.getRange(2,1,n-1,5).getValues().map(function(r,i){return {row:i+2,game:String(r[0]),id:String(r[1]),name:String(r[2]),key:String(r[3])};}).filter(function(t){return t.game===gid;});}
function load_(id){var g=game_(id);g.teams=teams_(g.id);return g;}
function admin_(g,key){if(!key||key!==g.admin)throw Error('Нет доступа ведущей');}
function team_(g,key){var t=g.teams.filter(function(t){return t.key===key;})[0];if(!t)throw Error('Ссылка команды недействительна');return t;}
function records_(gid){var sh=db_().getSheetByName('Сдачи'),n=sh.getLastRow();if(n<2)return [];
 return sh.getRange(2,1,n-1,10).getValues().map(function(r,i){return {row:i+2,game:String(r[0]),id:String(r[1]),time:Number(r[2]),team:String(r[3]),theme:Number(r[4]),n:Number(r[5]),answer:r[6]?JSON.parse(r[6]):'',file:String(r[7]||''),status:String(r[8]),note:r[9]?JSON.parse(r[9]):''};}).filter(function(r){return r.game===gid;});}

/* ---------- проверка набора задач ---------- */
function normTasks_(arr){
 if(!Array.isArray(arr)||!arr.length)throw Error('Добавьте хотя бы одну задачу');if(arr.length>144)throw Error('Слишком много задач (максимум 12×12)');
 var tasks=arr.map(function(t){t=t||{};return {theme:Number(t.theme),topic:String(t.topic==null?'':t.topic).trim(),n:Number(t.n),text:String(t.text==null?'':t.text).trim(),mode:String(t.mode||'Вручную').trim(),key:String(t.key==null?'':t.key).trim()};}),seen={},topics={};
 tasks.forEach(function(t){if(!Number.isInteger(t.theme)||!Number.isInteger(t.n)||t.theme<1||t.n<1||t.theme>12||t.n>12)throw Error('Номера тем и задач — целые от 1 до 12');
  var id=taskId_(t.theme,t.n);if(seen[id])throw Error('Дублируется задача '+id);seen[id]=true;
  if(!t.topic)throw Error('Введите название темы '+t.theme);if(topics[t.theme]&&topics[t.theme]!==t.topic)throw Error('В теме '+t.theme+' разные названия');topics[t.theme]=t.topic;
  if(!t.text)throw Error('Нет условия задачи '+id);if(MODES_.indexOf(t.mode)<0)throw Error('Неизвестный тип проверки '+id);
  if(t.mode==='Разрезание'){var pid=Puzzle.parseMarker(t.text);if(!pid||!Puzzle.DEFS[pid])throw Error('В условии задачи '+id+' нет метки интерактивной задачи вида [[puzzle:b1t10]]');}
  else if(t.mode!=='Вручную'&&!t.key)throw Error('Нет ответа на задачу '+id);
  if(t.text.length>3000||t.key.length>1000||t.topic.length>80)throw Error('Слишком длинное условие, ответ или название темы '+id);validateKey_(t);});
 var themes=Math.max.apply(null,tasks.map(function(t){return t.theme;})),per=Math.max.apply(null,tasks.map(function(t){return t.n;}));
 if(tasks.length!==themes*per)throw Error('Задачи должны образовывать полную таблицу: '+themes+' тем × '+per+' задач, а сейчас задач '+tasks.length);
 tasks.sort(function(a,b){return a.theme-b.theme||a.n-b.n;});
 if(JSON.stringify(tasks).length>45000)throw Error('Слишком большой набор задач');return tasks;}
function number_(v){v=String(v).trim().replace(/−/g,'-').replace(/,/g,'.');if(v.length>100)return null;var p=v.split('/');if(p.length>2)return null;var re=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;if(!p.every(function(s){return re.test(s.trim());}))return null;var a=Number(p[0]),b=p.length===2?Number(p[1]):1;if(!Number.isFinite(a)||!Number.isFinite(b)||!b)return null;var x=a/b;if((Number.isInteger(a)&&!Number.isSafeInteger(a))||(Number.isInteger(b)&&!Number.isSafeInteger(b)))return null;return Number.isFinite(x)?x:null;}
function text_(v){return String(v).normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ').trim();}
function set_(v){var parts=String(v).trim().split(/\s*;\s*/);if(parts.some(function(s){return !s.trim();}))return null;var nums=parts.map(number_);if(nums.some(function(x){return x===null;}))return null;return nums.sort(function(a,b){return a-b;});}
function equal_(a,b){return a===b;}
function validateKey_(t){if(t.mode==='Вручную'||t.mode==='Разрезание')return;var variants=t.key.split('|').map(function(v){return v.trim();});if(variants.some(function(v){return !v;}))throw Error('Пустой вариант ответа '+taskId_(t.theme,t.n));if(t.mode==='Число'&&variants.some(function(v){return number_(v)===null;}))throw Error('Некорректный числовой ключ '+taskId_(t.theme,t.n));if(t.mode==='Набор чисел'&&variants.some(function(v){return set_(v)===null;}))throw Error('В наборе разделяйте числа точкой с запятой: '+taskId_(t.theme,t.n));}
function judge_(t,answer,file){if(t.mode==='Разрезание')return 'yes';if(file||t.mode==='Вручную')return 'pending';var variants=t.key.split('|');if(t.mode==='Текст')return variants.some(function(k){return text_(k)===text_(answer);})?'yes':'pending';if(t.mode==='Число'){var a=number_(answer);if(a===null)return 'pending';return variants.some(function(k){return equal_(a,number_(k));})?'yes':'no';}var a=set_(answer);if(a===null)return 'pending';return variants.some(function(k){var b=set_(k);return a.length===b.length&&a.every(function(v,i){return equal_(v,b[i]);});})?'yes':'no';}

/* ---------- подсчёт баллов ---------- */
function calculate_(c,rs){
 var active=rs.filter(function(r){return r.status!=='cancelled';}),lines=[];
 var teams=c.teams.map(function(t){var own=active.filter(function(r){return r.team===t.id;}),good={};own.forEach(function(r){if(r.status==='yes')good[taskId_(r.theme,r.n)]=r;});var score=Object.keys(good).reduce(function(s,k){return s+good[k].n*10;},0);return {id:t.id,name:t.name,base:score,bonus:0,total:score,sent:own.length,pending:own.filter(function(r){return r.status==='pending';}).length,cells:own.map(function(r){return {theme:r.theme,n:r.n,status:r.status};}),good:good};});
 for(var a=1;a<=c.themes;a++){var ids=[];for(var b=1;b<=c.tasksN;b++)ids.push(taskId_(a,b));lines.push({id:'h'+a,label:'Тема '+a,base:c.tasksN*10,ids:ids});}
 for(var b=1;b<=c.tasksN;b++){var ids=[];for(var a=1;a<=c.themes;a++)ids.push(taskId_(a,b));lines.push({id:'v'+b,label:'Столбец '+b,base:b*10,ids:ids});}
 lines.forEach(function(line){var finishers=teams.filter(function(t){return line.ids.every(function(k){return !!t.good[k];});}).map(function(t){return {team:t.id,time:Math.max.apply(null,line.ids.map(function(k){return t.good[k].time;}))};});var first=finishers.length?Math.min.apply(null,finishers.map(function(t){return t.time;})):null;line.awards=finishers.map(function(f){var points=line.base*(f.time===first?2:1),t=teams.filter(function(t){return t.id===f.team;})[0];t.bonus+=points;t.total+=points;return {team:f.team,time:f.time,points:points,first:f.time===first};});delete line.ids;});
 teams.sort(function(a,b){return b.total-a.total||b.bonus-a.bonus||Number(a.id)-Number(b.id);});teams.forEach(function(t,i){t.place=i&&t.total===teams[i-1].total&&t.bonus===teams[i-1].bonus?teams[i-1].place:i+1;delete t.good;});return {teams:teams,lines:lines,provisional:active.some(function(r){return r.status==='pending';})};
}
function info_(t){return {theme:t.theme,n:t.n,topic:t.topic,text:t.text};}
function state_(auth){auth=auth||{};var c=load_(auth.game),host=!!auth.admin,t=null;if(host)admin_(c,auth.admin);if(auth.team)t=team_(c,auth.team);
 var rs=records_(c.id),out=calculate_(c,rs);out.game=c.id;out.title=c.title;out.now=Date.now();out.start=c.start;out.end=c.end;out.closed=c.closed;out.themes=c.themes;out.tasksPerTheme=c.tasksN;out.minutes=c.minutes;out.teamCount=c.teams.length;out.topics={};c.tasks.forEach(function(t){out.topics[t.theme]=t.topic;});
 if(host){out.admin=true;out.sheet=db_().getUrl();out.links=c.teams.map(function(t){return {id:t.id,name:t.name,key:t.key};});out.tasksFull=c.tasks;
  out.records=rs.map(function(r){return {id:r.id,time:r.time,team:r.team,theme:r.theme,n:r.n,answer:r.answer,hasFile:!!r.file,status:r.status,note:r.note};});out.taskInfo=c.tasks.map(info_);}
 if(t){out.me={id:t.id,name:t.name};out.records=rs.filter(function(r){return r.team===t.id;}).map(function(r){return {id:r.id,time:r.time,theme:r.theme,n:r.n,answer:r.answer,hasFile:!!r.file,status:r.status,note:r.note};});out.taskInfo=c.start?c.tasks.map(info_):[];}
 return out;}

/* ---------- публичные методы ---------- */
function info(){return {version:2,needCode:!!props_().getProperty('creator'),site:SITE_URL};}
function createGame(code,input){var need=props_().getProperty('creator');if(need&&String(code||'')!==need)throw Error('Неверный код создателя игр');
 input=input||{};var title=plain_(input.title,80);if(!title)throw Error('Введите название игры');var minutes=int_(input.minutes,1,300,'Время, минут'),tasks=normTasks_(input.tasks);
 return lock_(function(){var id='g'+uid_().replace(/-/g,'').slice(0,10),admin=uid_()+uid_();
  db_().getSheetByName('Игры').appendRow([id,admin,cell_(title),minutes,0,0,false,new Date().toISOString(),JSON.stringify(tasks)]);log_(id,'Создана игра',{title:title,tasks:tasks.length});return {game:id,admin:admin};});}
function joinGame(gid,name){return lock_(function(){var c=load_(gid);name=plain_(String(name||'').replace(/\s+/g,' '),40);if(!name)throw Error('Введите название команды');
 if(c.start&&(c.closed||Date.now()>=c.end))throw Error('Игра уже завершена');
 if(c.teams.some(function(t){return text_(t.name)===text_(name);}))throw Error('Команда с таким названием уже есть. Если это вы — откройте свою личную ссылку или выберите другое название.');
 if(c.teams.length>=40)throw Error('В игре уже 40 команд');
 var id=String(c.teams.reduce(function(m,t){return Math.max(m,Number(t.id));},0)+1),key=uid_()+uid_();
 db_().getSheetByName('Команды').appendRow([c.id,id,cell_(name),key,new Date().toISOString()]);log_(c.id,'Команда вошла',{id:id,name:name});return {id:id,name:name,key:key};});}
function getState(auth){return state_(auth);}
function configure(gid,key,input){return lock_(function(){var c=load_(gid);admin_(c,key);if(c.start)throw Error('Настройки меняются только до старта');input=input||{};
 var title=input.title!==undefined?plain_(input.title,80):c.title;if(!title)throw Error('Введите название игры');var minutes=input.minutes!==undefined?int_(input.minutes,1,300,'Время, минут'):c.minutes,tasks=input.tasks!==undefined?normTasks_(input.tasks):c.tasks;
 db_().getSheetByName('Игры').getRange(c.row,3,1,2).setValues([[cell_(title),minutes]]);db_().getSheetByName('Игры').getRange(c.row,9).setValue(JSON.stringify(tasks));log_(c.id,'Настройки',{title:title,minutes:minutes,tasks:tasks.length});return true;});}
function control(gid,key,action){return lock_(function(){var c=load_(gid);admin_(c,key);var sh=db_().getSheetByName('Игры');
 if(action==='start'){if(c.start)throw Error('Игра уже запускалась');var s=Date.now();sh.getRange(c.row,5,1,3).setValues([[s,s+c.minutes*60000,false]]);}
 else if(action==='close'){if(!c.start)throw Error('Игра ещё не началась');sh.getRange(c.row,7).setValue(true);}
 else throw Error('Неизвестное действие');log_(c.id,action,{});return true;});}
function renameTeam(gid,key,teamId,name){return lock_(function(){var c=load_(gid);admin_(c,key);var t=c.teams.filter(function(t){return t.id===String(teamId);})[0];if(!t)throw Error('Команда не найдена');name=plain_(String(name||'').replace(/\s+/g,' '),40);if(!name)throw Error('Введите название');
 if(c.teams.some(function(o){return o.id!==t.id&&text_(o.name)===text_(name);}))throw Error('Такое название уже занято');db_().getSheetByName('Команды').getRange(t.row,3).setValue(cell_(name));log_(c.id,'Переименование',{id:t.id,name:name});return true;});}
function removeTeam(gid,key,teamId){return lock_(function(){var c=load_(gid);admin_(c,key);var t=c.teams.filter(function(t){return t.id===String(teamId);})[0];if(!t)throw Error('Команда не найдена');
 if(records_(c.id).some(function(r){return r.team===t.id;}))throw Error('У команды уже есть сданные ответы — удалить её нельзя');db_().getSheetByName('Команды').deleteRow(t.row);log_(c.id,'Удалена команда',{id:t.id,name:t.name});return true;});}
function submitAnswer(gid,key,request){var receivedAt=Date.now();return lock_(function(){var c=load_(gid),t=team_(c,key),rs=records_(c.id),id=plain_(request.id,80);if(!/^[a-zA-Z0-9_-]{12,80}$/.test(id))throw Error('Некорректный ID запроса');var repeated=rs.filter(function(r){return r.id===id&&r.team===t.id;})[0];if(repeated)return {id:id,status:repeated.status};var now=receivedAt;if(!c.start||now<c.start||c.closed||now>=c.end)throw Error('Приём ответов закрыт');var theme=int_(request.theme,1,c.themes,'Тема'),n=int_(request.n,1,c.tasksN,'Номер задачи'),own=rs.filter(function(r){return r.team===t.id&&r.status!=='cancelled';});if(own.some(function(r){return r.theme===theme&&r.n===n;}))throw Error('На эту задачу ответ уже отправлен');for(var j=1;j<n;j++)if(!own.some(function(r){return r.theme===theme&&r.n===j;}))throw Error('Сначала отправьте ответ на задачу '+j+' этой темы');var answer=plain_(request.answer,30000),fileData=request.file||null;if(!answer&&!fileData)throw Error('Введите ответ или приложите картинку');var task=c.tasks.filter(function(x){return x.theme===theme&&x.n===n;})[0];if(!task)throw Error('Задача не найдена');
 if(task.mode==='Разрезание'){var pz=Puzzle.DEFS[Puzzle.parseMarker(task.text)],sol;if(!pz)throw Error('Интерактивная задача не найдена');if(fileData)throw Error('Для этой задачи фото не нужно');
  try{sol=JSON.parse(answer);}catch(e){throw Error('Неверный формат решения');}
  var chk=Puzzle.check(pz,sol);if(!chk.ok)throw Error('Решение не прошло проверку: '+chk.msg+' (попытка не потрачена)');
  answer=JSON.stringify({boards:sol.boards.map(function(b){return {cuts:b.cuts.slice().sort(),paint:b.paint||[]};})});}
 else if(answer.length>4000)throw Error('Слишком длинный текст (максимум 4000)');var fileId='';if(fileData){var raw=String(fileData.data||''),mime=String(fileData.type||'');if(['image/jpeg','image/png','image/webp'].indexOf(mime)<0||raw.length>5600000||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw Error('Картинка: JPG, PNG или WebP, до 4 МБ');var bytes=Utilities.base64Decode(raw);if(!bytes.length||bytes.length>4*1024*1024)throw Error('Картинка должна быть до 4 МБ');var b0=bytes.slice(0,12).map(function(b){return b&255;});var valid=mime==='image/jpeg'?b0[0]===255&&b0[1]===216&&b0[2]===255:mime==='image/png'?b0[0]===137&&b0[1]===80&&b0[2]===78&&b0[3]===71:b0[0]===82&&b0[1]===73&&b0[8]===87&&b0[9]===69;if(!valid)throw Error('Файл не соответствует формату картинки');var ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';fileId=DriveApp.getFolderById(props_().getProperty('folder')).createFile(Utilities.newBlob(bytes,mime,c.id+'_'+t.id+'_'+theme+'_'+n+'_'+id+'.'+ext)).getId();}
 var status=judge_(task,answer,fileId);db_().getSheetByName('Сдачи').appendRow([c.id,id,now,t.id,theme,n,JSON.stringify(answer),fileId,status,JSON.stringify('')]);return {id:id,status:status};});}
function review(gid,key,id,status,note){if(['yes','no','pending','cancelled'].indexOf(status)<0)throw Error('Неизвестная оценка');note=plain_(note,1000);return lock_(function(){var c=load_(gid);admin_(c,key);var r=records_(c.id).filter(function(r){return r.id===id;})[0];if(!r)throw Error('Сдача не найдена');if(r.status==='cancelled')throw Error('Сдача отменена; команда может отправить новый ответ');db_().getSheetByName('Сдачи').getRange(r.row,9,1,2).setValues([[status,JSON.stringify(note)]]);log_(c.id,'Проверка',{id:id,from:r.status,to:status,note:note});return true;});}
function getPicture(auth,id){auth=auth||{};var c=load_(auth.game),host=!!auth.admin,t=null;if(host)admin_(c,auth.admin);else t=team_(c,auth.team);var r=records_(c.id).filter(function(r){return r.id===id;})[0];if(!r||(!host&&r.team!==t.id)||!r.file)throw Error('Картинка недоступна');var blob=DriveApp.getFileById(r.file).getBlob();return {type:blob.getContentType(),data:Utilities.base64Encode(blob.getBytes())};}


/* ===== веб-API: сайт обращается сюда POST-запросом {fn, args} ===== */
var API_={info:info,createGame:createGame,joinGame:joinGame,getState:getState,configure:configure,control:control,renameTeam:renameTeam,removeTeam:removeTeam,submitAnswer:submitAnswer,review:review,getPicture:getPicture};
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
 try{var req=JSON.parse(e.postData.contents),fn=Object.prototype.hasOwnProperty.call(API_,req.fn)?API_[req.fn]:null;
  if(!fn)throw Error('Неизвестный метод');
  if(req.fn!=='info')ensure_();
  return json_({ok:true,data:fn.apply(null,Array.isArray(req.args)?req.args:[])});
 }catch(err){return json_({ok:false,error:String(err&&err.message||err)});}
}
function doGet(){try{ensure_();}catch(e){}return ContentService.createTextOutput('Математическая абака: сервер работает. Сайт: '+SITE_URL).setMimeType(ContentService.MimeType.TEXT);}


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
