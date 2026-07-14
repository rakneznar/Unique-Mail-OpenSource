/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Email, CalendarItem, Contact, Task, Note } from '../types';

export const mockEmails: Email[] = [
  {
    id: 'msg-101',
    sender: 'Dr. Andreas Müller',
    senderEmail: 'andreas.mueller@dev-core.local',
    subject: 'WPF & MVVM: Architektur-Feedback zu MailKit & SQLite',
    date: '2026-06-10T08:15:00Z',
    preview: 'Hallo Team, ich habe mir den Entwurf für den MailKit-Service und die EF Core SQLite Anbindung angeschaut. Die Separierung...',
    body: `Hallo Team,

ich habe mir den Entwurf für den MailKit-Service und die EF Core SQLite-Anbindung angeschaut.

Die Separierung über den \`IMailService\` ist hervorragend gelöst. Auf diese Weise können wir im Offline-Modus oder für Unit-Tests problemlos ein Mock-Repository injizieren.

Einige wichtige Punkte für die WPF-Umsetzung:
1. **Thread-Sicherheit**: MailKit-Instanzen sind nicht thread-sicher. Wir müssen sicherstellen, dass Lese-/Schreibvorgänge über einen dedizierten Hintergrund-Worker oder eine Task-Queue abgewickelt werden, um den WPF UI-Thread (Main STA Thread) niemals zu blockieren.
2. **Entity Framework Core**: Verwendet \`AsNoTracking()\` für READ-Operationen in den Mail-Listen, um die Speicherallokation zu minimieren.
3. **Datenbank-Migrationen**: Die SQLite-Datei sollte unter \`AppDomain.CurrentDomain.BaseDirectory\` abgelegt werden.

Lass uns das heute Nachmittag im Architektur-Sync besprechen.

Beste Grüße,
Dr. Andreas Müller
Director of Engineering`,
    isRead: false,
    isFlagged: true,
    hasAttachment: true,
    importance: 'high',
    category: 'Architektur'
  },
  {
    id: 'msg-102',
    sender: 'Sabine Hoffmann',
    senderEmail: 's.hoffmann@product.local',
    subject: 'Sync-Strategie & Delta-Updates für den Offline-Betrieb',
    date: '2026-06-09T14:30:00Z',
    preview: 'Aus Product-Sicht müssen wir sicherstellen, dass der Offline-Modus absolut nahtlos funktioniert. Sobald die Verbindung...',
    body: `Hallo zusammen,

aus Product-Sicht müssen wir sicherstellen, dass der Offline-Modus absolut nahtlos funktioniert.

Sobald die Verbindung abreißt (detektiert via \`NetworkInformation.NetworkAddressChanged\` in C#), wechselt die WPF-App elegant in den Offline-Status (rechts unten in der Statusleiste, exakt wie in Outlook Classic: "Offline arbeiten").

Unsere Anforderungen an den Sync-Service:
- **Delta-Sync**: Nur E-Mails abrufen, die neuer sind als die höchste \`UID\` in unserer SQLite-Datenbank.
- **Merge-Konflikte**: Wenn lokal gelöscht, auf dem Server spiegeln. Wenn beidseitig editiert (z.B. Tags/Kategorien), gewinnt der letzte Server-Zustand.
- **Lokale Queue**: Lokale Sendeaktionen (Posteingang/-ausgang) werden in einer SQLite Tabelle \`OutboxQueue\` gepuffert.

Gibt es von Entwicklerseite hier Einwände gegen diesen Ablauf?

Viele Grüße,
Sabine`,
    isRead: true,
    isFlagged: false,
    hasAttachment: false,
    importance: 'normal',
    category: 'Synchronisation'
  },
  {
    id: 'msg-103',
    sender: 'Thomas Weber',
    senderEmail: 't.weber@ui-design.local',
    subject: 'Classic Outlook Theme: XAML ControlTemplates & Farbpalette',
    date: '2026-06-08T10:45:00Z',
    preview: 'Hallo! Ich habe die finalen Hex-Farben für das Classic Outlook Blue Theme zusammengestellt. Diese entsprechen dem Original...',
    body: `Hallo zusammen,

ich habe die finalen Hex-Farben für das Classic-Outlook-Design in WPF zusammengestellt. Diese entsprechen exakt dem Original-Look von Outlook Classic:

- **Outlook-Blau (Primary)**: \`#0078D4\` (Gleiches Blau wie in der Titelleiste und selektierten Zuständen)
- **Helles Grau (Hintergründe)**: \`#F3F2F1\` (Für Ordnerleiste und Lesebereich-Rahmen)
- **Dunkler Text (Primary Content)**: \`#323130\`
- **Ausgewählte Zeilen**: \`#E1DFDD\`

Ich habe ein globales \`ResourceDictionary\` vorbereitet. Jedes UI-Element wie Buttons, ListViews und der TreeView muss so umgeschrieben werden, dass es unsere \`ControlTemplates\` nutzt, um den typischen 3D-Look an Rändern und die flachen Microsoft-Office-Flächen nachzuahmen.

Achtet darauf, dass wir für die Mailbox-ListView das \`VirtualizingStackPanel.IsVirtualizing="True"\` aktivieren, sonst laggt das Scrollen bei vielen Mails massiv!

Anbei sind die Styles. Im Anhang ist auch das XAML-Snippet für das Ribbon-Bar-Style.

Gruß,
Thomas`,
    isRead: true,
    isFlagged: false,
    hasAttachment: true,
    importance: 'normal',
    category: 'Design-System'
  },
  {
    id: 'msg-104',
    sender: 'Michael Schmitt',
    senderEmail: 'm.schmitt@dev-ui.local',
    subject: 'Datenbindung für Ordner-TreeView (Inbox, Sent, Trash)',
    date: '2026-06-07T16:20:00Z',
    preview: 'Hi, ich arbeite momentan an dem TreeView auf der linken Seite. Ich habe ein FolderViewModel entworfen, das eine Collection...',
    body: `Hi,

ich arbeite momentan an dem TreeView auf der linken Seite.

Ich habe ein \`FolderViewModel\` entworfen, das eine ObservableCollection von sich selbst hält, um Unterordner unendlich tief schachteln zu können (Composite Pattern).

Die Datenbindung im XAML sieht folglich so aus:
\`\`\`xml
<TreeView ItemsSource="{Binding Folders}">
    <TreeView.ItemTemplate>
        <HierarchicalDataTemplate ItemsSource="{Binding SubFolders}">
            <StackPanel Orientation="Horizontal">
                <Image Source="{Binding IconPath}" Width="16" Height="16" Margin="0,0,5,0"/>
                <TextBlock Text="{Binding FolderName}"/>
                <TextBlock Text="{Binding UnreadCountDisplay}" Foreground="#0078D4" FontWeight="Bold" Margin="5,0,0,0"/>
            </StackPanel>
        </HierarchicalDataTemplate>
    </TreeView.ItemTemplate>
</TreeView>
\`\`\`

Das funktioniert perfekt und aktualisiert sich dank \`INotifyPropertyChanged\` auch in Echtzeit, wenn neue Mails im Sync-Hintergrund eintreffen.

Meldet euch, falls ihr Optimierungsbedarf seht!

Schöne Grüße,
Michael`,
    isRead: true,
    isFlagged: true,
    hasAttachment: false,
    importance: 'normal',
    category: 'WPF Frontend'
  },
  {
    id: 'msg-105',
    sender: 'Julia Koch',
    senderEmail: 'j.koch@performance.local',
    subject: 'Performance-Engpass bei 10.000+ Mails gelöst (Virtualization)',
    date: '2026-06-05T09:12:00Z',
    preview: 'Wichtiges Update bezüglich Speicherbedarf: Ich habe die WPF Mail-ListView mit UI Virtualization ausgestattet. Die Ladezeit...',
    body: `Liebe Kolleginnen und Kollegen,

wichtiges Update bezüglich Speicher- und CPU-Performance:

Bei unseren Performance-Tests mit 10.000 simulierten Mails in der SQLite-Datenbank kam es beim schnellen Scrollen zu merklichen Rucklern. WPF hatte versucht, alle UI-Container im Speicher zu instanziieren.

Ich habe folgende Optimierungen im \`ListView\`-Style vorgenommen:
1. \`VirtualizingStackPanel.IsVirtualizing="True"\`
2. \`VirtualizingStackPanel.VirtualizationMode="Recycling"\`
3. \`ScrollViewer.CanContentScroll="True"\`

Effekt: Der RAM-Bedarf sank von 450MB auf unter 85MB und das Scrollen läuft jetzt butterweich mit stabilen 60 FPS, da nur noch die im Sichtfeld angezeigten Zeilen im Speicher verweilen.

Bitte stellt sicher, dass dieses Verhalten in allen Custom-Listen-Templates (z.B. auch bei den Kontakten) beibehalten wird.

Heitere Grüße,
Julia`,
    isRead: true,
    isFlagged: false,
    hasAttachment: false,
    importance: 'low',
    category: 'Performance'
  }
];

