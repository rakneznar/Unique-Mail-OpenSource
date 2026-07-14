# Unique Mail WIN Gemini - Projektstatus

Stand: 2026-06-15

## Build

- `npm install`: erfolgreich
- `npm run lint`: erfolgreich
- `npm run build`: erfolgreich
- Kurztest `node dist/server.cjs` + `GET /api/health`: erfolgreich
- Portable Windows-App: `release/Unique Mail Gemini Portable/Unique Mail Gemini.exe` erstellt und per Healthcheck erfolgreich gestartet
- Desktop-Titelleiste/Menu-Bar entfernt, damit kein schwarzer Electron-Balken mehr sichtbar ist
- IMAP-Initialsync beim Hinzufuegen eines Kontos angeschlossen
- WPF-/C#-Zusatzblock im Lesebereich entfernt
- IMAP-Sync laedt nicht mehr nur 30, sondern alle Nachrichten aus INBOX
- Erfolgs-Popup nach Mailabruf entfernt
- IMAP-Ordnerstruktur wird beim Kontosync geladen und im Konto gespeichert
- Fenster bekommt eigenen Drag-Bereich und OFF-Schaltflaeche
- Signaturtext wird je aktivem Konto gespeichert und beim Verfassen verwendet
- Composer nimmt Anlagen per Drag-and-drop und Dateiauswahl an
- RealSync-Badge in der oberen Leiste entfernt
- IMAP-Sync ruft Nachrichten aus allen auswählbaren Serverordnern ab
- Refresh/Senden-Empfangen lädt bestehende Konten jetzt erneut per IMAP und aktualisiert dabei auch die Ordnerstruktur
- Statische Ordner-Aliasse wie `sent`, `deleted`, `drafts`, `junk`, `archive` werden gegen echte Serverpfade wie `Sent Items`, `Gesendet`, `[Gmail]/Sent Mail` gemappt
- Ordnerfavoriten koennen entfernt und Serverordner als Favorit angepinnt werden
- Composer hat CC/BCC-Aufklappfelder
- Composer-Ribbon leicht klassischer gruppiert
- Anlagenvorschau fuer PDF/Bilder im Tool, Office-Dateien mit Dateivorschau-Hinweis

Hinweise:
- Der Build meldet noch eine CSS-Optimizer-Warnung wegen `.bg-slate-[50]`.
- Der JS-Chunk ist groesser als 500 kB. Das ist kein Fehler, sollte spaeter per Code-Splitting verbessert werden.
- `npm install` meldet 2 high severity vulnerabilities. Kein automatisches `audit fix --force` ausgefuehrt, weil das Abhaengigkeiten brechen kann.

## Bisher erledigt in der Gemini-Version

- Gemini-UI als fuehrendes Design beibehalten.
- Erststart auf leeren Zustand umgestellt:
  - keine Beispielkonten
  - keine Beispielmails
  - keine Beispielkontakte
  - keine Beispieltermine
  - keine Beispielnotizen
- Kontoanlage erzeugt keine Fake-Mails mehr.
- Manueller Sync erzeugt keine Fake-Mail mehr.
- Letztes Konto kann entfernt werden.
- Produktionsstart erkennt den gebauten `dist/server.cjs` automatisch als Production-Server.
- `clean` Script ist Windows-kompatibel.
- Electron-Desktop-Wrapper ergaenzt.
- Portable Windows-Testversion erstellt.
- Echte Inbox-Mails werden nach Kontoanlage ueber IMAP geladen, sofern Serverdaten und Passwort/App-Passwort korrekt sind.

## Funktionsvergleich: Gemini gegen bisherige Ziel-App

Vorhanden:
- Outlook-aehnliche Classic-UI als React/Vite App
- Kontenmaske mit IMAP/SMTP-Feldern
- Ordnerbaum, Nachrichtenliste, Lesebereich
- Rich-Text-Composer mit Formatierungen
- Darkmode-State
- lokale Persistenz via `localStorage`
- KI-Endpunkte fuer Abwesenheitsnotiz und Signatur

Fehlt noch fuer echte Mail-Nutzung:
- echte IMAP-Verbindung
- echte SMTP-Sendefunktion
- sichere Passwortspeicherung
- echte lokale Datenbank statt `localStorage`
- echter Ordner-/UID-Sync
- Body-/Attachment-Download
- Attachments hinzufuegen, speichern, oeffnen
- HTML-Sanitizing fuer externe Mails
- Entwurfs-/Outbox-Queue
- echte Loeschen/Archivieren/Verschieben-Synchronisation gegen Server
- Installer oder Desktop-Wrapper

## Naechste Phasen

