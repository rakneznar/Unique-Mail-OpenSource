/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoadmapPhase } from '../types';

export const roadmapPhases: RoadmapPhase[] = [
  {
    id: 1,
    title: 'Phase 1: MVVM Core & Basis-Architektur',
    subtitle: 'Grundgerüst, Dependency Injection & Navigation',
    duration: 'Woche 1 - 2',
    status: 'Completed',
    wpfFocus: 'Bootstrapping der WPF .NET 8 App, Integration eines modernen MVVM-Entwurfsmusters und DI Container.',
    tasks: [
      'Einrichtung des .NET 8 WPF Projekts in Visual Studio',
      'Integration von Microsoft.Extensions.DependencyInjection für Service Injection',
      'Implementierung der Basisklassen: ViewModelBase (INotifyPropertyChanged) und RelayCommand (ICommand)',
      'Aufbau des Hauptfensters (MainWindow.xaml) als flexible Shell mit NavigationService, um dynamische ContentViews (Mail, Kalender, Kontakte) zu laden',
      'Konfiguration der AppSettings.json für Server-Verbindungsdaten (IMAP, SMTP, SQLite-Pfad)'
    ],
    codeFiles: ['App.xaml.cs', 'ViewModelBase.cs', 'RelayCommand.cs', 'appsettings.json']
  },
  {
    id: 2,
    title: 'Phase 2: High-Fidelity Outlook Classic UI',
    subtitle: 'XAML ControlTemplates, Themes & Ribbon-System',
    duration: 'Woche 3 - 4',
    status: 'Completed',
    wpfFocus: 'Originalgetreue visuelle Identität des Outlook Classic Designs mittels reinem WPF-Styling.',
    tasks: [
      'Creation eines globalen ControlTemplate-ResourceDictionary für Buttons, ListBoxen, Scrollbars und Separators im typischen Classic Office Design',
      'Implementierung des Outlook Ribbon-Bars (Registerkarten wie Start, Senden/Empfangen mit Tooltips und RibbonGroups)',
      'Customizing des TreeViews für die Mailbox-Ordnerstruktur (Inbox, Sent, Trash etc.) inklusive Badge-Zähler für ungelesene E-Mails',
      'Entwicklung der dreispaltigen Layoutstruktur mit GridSplitters für flexible Breitenregulierungen (Ordnerleiste - Masterliste - Lesebereich)',
      'Implementierung von WPF UI Virtualization (VirtualizingStackPanel) für ultra-performantes Scrollen in E-Mail-Listen'
    ],
    codeFiles: ['MainWindow.xaml', 'Styles.xaml']
  },
  {
    id: 3,
    title: 'Phase 3: SQLite Datenbank, MailKit & Auto-Discovery Services',
    subtitle: 'EF Core, Mail-Datenmodellierung & intelligente Kontenerkennung',
    duration: 'Woche 5 - 6',
    status: 'Completed',
    wpfFocus: 'Lokale Datenhaltung, direkte E-Mail-Protokoll-Kommunikation und automatisierte Konteneinrichtung für hervorragende Benutzerfreundlichkeit.',
    tasks: [
      'Entwicklung des AutoDiscoveryService (C#) zur automatischen DNS MX-Record Auflösung, heuristischer Host-Port-Recherche und optionalen XML-Autodiscover-Abfragen',
      'Setup von Entity Framework Core mit SQLite für die lokale Speicherung von E-Mails, Ordnern, Kontakten und Tasks',
      'Erstellung der Entity-Datenmodelle (MailItem mit Eigenschaften wie UID, IsRead, FolderId, Headers, Body, Attachments)',
      'Implementierung des MailKit (IMAP/SMTP/POP3) Wrappers für sicheres Abrufen und Senden von E-Mails über SSL/TLS',
      'Volltextsuch-Indexierung auf Basis von SQLite FTS5, um blitzschnelle Suchen in Betreff und Mailinhalt zu ermöglichen',
      'Repository-Klassen für atomare Datenbanktransaktionen entwerfen, um Inkonsistenzen bei App-Abbrüchen zu verhindern'
    ],
    codeFiles: ['MailItem.cs', 'MailService.cs']
  },
  {
    id: 4,
    title: 'Phase 4: Delta Sync-Engine & Background Network Logic',
    subtitle: 'Automatische Synchronisation, Offline-Caching & Queue',
    duration: 'Woche 7 - 8',
    status: 'Completed',
    wpfFocus: 'Ausfallsichere Datensynchronisation im Hintergrund zur Entlastung des WPF UI-Threads.',
    tasks: [
      'Entwicklung eines Delta-Synchronisations-Algorithmus (Abgleich der IMAP UIDVALIDITY und lokaler UIDs)',
      'Implementierung einer Outbox-Sende-Warteschlange (Sendeaufträge in SQLite puffern und bei Online-Zustand autom. abarbeiten)',
      'Verbindung der C# NetworkInformation-Schnittstelle, um Netzwerkwechsel (Online/Offline) in Echtzeit zu registrieren',
      'Integration einer Thread-sicheren Progress-Schnittstelle (IProgress<SyncStatus>), die die Outlook Classic Statusbar aktualisiert (z.B. "Übermittlung läuft...", "Alle Ordner sind aktuell.")',
      'Robuste Fehlerbehandlung (Expontential Backoff bei Server-Verbindungsproblemen)'
    ],
    codeFiles: ['SyncEngine.cs']
  },
  {
    id: 5,
    title: 'Phase 5: Performance Tuning, Test & Deployment',
    subtitle: 'Memory Profiling, Outlook Integration & MSIX Installer',
    duration: 'Woche 9 - 10',
    status: 'Completed',
    wpfFocus: 'Feinschliff, Optimierung von Speicherbedarf und Betriebssystem-Integration für den produktiven Einsatz.',
    tasks: [
      'Profiler-Sitzungen zur Eliminierung von WPF Memory Leaks (nicht abgemeldete Events, DataBinding-Warnungen)',
      'Optimierung des SQLite Cache-Levels und Write-Ahead-Logging (WAL Modus) zur Datenbeschleunigung',
      'Verknüpfung mit der Windows-Registry für das standardmäßige MAPI-Protokoll (Rechtsklick "Senden an -> E-Mail-Empfänger")',
      'Erstellung eines professionellen MSIX-Installerpackages für sandboxed Windows Deployments inklusive silent Auto-Updates',
      'Unit-Tests für die Kernlogik (Sync-Engine, Mail-Kompression, MailKit-Parser) mittels xUnit & Moq'
    ],
    codeFiles: ['App.config']
  }
];