export const mockCalendarItems: CalendarItem[] = [
  {
    id: 'cal-1',
    title: 'Architektur-Sync: MailKit & DB-Anbindung',
    start: '2026-06-10T14:00:00Z',
    end: '2026-06-10T15:30:00Z',
    location: 'Besprechungsraum " Turing" (MS Teams)',
    description: 'Diskussion über IMailService, Threading im Hintergrund und EF Core SQLite Migrationsstrategie.',
    category: 'Architektur'
  },
  {
    id: 'cal-2',
    title: 'UI Design Review (Classic Outlook Ribbon & Colors)',
    start: '2026-06-11T10:00:00Z',
    end: '2026-06-11T11:30:00Z',
    location: 'Raum "Lovelace" (MS Teams)',
    description: 'Abnahme der WPF ControlTemplates und der globalen Styles.xaml.',
    category: 'Design-System'
  },
  {
    id: 'cal-3',
    title: 'Sprint-Planning & Roadmap-Validierung',
    start: '2026-06-12T09:00:00Z',
    end: '2026-06-12T10:30:00Z',
    location: 'Daily Standup Area',
    description: 'Überprüfung der Meilensteine von Phase 1 (Grundgerüst) bis Phase 5 (Deployment).',
    category: 'Projektmanagement'
  },
  {
    id: 'cal-4',
    title: 'Delta-Sync Algorithmus Walkthrough',
    start: '2026-06-15T15:00:00Z',
    end: '2026-06-15T16:00:00Z',
    location: 'Online Workshop',
    description: 'Code-Review des Delta-Synchronisations-Algorithmus und Fehlerbehandlung bei Netzausfall.',
    category: 'Synchronisation'
  }
];