Phase 1 - Gemini-Version stabilisieren: Build, Start, leerer Erststart, keine Fake-Daten. Status: erledigt.

Phase 2 - Mail-Backend anschliessen: IMAP/SMTP Bibliotheken, API-Routen, Credential-Speicher, Account-Test. Status: teilweise erledigt. IMAP-Inbox-Initialsync und Ordnerlistenabruf sind angeschlossen; SMTP, Credential-Speicher und kompletter Account-Test sind noch offen.

Phase 3 - Persistenz: SQLite/Dateidatenbank, Migrationen, lokale Cache-Tabellen. Status: offen.

Phase 4 - Sync Engine: Ordnerliste, UIDs, Delta-Sync, Read/Flag/Delete/Move-Ruecksync. Status: teilweise erledigt. Ordnerliste und initialer Abruf aller auswählbaren Ordner sind vorhanden; Delta-Sync und Server-Ruecksync fuer Read/Flag/Delete/Move fehlen noch.

Phase 5 - Composer komplettieren: SMTP senden, Entwurf speichern, Outbox, Anlagen. Status: teilweise erledigt. Anlagen koennen im Composer ausgewaehlt oder per Drag-and-drop hinzugefuegt werden; SMTP-Multipart-Versand, Entwurf und Outbox sind noch offen.

Phase 6 - Sicherheit und HTML: Sanitizing, externe Bilder, Attachment-Schutz. Status: offen.

Phase 7 - Packaging: Desktop-Wrapper oder Installer, Startdatei, Icon, Updatepfad. Status: teilweise erledigt. Portable EXE ist vorhanden, Installer/Icon/Updatepfad sind noch offen.

## Update 2026-06-29 - Ordnerstruktur, Alle-Ordner-Sync und lokaler Cache

Erledigt:
- IMAP-Folderlisting nutzt jetzt `client.list()` mit Statusabfrage fuer `messages`, `unseen`, `uidNext` und `uidValidity`.
- Alle vom Server gemeldeten Ordner werden mit Pfad, Label, Parent-/Depth-Information, Flags, SpecialUse und Status an die UI geliefert.
- Alle auswählbaren IMAP-Ordner werden beim Sync durchlaufen; nicht auswählbare `\Noselect`-Ordner erscheinen als Struktur, werden aber nicht als Mailbox geöffnet.
- Ordnerbaum zeigt echte Serverordner nicht mehr nur als flache Standardliste, sondern sortiert nach Serverpfad und eingerückt nach Hierarchie/Depth.
- Wenn alte lokale Mails vorhanden sind, werden daraus zusätzliche Cache-Ordner rekonstruiert, damit nichts verschwindet, auch wenn ein Konto noch keine neue Serverordnerliste gespeichert hat.
- Mailliste filtert jetzt gegen echte Serverpfade plus Aliasse wie `sent`, `deleted`, `drafts`, `junk`, `archive`.
- Manueller Sync ersetzt Kontomails nicht mehr blind, sondern merged neue/aktualisierte Mails mit lokal vorhandenen Mails und erhält lokale Markierungen wie Pin, Favorit, Kategorie und Wiedervorlage.
- Nach erfolgreichem Sync wird ein lokaler Disk-Cache in `UNIQUE_MAIL_CACHE_DIR` geschrieben; in der Electron-App zeigt das auf `app.getPath('userData')\mail-cache`.
- Beim Start wird dieser Disk-Cache je Konto wieder geladen, falls vorhanden. Zusätzlich bleibt die bisherige Browser-Persistenz via `localStorage` bestehen.
- Portable Release wurde mit aktuellem Frontend, `electron/main.cjs`, `electron/preload.cjs` und portable-tauglichem `dist/server.cjs` aktualisiert.
- Starttest der portablen EXE erfolgreich: `http://127.0.0.1:3000/api/health` antwortet mit `{ "status": "ok" }`.

Noch offen:
- Echter Delta-Sync auf UID-Basis statt vollständigem Abruf beim manuellen Sync.
- Serverseitiger Rücksync für gelesen/ungelesen, Löschen, Verschieben, Favoriten/Flags.
- SMTP-Versand, Entwürfe und Outbox.
- Sichere Passwortspeicherung statt erneuter Passwortabfrage beim manuellen Sync.

## Update 2026-06-29 - Delta-Cache und IMAP-Rücksync

