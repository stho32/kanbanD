/* kanbanD Prototyp — Zustand, Handlungen, Ereignisse. Jede Datenänderung „schreibt“ sofort (localStorage steht für den Ordner). */
let S;try{S=JSON.parse(localStorage.getItem(KD_KEY))}catch(e){}
if(!S||!S.board||!S.cards)S=kdSeed();
{const seen=new Set();S.cards=S.cards.filter(c=>{if(!/^Befund: /.test(c.title))return true;if(seen.has(c.title))return false;seen.add(c.title);c.sim=1;return true})}
Object.assign(S.ui,{toast:null,pop:null,setup:null,adding:null,palFor:null,need:false,orgErr:null});
const persist=()=>{try{localStorage.setItem(KD_KEY,JSON.stringify(S))}catch(e){}};
const save=f=>{S.meta.saved=Date.now();if(f)S.meta.file=f;persist()};
const busy=()=>{const a=document.activeElement;return a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&a.id!=='flt'};

function render(){
 $('#kopf').innerHTML=vKopf();renderMain();
 $('#over').innerHTML=(S.ui.open&&!S.ui.setup?vModal():'')+vPop()+vToast();
 $('#stat').innerHTML=vStatus();placePop();
 if(S.ui.focus){const f=$(S.ui.focus);S.ui.focus=null;if(f)f.focus()}
}
function renderMain(){$('#main').innerHTML=S.ui.first?vFirst():S.ui.setup?vSetup():({board:vBoard,personen:vPers,kreuz:vKreuz,stunden:vStunden}[S.ui.view]||vBoard)()}
function placePop(){const p=$('#pop');if(!p)return;const t=document.getElementById(p.dataset.for);if(!t){S.ui.pop=null;p.remove();return}const r=t.getBoundingClientRect();p.style.top=(r.bottom+2)+'px';p.style.left=(p.dataset.al==='r'?Math.max(4,r.right-p.offsetWidth):r.left)+'px'}