export const mockContacts: Contact[] = [
  {
    id: 'con-1',
    firstName: 'Andreas',
    lastName: 'Müller',
    email: 'andreas.mueller@dev-core.local',
    phone: '+49 170 1122334',
    company: 'WPF Outlook Architect Team',
    role: 'Technical Lead & Architect',
    address: 'Informatik-Allee 12, 80331 München'
  },
  {
    id: 'con-2',
    firstName: 'Sabine',
    lastName: 'Hoffmann',
    email: 's.hoffmann@product.local',
    phone: '+49 171 2233445',
    company: 'WPF Outlook Product Management',
    role: 'Lead Project Manager',
    address: 'Informatik-Allee 12, 80331 München'
  },
  {
    id: 'con-3',
    firstName: 'Thomas',
    lastName: 'Weber',
    email: 't.weber@ui-design.local',
    phone: '+49 172 3344556',
    company: 'PixelPerfect UI Agency',
    role: 'Senior WPF Designer / Themer',
    address: 'Kreativ-Quartier 4, 10115 Berlin'
  },
  {
    id: 'con-4',
    firstName: 'Michael',
    lastName: 'Schmitt',
    email: 'm.schmitt@dev-ui.local',
    phone: '+49 173 4455667',
    company: 'WPF Outlook Architect Team',
    role: 'WPF Control Engineer',
    address: 'Informatik-Allee 12, 80331 München'
  },
  {
    id: 'con-5',
    firstName: 'Julia',
    lastName: 'Koch',
    email: 'j.koch@performance.local',
    phone: '+49 174 5566778',
    company: 'Performance Analytics GmbH',
    role: 'Memory & Threading Expert',
    address: 'High-Speed-Weg 1, 70173 Stuttgart'
  }
];