Erledigt:
- Server-Sync lädt vorhandene Nachrichtenkörper aus dem lokalen Disk-Cache wieder und lädt vollständige Mailquellen nur für fehlende/neue IMAP-UIDs nach.
- Server löscht beim Sync nicht mehr blind alle lokalen Infos, sondern baut den aktuellen Stand je Ordner anhand der Server-UIDs neu auf.
- UIDVALIDITY und andere BigInt-Statuswerte werden JSON-sicher serialisiert, damit Ordnerlisting nicht an BigInt-Werten scheitert.
- Neue API `POST /api/mail/messages/read-state` synchronisiert gelesen/ungelesen per `\Seen` Flag zum IMAP-Server.
- Neue API `POST /api/mail/messages/move` verschiebt Nachrichten per IMAP `MOVE` in Papierkorb oder Archiv.
- Frontend speichert IMAP-Passwörter nur in der laufenden Sitzung im Speicher und fragt bei Serveraktionen nur erneut, wenn noch kein Sitzungspasswort vorhanden ist.
- Lesen/Ungelesen, Entf/Delete und Archivieren laufen jetzt optimistisch lokal und werden danach zum Server synchronisiert.
- Multi-Select-Aktionen über ItemList nutzen dieselben Serverrouten.
- Portable Release erneut aktualisiert und Starttest erfolgreich: `/api/health` gibt `{ "status": "ok" }` zurück.

Noch offen:
- SMTP-Versand, echte Entwürfe und Outbox.
- Sichere persistente Passwortspeicherung über Windows Credential Manager oder verschlüsselten Store.
- Server-Rücksync für Flag/Favorit, Kategorien und Ordner-Neuanlage/-Umbenennung/-Sortierung.
- Vollständige UID-/MODSEQ-Delta-Strategie für sehr große Postfächer; aktuell werden vorhandene Bodies gecached, aber Header/Flags werden weiterhin je Ordner abgeglichen.

## Update 2026-06-29 - SMTP-Versand und Postausgang

Erledigt:
- `nodemailer` als direkte Dependency eingetragen, inklusive TypeScript-Typen.
- Serverroute `POST /api/mail/send` ergänzt: sendet HTML-Mails über SMTP/TLS mit To, CC, BCC, Betreff und Anhängen.
- SMTP-Versand nutzt das aktive Konto mit SMTP-Server/Port und dem Sitzungspasswort.
- Nach erfolgreichem SMTP-Versand versucht der Server zusätzlich, eine Kopie per IMAP `APPEND` im echten Gesendet-Ordner abzulegen.
- Composer übergibt jetzt einen strukturierten Sendepayload statt nur `to/subject/body`.
- Drag-and-drop-/Datei-Anlagen werden vor dem Senden als Base64-Payload an den Server übergeben.
- Fehlgeschlagene oder nicht autorisierte Sends werden lokal im neuen Ordner `Postausgang`/`outbox` sichtbar abgelegt, statt einfach zu verschwinden.
- Ordnerbaum und Nachrichtenfilter kennen jetzt `outbox` als Arbeitsordner.
- Portable Release erneut aktualisiert und Starttest erfolgreich: `/api/health` gibt `{ "status": "ok" }` zurück.

Noch offen:
- Komfortabler Retry-Button für Postausgang-Mails.
- Sichere persistente Passwortspeicherung; aktuell nur Sitzungspasswort im Arbeitsspeicher.
- SMTP-Provider-Spezialfälle wie OAuth2/Microsoft/Google ohne App-Passwort.

## Update 2026-06-30 - Entwuerfe und Postausgang-Retry finalisiert

Erledigt:
- Composer kennt jetzt Compose-Modi fuer neue Mail, Antworten, Allen antworten, Weiterleiten, Entwurf und Postausgang.
- Neue Mails starten nicht mehr versehentlich als Antwort auf eine markierte Nachricht.
- Entwuerfe koennen lokal gespeichert werden und erscheinen im Ordner `drafts`/Entwuerfe.
- Gespeicherte Entwuerfe koennen wieder geoeffnet, bearbeitet und danach gesendet oder erneut gespeichert werden.
- Postausgang-Mails koennen direkt aus dem Lesebereich bearbeitet oder erneut gesendet werden.
- Beim erneuten Senden wird der alte Entwurf/Postausgang-Eintrag nach Erfolg oder neuer Queue-Ablage entfernt, damit keine Duplikate liegen bleiben.
- Gespeicherte Entwurfs-/Postausgangsanhaenge bleiben als Payload erhalten und werden beim erneuten Senden wieder mitgeschickt.
- Portable Release erneut aktualisiert und Starttest erfolgreich: `/api/health` gibt `{ "status": "ok" }` zurueck.

Noch offen:
- Persistenter verschluesselter Credential Store statt Sitzungspasswort.
- Echte serverseitige Speicherung von Entwuerfen per IMAP APPEND in den Drafts-Ordner.
- Hintergrund-Queue, die Postausgang automatisch versendet, sobald Verbindung/Passwort verfuegbar ist.