function moveCard(id,col,ref,before){
 const c=cardById(id),from=S.board.columns.find(k=>k.key===c.column),to=S.board.columns.find(k=>k.key===col);
 c.column=col;if(to.final&&!(from&&from.final))c.doneAt=Date.now();if(!to.final)c.doneAt=null;
 if(!to.final){const list=S.cards.filter(x=>x.column===col&&x.id!==c.id).sort((a,b)=>a.order-b.order);let i=ref==null?list.length:list.findIndex(x=>x.id===ref)+(before?0:1);if(i<0)i=list.length;list.splice(i,0,c);list.forEach((x,j)=>x.order=j+1)}
 save(c.file);render();
}
const done=c=>{save(c&&c.file);render()};
function newCard(col,title,who,origins){
 const b=S.board,id=b.next++,to=b.columns.find(k=>k.key===col);
 const c={id,title,column:col,cls:null,origins:origins||[],assignees:who?[who]:[],labels:[],due:null,desc:'',tasks:[],comments:[],times:[],doneAt:to&&to.final?Date.now():null,order:Math.max(0,...S.cards.filter(x=>x.column===col).map(x=>x.order))+1};
 c.file=`cards/${String(id).padStart(4,'0')}-${slug(title)}.md`;S.cards.push(c);return c;
}
function csv(){
 const rows=[['karte','titel','person','art','beginn','ende','dauer_min','origins']];
 S.cards.forEach(c=>c.times.forEach(t=>rows.push([c.id,c.title,t.who,per(t.who).kind,new Date(t.start).toISOString(),t.end?new Date(t.end).toISOString():'',Math.round(((t.end||Date.now())-t.start)/6e4),(c.origins.length?c.origins:['thin air']).join(' ')])));
 const s=rows.map(r=>r.map(v=>/[;"\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':v).join(';')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+s],{type:'text/csv'}));a.download=S.board.name+'-zeiten.csv';document.body.appendChild(a);a.click();a.remove();
}

function act(a,arg,el,val){
 const u=S.ui,c=u.open?cardById(u.open):null,d=u.setup;
 switch(a){
 case 'view':u.view=arg;u.pop=null;break;
 case 'pop':u.pop=u.pop===arg?null:arg;if(arg!=='ich')u.need=false;break;
 case 'scope':u.scope=arg;break;
 case 'tog':u[arg]=!u[arg];break;
 case 'legf':{const cur=(toks(u.filter).find(t=>t[0]==='class')||[])[1];u.filter=u.filter.replace(/class:\S+\s*/g,'').trim();if(cur!==arg)u.filter=(u.filter+' class:'+arg).trim();break}
 case 'more':u.more[arg]=(u.more[arg]||0)+10;break;
 case 'open':case 'lauf-open':u.open=+arg;u.tab='inhalt';u.pop=null;u.orgErr=null;break;
 case 'close':case 'close-bg':u.open=null;u.orgErr=null;break;
 case 'tab':u.tab=arg;break;
 case 'nav':{const v=visibleOrder();if(!v.length)break;const i=v.indexOf(u.open);u.open=v[((i<0?0:i)+ +arg+v.length)%v.length];u.orgErr=null;break}
 case 'add':u.adding=arg;u.focus='#add-inp';break;
 case 'add-ok':{const t=(val||'').trim();if(!t){u.adding=null;break}const n=newCard(arg,t,u.me);u.focus='#add-inp';return done(n)}
 case 'task':c.tasks[+arg].ok=!c.tasks[+arg].ok;return done(c);
 case 'task-del':c.tasks.splice(+arg,1);return done(c);
 case 'task-add':if(!val.trim())return;c.tasks.push({t:val.trim(),ok:false});u.focus='[data-enter="task-add"]';return done(c);
 case 'comment':if(!val.trim()||!u.me)return;c.comments.push({who:u.me,at:Date.now(),text:val.trim()});u.focus='#km-inp';return done(c);
 case 'start':{if(!u.me){u.pop='ich';u.need=true;break}const k=cardById(arg);if(!run(k).some(t=>t.who===u.me))k.times.push({who:u.me,start:Date.now(),end:null});return done(k)}
 case 'stop':{const[id,st,who]=arg.split('|'),k=cardById(id),t=k&&k.times.find(x=>!x.end&&x.start===+st&&x.who===who);if(t)t.end=Date.now();return done(k)}
 case 'time-del':{const[st,who]=arg.split('|');c.times=c.times.filter(x=>!(x.start===+st&&x.who===who));return done(c)}
 case 'time-add':{if(!u.me)return;const v=val.trim().replace(',','.');let m=/^(\d+):(\d{1,2})$/.exec(v);let min=m?+m[1]*60+ +m[2]:/^\d+(\.\d+)?$/.test(v)?Math.round(parseFloat(v)*60):0;if(/^\d+\s*min$/.test(v))min=parseInt(v);if(!min)return;const end=Date.now();c.times.push({who:u.me,start:end-min*6e4,end});u.focus='[data-enter="time-add"]';return done(c)}
 case 'org-add':{const v=val.trim();u.orgErr=null;if(/^(I\d{4}|R\d{5})$/i.test(v)){const o=v.toUpperCase();c.origins=c.origins.filter(x=>x!=='thin air');if(!c.origins.includes(o))c.origins.push(o)}else if(v.toLowerCase()==='thin air')c.origins=['thin air'];else if(v)u.orgErr=v;u.focus='[data-enter="org-add"]';return done(c)}
 case 'org-del':c.origins.splice(+arg,1);return done(c);
 case 'as':{const i=c.assignees.indexOf(arg);if(i<0)c.assignees.push(arg);else c.assignees.splice(i,1);return done(c)}
 case 'arch':{if(!c)return;if(c.archived){c.archived=null;u.toast={text:`#${c.id} zurückgeholt`,at:Date.now()}}else{c.archived=Date.now();c.times.forEach(t=>{if(!t.end)t.end=Date.now()});u.toast={text:`#${c.id} archiviert · archived: in der Datei, laufende Timer gestoppt`,undo:c.id,at:Date.now()};if(!isArch())u.open=null}return done(c)}
 case 'undo':{const k=cardById(arg);if(k)k.archived=null;u.toast=null;return done(k)}
 case 'arch-on':u.filter=(u.filter.replace(/is:\S+\s*/g,'')+' is:archived').trim();u.scope='alle';u.view='board';break;
 case 'arch-off':u.filter=u.filter.replace(/is:\S+\s*/g,'').trim();break;
 case 'empty':u.first={root:'/Users/stefan/projekte/neues-projekt',path:'~/projekte/',name:'neues-projekt',cols:'Zu erledigen, In Arbeit, Erledigt',mek:'',men:'',agents:{cl:true},wbs:'',req:''};u.open=null;u.setup=null;u.pop=null;u.focus='[data-fr="mek"]';break;
 case 'fr-agent':u.first.agents[arg]=!u.first.agents[arg];break;
 case 'first-ok':{const f=u.first;if(!(f.mek||'').trim()||!(f.men||'').trim()){f.err=1;break}const ui=kdSeed().ui;S={board:fBoard(f),cards:[],ui:Object.assign(ui,{me:(f.mek||'').trim().toLowerCase().replace(/[^a-z0-9]/g,''),sim:false,toast:{text:'board.yaml angelegt',at:Date.now()}}),meta:{saved:Date.now(),file:'board.yaml',sim:0}};persist();render();return}
 case 'ich':u.me=arg;u.pop=null;u.need=false;break;
 case 'csv':csv();u.pop=null;break;
 case 'pfilter':u.filter='@'+arg;u.scope='alle';u.view='board';break;
 case 'pscope':u.pscope=arg;break;
 case 'period':u.period=arg;break;
 case 'sp':u.sp=arg;break;
 case 'reset':if(!confirm('Prototyp auf den Anfangszustand zurücksetzen?'))return;S=kdSeed();persist();render();return;
 /* Board einrichten */
 case 'setup':u.setup=JSON.parse(JSON.stringify(S.board));u.palFor=null;u.pop=null;u.open=null;break;
 case 'setup-cancel':u.setup=null;u.palFor=null;break;
 case 'setup-ok':S.board=d;u.setup=null;u.palFor=null;S.cards.forEach(k=>{if(k.cls&&!S.board.classes[k.cls])k.cls=null});save('board.yaml');render();return;
 case 'col-l':case 'col-r':{const i=+arg,j=a==='col-l'?i-1:i+1;if(j<0||j>=d.columns.length)break;[d.columns[i],d.columns[j]]=[d.columns[j],d.columns[i]];break}
 case 'col-del':if(S.cards.some(x=>x.column===arg))return;d.columns=d.columns.filter(x=>x.key!==arg);break;
 case 'col-final':d.columns.forEach(k=>{if(k.key===arg){k.final=!k.final;if(k.final)k.limit=k.limit||20;else delete k.limit}else{delete k.final;delete k.limit}});break;
 case 'col-add':{const v=(val!=null?val:(($('#col-new')||{}).value||'')).trim();if(!v)return;let key=slug(v)||'spalte',n=2;while(d.columns.some(x=>x.key===key))key=slug(v)+'-'+n++;const fi=d.columns.findIndex(x=>x.final);d.columns.splice(fi<0?d.columns.length:fi,0,{key,name:v});u.focus='#col-new';break}
 case 'pal':u.palFor=u.palFor===arg?null:arg;break;
 case 'pcol':{const[k,col]=arg.split('|');d.classes[k].color=col;break}
 case 'cls-del':delete d.classes[arg];if(u.palFor===arg)u.palFor=null;break;
 case 'cls-add':{const key=slug($('#nck').value||'').replace(/-/g,'_'),label=($('#ncl').value||'').trim()||key;if(!key||d.classes[key])return;const used=Object.values(d.classes).map(v=>v.color);d.classes[key]={label,color:PAL.find(p=>!used.includes(p))||'grey'};u.palFor=key;break}
 case 'pkind':{const[k,kind]=arg.split('|');d.people[k].kind=kind;break}
 case 'pstill':{const p=d.people[arg];if(p.active===false)delete p.active;else p.active=false;break}
 case 'nkind':u.nkind=arg;break;
 case 'p-add':{const key=($('#npk').value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,''),name=($('#npn').value||'').trim();if(!key||!name||d.people[key])return;d.people[key]={name,kind:u.nkind||'human'};u.focus='#npk';break}
 default:return;
 }
 persist();render();
}

function field(f,v,k){
 const u=S.ui;
 if(u.setup){const d=u.setup;switch(f){
  case 'colname':{const col=d.columns.find(x=>x.key===k);if(v.trim())col.name=v.trim();break}
  case 'limit':{const col=d.columns.find(x=>x.key===k);col.limit=Math.max(1,parseInt(v)||20);break}
  case 'clslabel':d.classes[k].label=v.trim()||k;break;
  case 'pname':if(v.trim())d.people[k].name=v.trim();break;
  case 'hex':if(/^#[0-9a-f]{6}$/i.test(v.trim())){d.classes[k].color=v.trim().toLowerCase();persist();render()}return;
  }persist();const y=$('#yaml');if(y)y.innerHTML=yamlHtml();return}
 const c=cardById(u.open);if(!c)return;
 switch(f){
  case 'title':if(v.trim())c.title=v.trim();break;
  case 'desc':c.desc=v;break;
  case 'labels':c.labels=v.split(',').map(s=>s.trim()).filter(Boolean);break;
  case 'due':c.due=v||null;break;
  case 'cls':c.cls=v||null;break;
  case 'column':moveCard(c.id,v,null);return;
 }
 save(c.file);
 if(['title','desc','labels'].includes(f)){renderMain();const g=$('.mod-fuss .gs');if(g)g.textContent='gespeichert '+clockS(S.meta.saved);$('#stat').innerHTML=vStatus()}else render();
}

/* ── Ereignisse ── */
document.addEventListener('click',e=>{
 if(e.target.closest('a[href^="vscode:"]')){e.stopPropagation();return}
 const el=e.target.closest('[data-act]');
 if(S.ui.pop&&!e.target.closest('.pop')&&!(el&&el.dataset.act==='pop')){S.ui.pop=null;S.ui.need=false;if(!el){render();return}}
 if(!el||el.disabled)return;
 if(el.dataset.act==='close-bg'&&e.target!==el)return;
 if(el.tagName==='A'||el.tagName==='LABEL')e.preventDefault();
 act(el.dataset.act,el.dataset.arg,el);
});
document.addEventListener('change',e=>{const f=e.target.dataset&&e.target.dataset.f;if(f)field(f,e.target.value,e.target.dataset.k)});
document.addEventListener('input',e=>{const fr=e.target.dataset&&e.target.dataset.fr;if(fr&&S.ui.first){S.ui.first[fr]=e.target.value;S.ui.first.err=0;persist();const y=$('#fyaml');if(y)y.textContent=toYaml(fBoard(S.ui.first));return}if(e.target.id==='flt'){S.ui.filter=e.target.value;persist();renderMain()}});
document.addEventListener('keydown',e=>{
 const t=e.target,typing=/INPUT|TEXTAREA|SELECT/.test(t.tagName),u=S.ui;
 if(e.key==='Enter'&&t.dataset&&t.dataset.enter&&!e.shiftKey){e.preventDefault();const v=t.value;act(t.dataset.enter,t.dataset.arg,t,v);return}
 if(e.key==='Escape'){
  if(t.id==='flt'){if(u.filter){u.filter='';persist();render()}else t.blur();return}
  if(u.adding){u.adding=null;render();return}
  if(u.pop){u.pop=null;u.need=false;render();return}
  if(u.open){if(typing)t.blur();u.open=null;u.orgErr=null;persist();render();return}
  if(u.palFor){u.palFor=null;render();return}
  return;
 }
 if(typing)return;
 if(u.open&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();act('nav',e.key==='ArrowDown'?1:-1);return}
 if(u.open&&(e.key==='e'||e.key==='E')){const a=$('#vsc');if(a)a.click();return}
 if(e.key==='/'&&u.view==='board'&&!u.setup){e.preventDefault();const f=$('#flt');if(f)f.focus()}
});
window.addEventListener('resize',placePop);

/* Ziehen: obere Hälfte = davor, untere = dahinter, freie Fläche = ans Ende */
let drag=null,dropT=null;
const clearIns=()=>document.querySelectorAll('.ins-b,.ins-a,.ins-end').forEach(x=>x.classList.remove('ins-b','ins-a','ins-end'));
document.addEventListener('dragstart',e=>{const k=e.target.closest&&e.target.closest('.ka[draggable]');if(!k)return;drag=+k.dataset.id;e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(drag))}catch(_){}setTimeout(()=>k.classList.add('zieht'))});
document.addEventListener('dragover',e=>{
 if(drag==null)return;const lane=e.target.closest('.bahn[data-col]');if(!lane)return;e.preventDefault();clearIns();
 const k=e.target.closest('.ka[data-id]'),col=lane.dataset.col;
 if(k){if(+k.dataset.id===drag){dropT=null;return}const r=k.getBoundingClientRect(),b=e.clientY<r.top+r.height/2;k.classList.add(b?'ins-b':'ins-a');dropT={col,ref:+k.dataset.id,before:b}}
 else{const ks=[...lane.querySelectorAll('.ka[data-id]')].filter(x=>+x.dataset.id!==drag);if(ks.length)ks[ks.length-1].classList.add('ins-a');else lane.classList.add('ins-end');dropT={col,ref:null}}
});
document.addEventListener('drop',e=>{if(drag==null)return;e.preventDefault();const id=drag,t=dropT;drag=null;dropT=null;clearIns();if(t)moveCard(id,t.col,t.ref,t.before)});
document.addEventListener('dragend',()=>{drag=null;dropT=null;clearIns();document.querySelectorAll('.zieht').forEach(x=>x.classList.remove('zieht'))});

/* Takt: laufende Dauern, Marken „extern“ */
setInterval(()=>{
 const n=Date.now();
 if(S.ui.toast&&n-S.ui.toast.at>6000){S.ui.toast=null;const t=$('.toast');if(t)t.remove()}
 document.querySelectorAll('[data-since]').forEach(el=>{const d=n-+el.dataset.since;el.textContent=el.dataset.fmt==='s'?hms(d):hm(d)});
 document.querySelectorAll('[data-ext]').forEach(el=>{el.textContent=`extern · ${el.dataset.file} · vor ${Math.round((n-+el.dataset.ext)/1000)} Sek`});
 if(S.cards.some(c=>c.ext&&n-c.ext.at>=10000)&&!busy()&&drag==null){S.cards.forEach(c=>{if(c.ext&&n-c.ext.at>=10000)delete c.ext});persist();renderMain()}
},1000);

/* Änderungen von außen: ein Agent schreibt in eine Kartendatei; das Board übernimmt still. */
function simStep(){
 const agents=Object.entries(S.board.people).filter(([k,p])=>p.kind==='agent'&&p.active!==false).map(([k])=>k);if(!agents.length)return;
 const cols=S.board.columns,fin=finalCol();
 const cand=S.cards.filter(c=>!c.archived&&c.id!==S.ui.open&&(!fin||c.column!==fin.key)&&c.assignees.some(a=>agents.includes(a)));
 const who=c=>c.assignees.find(a=>agents.includes(a))||agents[0];
 const steps=[
  ()=>{const c=cand.find(c=>c.tasks.some(t=>!t.ok));if(!c)return;c.tasks.find(t=>!t.ok).ok=true;return c},
  ()=>{const c=cand[Math.floor(Math.random()*cand.length)];if(!c)return;c.comments.push({who:who(c),at:Date.now(),text:['Zwischenstand: Tests laufen grün, Doku folgt.','Ursache gefunden, Korrektur ist unterwegs.','Frage: soll das auch für leere Dateien gelten?'][c.comments.length%3]});return c},
  ()=>{const c=cand.find(c=>c.tasks.length&&c.tasks.every(t=>t.ok));if(!c)return;const i=cols.findIndex(k=>k.key===c.column),nx=cols[i+1];if(!nx)return;c.column=nx.key;c.order=Math.max(0,...S.cards.filter(x=>x.column===nx.key).map(x=>x.order))+1;if(nx.final){c.doneAt=Date.now();c.times.forEach(t=>{if(!t.end)t.end=Date.now()})}return c},
  ()=>{if(S.cards.filter(x=>x.sim).length>=3)return;const t=['Befund: leere Frontmatter-Zeile tolerieren','Befund: Zeitzone in kanbanD-time prüfen','Befund: doppelte id beim Einlesen melden'].find(t=>!S.cards.some(x=>x.title===t&&!x.archived));if(!t)return;const n=newCard(cols[0].key,t,agents[0],['thin air']);n.sim=1;return n}
 ];
 for(let n=0;n<steps.length;n++){S.meta.sim=(S.meta.sim||0)+1;const c=steps[S.meta.sim%steps.length]();if(c){c.ext={at:Date.now()};S.meta.saved=Date.now();S.meta.file=c.file;persist();if(!busy()&&drag==null)render();else $('#stat').innerHTML=vStatus();return}}
}
setInterval(()=>{if(S.ui.sim&&!S.ui.setup&&!S.ui.first)simStep()},20000);

render();