export const mockTasks: Task[] = [
  {
    id: 'tsk-1',
    title: '[Tutorial] Berufungsfrist im Mandat Richter prüfen & eintragen',
    dueDate: '2026-06-18',
    isCompleted: false,
    priority: 'High',
    notes: 'Kanzlei-Tipp: Klicken Sie im Posteingang auf eine E-Mail und wählen Sie das Flaggen-Symbol, um eine Wiedervorlage einzurichten. Das System trägt diese Frist automatisch in den Kalender ein.',
    percentComplete: 40,
    accountEmail: 'rae.mueller@juris-kanzlei.de'
  },
  {
    id: 'tsk-2',
    title: '[Tutorial] Aktennotiz zum Erstgespräch (Scheidungsverfahren) erfassen',
    dueDate: '2026-06-20',
    isCompleted: true,
    priority: 'Normal',
    notes: 'Navigieren Sie in das Modul "Notizen". Erstellen Sie dort eine neue Gesprächsnotiz und weisen Sie eine Farbe zu (z.B. Rot für dringende Angelegenheiten).',
    percentComplete: 100,
    accountEmail: 'rae.mueller@juris-kanzlei.de'
  },
  {
    id: 'tsk-3',
    title: '[Tutorial] Offline-Arbeiten über die Statusleiste simulieren',
    dueDate: '2026-06-22',
    isCompleted: false,
    priority: 'High',
    notes: 'Klicken Sie rechts unten in der Statusleiste auf "RealSync aktiv" oder oben im Menüband auf "Offline arbeiten". Der Client greift sofort nahtlos auf die lokale SQL-Schicht zurück.',
    percentComplete: 0,
    accountEmail: 'rae.mueller@juris-kanzlei.de'
  },
  {
    id: 'tsk-4',
    title: '[Tutorial] Neues Kanzlei-Postfach per Autodiscover anbinden',
    dueDate: '2026-06-25',
    isCompleted: false,
    priority: 'Normal',
    notes: 'Öffnen Sie die Einstellungen via Zahnrad-Symbol oben rechts. Geben Sie eine neue Kanzlei-Adresse ein und testen Sie den automatischen DNS-Lookup des C#-Algorithmus.',
    percentComplete: 75,
    accountEmail: 'rae.mueller@juris-kanzlei.de'
  }
];

export const mockNotes: Note[] = [
  {
    id: 'note-1',
    title: '💡 Kanzlei-Tutorial: Aktennotizen & Farbsystem',
    content: 'Willkommen bei Unique Mail Classic!\n\nIm Kanzleialltag sind strukturierte Aktennotizen unentbehrlich.\n\nNutzen Sie unser Farbsystem im Notizen-Tab:\n• 🟥 Rot: Fristkritische Notizen (z.B. Notfrist nach § 224 ZPO)\n• 🟦 Blau: Allgemeine Mandantendetails / Gesprächsinhalte\n• 🟩 Grün: Zahlungseingänge / RVG-Gebührenvereinbarungen\n• 🟨 Gelb: Arbeits-To-Dos für die Kanzleikräfte (ReNo)\n\nKlicken Sie direkt auf die Farbkreise, um eine Notiz neu zu kategorisieren.',
    date: '15.06.2026',
    color: '#fee2e2', // soft red
    accountEmail: 'rae.mueller@juris-kanzlei.de'
  },
  {
    id: 'note-2',
    title: '💡 Kanzlei-Tutorial: Wiedervorlagen & Kalendersynchronisation',
    content: 'Wie richte ich eine anwaltliche Fristenüberwachung ein?\n\n1. Wählen Sie im Posteingang eine E-Mail (z.B. eine Gerichtsverfügung).\n2. Klicken Sie auf das Flaggen-Symbol. Es öffnet sich das Wiedervorlage-Modal.\n3. Wählen Sie Fristdatum und Uhrzeit. Fügen Sie als Notiz das Aktenzeichen hinzu (z.B. "Az. 4 O 112/26").\n4. Speichern Sie. Das System erstellt automatisch einen Kalendereintrag und benachrichtigt Sie sekundengenau, selbst im Offline-Modus!',
    date: '15.06.2026',
    color: '#dbeafe', // soft blue
    accountEmail: 'rae.mueller@juris-kanzlei.de'
  },
  {
    id: 'note-3',
    title: '💡 Kanzlei-Tutorial: Offline-Schutz für sensible Mandantendaten',
    content: 'Die Daten Ihrer Mandanten unterliegen der anwaltlichen Schweigepflicht (§ 43a Abs. 2 BRAO) und müssen optimal geschützt sein.\n\nDeshalb speichert der Unique Mail WPF Client alle Mails, Kontakte, Notizen und Termine ausschließlich lokal in einer verschlüsselten, offline-fähigen SQLite-Datenbank.\n\nFällt die Internetverbindung aus, können Sie nahtlos weiterarbeiten. Geplante Schriftsätze verbleiben in der lokalen Outbox-Queue und werden beim nächsten Sync-Handshake automatisch übertragen.',
    date: '15.06.2026',
    color: '#dcfce7', // soft green
    accountEmail: 'rae.mueller@juris-kanzlei.de'
  }
];