## Update 2026-06-30 - Windows-Installer und installierbare Testversion

Erledigt:
- NSIS-Installer-Konfiguration ergaenzt: Setup-Assistent statt nur Portable-EXE.
- Installer erstellt Desktop- und Startmenue-Verknuepfung mit dem Namen `Unique Mail`.
- Updates sind installierbar, indem eine neue Setup-Version ueber die bestehende Installation installiert wird; App-Dateien werden dabei ersetzt, Nutzerdaten bleiben erhalten.
- Installierte Builds legen Cache, Einstellungen, lokale Maildaten und Startup-Logs in `UniqueMailData` neben der gestarteten EXE ab.
- Portable-Build-Script bleibt separat verfuegbar (`npm run dist:portable`), Installer-Build laeuft ueber `npm run dist:win`.
- Finaler Installer erzeugt: `release\Unique Mail Gemini Setup 0.0.0.exe`.
- Frisch gepackte `release\win-unpacked\Unique Mail Gemini.exe` gestartet; `/api/health` antwortet mit HTTP 200 und `UniqueMailData` wurde angelegt.

Hinweis:
- Der voreingestellte per-user Installer ist passend, weil der Installationsordner dadurch beschreibbar bleibt. Bei Installation in `C:\Program Files` kann Windows Schreibrechte fuer `UniqueMailData` blockieren.

## Update 2026-06-30 - Branding, Version 0.0.3 und Fenstersteuerung

Erledigt:
- App-Version auf `0.0.3` gesetzt (`package.json`, `package-lock.json`, `electron/app-package.json`).
- Produktname, Fenstertitel, EXE-Name, Installer-Name und Shortcut-Name auf `Unique Mail` umgestellt.
- Neuer Installer erzeugt: `release\Unique Mail Setup 0.0.3.exe`.
- Alte `Unique Mail Gemini Setup 0.0.0`-Artefakte aus dem Release-Root entfernt, damit kein falscher Installer gestartet wird.
- Fenster ist explizit resizable/maximizable/fullscreenable; Mindestgroesse auf 900x620 gesenkt.
- Custom-Window-Controls robuster gemacht: Minimieren-Button und Beenden-Button werden getrennt angelegt und bleiben klickbar.
- Frisch gepackte `release\win-unpacked\Unique Mail.exe` gestartet; `/api/health` antwortet mit HTTP 200 und `UniqueMailData` existiert.

Versionsregel ab jetzt:
- Nach jedem abgeschlossenen Task wird die Patch-Version erhoeht: aktuell `0.0.3`, naechster Task `0.0.4`, danach `0.0.5` usw.

## Update 2026-07-01 - Version 0.2.0, neues Logo und Mailanzeige-Fix

Erledigt:
- Version einmalig auf `0.2.0` gesetzt (`package.json`, `package-lock.json`, `electron/app-package.json`).
- Neues Unique-Mail-Logo aus `C:\Users\xerow\Downloads\ChatGPT Image 1. Juli 2026, 21_20_32.png` als App-Logo, Favicon und Windows-App-Icon eingebaut.
- Favicon-/Logo-Dateien liegen in `public`, `src/assets`, `electron/assets` und `build`.
- Electron/Installer nutzt jetzt `electron/assets/icon.ico`; BrowserWindow nutzt dasselbe Icon.
- Einstellungen zeigen unten links die installierte Version als `Unique Mail v0.2.0`.
- Mailanzeige nach IMAP-Sync/Cache-Load robuster gemacht: aktive Konten werden automatisch gesetzt, echte Serverordner wie `INBOX` werden erkannt und nach Sync wird ein Ordner gewaehlt, in dem geladene Mails tatsaechlich sichtbar sind.
- Neuer Installer erzeugt: `release\Unique Mail Setup 0.2.0.exe`.
- Alte `Unique Mail Setup 0.0.3`-Artefakte aus dem Release-Root entfernt.
- Frisch gepackte `release\win-unpacked\Unique Mail.exe` gestartet; `/api/health` antwortet mit HTTP 200 und `UniqueMailData` existiert.

Versionsregel:
- Diese Aufgabe hat die Version einmalig auf `0.2.0` gesetzt. Naechster regulaerer Task: `0.2.1`.

## Update 2026-07-01 - Version 0.2.1, mail.de-Fix und Kalender bereinigt

