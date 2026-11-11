# ADR-0020: Erklärtext auf Anforderung — eine nicht-modale Kopfzeichen-Komponente an Fokus und langem Druck, ohne eigene Ebene

**Status**: Akzeptiert
**Datum**: 2026-11-11
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #24)
**Kontext-Anforderung**: Karte #24 „Kopfzeichen-Tooltip bei Fokus und langem Druck“; Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: — (getragen von der Systemantwort: der Renderer zeichnet alles neu, [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md); die Fokusführung über Ebenen, [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md); der zugängliche Name am Auslöser, [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md); `popPlatzieren` als vorhandene Positionierungslogik, `web/app.js:978`)
**Nachträge**: 2026-11-11 — N1 Darstellung unmittelbar gestellt, Zustand und Textregel an einem Ort (R00119, Karte #24, Nacharbeit M1), siehe [Nachtrag N1](#nachtrag-2026-11-11-n1-darstellung-unmittelbar-gestellt-zustand-und-textregel-an-einem-ort-r00119-karte-24-nacharbeit-m1). Der Text oberhalb der Nachträge ist der Stand der Annahme und bleibt unverändert; Marke *(→ N1)* zeigt, wo der Nachtrag gilt.

## Kontext

- **Karte #24** verlangt, dass die **Kopfzeichen des Spaltenkopfs** ihren Erklärtext auf Anforderung zeigen — bei Tastaturfokus und bei langem Druck auf Touch —, nicht erst beim Überfahren mit der Maus.
- **Vision** `Anforderungen/R00000-vision.md:104`: Die Oberfläche ist per Tastatur bedienbar und folgt gewohnten Konventionen. Ein Erklärtext, den nur ein Zeiger erreicht, erfüllt das nicht.
- **PO-Entscheidung** `AI-Team/po-entscheidungen.md:53`: In `R00097` steht **nur der zugängliche Name am Zeichen** (`aria-label` = Tooltiptext, `role="img"`) und ein **sichtbarer Hinweissatz im Spalten-Dialog**; das **Tooltip bei Fokus und langem Druck für alle Kopfzeichen** (ⓘ, ✓, Phase, Grenze, Eigentümer) ist eine **eigene Karte**. Dieselbe Linie hält `R00106` Z. 407 fest („ein Tooltip bei Fokus (PO Z. 53, eigene Karte)“, bewusst außerhalb). `R00097`/Featur `F0015` schließen den Tooltip damit ausdrücklich aus; das AK „mit Tooltip“ erfüllt dem PO der `title`.
- **Belegt (Code), die heutige Erklärung der Kopfzeichen hängt allein an `title`** (`web/ansicht.js`):
  - `vLane` (`web/ansicht.js:734–747`) zeichnet den Spaltenkopf. Der Kommentar ⓘ ist ein **Tab-Stopp** mit `title` und `aria-label` (`tabindex="0"`), **✓** (Abschlussspalte), **Phase** (`span.v.ph`) und **Grenze** (`span.v`) sind **nicht fokussierbar** und tragen **keinen zugänglichen Namen** — nur `title`.
  - `vEigentuemerZeichen` (`web/ansicht.js:720–726`) zeichnet das Eigentümer-Zeichen mit `role="img"` und `aria-label`/`title`; im zugeklappten Streifen ist es nur Schmuck (`aria-hidden`).
  - `title` ist ein reiner Zeiger-Mechanismus: Er erscheint nicht bei Tastaturfokus und lässt sich auf Touch nicht auslösen. Er erfüllt „bei Fokus sichtbar“ nicht.
- **Belegt (Code), zwei vorhandene, aber unpassende Mechanismen**:
  - `#pop` (Positionierung `popPlatzieren`, `web/app.js:978`) ist **klick-getrieben**, **fokusführend** und als **Menü oder nicht-modaler Dialog** eingeordnet ([ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) N4). Ein Tooltip ist keines von beidem: Er nimmt keinen Fokus und fängt keinen.
  - `#tooltip` (`web/ansicht.js:950`, gelesen in `web/app.js:2307`) ist der **Fieber-Daten-Tooltip der Diagramme**, kein allgemeiner Erklärtext-Mechanismus; er hängt an der Zeigerposition über der Zeichenfläche.
- **Kein Hausmuster.** Es gibt bisher keine Komponente, die auf eine Anforderung des Menschen (Fokus, langer Druck) einen nicht-modalen Erklärtext zu einem Auslöser zeigt.
- **Zwang (Referenz-Designsystem, Factory-Gedächtnis `rollen/ux-reviewer/spezialisierungen/material3/notizen.md:175`)**: M3 **Plain tooltip** — kurze Beschriftung, Höhe 24 dp, einzeilig, für Elemente ohne Text (Icon Buttons). Das ist die Rolle; der zentrale Stil des Projekts und die Vision gehen vor (Factory `gemeinsam/regeln.md`, „Gestaltung“).

Die Klasse der Aufgabe ist damit nicht „ⓘ braucht einen Tooltip“, sondern „die Kopfzeichen haben **einen** Ort, an dem ihr Erklärtext auf Anforderung sichtbar wird — für Tastatur und Touch gleich, ohne die Ebenen der Fokusführung zu verwischen“.

## Optionen

### Option A: native `title` + `aria-label` (Status quo)

Der `title` bleibt der Erklärtext, `aria-label` der zugängliche Name.

- Stärke: kleinste denkbare Änderung, kein neuer Code, kein Zustand; heute steht es fast überall schon so.
- Nachteil: `title` erscheint **nicht bei Tastaturfokus** und **nicht bei langem Druck**. Die Aufgabe der Karte — „sichtbar bei Fokus“ — ist damit nicht erfüllt. Ein neuer Mechanismus daneben wäre ein zweiter Erklärweg, den diese Option gerade vermeiden will.

### Option B: eigenes nicht-modales Primitiv (gewählt)

Eine Komponente `role="tooltip"`, die den Erklärtext zu einem Auslöser zeigt:

- **kein Fokus**: Das Primitiv nimmt keinen Fokus und fängt keinen; der Fokus bleibt auf dem Auslöser.
- **Der sichtbare Text trägt den zugänglichen Namen, nicht eine Beschreibung**: An den fünf Kopfzeichen entfällt `aria-describedby` — ihr Name liest den Text schon vor, eine Beschreibung ergäbe dieselbe Ansage zweimal. Nur der **Streifen-Knopf** der zugeklappten Spalte hält eine `aria-describedby`-Verbindung, weil sein Name den vollen Erklärtext nicht trägt.
- **Auslöser**: Fokus auf dem Auslöser (Tastatur) und **langer Druck** (Touch). Überfahren mit der Maus ist möglich, aber nicht die Bedingung.
- **Esc in der Kaskade** schließt ihn **zuerst** (höchste Priorität, vor Pop und Fenstern; die Kaskade `web/app.js:1950`).
- **Positionierung** über die vorhandene `popPlatzieren`-Logik (`web/app.js:978`), die schon Unter-dem-Auslöser/Über-dem-Auslöser und die Fensterkante kennt.
- **Zustand in `S.ui`** (`web/app.js:2`), **redraw-sicher**: Der Text übersteht das `innerHTML`-Neuzeichnen wie die übrigen Zustände in `S.ui` ([ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md)).
- Stärke: eine Komponente an einem Ort; sie trifft die Aufgabe (Fokus und langer Druck) für **alle** Kopfzeichen gleich, ohne die Ebenen-Invarianten von [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) anzutasten.
- Nachteil: ein kleines neues Primitiv samt Zustand und eigener Code für den langen Druck; ein zweiter Ort, den eine Probe abdecken muss.

### Option C: `#pop` erweitern

Der Spaltenkopf bekommt einen Tooltip-„Modus“ im vorhandenen `#pop`.

- Stärke: kein neues Markup — die Positionierung und der gezeichnete Ort sind schon da.
- Nachteil: `#pop` ist **fokusführend** und als **Menü oder Dialog** eingeordnet ([ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) N4). Ein Tooltip, der Fokus setzt oder in der Fokusführung als Ebene zählt, verwischt genau die Ebenen-Invarianten dieser ADRs. Der `#pop` ist für eine Anforderung des Menschen gebaut, der Tooltip ist keine.

### Option D: native Popover-API

Das Popover-Attribut des Browsers öffnet den Erklärtext.

- Stärke: Top-Layer, Esc und Positionierung vom Browser — wenig eigener Code.
- Nachteil: **dasselbe Redraw-Problem wie `<dialog>.showModal()`**, das [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) (Option C) verworfen hat: Nach jedem `render()` müsste das Öffnen erneut laufen, und der Zustand gehört dann in einen zweiten Ort neben dem Neuzeichnen. Ein **langer Druck** ist über das Attribut allein nicht auslösbar. Für den Nutzen bleibt nur ein Teil.

### Option E: CSS-only (`:focus-visible` / `:active`)

Der Erklärtext ist im Markup und wird per CSS an `:focus-visible` bzw. `:active` eingeblendet.

- Stärke: kein JavaScript, kein Zustand, deklarativ.
- Nachteil: **langer Druck ist per CSS unzuverlässig** (`:active` endet beim Loslassen, nicht nach einer Dauer), **Esc gibt es nicht**, und die **Positionierung ist auf den Fluss des Elternelements beschränkt** (kein Umklappen an der Fensterkante wie `popPlatzieren`). Der Erklärtext wäre nicht zuverlässig lesbar, und das Ausblenden wäre nicht sicher.

## Entscheidung

**Gewählt: Option B** — ein eigenes, nicht-modales Primitiv `role="tooltip"`, gezeichnet aus dem Renderer, ohne eigene Ebene.

Begründung: B trifft die Aufgabe der Karte („Erklärtext auf Anforderung bei Fokus und langem Druck“) für alle Kopfzeichen gleich und hält sich an die vorhandenen Invarianten:

1. **Der Tooltip ist keine Ebene der Fokusführung** ([ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) bleibt unberührt). Er nimmt keinen Fokus, fängt keinen und zählt nicht in `ebenen(ui)`. Der Fokus bleibt auf dem Auslöser.
2. **Gezeichnet wird aus dem Renderer** ([ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md)): Der Zustand liegt in `S.ui` und übersteht das Neuzeichnen; es gibt keinen zweiten Schreibweg neben `render()`. *(→ N1: die **Darstellung** der Blase darf unmittelbar gestellt werden — gemeint ist der Schreibweg des **Zustands**)*
3. **Der zugängliche Name bleibt am Auslöser** ([ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md)). Der Tooltip ersetzt den Namen nicht und wird nicht zu einer zweiten Namensquelle: Sein zugänglicher Name ist wörtlich der Tooltiptext, die **Beschreibung ist die sichtbare Ausprägung desselben Textes**. An den **fünf Kopfzeichen** (ⓘ, ✓, Phase, Grenze, Eigentümer) entfällt deshalb `aria-describedby` — der Name trägt den Text schon, eine Beschreibung würde denselben Satz doppelt vorlesen. Der **Streifen-Knopf** der zugeklappten Spalte **behält `aria-describedby`**, weil sein Name den vollen Erklärtext nicht trägt (PO `AI-Team/po-entscheidungen.md:186`).
4. **Esc schließt ihn zuerst** — an der Spitze der Kaskade (`web/app.js:1950`), vor Pop und Fenstern.
5. **Maße, Kontrast und Anzeige** folgen [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md) (Zielgröße des Auslösers), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md) (Kontrast des Textes in beiden Themen) und [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md) (deutscher Wortlaut, zugänglicher Name zählt als sichtbarer Text).

