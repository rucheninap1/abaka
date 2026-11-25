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