Erledigt:
- Version nach Regel auf `0.2.1` erhoeht.
- mail.de-Autodiscovery korrigiert: `mailde` wird zu `mail.de` normalisiert; `mail.de` nutzt `imap.mail.de:993` und `smtp.mail.de:587`.
- Einstellungen-Titel auf `EINSTELLUNGEN` geaendert.
- Menuepunkt `App-Installation` und der zugehoerige Einstellungsinhalt entfernt.
- Alte Sandbox-/Roadmap-Kalenderdaten werden beim Start aus dem lokalen Kalender entfernt und nicht mehr gespeichert.
- Kalenderansicht zeigt echte Termine aus `calendarItems` statt statischer Roadmap-Dummy-Termine.
- Kalendertage haben Hover-/Focus-Stil und koennen per Klick einen neuen Termin fuer diesen Tag erfassen.
- Neuer Installer erzeugt: `release\Unique Mail Setup 0.2.1.exe`.
- Alte `0.2.0`-Installerartefakte aus dem Release-Root entfernt.
- Frisch gepackte `release\win-unpacked\Unique Mail.exe` gestartet; `/api/health` antwortet mit HTTP 200 und `UniqueMailData` existiert.

Hinweis:
- Ein echter IMAP-Login wurde ohne Nutzerpasswort nicht live gegen mail.de getestet; der im Screenshot sichtbare Hostfehler `imap.mailde` ist durch die Provider-Normalisierung behoben.

## Update 2026-07-01 - Version 0.2.2, Konto-Dialog-Haenger und Fenstercontrols

Erledigt:
- Version nach Regel auf `0.2.2` erhoeht.
- Konto-Einrichtung haengt nicht mehr dauerhaft bei `Lese Server-Portkonfiguration ein...`: beide Fortschrittsboxen zeigen nun den letzten echten Sync-Schritt aus dem Log.
- IMAP-Kontoabruf hat jetzt einen 45-Sekunden-Abbruch mit klarer Fehlermeldung, damit ein nicht antwortender Server den Dialog nicht endlos blockiert.
- Quick-Access-Buttons oben links haben Hover-Bewegung, Schatten, Icon-Skalierung und aktive Rueckmeldung bekommen.
- Fenstercontrols oben rechts erweitert: Minimieren, Maximieren/Wiederherstellen und Beenden sind getrennte runde Buttons mit Hover-Feedback.
- Neuer Installer erzeugt: `release\Unique Mail Setup 0.2.2.exe`.
- Alte `0.2.1`-Installerartefakte aus dem Release-Root entfernt.
- Frisch gepackte `release\win-unpacked\Unique Mail.exe` gestartet; `/api/health` antwortet mit HTTP 200.

Hinweis:
- Ein echter IMAP-Login wurde ohne Nutzerpasswort nicht live gegen ein reales Konto getestet; der Haenger ist technisch durch Timeout und Statusanzeige abgesichert.

## Update 2026-07-02 - Version 0.2.3, Konto-Eingabe, Kalender-Doppelklick und IMAP-Erstsync

Erledigt:
- Version nach Regel auf `0.2.3` erhoeht.
- E-Mail- und Passwortfelder beim Konto-Hinzufuegen bleiben nun beschreibbar; sie werden nicht mehr durch `isOptionsSyncing` deaktiviert.
- Kalender-Tage reagieren auf Doppelklick und oeffnen ein angedocktes Formular fuer Titel, Datum, Uhrzeit, Dauer, Ort und Notiz.
- Kalendertermine aus dem angedockten Formular werden direkt in `calendarItems` gespeichert und ausgewaehlt.
- IMAP-Erstsync beschleunigt: alle Serverordner und Mail-Header werden geladen, ohne beim ersten Lauf jede Roh-Mail vollstaendig zu parsen.
- Nachrichtentexte werden bei Bedarf ueber `/api/mail/message-body` nachgeladen und danach im lokalen Cache aktualisiert.
- Client-Timeout fuer den Kontoabruf von 45 Sekunden auf 3 Minuten erhoeht, damit echte Konten mit vielen Ordnern nicht vorschnell als fehlgeschlagen gelten.
- Neuer Installer erzeugt: `release\Unique Mail Setup 0.2.3.exe`.
- Alte `0.2.2`-Installerartefakte aus dem Release-Root entfernt.
- Frisch gepackte `release\win-unpacked\Unique Mail.exe` gestartet; `/api/health` antwortet mit HTTP 200.

Hinweis:
- Ein echter IMAP-Login wurde ohne Nutzerpasswort nicht live gegen mail.de getestet; die zuvor sichtbare Timeout-Ursache wurde durch schnelleren Header-Sync plus laengeres Zeitfenster entschärft.