**Akzeptierte Schwäche.** Es entsteht ein **kleines neues Primitiv samt Zustand in `S.ui`** und eigener Code für den **langen Druck**. Die Komponente muss durch eine Probe abgesichert werden wie die übrigen zentralen Regeln. Ggf. muss das **Eigentümer-Zeichen in die Tab-Folge** aufgenommen werden: Es trägt heute keinen Tab-Halt (`role="img"`, `web/ansicht.js:720–726`), damit es den Tooltip bei Fokus überhaupt zeigen kann — das ist das Ziel von [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md) (jedes Bedienziel erreichbar) und ein Detail von [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md).

C, D und E scheiden aus: C verwischt die Ebenen-Einordnung von `#pop`, D trägt das Redraw-Problem, das [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) verworfen hat, und kann den langen Druck nicht, E ist unzuverlässig und ohne Esc.

## Konsequenzen

**Positiv:**

- Ein **Ort** für den Erklärtext der Kopfzeichen; Fokus und langer Druck verhalten sich bei allen Zeichen gleich.
- Die Fokusführung, die Ebenen-Logik und die zugänglichen Namen der bestehenden ADRs bleiben unverändert.
- Ein künftiges Kopfzeichen erbt den in `S.ui` gehaltenen Mechanismus, statt einen eigenen zu brauchen.

