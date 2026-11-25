/* Интерактивное поле для задач на разрезание. Зависит от puzzle.js (Puzzle). */
var PuzzleUI=(function(){
var NS='http://www.w3.org/2000/svg',CELL=40,M=10;
var TINTS=['#cfe0ff','#ffe2b8','#d5f2d0','#f6cfe6','#e0d4fb','#fff3b0','#c8f0ee','#f9d2c4','#dfe8c2','#ead7c3','#d0d9e6','#f3c9d4'];
var MARK={g:'#4fae4f',r:'#e0626b',p:'#8b7ad6'};
var INK='#14233a',GRID='#a9b5c6';
function sv(tag,attrs,parent){var e=document.createElementNS(NS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function h(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}

function mount(box,def,opts){
 opts=opts||{};box.replaceChildren();
 var ro=!!opts.readonly,tool='cut',boards=[],ctl={},history=[],sub=def.rule.type==='ways'?Puzzle.subDef(def):def;
 var px=Math.max(28,Math.min(64,Math.floor(600/def.rows),Math.floor(880/def.cols)));
 var W=def.cols*CELL+2*M,H=def.rows*CELL+2*M;
 for(var i=0;i<def.boards;i++)boards.push({cuts:new Set(),paint:[],svg:null,note:null,title:null,res:null});

 function load(sol){if(!sol||!Array.isArray(sol.boards))return;
  sol.boards.forEach(function(b,i){if(!boards[i])return;boards[i].cuts=new Set((b.cuts||[]).filter(function(e){return Puzzle.edgeOk(def,e);}));boards[i].paint=(b.paint||[]).filter(function(x){return def.cells.indexOf(x)>=0;}).slice(0,1);});}
 ctl.solution=function(){return {boards:boards.map(function(b){return {cuts:Array.from(b.cuts).sort(),paint:b.paint.slice()};})};};
 ctl.ok=function(){return !!ctl.result&&ctl.result.ok;};
 ctl.message=function(){return ctl.result?ctl.result.msg:'';};
 var restored=false;
 if(opts.solution){load(typeof opts.solution==='string'?safeParse(opts.solution):opts.solution);restored=true;}
 else if(opts.storageKey){var raw=lsGet(opts.storageKey);if(raw){load(safeParse(raw));restored=true;}}
 function safeParse(s){try{return JSON.parse(s);}catch(e){return null;}}

 var bar=h('div','pz-bar'),status=h('div','pz-status'),wrap=h('div','pz-boards');
 var btnCut,btnPaint,btnUndo,btnClear;
 if(!ro){
  btnCut=h('button','secondary pz-tool','✂ Резать');btnCut.type='button';
  bar.appendChild(btnCut);
  if(def.rule.type==='paint'){btnPaint=h('button','secondary pz-tool','🎨 Закрасить клетку');btnPaint.type='button';bar.appendChild(btnPaint);}
  btnUndo=h('button','secondary','↶ Отменить');btnUndo.type='button';btnClear=h('button','secondary','Очистить');btnClear.type='button';
  bar.appendChild(btnUndo);bar.appendChild(btnClear);
  box.appendChild(bar);
  var hint=h('p','muted notes pz-hint',def.rule.type==='paint'
   ?'«Резать»: нажимайте или проведите пальцем/мышью вдоль линий сетки (повторное нажатие убирает разрез). «Закрасить»: выберите одну клетку.'
   :'Нажимайте на линии сетки внутри фигуры или проведите по ним пальцем/мышью — появится разрез. Повторное нажатие убирает его. Части раскрашиваются сами.');
  box.appendChild(hint);
 }
 box.appendChild(wrap);box.appendChild(status);
 function setTool(t){tool=t;if(!ro){btnCut.classList.toggle('active',t==='cut');if(btnPaint)btnPaint.classList.toggle('active',t==='paint');}}

 boards.forEach(function(b,i){
  var cell=h('div','pz-board');
  if(def.boards>1){b.title=h('div','pz-title','Способ '+(i+1));cell.appendChild(b.title);}
  b.svg=sv('svg',{viewBox:'0 0 '+W+' '+H,'class':'pz-svg'},cell);
  b.svg.style.maxWidth=(def.cols*px+2*M*px/CELL)+'px';
  b.svg.style.touchAction=ro?'auto':'none';
  b.note=h('div','pz-note muted');cell.appendChild(b.note);wrap.appendChild(cell);
 });

 function draw(b){
  var g=b.svg;while(g.firstChild)g.removeChild(g.firstChild);
  var res=b.res,compOf={};
  if(res&&res.comps.length>1)res.comps.forEach(function(c,k){c.forEach(function(x){compOf[x]=k;});});
  var ptSet={};b.paint.forEach(function(x){ptSet[x]=1;});
  var lay=sv('g',{transform:'translate('+M+','+M+')'},g);
  def.cells.forEach(function(x){var r=Math.floor(x/def.cols),c=x%def.cols;
   var fill=ptSet[x]?'#3b4252':(compOf[x]!==undefined?TINTS[compOf[x]%TINTS.length]:'#ffffff');
   sv('rect',{x:c*CELL,y:r*CELL,width:CELL,height:CELL,fill:fill},lay);
   var k=def.color(r,c);if(k&&!ptSet[x])sv('rect',{x:c*CELL+9,y:r*CELL+9,width:CELL-18,height:CELL-18,rx:5,fill:MARK[k],stroke:'#fff','stroke-width':1.5,'stroke-opacity':.6},lay);});
  var thin=sv('g',{stroke:GRID,'stroke-width':1,'stroke-linecap':'round'},lay),thick=sv('g',{stroke:INK,'stroke-width':3.2,'stroke-linecap':'round'},lay),cut=sv('g',{stroke:INK,'stroke-width':5,'stroke-linecap':'round'},lay);
  function line(p,x1,y1,x2,y2){sv('line',{x1:x1,y1:y1,x2:x2,y2:y2},p);}
  def.cells.forEach(function(x){var r=Math.floor(x/def.cols),c=x%def.cols,X=c*CELL,Y=r*CELL;
   if(!def.has(r-1,c))line(thick,X,Y,X+CELL,Y);else line(b.cuts.has('h:'+r+':'+c)?cut:thin,X,Y,X+CELL,Y);
   if(!def.has(r,c-1))line(thick,X,Y,X,Y+CELL);else line(b.cuts.has('v:'+r+':'+c)?cut:thin,X,Y,X,Y+CELL);
   if(!def.has(r+1,c))line(thick,X,Y+CELL,X+CELL,Y+CELL);
   if(!def.has(r,c+1))line(thick,X+CELL,Y,X+CELL,Y+CELL);});
  b.hover=sv('line',{stroke:'#2855ca','stroke-width':6,'stroke-linecap':'round',opacity:0,'pointer-events':'none'},lay);
 }
 function evaluate(){
  boards.forEach(function(b){b.res=Puzzle.analyzeBoard(sub,{cuts:Array.from(b.cuts),paint:b.paint});});
  ctl.result=Puzzle.check(def,ctl.solution());
  boards.forEach(function(b,i){draw(b);
   var ok=b.res.ok;
   if(b.title)b.title.textContent='Способ '+(i+1)+(ok?' ✓':'');
   b.note.textContent='';b.note.style.display='none';});
  var r=ctl.result;
  var any=boards.some(function(b){return b.cuts.size||b.paint.length;});status.className='pz-status '+(r.ok?'ok':any?'bad':'wait');
  status.textContent=ro?'':(r.ok?'✓ Верно! Можно отправлять.':any?'✕ Неверно':'Нарисуйте разрезы по линиям сетки.');
  if(ro)status.style.display='none';
  if(!ro&&opts.storageKey)lsSet(opts.storageKey,JSON.stringify(ctl.solution()));
  if(opts.onChange)opts.onChange(ctl);
 }
 ctl.refresh=evaluate;

 if(!ro){
  var snapshot=function(i){return {i:i,cuts:Array.from(boards[i].cuts),paint:boards[i].paint.slice()};};
  var pick=function(b,e,pref){var rect=b.svg.getBoundingClientRect();if(!rect.width)return null;
   var k=W/rect.width,x=(e.clientX-rect.left)*k-M,y=(e.clientY-rect.top)*k-M,u=x/CELL,v=y/CELL;
   if(tool==='paint'){var r=Math.floor(v),c=Math.floor(u);return def.has(r,c)?{cell:r*def.cols+c}:null;}
   var T=e.pointerType==='touch'?0.36:0.3,ri=Math.round(v),ci=Math.round(u),dh=Math.abs(v-ri),dv=Math.abs(u-ci),cand=[];
   if(dh<T)cand.push([dh,'h:'+ri+':'+Math.floor(u)]);if(dv<T)cand.push([dv,'v:'+Math.floor(v)+':'+ci]);
   cand.sort(function(a,b){return a[0]-b[0];});
   if(pref){var same=cand.filter(function(c){return c[1].charAt(0)===pref&&Puzzle.edgeOk(def,c[1]);});if(same.length)return {edge:same[0][1]};}
   for(var j=0;j<cand.length;j++)if(Puzzle.edgeOk(def,cand[j][1]))return {edge:cand[j][1]};return null;};
  var showHover=function(b,edge){if(!b.hover)return;if(!edge){b.hover.setAttribute('opacity',0);return;}
   var m=/^([hv]):(\d+):(\d+)$/.exec(edge),r=+m[2],c=+m[3];
   b.hover.setAttribute('x1',c*CELL);b.hover.setAttribute('y1',r*CELL);b.hover.setAttribute('x2',m[1]==='h'?(c+1)*CELL:c*CELL);b.hover.setAttribute('y2',m[1]==='h'?r*CELL:(r+1)*CELL);b.hover.setAttribute('opacity',.45);};
  boards.forEach(function(b,i){
   var drag=null;
   b.svg.addEventListener('pointerdown',function(e){e.preventDefault();var p=pick(b,e);if(!p)return;
    if(p.cell!==undefined){history.push(snapshot(i));b.paint=b.paint[0]===p.cell?[]:[p.cell];evaluate();return;}
    history.push(snapshot(i));var mode=b.cuts.has(p.edge)?'remove':'add';drag={mode:mode,pref:p.edge.charAt(0)};
    if(mode==='add')b.cuts.add(p.edge);else b.cuts.delete(p.edge);
    try{b.svg.setPointerCapture(e.pointerId);}catch(x){}evaluate();});
   b.svg.addEventListener('pointermove',function(e){var p=pick(b,e,drag&&drag.pref);
    if(!drag){showHover(b,p&&p.edge);return;}
    if(!p||!p.edge)return;drag.pref=p.edge.charAt(0);var has=b.cuts.has(p.edge);
    if(drag.mode==='add'&&!has){b.cuts.add(p.edge);evaluate();}else if(drag.mode==='remove'&&has){b.cuts.delete(p.edge);evaluate();}});
   var end=function(){drag=null;};
   b.svg.addEventListener('pointerup',end);b.svg.addEventListener('pointercancel',end);
   b.svg.addEventListener('pointerleave',function(){showHover(b,null);});
  });
  btnCut.onclick=function(){setTool('cut');};if(btnPaint)btnPaint.onclick=function(){setTool('paint');};
  btnUndo.onclick=function(){var s=history.pop();if(!s)return;boards[s.i].cuts=new Set(s.cuts);boards[s.i].paint=s.paint;evaluate();};
  btnClear.onclick=function(){if(!boards.some(function(b){return b.cuts.size||b.paint.length;}))return;if(!confirm('Стереть все разрезы?'))return;
   boards.forEach(function(b,i){history.push(snapshot(i));b.cuts=new Set();b.paint=[];});evaluate();};
  setTool('cut');
 }
 evaluate();
 return ctl;
}
return {mount:mount};
})();