## Update 2026-07-02 - Version 0.2.4, Encoding, Drag&Drop und Ordnerbedienung

Erledigt:
- Version nach Regel auf `0.2.4` erhoeht.
- Sichtbare Mojibake-/Encoding-Fehler in den UI-Quellen bereinigt, darunter Einstellungsmenue, Buttons, Titel und Platzhalter.
- Server-seitige Mailtext-Reparatur ergaenzt: kaputte UTF-8/Windows-1252-Mojibake-Sequenzen werden repariert; bei `�`-Texten wird ein Windows-1252-Fallback-Parse versucht.
- Bereits lokal gecachte kaputte Mailtexte werden beim Oeffnen erneut vom IMAP-Server nachgeladen, statt dauerhaft falsch angezeigt zu werden.
- Mails koennen nun per Drag&Drop aus der Nachrichtenliste in Ordner gezogen werden; der Server-Move wird mit dem echten Zielordner synchronisiert.
- Neben dem Favoriten-Stern gibt es pro Nachricht einen kleinen Papierkorb-Button zum Loeschen/Verschieben in den Papierkorb.
- Ordner mit Unterordnern koennen im Ordnerbaum auf- und zugeklappt werden.
- Auto-Discovery um viele Anbieter erweitert, inklusive Gmail, Microsoft, iCloud, Yahoo, AOL, Telekom, freenet, Posteo, mailbox.org, IONOS/1&1, STRATO, Zoho, Fastmail, Yandex, Proton Bridge, mail.com, Hostinger, Namecheap Private Email und Spaceship SpaceMail (`imap.spacemail.com` / `smtp.spacemail.com`).
- Neuer Installer erzeugt: `release\Unique Mail Setup 0.2.4.exe`.
- Alte `0.2.3`-Installerartefakte aus dem Release-Root entfernt.
- Frisch gepackte `release\win-unpacked\Unique Mail.exe` gestartet; `/api/health` antwortet mit HTTP 200.

Hinweis:
- Echte Drag&Drop- und IMAP-Move-Synchronisation wurde ohne Nutzerkonto nicht live gegen einen realen Mailserver getestet; TypeScript, Build, Installer und App-Start wurden erfolgreich verifiziert.

## Update 0.2.5 - Bilder-/Absender-Schutz und Tastaturauswahl

- Version auf 0.2.5 erhoeht: package.json, electron/app-package.json, package-lock.json und App-Anzeige verwenden dieselbe Versionsnummer.
- Pro geoeffneter Mail gibt es nun eine Sicherheitsleiste fuer externe Bilder/Inhalte:
  - Bilder jetzt laden: nur fuer die aktuelle Nachricht.
  - Immer laden: Absender in die Zulassungsliste uebernehmen.
  - Nie laden: Absender in die Sperrliste fuer externe Inhalte uebernehmen.
  - Absender sperren: Absender in die Blockliste aufnehmen und vorhandene/neue Mails dieses Absenders nach Spam/Junk einsortieren.
- Unter Einstellungen > Allgemein & Konten wurde "Bilder & Absender-Schutz" ergaenzt:
  - Bilder automatisch laden.
  - Bilder nie laden.
  - Gesperrte Absender.
  Alle Listen sind direkt bearbeitbar, Eintraege koennen entfernt oder manuell hinzugefuegt werden.
- Remote-Bilder in HTML-Mails werden standardmaessig ersetzt, bis der User sie manuell oder per Absenderregel freigibt.
- Nachrichtenliste:
  - Ctrl+A markiert alle sichtbaren Mails.
  - Delete/Entfernen verschiebt markierte Mails in Papierkorb.
  - Shift+Pfeil hoch/runter erweitert die Mehrfachauswahl.
  - Home/End funktionieren mit Shift ebenfalls fuer Bereichsauswahl.
- Gesperrte Absender werden beim lokalen Merge/Synchronisieren automatisch in den Junk/Spam-Ordner gelegt.
- Build-Verifikation:
  - npm run lint erfolgreich.
  - npm run build erfolgreich.
  - npm run dist:win erfolgreich.
  - Release-EXE Health-Check erfolgreich: {"status":"ok"}.
- Neuer Installer:
  - F:\Unique Mail WIN Gemini\release\Unique Mail Setup 0.2.5.exe
- Hinweis: Live-IMAP-Regeln wurden mangels Zugangsdaten nicht mit einem echten Konto getestet; die lokale Regel-/UI-Logik und der Start der gepackten App sind verifiziert.


## Update 0.2.6 - Schutzlisten-Export, Konto-Fokus und Spacemail-Autodiscovery

