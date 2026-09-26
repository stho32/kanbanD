/* kanbanD Prototyp — Darstellung. Jede Funktion liefert HTML aus dem Zustand S. */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ICON={uhr:'<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
 zettel:'<path d="M4 4h16v16H4zM4 9h16M9 4v16"></path>',kreuz:'<path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16"></path>',csv:'<path d="M12 4v11M8 11l4 4 4-4M4 19h16"></path>'};
const per=(k,m)=>(m||S.board.people)[k]||{name:k,kind:'human'};
const pk=(k,m)=>{const p=per(k,m);return `<span class="pk ${p.kind==='agent'?'pk-a':'pk-m'}${p.active===false?' pk-still':''}" title="${esc(p.name)}${p.active===false?' (stillgelegt)':''}">${esc(k.slice(0,2).toUpperCase())}</span>`};
const hm=ms=>{const m=Math.max(0,Math.floor(ms/6e4));return Math.floor(m/60)+':'+String(m%60).padStart(2,'0')};
const hms=ms=>{const s=Math.max(0,Math.floor(ms/1e3));return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const clock=t=>new Date(t).toTimeString().slice(0,5);
const clockS=t=>new Date(t).toTimeString().slice(0,8);
const isoD=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const today0=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
const weekStart=()=>{const t=today0();return t-((new Date(t).getDay()+6)%7)*864e5};
const run=c=>c.times.filter(t=>!t.end);
const allRun=()=>S.cards.flatMap(c=>run(c).map(t=>({c,t})));
const cv=color=>!color?'':PAL.includes(color)?`--c:var(--kd-c-${color});--cl:var(--kd-c-${color}-line)`:`--c:color-mix(in srgb,${color} 14%,#fff);--cl:${color}`;
const cardById=id=>S.cards.find(c=>c.id===+id);
const finalCol=()=>S.board.columns.find(c=>c.final);
const dayLbl=t=>{const d=today0();return t>=d?'HEUTE':t>=d-864e5?'GESTERN':isoD(t)};

function orgHref(o){const b=S.board;if(/^I\d+$/i.test(o))return `vscode://file${b.root}/${b.origins.I}:${40+parseInt(o.slice(1))*7}`;if(/^R\d+$/i.test(o))return `vscode://file${b.root}/${b.origins.R}${o}.md`;return null}
function orgs(c){const o=c.origins.length?c.origins:['thin air'];return `<span class="orgs">${o.map(x=>{const h=orgHref(x);return h?`<a class="org" href="${h}" title="In VS Code öffnen · ${esc(h.slice(13))}">${esc(x)}</a>`:`<span class="org leer" title="ohne Herkunft">${esc(x)}</span>`}).join('')}</span>`}

/* Filter: Freitext, #12, @st, origin:I0023, origin:"thin air", class:bug, class:none, label:ui */
const isArch=()=>toks(S.ui.filter).some(([k,v])=>k==='is'&&v.toLowerCase()==='archived');
function toks(q){const r=[];(q||'').replace(/(\w+):"([^"]*)"|(\S+)/g,(m,k,v,w)=>{if(k)r.push([k.toLowerCase(),v]);else{const i=w.indexOf(':');if(i>0&&!/^[#@]/.test(w))r.push([w.slice(0,i).toLowerCase(),w.slice(i+1)]);else r.push(['',w])}});return r}
function match(c){
 const u=S.ui;
 if(u.scope==='meine'&&!c.assignees.includes(u.me))return false;
 if(u.scope==='agenten'&&!c.assignees.some(a=>per(a).kind==='agent'))return false;
 if(isArch()!==!!c.archived)return false;
 for(const [k,v] of toks(u.filter)){const l=v.toLowerCase();
  if(k===''){if(l.startsWith('#')){if(l.length>1&&String(c.id)!==l.slice(1))return false}else if(l.startsWith('@')){if(l.length>1&&!c.assignees.includes(l.slice(1)))return false}else if(!c.title.toLowerCase().includes(l))return false}
  else if(k==='origin'){const o=c.origins.length?c.origins:['thin air'];if(l&&!o.some(x=>x.toLowerCase()===l))return false}
  else if(k==='class'){if(l&&(l==='none'?c.cls:c.cls!==l))return false}
  else if(k==='label'){if(l&&!c.labels.some(x=>x.toLowerCase()===l))return false}
  else if(k==='is'){}
  else if(!c.title.toLowerCase().includes((k+':'+v).toLowerCase()))return false;
 }return true}
function visibleOrder(){const vis=S.cards.filter(match);return S.board.columns.flatMap(col=>{const cs=vis.filter(c=>c.column===col.key);return (col.final?cs.sort((a,b)=>(b.doneAt||0)-(a.doneAt||0)):cs.sort((a,b)=>a.order-b.order)).map(c=>c.id)})}

/* ── Kopfzeile ── */
function vKopf(){
 const b=S.board,u=S.ui;
 if(u.first)return `<header class="kz"><div class="kz-z1">${esc(u.first.name)} <span class="mono">${esc(u.first.path)}</span></div><div class="kz-modus"><b>Neues Board</b><span class="muted">Ordner ohne board.yaml</span></div></header>`;
 if(u.setup)return `<header class="kz modus"><div class="kz-z1">${esc(b.name)} <span class="mono">${esc(b.path)}</span></div><div class="kz-modus"><b>Board einrichten</b><span class="muted">Spalten, Klassen und Personen · schreibt <span class="mono">board.yaml</span>, Karten bleiben unberührt</span><div class="rechts"><button class="kz-btn" data-act="setup-cancel">Verwerfen</button><button class="kz-btn haupt" data-act="setup-ok">Fertig</button></div></div></header>`;
 const nav=[['board','Board'],['personen','Personen']].map(([k,t])=>`<a href="#" class="${u.view===k?'an':''}" data-act="view" data-arg="${k}">${t}</a>`).join('')+`<a href="#" id="t-ber" class="${['kreuz','stunden'].includes(u.view)?'an':''}${u.pop==='ber'?' auf':''}" data-act="pop" data-arg="ber">Berichte<span class="dd">▾</span></a>`;
 const werk=u.view==='board'?`<div class="kz-werk"><input class="inp" id="flt" placeholder="Filtern: Titel, #Nr, origin:I0023, class:bug, label:, @wer  ( / )" value="${esc(u.filter)}"><span class="seg">${[['alle','alle'],['meine','meine'],['agenten','Agenten']].map(([k,t])=>`<span class="${u.scope===k?'an':''}" data-act="scope" data-arg="${k}">${t}</span>`).join('')}</span><label class="kz-chk" data-act="tog" data-arg="count" title="Kartenzahl ein/aus"><i>${u.count?'✓':''}</i><span class="lb">Kartenzahl</span></label><label class="kz-chk" data-act="tog" data-arg="legend" title="Legende ein/aus"><i>${u.legend?'✓':''}</i><span class="lb">Legende</span></label><button class="kz-btn" data-act="setup" title="Board einrichten: Spalten, Klassen, Personen">Spalten</button></div>`:'';
 const r=allRun().length,me=u.me&&S.board.people[u.me];
 return `<header class="kz"><div class="kz-z1" title="${esc(b.root)}">${esc(b.name)} <span class="mono">${esc(b.path)}</span></div><nav class="kz-nav">${nav}</nav>${werk}<div class="kz-z3">${r?`<button class="kz-btn${u.pop==='lauf'?' auf':''}" id="t-lauf" data-act="pop" data-arg="lauf">${ICON.uhr}${r} ${r===1?'läuft':'laufen'}</button>`:''}<button class="kz-btn${u.pop==='ich'?' auf':''}${me?'':' leer'}" id="t-ich" data-act="pop" data-arg="ich">${me?pk(u.me)+esc(me.name):'nicht gewählt'} ▾</button></div></header>`;
}

/* ── Board ── */
function vCard(c,fin){
 const cl=c.cls&&S.board.classes[c.cls],rs=run(c),own=rs.some(t=>t.who===S.ui.me);
 const first=[...rs].sort((a,b)=>a.start-b.start)[0];
 const lz=rs.length?`<span class="lauf${own?' eigen':''}" title="läuft: ${esc(rs.map(t=>per(t.who).name).join(', '))}">${rs.length>1?rs.length+'× ':''}<span data-since="${first.start}">${hm(Date.now()-first.start)}</span></span>`:'';
 const tk=c.tasks.length?`<span>☑ ${c.tasks.filter(t=>t.ok).length}/${c.tasks.length}</span>`:'';
 const due=c.due?`<span class="due${!fin&&c.due<=isoD(Date.now()+864e5)?' warn':''}">${c.due}</span>`:'';
 const ext=c.ext&&Date.now()-c.ext.at<10000;
 return `<div class="ka${fin?' fertig':''}${ext?' fremd':''}${S.ui.open===c.id?' offen':''}" draggable="true" data-id="${c.id}" data-act="open" data-arg="${c.id}"${cl?` data-c="1" style="${cv(cl.color)}"`:''}><div class="r1"><span class="id">#${c.id}</span>${orgs(c)}${c.labels.map(l=>`<span class="lbl">${esc(l)}</span>`).join('')}${lz}</div><div class="t">${esc(c.title)}</div><div class="r3"><span class="avs">${c.assignees.map(a=>pk(a)).join('')}</span>${cl?`<span class="cls">${esc(cl.label)}</span>`:''}${tk}${due}</div>${ext?`<div class="ein" data-ext="${c.ext.at}" data-file="${esc(c.file)}">extern · ${esc(c.file)} · vor ${Math.round((Date.now()-c.ext.at)/1000)} Sek</div>`:''}</div>`;
}
function vLane(col,cs){
 const u=S.ui;let body='';
 if(col.final){const all=[...cs].sort((a,b)=>(b.doneAt||0)-(a.doneAt||0)),n=col.limit+(u.more[col.key]||0);let g='';for(const c of all.slice(0,n)){const l=dayLbl(c.doneAt||0);if(l!==g){body+=`<div class="dgrp">${l}</div>`;g=l}body+=vCard(c,1)}const na=S.cards.filter(c=>c.archived).length;if((all.length>n||na)&&!isArch())body+=`<div class="nach">${all.length>n?`${all.length-n} ältere · <a href="#" data-act="more" data-arg="${col.key}">nachladen</a>`:''}${all.length>n&&na?' · ':''}${na?`<a href="#" data-act="arch-on">Archiv (${na})</a>`:''}</div>`}
 else body=[...cs].sort((a,b)=>a.order-b.order).map(c=>vCard(c)).join('');
 if(!cs.length)body=`<div class="leer">${u.filter||u.scope!=='alle'?'keine Treffer':!S.cards.length&&col===S.board.columns[0]?'Noch keine Karten.<br>„+ Karte“ legt <span class="mono">cards/0001-….md</span> an.':'leer'}</div>`;
 const add=u.adding===col.key?`<div class="bahn-add"><input class="inp" id="add-inp" placeholder="Titel · Enter legt an · Esc bricht ab" data-enter="add-ok" data-arg="${col.key}"></div>`:`<button data-act="add" data-arg="${col.key}">+ Karte</button>`;
 return `<section class="bahn" data-col="${col.key}"><div class="bahn-kopf">${esc(col.name)}${col.final?` <span class="ok" title="Abschlussspalte">✓</span> <span class="v">Grenze ${col.limit}</span>`:''}${u.count?`<span class="n">${cs.length}</span>`:''}</div><div class="flaeche">${body}</div><div class="bahn-fuss">${add}</div></section>`;
}
function vLeg(vis){
 const cnt=k=>vis.filter(c=>k?c.cls===k:!c.cls).length,cur=(toks(S.ui.filter).find(t=>t[0]==='class')||[])[1];
 return `<div class="leg"><span class="tt">LEGENDE</span>${Object.entries(S.board.classes).map(([k,v])=>`<button class="${cur===k?'an':''}" data-act="legf" data-arg="${k}" style="${cv(v.color)}" title="filtern: class:${k}"><span class="sw"></span>${esc(v.label)}<span class="n">${cnt(k)}</span></button>`).join('')}<button class="${cur==='none'?'an':''}" data-act="legf" data-arg="none" title="filtern: class:none"><span class="sw leer"></span>ohne Klasse<span class="n">${cnt(null)}</span></button><span class="rechts">Klick filtert · <span class="mono">class:</span><button class="btn btn-sym x" data-act="tog" data-arg="legend" title="Legende ausblenden">✕</button></span></div>`;
}
function vBoard(){const vis=S.cards.filter(match),na=S.cards.filter(c=>c.archived).length;return (isArch()?`<div class="archbar">Archiv · ${vis.length} von ${na} archivierten Karten · Dateien bleiben im Ordner, Zeiten zählen in Berichten weiter<button class="lnk" data-act="arch-off">Archiv verlassen</button></div>`:'')+`<div class="bahnen">${S.board.columns.map(col=>vLane(col,vis.filter(c=>c.column===col.key))).join('')}</div>${S.ui.legend?vLeg(vis):''}`}

/* ── Karte (Modal) ── */
function toMd(c){
 const L=a=>`[${a.join(', ')}]`,o=(c.origins.length?c.origins:['thin air']).map(x=>x==='thin air'?'"thin air"':x);
 let s=`---\nid: ${c.id}\ntitle: ${c.title}\ncolumn: ${c.column}\n`+(c.cls?`class: ${c.cls}\n`:'')+`origins: ${L(o)}\nassignees: ${L(c.assignees)}\n`+(c.labels.length?`labels: ${L(c.labels)}\n`:'')+(c.due?`due: ${c.due}\n`:'')+(c.archived?`archived: ${isoD(c.archived)}\n`:'')+'---\n\n';
 if(c.desc)s+=c.desc+'\n\n';
 if(c.tasks.length)s+=c.tasks.map(t=>`- [${t.ok?'x':' '}] ${t.t}`).join('\n')+'\n\n';
 if(c.times.length)s+='```kanbanD-time\n'+[...c.times].sort((a,b)=>a.start-b.start).map(t=>`${isoD(t.start)} ${clock(t.start)}  ${t.end?clock(t.end):'...  '}  ${t.who}`).join('\n')+'\n```\n\n';
 if(c.comments.length)s+='```kanbanD-comments\n'+c.comments.map(k=>`${isoD(k.at)} ${clock(k.at)} ${k.who}: ${k.text}`).join('\n')+'\n```\n';
 return s;
}
function vModal(){
 const c=cardById(S.ui.open);if(!c)return'';
 const u=S.ui,b=S.board,cl=c.cls&&b.classes[c.cls],me=u.me,vis=visibleOrder(),i=vis.indexOf(c.id);
 const rs=run(c),mine=rs.find(t=>t.who===me),now=Date.now(),total=c.times.reduce((s,t)=>s+((t.end||now)-t.start),0),ok=c.tasks.filter(t=>t.ok).length;
 const head=`<div class="mod-kopf"><span class="id">#${c.id}</span>${cl?`<span class="cls">${esc(cl.label)}</span>`:''}<span class="pfad">${esc(c.file)}</span><div class="rechts"><span class="seg">${[['inhalt','Inhalt'],['datei','Datei']].map(([k,t])=>`<span class="${u.tab===k?'an':''}" data-act="tab" data-arg="${k}">${t}</span>`).join('')}</span><span class="nav">${i+1} / ${vis.length}</span><button class="btn btn-sym" data-act="nav" data-arg="-1" title="vorige Karte (↑)">↑</button><button class="btn btn-sym" data-act="nav" data-arg="1" title="nächste Karte (↓)">↓</button><a class="btn btn-sym" id="vsc" href="vscode://file${esc(b.root)}/${esc(c.file)}" title="In VS Code öffnen (E)">↗</a><button class="btn btn-sym" data-act="arch" title="${c.archived?'Aus dem Archiv zurückholen':'Archivieren – verschwindet vom Board, Datei bleibt'}">${c.archived?'↺':'▭'}</button><button class="btn btn-sym" data-act="close" title="Schließen (Esc)">✕</button></div></div>${c.archived?`<div class="archbar">Archiviert am ${isoD(c.archived)} · nicht auf dem Board, Datei und Zeiten bleiben<button class="lnk" data-act="arch">zurückholen</button></div>`:''}`;
 const foot=`<div class="mod-fuss"><span class="gs">gespeichert ${clockS(S.meta.saved)}</span><span>jede Änderung geht sofort in die Datei</span><span style="margin-left:auto"><kbd>Esc</kbd> schließen · <kbd>↑</kbd><kbd>↓</kbd> Karte wechseln · <kbd>E</kbd> VS Code</span></div>`;
 if(u.tab==='datei')return `<div class="mod-bg" data-act="close-bg"><div class="mod"${cl?` style="${cv(cl.color)}"`:''}>${head}<div class="mod-body voll"><div class="mod-main"><pre class="md">${esc(toMd(c))}</pre></div></div>${foot}</div></div>`;
 const main=`<div class="mod-main"><input class="titel" data-f="title" value="${esc(c.title)}" aria-label="Titel">
<div class="abs"><h3>BESCHREIBUNG</h3><textarea class="besch" data-f="desc" placeholder="Beschreibung in Markdown">${esc(c.desc)}</textarea></div>
<div class="abs"><h3>TEILAUFGABEN <span class="mono">${ok}/${c.tasks.length}</span></h3>${c.tasks.map((t,j)=>`<div class="chk${t.ok?' ok':''}"><i data-act="task" data-arg="${j}">${t.ok?'✓':''}</i><span data-act="task" data-arg="${j}">${esc(t.t)}</span><button class="btn btn-sym x" data-act="task-del" data-arg="${j}" title="entfernen">✕</button></div>`).join('')}<input class="inp add" placeholder="+ Teilaufgabe · Enter" data-enter="task-add"></div>
<div class="abs"><h3>KOMMENTARE <span class="mono">kanbanD-comments · ${c.comments.length}</span></h3>${c.comments.map(k=>`<div class="km">${pk(k.who)}<div><p>${esc(k.text)}</p><span class="mono">${esc(per(k.who).name)} · ${isoD(k.at)} ${clock(k.at)}</span></div></div>`).join('')}<input class="inp add" id="km-inp" placeholder="${me?'+ Kommentar als '+esc(per(me).name)+' · Enter':'erst „Ich bin …“ wählen'}" data-enter="comment"${me?'':' disabled'}></div></div>`;
 const oc=c.origins.length?c.origins.map((o,j)=>{const h=orgHref(o);return `<span class="ochip">${h?`<a class="org" href="${h}" title="In VS Code öffnen">${esc(o)}</a>`:`<span class="org leer">${esc(o)}</span>`}<button data-act="org-del" data-arg="${j}" title="entfernen">×</button></span>`}).join(''):'<span class="org leer" title="ohne Herkunft">thin air</span>';
 const as=Object.entries(b.people).filter(([k,p])=>p.active!==false||c.assignees.includes(k)).map(([k,p])=>`<button class="as${c.assignees.includes(k)?' an':''}" data-act="as" data-arg="${k}"${p.active===false?' disabled title="stillgelegt"':''}>${pk(k)}${esc(p.name)}</button>`).join('');
 const side=`<aside class="mod-side">
<div class="abs"><h3>LÄUFT GERADE <span class="mono">${rs.length} Timer</span></h3>${rs.length?`<div class="tl">${rs.map(t=>`<div class="tz${t.who===me?' eigen':''}">${pk(t.who)}<span>${esc(per(t.who).name)} <span class="muted">${t.who===me?'· ich ':''}· seit ${clock(t.start)}</span></span><b data-since="${t.start}" data-fmt="s">${hms(now-t.start)}</b><button class="btn${t.who===me?' btn-haupt':''}" data-act="stop" data-arg="${c.id}|${t.start}|${t.who}" title="${t.who===me?'meinen Timer':esc(per(t.who).name)+'s Timer'} stoppen">■</button></div>`).join('')}</div>`:''}${mine?'':`<button class="btn btn-haupt start" data-act="start" data-arg="${c.id}">▶ ${me?'Meinen Timer starten':'Timer starten …'}</button>`}</div>
<div class="felder"><span class="k">column</span><span class="w"><select data-f="column">${b.columns.map(k=>`<option value="${k.key}"${k.key===c.column?' selected':''}>${esc(k.name)}</option>`).join('')}</select></span>
<span class="k">class</span><span class="w"><select data-f="cls"><option value="">— keine —</option>${Object.entries(b.classes).map(([k,v])=>`<option value="${k}"${k===c.cls?' selected':''}>${esc(v.label)}</option>`).join('')}</select></span>
<span class="k">origins</span><span class="w wrap">${oc}<input class="mini-inp" placeholder="I0001 / R00014" data-enter="org-add" title="WBS-Knoten I0001, Anforderung R00014 oder thin air · Enter">${u.orgErr?`<span class="oerr">„${esc(u.orgErr)}“ ist kein Origin – erwartet I0001, R00014 oder thin air</span>`:''}</span>
<span class="k">assignees</span><span class="w wrap">${as}</span>
<span class="k">labels</span><span class="w"><input class="mini-inp full" data-f="labels" value="${esc(c.labels.join(', '))}" placeholder="ui, daten"></span>
<span class="k">due</span><span class="w"><input type="date" class="mini-inp" data-f="due" value="${c.due||''}"></span></div>
<div class="abs"><h3>ZEITEN <span class="mono">kanbanD-time · ${hm(total)}</span></h3><table class="zt">${[...c.times].sort((a,b)=>b.start-a.start).map(t=>`<tr><td class="mono">${isoD(t.start).slice(5)}</td><td class="mono">${clock(t.start)}–${t.end?clock(t.end):'…'}</td><td>${pk(t.who)}</td><td class="r">${t.end?hm(t.end-t.start):`<span class="lauf${t.who===me?' eigen':''}"><span data-since="${t.start}">${hm(now-t.start)}</span></span>`}</td><td class="x">${t.end?`<button class="btn btn-sym" data-act="time-del" data-arg="${t.start}|${t.who}" title="Eintrag löschen">✕</button>`:''}</td></tr>`).join('')}</table><input class="inp add" placeholder="${me?'+ Zeit nachtragen, z. B. 0:45 · Enter':'erst „Ich bin …“ wählen'}" data-enter="time-add"${me?'':' disabled'}></div></aside>`;
 return `<div class="mod-bg" data-act="close-bg"><div class="mod"${cl?` style="${cv(cl.color)}"`:''}>${head}<div class="mod-body">${main}${side}</div>${foot}</div></div>`;
}

/* ── Popover ── */
function vPop(){
 const u=S.ui;if(!u.pop)return'';
 if(u.pop==='lauf'){const r=allRun().sort((a,b)=>a.t.start-b.t.start);return `<div class="pop" id="pop" data-for="t-lauf" data-al="r" style="width:450px"><h4>LÄUFT GERADE <span class="mono">${r.length} Timer · ${new Set(r.map(x=>x.c.id)).size} Karten</span></h4>${r.map(({c,t})=>`<div class="pz2${t.who===u.me?' eigen':''}" data-act="lauf-open" data-arg="${c.id}">${pk(t.who)}<span class="id">#${c.id}</span><span class="t">${esc(c.title)}<small>${esc(per(t.who).name)}${t.who===u.me?' · ich':''} · seit ${clock(t.start)}</small></span><b data-since="${t.start}" data-fmt="s">${hms(Date.now()-t.start)}</b><button class="btn${t.who===u.me?' btn-haupt':''}" data-act="stop" data-arg="${c.id}|${t.start}|${t.who}" title="stoppen">■</button></div>`).join('')}<div class="fuss">Klick auf eine Zeile öffnet die Karte · fremde Timer lassen sich stoppen</div></div>`}
 if(u.pop==='ich'){const ps=Object.entries(S.board.people);return `<div class="pop" id="pop" data-for="t-ich" data-al="r" style="width:280px"><h4>ICH BIN … <span class="mono">people:</span></h4>${u.need?'<div class="warnh">Für einen Timer zuerst wählen, wer du bist.</div>':''}${ps.filter(([k,p])=>p.kind==='human'&&p.active!==false).map(([k,p])=>`<div class="iz${k===u.me?' an':''}" data-act="ich" data-arg="${k}">${pk(k)}${esc(p.name)}<span class="muted">${k===u.me?'gewählt':''}</span></div>`).join('')}${ps.filter(([k,p])=>p.kind==='agent'||p.active===false).map(([k,p])=>`<div class="iz aus">${pk(k)}${esc(p.name)}<span class="muted">${p.active===false?'stillgelegt':'Agent · schreibt selbst'}</span></div>`).join('')}<div class="fuss">Die Wahl merkt sich dieser Rechner. Ohne Wahl startet kein Timer.</div></div>`}
 const e=(act,arg,svg,t,s)=>`<div class="e${u.view===arg?' an':''}" data-act="${act}" data-arg="${arg}"><svg class="i" viewBox="0 0 24 24">${svg}</svg><b>${t}</b><small>${s}</small></div>`;
 return `<div class="pop menue" id="pop" data-for="t-ber" data-al="l" style="width:330px"><div class="k">ZEITEN</div>${e('view','stunden',ICON.zettel,'Stundenzettel','Eine Person, diese Woche: Karten × Tage mit Summen.')}${e('view','kreuz',ICON.kreuz,'Zeiten nach Karte und Person','Kreuztabelle über den Zeitraum, Summen in beide Richtungen.')}<div class="k">AUSLEITEN</div>${e('csv','',ICON.csv,'Export als CSV','Eine Zeile je Zeiteintrag: Karte, Person, Art, Beginn, Ende, Dauer, Origins.')}</div>`;
}

/* ── Board einrichten ── */
function toYaml(b){
 const q=s=>/[:#,{}\[\]"]|^\s|\s$/.test(s)?JSON.stringify(s):s;
 return 'columns:\n'+b.columns.map(c=>`  - {key: ${c.key}, name: ${q(c.name)}${c.final?`, final: true, limit: ${c.limit}`:''}}`).join('\n')
 +'\nclasses:'+(Object.keys(b.classes).length?'\n':' {}')+Object.entries(b.classes).map(([k,v])=>`  ${k}: {label: ${q(v.label)}, color: ${v.color.startsWith('#')?JSON.stringify(v.color):v.color}}`).join('\n')
 +'\npeople:\n'+Object.entries(b.people).map(([k,p])=>`  ${k}: {name: ${q(p.name)}, kind: ${p.kind}${p.active===false?', active: false':''}}`).join('\n')
 +`\nnext_id: ${b.next}\norigins:\n  I: ${b.origins.I}\n  R: ${b.origins.R}`;
}
function yamlHtml(){const o=new Set(toYaml(S.board).split('\n'));return toYaml(S.ui.setup).split('\n').map(l=>o.has(l)?esc(l):`<span class="neu">${esc(l)}</span>`).join('\n')}
function vSetup(){
 const u=S.ui,d=u.setup,n=k=>S.cards.filter(c=>c.column===k).length;
 const mini=c=>{const cl=c.cls&&d.classes[c.cls];return `<div class="ka"${cl?` data-c="1" style="${cv(cl.color)}"`:''}><div class="r1"><span class="id">#${c.id}</span></div><div class="t">${esc(c.title)}</div>${cl?`<div class="r3"><span class="cls">${esc(cl.label)}</span></div>`:''}</div>`};
 const lanes=d.columns.map((col,i)=>{const m=n(col.key);return `<section class="bahn" style="--bw:228px"><div class="bk-ed"><div class="r"><input class="inp" data-f="colname" data-k="${col.key}" value="${esc(col.name)}" aria-label="Spaltenname"><button class="btn btn-sym" data-act="col-l" data-arg="${i}"${i===0?' disabled':''} title="nach links">←</button><button class="btn btn-sym" data-act="col-r" data-arg="${i}"${i===d.columns.length-1?' disabled':''} title="nach rechts">→</button><button class="btn btn-sym" data-act="col-del" data-arg="${col.key}"${m?` disabled title="enthält ${m} Karten – erst leeren"`:' title="entfernen"'}>✕</button></div><div class="r2"><span class="mono">${col.key}</span><span>${m} Karten</span><label class="chk-s" data-act="col-final" data-arg="${col.key}"><i class="${col.final?'an':''}">${col.final?'✓':''}</i>Abschluss</label>${col.final?`Grenze <input class="inp" data-f="limit" data-k="${col.key}" value="${col.limit}">`:''}</div></div><div class="flaeche ruhig">${S.cards.filter(c=>c.column===col.key).sort((a,b)=>col.final?(b.doneAt||0)-(a.doneAt||0):a.order-b.order).slice(0,6).map(mini).join('')}</div></section>`}).join('')
 +`<section class="bahn-neu"><div class="bk-ed"><div class="r"><input class="inp" id="col-new" placeholder="neue Spalte · Enter" data-enter="col-add"><button class="btn btn-sym" data-act="col-add" title="anlegen">+</button></div><div class="r2">wird vor der Abschlussspalte eingefügt</div></div></section>`;
 const cnt=k=>S.cards.filter(c=>c.cls===k).length;
 const cls=Object.entries(d.classes).map(([k,v])=>`<div class="klz"><span class="farbe${u.palFor===k?' an':''}" style="${cv(v.color)}" data-act="pal" data-arg="${k}" title="Farbe wählen"></span><span class="key" title="${k}">${k}</span><input class="inp" data-f="clslabel" data-k="${k}" value="${esc(v.label)}"><span class="n" title="Karten mit dieser Klasse">${cnt(k)}</span><button class="btn btn-sym" data-act="cls-del" data-arg="${k}" title="entfernen – ${cnt(k)} Karten verlieren ihre Klasse">✕</button></div>${u.palFor===k?`<div class="pal"><span class="nm">gewählt: ${esc(v.color)}</span><div class="g">${PAL.map(p=>`<span style="${cv(p)}" class="${v.color===p?'an':''}" data-act="pcol" data-arg="${k}|${p}" title="${p}"></span>`).join('')}</div><div class="eig">Eigene Farbe <input type="color" data-f="hex" data-k="${k}" value="${v.color.startsWith('#')?v.color:'#b04a8c'}" title="Farbwähler"><input class="inp mono" data-f="hex" data-k="${k}" value="${v.color.startsWith('#')?esc(v.color):''}" placeholder="#b04a8c"></div></div>`:''}`).join('');
 const ppl=Object.entries(d.people).map(([k,p])=>`<div class="klz pz${p.active===false?' still':''}">${pk(k,d.people)}<span class="key">${k}</span><input class="inp" data-f="pname" data-k="${k}" value="${esc(p.name)}"><span class="seg art"><span class="${p.kind==='human'?'an':''}" data-act="pkind" data-arg="${k}|human">Mensch</span><span class="${p.kind==='agent'?'an':''}" data-act="pkind" data-arg="${k}|agent">Agent</span></span><button class="btn btn-sym" data-act="pstill" data-arg="${k}" title="${p.active===false?'zurückholen':'stilllegen – nicht mehr wählbar, Name bleibt lesbar'}">${p.active===false?'↺':'⏸'}</button></div>`).join('');
 const einr=`<aside class="einr"><h3>KLASSEN <span class="mono">classes:</span></h3><div class="hin">Eine Karte trägt höchstens eine Klasse. Sie färbt die Karte und ist filterbar mit <span class="mono">class:bug</span>. Klick auf das Farbfeld öffnet 16 Farben oder eine eigene.</div>${cls}<div class="klz"><span class="farbe"></span><input class="inp mono" id="nck" placeholder="schlüssel"><input class="inp" id="ncl" placeholder="Bezeichnung · Enter" data-enter="cls-add"><span></span><button class="btn btn-sym" data-act="cls-add" title="anlegen">+</button></div>
<h3>PERSONEN <span class="mono">people:</span></h3><div class="hin">Menschen sind unter „Ich bin …“ wählbar; alle sind als <span class="mono">assignees</span> zuweisbar. Stilllegen statt entfernen – der Name bleibt in Karten und Zeiten lesbar.</div>${ppl}<div class="klz pz"><span class="pk pk-0">+</span><input class="inp mono" id="npk" placeholder="kürzel"><input class="inp" id="npn" placeholder="Name · Enter" data-enter="p-add"><span class="seg art"><span class="${u.nkind!=='agent'?'an':''}" data-act="nkind" data-arg="human">Mensch</span><span class="${u.nkind==='agent'?'an':''}" data-act="nkind" data-arg="agent">Agent</span></span><button class="btn btn-sym" data-act="p-add" title="anlegen">+</button></div>
<h3>BOARD.YAML <span class="mono">Vorschau · Änderungen grün</span></h3><pre class="yaml" id="yaml">${yamlHtml()}</pre></aside>`;
 return `<div class="setup"><div class="bahnen">${lanes}</div>${einr}</div>`;
}

/* ── Personen ── */
function vPers(){
 const u=S.ui,now=Date.now(),t0=today0(),wk=weekStart(),W0=6,W1=20,fin=finalCol()?.key,first=S.board.columns[0]?.key;
 const pos=t=>Math.max(0,Math.min(100,((t-t0)/36e5-W0)/(W1-W0)*100));
 const all=Object.entries(S.board.people);
 const ppl=all.filter(([k,p])=>(u.pstill||p.active!==false)&&(u.pscope==='alle'||(u.pscope==='m'?p.kind==='human':p.kind==='agent')));
 const data=ppl.map(([k,p])=>{const e=S.cards.flatMap(c=>c.times.filter(t=>t.who===k).map(t=>({c,t})));const ov=a=>e.reduce((s,x)=>s+Math.max(0,(x.t.end||now)-Math.max(x.t.start,a)),0);const r=e.filter(x=>!x.t.end),tod=ov(t0),open=S.cards.filter(c=>c.assignees.includes(k)&&c.column!==fin&&!c.archived);const last=Math.max(0,...e.map(x=>x.t.end||0),...S.cards.flatMap(c=>c.comments.filter(m=>m.who===k).map(m=>m.at)));return {k,p,e,r,tod,wo:ov(wk),open,beg:open.filter(c=>c.column!==first).length,last,g:r.length?0:tod>0?1:2}});
 const G=['LÄUFT JETZT','HEUTE AKTIV','HEUTE RUHIG'];let rows='';
 for(let g=0;g<3;g++){const ds=data.filter(d=>d.g===g);if(!ds.length)continue;
  rows+=`<tr class="grp"><td colspan="6">${G[g]} <span>· ${g===0?ds.reduce((s,d)=>s+d.r.length,0)+' Timer':ds.length+(ds.length===1?' Person':' Personen')}</span></td></tr>`;
  rows+=ds.map(d=>{
   const segs=d.e.filter(x=>(x.t.end||now)>t0).map(x=>{const a=pos(Math.max(x.t.start,t0)),b=pos(x.t.end||now);return b>a?`<i class="${!x.t.end?'l':d.p.kind==='agent'?'a':''}" style="left:${a}%;width:${Math.max(.5,b-a)}%" title="#${x.c.id} · ${clock(x.t.start)}–${x.t.end?clock(x.t.end):'…'}"></i>`:''}).join('');
   const akt=d.r.length?`<div class="akt">${d.r.map(x=>`<div class="z"><span class="lauf${d.k===u.me?' eigen':''}"><span data-since="${x.t.start}">${hm(now-x.t.start)}</span></span><a href="#" class="id" data-act="open" data-arg="${x.c.id}">#${x.c.id}</a><span class="t">${esc(x.c.title)}</span><button class="btn stop${d.k===u.me?' btn-haupt':''}" data-act="stop" data-arg="${x.c.id}|${x.t.start}|${d.k}" title="${d.k===u.me?'meinen Timer':esc(d.p.name)+'s Timer'} stoppen">■</button></div>`).join('')}</div>`:`<span class="muted">${d.last?'zuletzt '+(d.last>=t0?clock(d.last):isoD(d.last)):'—'}</span>`;
   return `<tr class="${d.g===2?'ruhe':''}"><td><a href="#" class="wer" data-act="pfilter" data-arg="${d.k}" title="Board auf @${d.k} filtern">${pk(d.k)}<span><b>${esc(d.p.name)}</b><small>${d.p.active===false?'stillgelegt':d.k===u.me?'ich':d.p.kind==='agent'?'Agent':'&nbsp;'}</small></span></a></td><td>${akt}</td><td><div class="tagl">${segs}<span class="jetzt" style="left:${pos(now)}%"></span></div></td><td class="r num">${hm(d.tod)}</td><td class="r num muted">${hm(d.wo)}</td><td class="r"><span class="num">${d.open.length}</span> <span class="muted" style="font-size:11px">· ${d.beg} begonnen</span></td></tr>`}).join('');
 }
 const still=all.filter(([k,p])=>p.active===false).length,sumT=data.reduce((s,d)=>s+d.tod,0);
 return `<div class="leiste"><span class="seg">${[['alle','Menschen + Agenten'],['m','nur Menschen'],['a','nur Agenten']].map(([k,t])=>`<span class="${u.pscope===k?'an':''}" data-act="pscope" data-arg="${k}">${t}</span>`).join('')}</span>${still?`<label class="chk-s" data-act="tog" data-arg="pstill"><i class="${u.pstill?'an':''}">${u.pstill?'✓':''}</i>Stillgelegte einblenden (${still})</label>`:''}<div class="rechts muted">Tagesleiste ${W0}–${W1} Uhr · schraffiert = läuft</div></div>
<div class="body"><table class="pt"><thead><tr><th style="width:190px">Person</th><th>Gerade</th><th><div class="skala">${[6,8,10,12,14,16,18,20].map(h=>`<span style="left:${(h-W0)/(W1-W0)*100}%">${h}</span>`).join('')}</div></th><th class="r">heute</th><th class="r">Woche</th><th class="r">zugewiesen offen</th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="leiste" style="border-top:1px solid var(--kd-line);border-bottom:0;font-size:12px;color:var(--kd-muted)"><span>${data.length} Personen · ${allRun().length} laufende Timer · heute zusammen ${hm(sumT)}</span><span class="rechts">Klick auf Person → Board gefiltert auf <span class="mono">@kürzel</span></span></div>`;
}

/* ── Berichte (lesen nur) ── */
function tsum(from,to,fn){const now=Date.now(),m={};S.cards.forEach(c=>c.times.forEach(t=>{const d=Math.max(0,Math.min(t.end||now,to)-Math.max(t.start,from));if(d>0){const k=fn(c,t);m[k]=(m[k]||0)+d}}));return m}
function vKreuz(){
 const u=S.ui,now=Date.now(),from=u.period==='woche'?weekStart():u.period==='30'?now-30*864e5:0;
 const m=tsum(from,now+1,(c,t)=>c.id+'|'+t.who),ids=[...new Set(Object.keys(m).map(k=>+k.split('|')[0]))].sort((a,b)=>b-a),ppl=Object.keys(S.board.people).filter(p=>Object.keys(m).some(k=>k.endsWith('|'+p)));
 const v=(i,p)=>m[i+'|'+p]||0,rs=i=>ppl.reduce((s,p)=>s+v(i,p),0),cs=p=>ids.reduce((s,i)=>s+v(i,p),0);
 return `<div class="leiste"><b>Zeiten nach Karte und Person</b><span class="seg">${[['woche','diese Woche'],['30','30 Tage'],['alle','alles']].map(([k,t])=>`<span class="${u.period===k?'an':''}" data-act="period" data-arg="${k}">${t}</span>`).join('')}</span><span class="muted" style="font-size:12px">liest nur · korrigiert wird an der Karte</span><div class="rechts"><button class="btn" data-act="csv">CSV</button></div></div>
<div class="body"><table class="pt dicht"><thead><tr><th>Karte</th>${ppl.map(p=>`<th class="r">${pk(p)} ${esc(per(p).name)}</th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${ids.map(i=>{const c=cardById(i);return `<tr class="klick" data-act="open" data-arg="${i}"><td class="tt"><span class="mono muted">#${i}</span> ${esc(c?c.title:'')}</td>${ppl.map(p=>`<td class="r num">${v(i,p)?hm(v(i,p)):'<span class="muted">—</span>'}</td>`).join('')}<td class="r num"><b>${hm(rs(i))}</b></td></tr>`}).join('')||`<tr><td class="muted">Keine Zeiten im Zeitraum.</td></tr>`}<tr class="grp"><td>SUMME</td>${ppl.map(p=>`<td class="r">${hm(cs(p))}</td>`).join('')}<td class="r">${hm(ids.reduce((s,i)=>s+rs(i),0))}</td></tr></tbody></table></div>`;
}
function vStunden(){
 const u=S.ui,w=weekStart(),D=864e5,days=[...Array(7)].map((_,i)=>w+i*D),names=['Mo','Di','Mi','Do','Fr','Sa','So'],t0=today0();
 const m=tsum(w,w+7*D,(c,t)=>t.who===u.sp?c.id+'|'+Math.floor((Math.max(t.start,w)-w)/D):'x');delete m.x;
 const ids=[...new Set(Object.keys(m).map(k=>+k.split('|')[0]))],v=(i,d)=>m[i+'|'+d]||0,rs=i=>days.reduce((s,_,d)=>s+v(i,d),0),ds=d=>ids.reduce((s,i)=>s+v(i,d),0);
 return `<div class="leiste"><b>Stundenzettel</b><span class="seg">${Object.entries(S.board.people).filter(([k,p])=>p.active!==false).map(([k,p])=>`<span class="${u.sp===k?'an':''}" data-act="sp" data-arg="${k}">${esc(p.name)}</span>`).join('')}</span><span class="mono muted">${isoD(w)} – ${isoD(w+6*D)}</span><span class="muted" style="font-size:12px">liest nur · Klick auf eine Zeile öffnet die Karte zum Korrigieren</span><div class="rechts"><button class="btn" data-act="csv">CSV</button></div></div>
<div class="body"><table class="pt dicht"><thead><tr><th>Karte</th>${days.map((d,i)=>`<th class="r"${d===t0?' style="color:var(--kd-accent-ink)"':''}>${names[i]} <span class="mono">${isoD(d).slice(8)}</span></th>`).join('')}<th class="r">Summe</th></tr></thead><tbody>${ids.map(i=>{const c=cardById(i);return `<tr class="klick" data-act="open" data-arg="${i}"><td class="tt"><span class="mono muted">#${i}</span> ${esc(c?c.title:'')}</td>${days.map((_,d)=>`<td class="r num">${v(i,d)?hm(v(i,d)):'<span class="muted">·</span>'}</td>`).join('')}<td class="r num"><b>${hm(rs(i))}</b></td></tr>`}).join('')||`<tr><td class="muted" colspan="9">${esc(per(u.sp).name)} hat diese Woche keine Zeiten.</td></tr>`}<tr class="grp"><td>SUMME</td>${days.map((_,d)=>`<td class="r">${hm(ds(d))}</td>`).join('')}<td class="r">${hm(ids.reduce((s,i)=>s+rs(i),0))}</td></tr></tbody></table></div>`;
}

function vStatus(){const u=S.ui;if(u.first)return `<span class="mono">${esc(u.first.root)}</span><span>0 Kartendateien · board.yaml fehlt</span><span class="rechts"><button class="lnk" data-act="reset">↺ Beispiel</button></span>`;return `<span class="mono">${esc(S.board.root)}</span><span>${S.cards.length} Kartendateien · board.yaml</span><span>geschrieben ${clockS(S.meta.saved)} · <span class="mono">${esc(S.meta.file)}</span></span><span class="rechts"><label class="chk-s" data-act="tog" data-arg="sim" title="Alle 20 s ändert ein Agent eine Kartendatei von außen"><i class="${u.sim?'an':''}">${u.sim?'✓':''}</i>extern<span class="lb">e Änderungen simulieren</span></label><button class="lnk" data-act="empty" title="Ersten Start in einem Ordner ohne board.yaml zeigen">leeren Ordner öffnen</button><button class="lnk" data-act="reset">↺ Beispiel</button></span>`}

/* ── Erster Start: Ordner ohne board.yaml ── */
function fBoard(f){const key=(f.mek||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')||'ich',columns=f.cols.split(',').map(s=>s.trim()).filter(Boolean).map((n,i)=>({key:slug(n)||'s'+i,name:n}));if(columns.length){const l=columns[columns.length-1];l.final=true;l.limit=20}const people={[key]:{name:(f.men||'').trim()||'—',kind:'human'}};if(f.agents.cl)people.cl={name:'Claude',kind:'agent'};if(f.agents.cx)people.cx={name:'Codex',kind:'agent'};return {name:f.name,path:f.path,root:f.root,next:1,columns,classes:{},people,origins:{I:(f.wbs||'').trim()||'docs/wbs.md',R:(f.req||'').trim()||'docs/anforderungen/'}}}
function vFirst(){const f=S.ui.first,ag=[['cl','Claude'],['cx','Codex']];
 return `<div class="first"><div class="first-l"><h2>Neues Board in <span class="mono">${esc(f.root)}</span></h2><p class="muted">Hier liegt noch keine <span class="mono">board.yaml</span>. kanbanD legt nur diese eine Datei an; Karten entstehen später einzeln als <span class="mono">cards/*.md</span>. Alles lässt sich danach unter „Spalten“ ändern.</p>
<div class="felder"><span class="k">Ordner</span><span class="w mono">${esc(f.root)}</span><span class="k">Board</span><span class="w"><b>${esc(f.name)}</b>&nbsp;<span class="muted">· heißt wie der Ordner</span></span>
<span class="k">columns</span><span class="w"><input class="mini-inp full" data-fr="cols" value="${esc(f.cols)}" title="durch Komma getrennt; die letzte wird Abschlussspalte"></span>
<span class="k">ich</span><span class="w"><input class="mini-inp" data-fr="mek" value="${esc(f.mek)}" placeholder="kürzel" style="width:64px"><input class="mini-inp full" data-fr="men" value="${esc(f.men)}" placeholder="Dein Name"></span>
<span class="k">agents</span><span class="w wrap">${ag.map(([k,n])=>`<button class="as${f.agents[k]?' an':''}" data-act="fr-agent" data-arg="${k}"><span class="pk pk-a">${k.toUpperCase()}</span>${n}</button>`).join('')}</span>
<span class="k">origins I</span><span class="w"><input class="mini-inp full" data-fr="wbs" value="${esc(f.wbs)}" placeholder="docs/wbs.md"></span>
<span class="k">origins R</span><span class="w"><input class="mini-inp full" data-fr="req" value="${esc(f.req)}" placeholder="docs/anforderungen/"></span></div>
<div class="hin" style="border:1px solid var(--kd-line)">Gefunden: <b>0</b> Kartendateien · README.md, docs/ bleiben unberührt. Die letzte Spalte wird Abschlussspalte (Grenze 20). Klassen legst du später an.</div>
${f.err?'<div class="fehl">Kürzel und Name fehlen – ohne „ich“ startet kein Timer.</div>':''}
<div class="zeile"><button class="btn btn-haupt" data-act="first-ok">board.yaml anlegen</button><button class="btn" data-act="reset">Beispiel-Board öffnen</button></div></div>
<aside class="first-r"><h3>BOARD.YAML <span class="mono">wird angelegt</span></h3><pre class="yaml" id="fyaml">${esc(toYaml(fBoard(f)))}</pre></aside></div>`}
function vToast(){const t=S.ui.toast;return t?`<div class="toast">${esc(t.text)}${t.undo?`<button class="lnk" data-act="undo" data-arg="${t.undo}">rückgängig</button>`:''}</div>`:''}
