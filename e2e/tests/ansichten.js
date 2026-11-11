// Die Ansichten der Anwendung, geteilt von Kontrast- und Zielprobe (ADR-0012 Regel 6): eine Liste, damit keine Probe eine Ansicht auslässt

const BERICHTE = ['stundenzettel', 'kreuz', 'verlauf', 'fluss', 'durchlauf', 'prognose', 'fieber', 'kosten', 'bestand'];

/** Je Ansicht Name und Adresse (Hash); Board und WBS-Sicht tragen den Slug des Testbestands. */
function ansichtenDerAnwendung({ board, wbs }) {
  return [
    { ansicht: 'Board', adresse: '#/board/' + board },
    { ansicht: 'Aufgabenliste', adresse: '#/aufgaben' },
    { ansicht: 'Personen', adresse: '#/personen' },
    { ansicht: 'Einrichten', adresse: '#/einrichten' },
    ...BERICHTE.map(name => ({ ansicht: 'Bericht ' + name, adresse: '#/berichte/' + name })),
    { ansicht: 'WBS-Sicht', adresse: '#/wbs/' + wbs },
  ];
}

/** Öffnet das Aufgabenfenster einer Karte des geladenen Boards und wartet auf den Dialog. */
async function aufgabenfenster(page, nummer, reiter) {
  await page.locator(`.ka[data-id="${nummer}"] .t`).click();
  const fenster = page.getByRole('dialog', { name: `Aufgabe #${nummer}` });
  await fenster.waitFor();
  if (reiter) await fenster.getByRole('tab', { name: reiter }).click();
  return fenster;
}

/** Datum von gestern in Berlin: ein Zeitnachtrag darf nicht in der Zukunft enden. */
const gestern = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(Date.now() - 864e5);

/**
 * Aufgabenfenster #1 mit lebendem Hinweis „Zeit … gelöscht“ samt „rückgängig“ (R00112 B0465). Legt den Zeiteintrag selbst an
 * (ein schon vorhandener ergibt 409), weil breite und schmale Seite denselben Server teilen; die Uhr steht still, solange gemessen
 * wird, damit der Hinweis seine 8 s nicht ablebt.
 */
async function aufgabenfensterMitHinweis(page) {
  const adresse = new URL(page.url()).origin + '/';
  const angelegt = await page.request.post(adresse + 'api/aufgaben/1/zeiten', { headers: { 'X-KanbanD-Wer': 'st' }, data: { wer: 'st', beginn: `${gestern()} 09:00`, ende: `${gestern()} 10:00` } });
  if (![200, 409].includes(angelegt.status())) throw new Error(`Zeiteintrag für #1 nicht angelegt: ${angelegt.status()} ${await angelegt.text()}`);
  await page.clock.install();
  await page.reload();
  const fenster = await aufgabenfenster(page, 1);
  await fenster.getByLabel('Zeit 1 löschen').click();
  await fenster.locator('.toast[role=status] [data-act=rueckgaengig]').waitFor({ state: 'attached' });
  await page.clock.pauseAt(Date.now() + 1000);
  return fenster;
}

/**
 * Die Fenster der Anwendung, geteilt von Proben über alle Fenster (R00111 AK 8–10, ADR-0015): eine Liste, damit keine Probe
 * ein Fenster auslässt. `id` ist die id des Dialogs in `web/ansicht.js`, `oeffnen` beginnt am geladenen Board und liefert ihn. Erwarteter Testbestand: #1 offen
 * (ihre Meldung entsteht aus der abgelehnten Herkunft „X1“), #2 mit Preisetikett, #3 archiviert, #4 defekte Datei, ein Board mit der Spalte „Zu erledigen“.
 */
function fensterDerAnwendung() {
  return [
    { fenster: 'Aufgabenfenster #1, Reiter Inhalt', id: 'fenster', oeffnen: page => aufgabenfenster(page, 1) },
    { fenster: 'Aufgabenfenster #1, Reiter Datei', id: 'fenster', oeffnen: page => aufgabenfenster(page, 1, 'Datei') },
    {
      fenster: 'Aufgabenfenster #1 mit Meldung',
      id: 'fenster',
      oeffnen: async page => {
        const fenster = await aufgabenfenster(page, 1);
        await fenster.getByLabel('Neue Herkunft').fill('X1');
        await fenster.getByLabel('Neue Herkunft').press('Enter');
        await fenster.locator('[role=alert]').waitFor({ state: 'attached' });
        return fenster;
      },
    },
    { fenster: 'Aufgabenfenster #1 mit Hinweis', id: 'fenster', oeffnen: aufgabenfensterMitHinweis },
    { fenster: 'Aufgabenfenster #2, Reiter Kosten', id: 'fenster', oeffnen: page => aufgabenfenster(page, 2, 'Kosten') },
    {
      fenster: 'Aufgabenfenster #3 (archiviert)',
      id: 'fenster',
      oeffnen: async page => { await page.locator('[data-act="archiv-an"]').click(); return aufgabenfenster(page, 3); },
    },
    {
      fenster: '„Neue Aufgabe“ mit Meldung',
      id: 'neu-fenster',
      oeffnen: async page => {
        await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
        const fenster = page.getByRole('dialog', { name: 'Neue Aufgabe' });
        // Enter im Titel statt Klick auf „Anlegen“: die Meldung entsteht auch, wenn der Knopf fehlt, und die Probe zeigt, was fehlt
        await page.getByLabel('Titel der neuen Aufgabe').press('Enter');
        await fenster.locator('[role=alert]').waitFor({ state: 'attached' });
        return fenster;
      },
    },
    {
      fenster: 'Defekte Datei #4',
      id: 'defekt-fenster',
      oeffnen: async page => {
        await page.locator('.ka.defekt[data-id="4"]').click();
        const fenster = page.getByRole('dialog', { name: 'Defekte Datei #4' });
        await fenster.waitFor();
        return fenster;
      },
    },
    {
      fenster: '„Zuständige“ für #1',
      id: 'zuweisen',
      oeffnen: async page => {
        await page.locator('.ka[data-id="1"]').click({ button: 'right' });
        await page.getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
        const fenster = page.getByRole('dialog', { name: 'Zuständige für #1' });
        await fenster.waitFor();
        return fenster;
      },
    },
  ];
}

module.exports = { ansichtenDerAnwendung, fensterDerAnwendung };