- Version auf 0.2.6 erhoeht: package.json, electron/app-package.json, package-lock.json und App-Anzeige verwenden dieselbe Versionsnummer.
- Einstellungen > Allgemein & Konten > Bilder & Absender-Schutz:
  - Export/Import fuer Schutzlisten hinzugefuegt.
  - Export enthaelt nur Bilder-Zulassungsliste, Bilder-Sperrliste und gesperrte Absender.
  - Passwoerter, Mailinhalte und Kontodaten werden nicht exportiert.
  - Import akzeptiert Unique-Mail-JSON-Dateien und speichert die Listen wieder in localStorage.
- Konto-Hinzufuegen:
  - E-Mail-, Passwort- und manuelle Serverfelder erhalten robuste Fokus-/Pointer-/Keyboard-Guards.
  - Konto-Buttons sind explizit type=button, damit kein versteckter Submit/Fokuswechsel die Eingabe stoert.
  - Felder bleiben bewusst nicht disabled/readOnly, auch wenn ein Sync-Status angezeigt wird.
- Autodiscovery:
  - Spacemail/Spaceship-Preset korrigiert auf mail.spacemail.com:993 und smtp.spacemail.com:465.
  - Neuer Server-Endpunkt /api/autodiscover.
  - MX-Erkennung fuer Custom Domains, deren MX auf spacemail.com bzw. privateemail.com zeigt.
- Verifikation:
  - DNS MX fuer spacemail.com: mx1.spacemail.com und mx2.spacemail.com geprueft.
  - Gebauter Server /api/autodiscover fuer test@spacemail.com erfolgreich: mail.spacemail.com / smtp.spacemail.com.
  - npm run lint erfolgreich.
  - npm run build erfolgreich.
  - npm run dist:win erfolgreich.
  - Gepackte Release-EXE Health-Check erfolgreich: {"status":"ok"}.
- Neuer Installer:
  - F:\Unique Mail WIN Gemini\release\Unique Mail Setup 0.2.6.exe

Hinweis:
- Ein echter Konto-Login gegen Spacemail/Spaceship wurde mangels Zugangsdaten nicht live getestet; DNS, API-Antwort, Build und gepackter App-Start sind verifiziert.


## Update 0.2.7 - Settings-Reiter, Copy-Adressen und erweiterter Export

- Version auf 0.2.7 erhoeht: package.json, electron/app-package.json, package-lock.json und App-Anzeige verwenden dieselbe Versionsnummer.
- Lesebereich:
  - Absenderadresse hat nun einen kleinen Copy-Button.
  - Empfaengeradresse hat nun einen kleinen Copy-Button.
  - Empfaengeranzeige nutzt echte Empfaengerdaten aus der Mail, sofern vorhanden.
- Einstellungen:
  - Neuer Reiter Allgemein.
  - Neuer Reiter E-Mail-Konten fuer aktive Konten und Kontoanlage.
  - Neuer Reiter Bilder & Absender fuer Bilddownload-/Blocklisten.
  - Neuer Reiter Signatur.
  - Neuer Reiter Abwesenheit.
  - KI und Hilfe bleiben eigene Reiter.
- Allgemein:
  - Neue Option: Mail beim Oeffnen automatisch als gelesen markieren.
  - Die Option wird in localStorage gespeichert und an den ReadingPane weitergegeben.
- Export/Import:
  - Schema auf unique-mail.settings.v2 erweitert.
  - Export enthaelt jetzt Schutzlisten, gespeicherte E-Mail-Konten, aktive Kontoauswahl, Signaturen und Abwesenheitseinstellungen.
  - Passwoerter, Tokens und Mailinhalte werden nicht exportiert.
  - Alte reine Schutzlisten-Dateien bleiben importierbar.
- Verifikation:
  - npm run lint erfolgreich.
  - npm run build erfolgreich.
  - npm run dist:win erfolgreich.
  - Gebauter Server auf Testport 3017 gestartet; /api/health erfolgreich: {"status":"ok"}.
  - Gepackte EXE wurde nicht separat auf Port 3000 gestartet, weil bereits die installierte Unique Mail aus C:\Users\xerow\AppData\Local\Programs\Unique Mail lief.
- Neuer Installer:
  - F:\Unique Mail WIN Gemini\release\Unique Mail Setup 0.2.7.exe


## Update 0.2.10 - Update-sichere Datenablage und vollerer Export