**Negativ / In Kauf zu nehmen:**

- Ein kleines neues Primitiv samt Zustand und eigener Code für den langen Druck.
- Ggf. wächst die Tab-Folge um das Eigentümer-Zeichen (`web/ansicht.js:720–726`).

**Durchsetzung** (E2E-Probe, Abnahme der Karte #24):

- **Tab auf ⓘ und auf das Eigentümer-Zeichen** zeigt die Erklärung sichtbar; **langer Druck auf Touch** ebenso.
- **Esc** schließt den Tooltip; er bleibt nicht stehen.
- Der **zugängliche Name ist wörtlich der Tooltiptext** (keine abweichende zweite Formulierung).
- Ein **Live-Ereignis** (fremder Schreibaufruf, [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md)) hinterlässt **keinen verwaisten Tooltip**.
- **Kontrast** des Erklärtextes hell und dunkel ≥ 4,5:1 ([ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md)).
- **Review-Punkt** für architektur-reviewer und code-reviewer: **ein Tooltip, der Fokus nimmt oder fängt**, und **ein zweiter Erklärmechanismus neben dem Primitiv** sind je ein Befund.

**Geltung:** Die Regel gilt für die **Kopfzeichen im Spaltenkopf**. Ob sie auf **weitere `title`-Stellen** im Projekt ausgeweitet wird, entscheidet eine **spätere Karte**.

**Folgeentscheidungen / Aufgaben:**

- [ ] Anforderung aus Karte #24 nach dieser ADR (Vorschlag im Bericht an den Director).
- [ ] Ob das Eigentümer-Zeichen in die Tab-Folge aufgenommen wird (Detail aus [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md)/[ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md)).
- [ ] Ausweitung auf weitere `title`-Stellen: eigene Karte.

## Nachtrag 2026-11-11 N1: Darstellung unmittelbar gestellt, Zustand und Textregel an einem Ort (R00119, Karte #24, Nacharbeit M1)

**Status bleibt `Akzeptiert`.** Der Nachtrag schärft Regel 2 der Entscheidung („Gezeichnet wird aus dem Renderer … kein zweiter Schreibweg neben `render()`“); die Wahl — Option B, ein nicht-modales Primitiv `role="tooltip"` ohne eigene Ebene — gilt unverändert. Anlass ist das Muss des Architektur-Reviews zur Karte #24 vom 2026-11-11 (M1): Der Bau schreibt den Blasentext neben `render()` auch direkt (`web/app.js` `tippZeigen`/`tippVerbergen`), was Regel 2 **wörtlich** verletzt; ein `render()` im `focusin`-Pfad bräche zudem den Abtastwächter `r00106-fokus-raster` (Befund der wiederholten Fokusprobe, Gelerntes `R00119`, Commit `f862509`). Der Director hat entschieden: **Nachtrag, kein neues ADR.**

### Was der Nachtrag festlegt

1. **Die Darstellung der Blase darf unmittelbar gestellt werden** — ihr Text und ihre Sichtbarkeit —, so wie `popPlatzieren` die Position von `#pop` stellt (`web/app.js:979`). Regel 2 meint den **Schreibweg des Zustands**, nicht das Stellen des gezeichneten Elements: `tippZeigen`/`tippVerbergen` (`web/app.js:1014`, `:1024`) setzen `S.ui.tooltip`, füllen die von `render()` gezeichnete Blase `#kd-tipp` (`web/app.js:1016–1019`) und rufen in diesem Pfad **kein `render()`** — die Karte bleibt in der Fokusfalle unberührt. Der `focusin`-Weg (`web/app.js:1766–1770`) ist damit kein zweites Zeichnen.
2. **Der Zustand bleibt in `S.ui.tooltip` und übersteht das Neuzeichnen.** `render()` zeichnet die Blase weiterhin aus dem Zustand (`vTipp()` in `#over`, `web/app.js:702`, `web/ansicht.js:382–388`, [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md)); „zeichnen aus Zustand“ bleibt die tragende Regel. Ist der Zustand gesetzt, stellt der nächste Render die Blase sichtbar wieder her.
3. **Die Textregel lebt an genau einer Stelle.** Der Wortlaut je Kopfzeichen (sichtbarer Text = zugänglicher Name) entsteht in **einer** Funktion, die **beide** Wege benutzen: `render()` für das Neuzeichnen und das unmittelbare Stellen. Heute steht die Regel doppelt — `tippText` (`web/app.js:1005`) und die gleiche Ableitung in `vTipp` (`web/ansicht.js:385`); diese **Doppelung ist ein Befund** und in der Nacharbeit zu entfernen (eine Quelle, beide Aufrufer).

### Grenze

- **Nur die Darstellungs-Schreibung ist erlaubt.** Erlaubt sind das Setzen von `S.ui.tooltip` und das Füllen/Stellen/Verbergen der von `render()` gezeichneten Blase. Ein **zweiter Erklärmechanismus** — ein weiteres `role="tooltip"` oder ein `title` an den fünf Kopfzeichen (ⓘ, ✓, Phase, Grenze, Eigentümer) — bleibt ein **Befund** (Durchsetzung der Entscheidung; [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md)).
- **Esc zuerst**, **keine Fokus-Ebene**, **Zielgröße und Kontrast**: unverändert aus der Entscheidung (Punkte 1, 4, 5; [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md)). Der Nachtrag berührt keine Ebene der Fokusführung: Der Tooltip zählt nicht in `ebenen(ui)`, der Fokus bleibt auf dem Auslöser.

### Belegt (Code)

- `web/app.js:1014` `tippZeigen` und `:1024` `tippVerbergen`: schreiben Text und Sichtbarkeit der Blase `#kd-tipp` direkt; kein `render()`.
- `web/app.js:702`: `render()` hängt `vTipp()` in `#over` — der Zeichenweg aus dem Zustand.
- `web/ansicht.js:382–388` `vTipp`: zeichnet die Blase aus `S.ui.tooltip`; `:385` leitet den Text erneut ab (zweite Ausprägung von `tippText`, `web/app.js:1005`).
- `web/app.js:979` `popPlatzieren`: das Vorbild — stellt die Position des von `render()` gezeichneten `#pop`, ohne neu zu zeichnen.
- `web/app.js:1983`: Esc schließt den Tooltip zuerst (Spitze der Kaskade).

### Durchsetzung (ergänzt)

- **Review-Punkt `architektur-reviewer` und `code-reviewer`**: Ein **`render()` im `focusin`/`focusout`-Pfad des Tooltips** ist ein Befund — er hängt das gerade fokussierte Element ab, der Wächter `r00106-fokus-raster` wird rot (Gelerntes `R00119`, Commit `f862509`). Die Blase wird gezeigt/verborgen, indem `S.ui.tooltip` gesetzt und das von `render()` gezeichnete Element gestellt wird.
- **Review-Punkt**: Die **Textregel doppelt** zu führen (Ableitung des Wortlauts an zwei Orten) ist ein Befund; sie gehört in eine Funktion, die `render()` und das unmittelbare Stellen gemeinsam nutzen.
- Die Abnahme der Karte #24 (E2E) bleibt: Tab zeigt die Erklärung, langer Druck ebenso, Esc schließt, der zugängliche Name ist wörtlich der Tooltiptext, ein Live-Ereignis hinterlässt keinen verwaisten Tooltip. Der Abtastwächter `r00106-fokus-raster` bleibt grün — er ist die Probe, die ein `render()` im `focusin`-Pfad fängt.

### Verworfen

- **`render()` im `focusin`-Pfad**: hielte Regel 2 wörtlich ein (ein Zeichenweg), hängt aber das gerade fokussierte Element ab und lässt den Fokuswächter fehlschlagen (Gelerntes `R00119`, Commit `f862509`). Der Schaden ist größer als die Worttreue.
- **Ein zweiter Schreibweg für den Zustand** (Text in einer zweiten Struktur neben `S.ui.tooltip`): bräche die Redraw-Sicherheit aus [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md); der Zustand bleibt bei `S.ui.tooltip`.

**Folgeentscheidung, offen**: keine. Die Doppelung der Textregel (`tippText` / `vTipp`) beseitigt der `entwickler` als Nacharbeit M1 auf Karte #24.

## Quellen / Bezüge

- Karte #24 „Kopfzeichen-Tooltip bei Fokus und langem Druck“; Vision `Anforderungen/R00000-vision.md:104`
- `AI-Team/po-entscheidungen.md:53` (zugänglicher Name = Tooltiptext, Hinweissatz im Spalten-Dialog, Tooltip als eigene Karte)
- `AI-Team/po-entscheidungen.md:186` (Artboard-Freigabe #24: `aria-describedby` entfällt an den fünf Kopfzeichen, bleibt am Streifen-Knopf der zugeklappten Spalte)
- `R00097`/`F0015` (schließt den Tooltip ausdrücklich aus), `R00106` Z. 407 (bewusst außerhalb)
- `web/ansicht.js:734–747` (`vLane`), `:720–726` (`vEigentuemerZeichen`), `:950` (`#tooltip` der Diagramme); `web/app.js:978` (`popPlatzieren`), `:1950` (Esc-Kaskade), `:2` (`S.ui`), `:2307` (Fieber-Daten-Tooltip)
- Factory-Gedächtnis Material 3 (`rollen/ux-reviewer/spezialisierungen/material3/notizen.md:175`, Plain tooltip)
- [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) (N4), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md), [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md)
- Baustein [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
- Nachtrag N1: Karte #24, Architektur-Review 2026-11-11 (M1); Gelerntes `R00119` (Commit `f862509`); `web/app.js:702`, `:979`, `:1005`, `:1014`, `:1024`, `:1766–1770`, `:1983`, `web/ansicht.js:382–388`; [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md)
