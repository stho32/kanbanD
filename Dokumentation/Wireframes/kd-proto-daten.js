/* kanbanD Prototyp — Anfangsbestand. Spiegelt einen Board-Ordner: board.yaml + cards/*.md */
const KD_KEY = 'kanbanD.proto.v1';
const PAL = ['yellow','amber','orange','red','rose','pink','magenta','violet','indigo','blue','sky','cyan','teal','green','lime','grey'];

function slug(t){return t.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)}

function kdSeed(){
  const now=Date.now(),H=36e5,D=864e5;
  const ago=h=>Math.round(now-h*H);
  const day=d=>{const t=new Date(now+d*D);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
  const T=(who,a,b)=>({who,start:ago(a),end:b==null?null:ago(b)});
  const K=(who,h,text)=>({who,at:ago(h),text});
  const C=(id,title,column,cls,origins,assignees,labels,o={})=>({id,title,column,cls,origins,assignees,labels,due:o.due||null,desc:o.desc||'',tasks:(o.tasks||[]).map(([t,ok])=>({t,ok:!!ok})),comments:o.comments||[],times:o.times||[],doneAt:o.doneAt||null,order:o.order||id});
  const cards=[
    C(31,'Board-Datei board.yaml einlesen und Spaltenreihenfolge übernehmen','todo','feature',['I0003'],[],['daten'],{due:day(6),tasks:[['Spalten lesen'],['Klassen lesen'],['Personen lesen']],desc:'Beim Öffnen des Ordners wird `board.yaml` gelesen. Fehlt die Datei, entsteht sie mit den Standardspalten.'}),
    C(32,'Export der Zeiten als CSV','todo','docs',['I0036'],[],[]),
    C(34,'Kartendatei beim Umbenennen des Titels nicht umbenennen','todo','bug',[],[],['daten'],{tasks:[['Dateiname beim Anlegen festschreiben'],['Test: Umbenennen ändert nur title:']]}),
    C(35,'Leeres Board: Ordner ohne board.yaml anlegen','todo','critical',['R00014'],['ml'],[],{due:day(10),times:[T('ml',22,19.7)]}),
    C(36,'Tastaturkürzel für Spaltenwechsel','todo','feature',[],[],['ui']),
    C(28,'Frontmatter-Parser mit Fehlerzeile statt Absturz','ready','bug',['I0015','R00014'],['cx'],['daten'],{due:day(2),tasks:[['Zeile und Spalte melden',1],['Karte trotzdem anzeigen'],['Markierung auf der Karte'],['Test mit kaputtem YAML']],times:[T('cx',30,28)]}),
    C(29,'Kommentare als Codeblock schreiben','ready',null,['I0017'],[],[]),
    C(12,'Kopfzeile auf 40 px verdichten','doing','feature',['I0027'],['cl','sv'],['ui'],{tasks:[['Höhe 40 px',1],['Filter in die Kopfzeile',1],['Laufzeit-Plakette']],times:[T('cl',6.5,4.8),T('cl',1.3,null),T('sv',4.2,2.3),T('sv',0.85,null)],comments:[K('cl',1.25,'Filterzeile ist in die Kopfzeile gewandert; spart 38 px über den Bahnen.')],desc:'Filter, Ansichtsschalter und Einrichten sitzen in der Kopfzeile statt in einer eigenen Leiste.'}),
    C(21,'Timer: laufender Eintrag mit … im Codeblock','doing','feature',['I0023','I0024'],['st','sv','ei'],['zeit'],{due:day(1),tasks:[['Zeile beim Start schreiben',1],['Beim Stopp Ende eintragen'],['Hand-geschriebene Zeile mit … als laufend erkennen']],times:[T('st',22.5,21.2),T('sv',3.0,2.1),T('st',0.4,null),T('ei',0.12,null)],comments:[K('cl',1.4,'Die Zeile mit … wird beim Einlesen als laufend erkannt – auch wenn sie von Hand geschrieben wurde.'),K('st',1.2,'Gut, dann braucht es kein eigenes Feld.')],desc:'Ein gestarteter Timer schreibt sofort eine Zeile mit `...` als Ende in den Block `kanbanD-time`. So sieht jeder, der die Datei liest – Mensch, Agent, Git-Diff –, dass gerade gemessen wird.\n\nBeim Stopp wird genau diese Zeile ersetzt, nicht angehängt.'}),
    C(25,'Dateiwächter: Änderungen von außen übernehmen','doing','critical',['I0028','R00016'],['cx'],['daten'],{tasks:[['Ordner beobachten'],['Nur geänderte Karte neu lesen'],['Marke „extern“ 10 s']],times:[T('cx',6.2,4.6),T('cx',3.7,1.9),T('cx',26,23)]}),
    C(11,'Token-Sheet kd-tokens.css','review',null,['R00005'],['st'],['ui'],{tasks:[['Farben',1],['Abstände',1],['Klassenfarben',1],['Schrift',1]],times:[T('st',5.4,3.6),T('st',3.1,1.5)]}),
    C(9,'Ordnerwahl beim Start','done','bug',['I0001'],['st'],[],{doneAt:ago(2),times:[T('st',28,26)]}),
    C(7,'Karte = eine .md-Datei','done',null,['I0010'],['cl'],[],{doneAt:ago(3.5),times:[T('cl',27,25)]}),
    C(6,'Fortlaufende Nummer aus board.yaml','done','feature',['I0021'],['cl'],[],{doneAt:ago(26),times:[T('cl',48,45)]}),
    C(4,'Spalten aus Frontmatter column:','done',null,['I0003'],['st'],[],{doneAt:ago(27),times:[T('st',50,47)]}),
    C(2,'Grundgerüst','done','feature',[],['st'],[],{doneAt:ago(50),times:[T('st',75,70)]}),
    C(3,'Token-Namen festlegen','done',null,['R00005'],['st'],[],{doneAt:ago(52)}),
    C(1,'Ordnerstruktur festlegen','done',null,[],['st'],[],{doneAt:ago(75)}),
    C(5,'Beispieldaten anlegen','done','docs',[],['cl'],[],{doneAt:ago(76)}),
    C(8,'Lizenz klären','done',null,[],['ml'],[],{doneAt:ago(100)})
  ];
  cards.forEach(c=>c.file=`cards/${String(c.id).padStart(4,'0')}-${slug(c.title)}.md`);
  return {
    board:{name:'kanband',path:'~/boards/',root:'/Users/stefan/boards/kanband',next:37,
      columns:[{key:'todo',name:'Zu erledigen'},{key:'ready',name:'Bereit'},{key:'doing',name:'In Arbeit'},{key:'review',name:'Prüfung'},{key:'done',name:'Erledigt',final:true,limit:6}],
      classes:{bug:{label:'Bug',color:'yellow'},critical:{label:'Kritisch',color:'red'},feature:{label:'Weiterentwicklung',color:'green'},docs:{label:'Doku',color:'blue'}},
      people:{st:{name:'Stefan',kind:'human'},sv:{name:'Sven',kind:'human'},ei:{name:'Eike',kind:'human'},ml:{name:'Maria',kind:'human'},cl:{name:'Claude',kind:'agent'},cx:{name:'Codex',kind:'agent'},jr:{name:'Jan',kind:'human',active:false}},
      origins:{I:'docs/wbs.md',R:'docs/anforderungen/'}},
    cards,
    ui:{me:'st',view:'board',filter:'',scope:'alle',count:true,legend:true,open:null,tab:'inhalt',pop:null,setup:null,palFor:null,more:{},adding:null,sim:true,pscope:'alle',pstill:false,period:'woche',sp:'st',nkind:'human'},
    meta:{saved:now,file:'board.yaml',sim:0}
  };
}