- Version von 0.2.7 um +0.0.3 auf 0.2.10 erhoeht.
- Update-sichere lokale Datenablage:
  - Packaged App nutzt kuenftig %LOCALAPPDATA%\Unique Mail\UserData als stabilen Electron-userData-Pfad.
  - Alte Installationsdaten aus dem frueheren Installationsordner UniqueMailData werden beim Start in den stabilen Pfad migriert, ohne vorhandene neue Daten zu ueberschreiben.
  - Zusaetzliche stabile Datenordner werden vorbereitet: Data\Settings, Data\Cache, Data\Logs; Mailcache bleibt unter dem stabilen UserData-mail-cache Pfad.
  - Installer bleibt mit stabiler appId und deleteAppDataOnUninstall=false update-faehig.
- Export/Import:
  - Schema auf unique-mail.settings.v3 erweitert.
  - Export enthaelt jetzt zusaetzlich Notizen, Kalender, Kategorien, QuickSteps, Ordnerfavoriten und Mail-Markierungen.
  - Mail-Markierungen umfassen Favorit, Angepinnt, Flag, erledigte Flag, Kategorie und Wiedervorlage-Metadaten.
  - Passwoerter, Tokens und Mailinhalte werden nicht exportiert.
  - Import aktualisiert Ordnerfavoriten sofort per App-Event.
- Verifikation:
  - npm run lint erfolgreich.
  - npm run build erfolgreich.
  - npm run dist:win erfolgreich.
  - Gebauter Server auf Testport 3020 gestartet; /api/health erfolgreich: {"status":"ok"}.
- Neuer Installer:
  - F:\Unique Mail WIN Gemini\release\Unique Mail Setup 0.2.10.exe


## Update 2026-07-04 - Version 0.2.11

- Versionsverlauf: Neuer, auffaelliger Button neben der Fenstersteuerung. Oeffnet ein Popup mit Chronik, Bugfixes und neuen Funktionen.
- Export/Import: Aufgaben werden jetzt zusammen mit Einstellungen, Konten, Signaturen, Kalender, Notizen, Kategorien, Favoriten und Schutzlisten gesichert und wiederhergestellt.
- Kalender: Kalendertage oeffnen den angedockten Termin-Dialog jetzt per Klick und Doppelklick. Gespeicherte Termine werden in die lokale Kalenderliste uebernommen.
- Mailanzeige: Gesendete Mails zeigen keine Demo-Adresse wie Projekt-Team/outlook-classic.local mehr an, sondern den echten Empfaenger oder einen neutralen Hinweis.
- Build: TypeScript-Lint, Produktionsbuild, NSIS-Installer und lokaler Healthcheck auf Port 3021 erfolgreich.
- Artefakt: release\\Unique Mail Setup 0.2.11.exe


## Update 2026-07-04 - Version 0.2.12

- Bugfix: Installierte App crasht nicht mehr beim Start durch app.getPath('localAppData').
- Ursache: Electron stellt den Pfadnamen localAppData nicht bereit; der Main-Prozess brach deshalb vor dem Fensterstart ab.
- Fix: UserData-Pfad wird jetzt ueber LOCALAPPDATA ermittelt, mit APPDATA-Fallback und Installationsdatenpfad als Notfallpfad.
- Datenhaltung: Bestehende lokale Daten bleiben im stabilen Unique-Mail-Datenpfad erhalten.
- Artefakt: release\\Unique Mail Setup 0.2.12.exe


## Update 2026-07-04 - Version 0.2.13

- Layout-Fix: Einstellungen, Ribbon und Nachrichtenliste wurden wieder stabil ausgerichtet.
- Ordnerbereich: Kompakte Ordnerstruktur bleibt erhalten.
- Nachrichtenliste: Aktionsicons liegen als Hover-Leiste ueber der Zeile und druecken Sender, Betreff und Vorschau nicht mehr auseinander.
- Einstellungen: Modal ist breiter/hoeher, responsiv begrenzt und Formularfelder brechen auf kleinen Fenstern sauber um.
- Ribbon: Tabs und Gruppen schrumpfen nicht mehr ineinander, sondern bleiben als horizontale Desktop-Leiste scrollbar.
- Artefakt: release\\Unique Mail Setup 0.2.13.exe


## Update 2026-07-04 - Version 0.2.14

- Bugfix: Whitescreen nach Version 0.2.13 behoben.
- Ursache: Electron/Chromium 42 unterstuetzt native prompt()-Dialoge im Renderer nicht mehr; ein Passwort-prompt wurde beim Mail-Body-Laden ausgelöst.
- Fix: IMAP/SMTP-Sitzungspasswoerter nutzen jetzt einen app-eigenen Modal-Dialog.
- Stabilitaet: Alte Prompt-basierte Hilfsaktionen fangen den blockierten Dialog ab, statt den Renderer zu crashen.
- Artefakt: release\\Unique Mail Setup 0.2.14.exe
