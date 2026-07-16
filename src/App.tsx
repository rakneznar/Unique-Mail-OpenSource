/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { roadmapPhases } from './data/roadmapData';
import { wpfCodeFiles } from './data/wpfCodeFiles';

import Ribbon from './components/Ribbon';
import NavigationRail from './components/NavigationRail';
import FolderTree from './components/FolderTree';
import ItemList from './components/ItemList';
import ReadingPane, { ComposeMailPayload, ComposeMode } from './components/ReadingPane';
import ArchTab from './components/ArchTab';
import NotesView from './components/NotesView';
import { Email, Task, Note, Category, Contact, CalendarItemDraft, CalendarItem } from './types';
import AppLogo from './components/AppLogo';
import { ShieldAlert, RefreshCw, Layers, Plus, Mail, Trash2, Settings, Tag, Palette, Download, Upload, Zap } from 'lucide-react';

const APP_VERSION = '0.4.36';
(window as any).uniqueMailNative?.restoreRendererStorage?.();
type UiLanguage = 'de' | 'en';
type FeedbackKind = 'bug' | 'feature';
type AppLockConfig = { enabled: boolean; salt: string; hash: string; updatedAt?: string };
type AppPage = 'mail' | 'calendar' | 'contacts' | 'crm' | 'tasks' | 'notes' | 'dev';
type BackgroundJob = {
  id: number;
  key: string;
  priority: number;
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const readJsonStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Lokale Daten konnten nicht gelesen werden: ${key}`, error);
    return fallback;
  }
};

const readStoredAppLockConfig = (): AppLockConfig | null => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('uniquemail_app_lock_config');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.enabled && typeof parsed.salt === 'string' && typeof parsed.hash === 'string') {
      return { enabled: true, salt: parsed.salt, hash: parsed.hash, updatedAt: parsed.updatedAt };
    }
  } catch {
    return null;
  }
  return null;
};

const isValidAppLockPassword = (value: string) => /^[A-Za-z0-9]{4,}$/.test(value);

const createAppLockSalt = () => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const hashAppLockPassword = async (password: string, salt: string) => {
  const data = new TextEncoder().encode(salt + ':' + password);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
const DEFAULT_CONTACT_SORT_LABELS = ['Newsletter', 'Privat', 'Beruflich'];
const DEFAULT_MAIL_DATE_FORMAT = 'dd.MM.yyyy';
const MAIL_DATE_FORMAT_OPTIONS = [
  { value: 'dd.MM.yyyy', de: '04.07.2026', en: '04.07.2026' },
  { value: 'dd.MM.yyyy HH:mm', de: '04.07.2026 13:24', en: '04.07.2026 13:24' },
  { value: 'yyyy-MM-dd', de: '2026-07-04', en: '2026-07-04' },
  { value: 'MM/dd/yyyy', de: '07/04/2026', en: '07/04/2026' },
  { value: 'MMM dd, yyyy', de: 'Jul. 04, 2026', en: 'Jul 04, 2026' }
];

export default function App() {
  // Page switching & Ribbon active tab - defaulted to mail inbox per security directives
  const [currentPage, setCurrentPage] = useState<AppPage>('mail');
  const [activeTab, setActiveTab] = useState<'start' | 'sync' | 'folder' | 'view' | 'dev' | 'options'>('start');
  const backgroundJobsRef = useRef<BackgroundJob[]>([]);
  const backgroundWorkerRunningRef = useRef(false);
  const backgroundJobSequenceRef = useRef(0);

  useEffect(() => {
    const persist = () => (window as any).uniqueMailNative?.persistRendererStorage?.();
    const intervalId = window.setInterval(persist, 1500);
    window.addEventListener('beforeunload', persist);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', persist);
      persist();
    };
  }, []);

  useEffect(() => {
    let lastEditableElement: HTMLElement | null = null;
    const editableSelector = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="file"]), textarea, [contenteditable="true"]';
    const findEditable = (target: EventTarget | null) => target instanceof Element
      ? target.closest<HTMLElement>(editableSelector)
      : null;
    const canFocus = (target: HTMLElement | null) => {
      if (!target || !target.isConnected) return false;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return !target.disabled && !target.readOnly;
      }
      return target.getAttribute('contenteditable') === 'true';
    };
    const focusEditable = (target: HTMLElement) => {
      if (!canFocus(target) || document.activeElement === target) return;
      target.focus({ preventScroll: true });
    };
    const handleEditablePointer = (event: Event) => {
      const target = findEditable(event.target);
      if (!canFocus(target)) return;
      lastEditableElement = target;
      focusEditable(target);
      window.requestAnimationFrame(() => focusEditable(target));
    };
    const rememberEditableFocus = (event: FocusEvent) => {
      const target = findEditable(event.target);
      if (canFocus(target)) lastEditableElement = target;
    };
    const restoreRendererFocus = () => {
      window.requestAnimationFrame(() => {
        if (document.activeElement === document.body && canFocus(lastEditableElement)) {
          focusEditable(lastEditableElement as HTMLElement);
        }
      });
    };

    document.addEventListener('pointerdown', handleEditablePointer, true);
    document.addEventListener('mousedown', handleEditablePointer, true);
    document.addEventListener('focusin', rememberEditableFocus, true);
    window.addEventListener('focus', restoreRendererFocus);
    return () => {
      document.removeEventListener('pointerdown', handleEditablePointer, true);
      document.removeEventListener('mousedown', handleEditablePointer, true);
      document.removeEventListener('focusin', rememberEditableFocus, true);
      window.removeEventListener('focus', restoreRendererFocus);
    };
  }, []);

  const processBackgroundJobs = () => {
    if (backgroundWorkerRunningRef.current) return;
    const nextJob = backgroundJobsRef.current
      .sort((left, right) => right.priority - left.priority || left.id - right.id)
      .shift();
    if (!nextJob) return;

    backgroundWorkerRunningRef.current = true;
    window.setTimeout(() => {
      void nextJob.task()
        .then(nextJob.resolve, nextJob.reject)
        .finally(() => {
          backgroundWorkerRunningRef.current = false;
          processBackgroundJobs();
        });
    }, 0);
  };

  const enqueueBackgroundJob = <T,>(key: string, priority: number, task: () => Promise<T>): Promise<T> => (
    new Promise<T>((resolve, reject) => {
      backgroundJobSequenceRef.current += 1;
      backgroundJobsRef.current.push({
        id: backgroundJobSequenceRef.current,
        key,
        priority,
        task,
        resolve: value => resolve(value as T),
        reject
      });
      processBackgroundJobs();
    })
  );

  const normalizeProviderDomain = (domain: string) => {
    const normalized = domain.trim().toLowerCase();
    if (normalized === 'mailde') return 'mail.de';
    if (normalized === 'webde') return 'web.de';
    if (normalized === 'gmxde') return 'gmx.de';
    return normalized;
  };

  const normalizeEmailAddressForProvider = (email: string) => {
    const trimmed = email.trim();
    const [localPart, rawDomain] = trimmed.split('@');
    if (!localPart || !rawDomain) return trimmed;
    return `${localPart}@${normalizeProviderDomain(rawDomain)}`;
  };

  const PROVIDER_PRESETS: Array<{
    match: (domain: string) => boolean;
    imapServer: string;
    smtpServer: string;
    imapPort?: number;
    smtpPort?: number;
    provider: string;
  }> = [
    { match: d => d === 'gmail.com' || d === 'googlemail.com', imapServer: 'imap.gmail.com', smtpServer: 'smtp.gmail.com', imapPort: 993, smtpPort: 465, provider: 'Google Workspace / Gmail' },
    { match: d => d.includes('gmx.'), imapServer: 'imap.gmx.net', smtpServer: 'mail.gmx.net', imapPort: 993, smtpPort: 465, provider: 'GMX Freemail' },
    { match: d => d === 'mail.de', imapServer: 'imap.mail.de', smtpServer: 'smtp.mail.de', imapPort: 993, smtpPort: 587, provider: 'mail.de' },
    { match: d => d.includes('web.de'), imapServer: 'imap.web.de', smtpServer: 'smtp.web.de', imapPort: 993, smtpPort: 587, provider: 'WEB.DE Freemail' },
    { match: d => d.includes('outlook.com') || d.includes('hotmail.') || d.includes('live.') || d.includes('msn.'), imapServer: 'outlook.office365.com', smtpServer: 'smtp-mail.outlook.com', imapPort: 993, smtpPort: 587, provider: 'Microsoft Live / Outlook.com' },
    { match: d => d.includes('office365.') || d.includes('microsoft365.') || d.includes('onmicrosoft.com'), imapServer: 'outlook.office365.com', smtpServer: 'smtp.office365.com', imapPort: 993, smtpPort: 587, provider: 'Microsoft 365 / Exchange Online' },
    { match: d => d === 'icloud.com' || d === 'me.com' || d === 'mac.com', imapServer: 'imap.mail.me.com', smtpServer: 'smtp.mail.me.com', imapPort: 993, smtpPort: 587, provider: 'Apple iCloud Mail' },
    { match: d => d.includes('yahoo.'), imapServer: 'imap.mail.yahoo.com', smtpServer: 'smtp.mail.yahoo.com', imapPort: 993, smtpPort: 465, provider: 'Yahoo Mail' },
    { match: d => d.includes('aol.'), imapServer: 'imap.aol.com', smtpServer: 'smtp.aol.com', imapPort: 993, smtpPort: 465, provider: 'AOL Mail' },
    { match: d => d.includes('t-online.de') || d.includes('magenta.de'), imapServer: 'secureimap.t-online.de', smtpServer: 'securesmtp.t-online.de', imapPort: 993, smtpPort: 465, provider: 'Telekom / T-Online' },
    { match: d => d.includes('freenet.'), imapServer: 'mx.freenet.de', smtpServer: 'mx.freenet.de', imapPort: 993, smtpPort: 587, provider: 'freenet Mail' },
    { match: d => d === 'posteo.de', imapServer: 'posteo.de', smtpServer: 'posteo.de', imapPort: 993, smtpPort: 587, provider: 'Posteo' },
    { match: d => d === 'mailbox.org', imapServer: 'imap.mailbox.org', smtpServer: 'smtp.mailbox.org', imapPort: 993, smtpPort: 465, provider: 'mailbox.org' },
    { match: d => d.includes('ionos.') || d.includes('1und1.') || d.includes('1and1.'), imapServer: 'imap.ionos.de', smtpServer: 'smtp.ionos.de', imapPort: 993, smtpPort: 587, provider: 'IONOS / 1&1 Mail' },
    { match: d => d.includes('strato.'), imapServer: 'imap.strato.de', smtpServer: 'smtp.strato.de', imapPort: 993, smtpPort: 465, provider: 'STRATO Mail' },
    { match: d => d.includes('zoho.'), imapServer: 'imap.zoho.eu', smtpServer: 'smtp.zoho.eu', imapPort: 993, smtpPort: 465, provider: 'Zoho Mail' },
    { match: d => d.includes('fastmail.'), imapServer: 'imap.fastmail.com', smtpServer: 'smtp.fastmail.com', imapPort: 993, smtpPort: 465, provider: 'Fastmail' },
    { match: d => d.includes('yandex.'), imapServer: 'imap.yandex.com', smtpServer: 'smtp.yandex.com', imapPort: 993, smtpPort: 465, provider: 'Yandex Mail' },
    { match: d => d.includes('proton.') || d.includes('pm.me'), imapServer: '127.0.0.1', smtpServer: '127.0.0.1', imapPort: 1143, smtpPort: 1025, provider: 'Proton Mail Bridge' },
    { match: d => d.includes('mail.com'), imapServer: 'imap.mail.com', smtpServer: 'smtp.mail.com', imapPort: 993, smtpPort: 587, provider: 'mail.com' },
    { match: d => d === 'inbox.lv' || d === 'inbox.eu' || d.endsWith('.inbox.lv') || d.endsWith('.inbox.eu'), imapServer: 'mail.inbox.lv', smtpServer: 'mail.inbox.lv', imapPort: 993, smtpPort: 587, provider: 'Inbox.lv / Inbox.eu' },
    { match: d => d.includes('hostinger.'), imapServer: 'imap.hostinger.com', smtpServer: 'smtp.hostinger.com', imapPort: 993, smtpPort: 465, provider: 'Hostinger Email' },
    { match: d => d.includes('privateemail.') || d.includes('namecheap.'), imapServer: 'mail.privateemail.com', smtpServer: 'mail.privateemail.com', imapPort: 993, smtpPort: 465, provider: 'Namecheap Private Email' },
    { match: d => d === 'spacemail.com' || d.endsWith('.spacemail.com') || d === 'spaceship.com' || d.endsWith('.spaceship.com'), imapServer: 'mail.spacemail.com', smtpServer: 'smtp.spacemail.com', imapPort: 993, smtpPort: 465, provider: 'Spaceship Spacemail' }
  ];
  // central parameters-resolution service for Auto-Discovery
  const resolveServerSettings = (email: string) => {
    const domain = normalizeProviderDomain(email.split('@')[1] || 'domain.de');
    const suffix = domain.split('.')[0] || 'Web';
    const preset = PROVIDER_PRESETS.find(item => item.match(domain));

    if (preset) {
      return {
        imapServer: preset.imapServer,
        imapPort: preset.imapPort ?? 993,
        smtpServer: preset.smtpServer,
        smtpPort: preset.smtpPort ?? 465,
        provider: preset.provider
      };
    }

    return {
      imapServer: 'imap.' + domain,
      imapPort: 993,
      smtpServer: 'smtp.' + domain,
      smtpPort: 465,
      provider: suffix.toUpperCase() + ' Mail-Dienst (Auto-Discovered)'
    };
  };

  const resolveServerSettingsOnline = async (email: string) => {
    const fallback = resolveServerSettings(email);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/autodiscover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal
      });
      if (!response.ok) return fallback;
      const data = await response.json();
      if (data?.imapServer && data?.smtpServer) {
        return {
          imapServer: data.imapServer,
          imapPort: Number(data.imapPort) || 993,
          smtpServer: data.smtpServer,
          smtpPort: Number(data.smtpPort) || 465,
          provider: data.provider || fallback.provider
        };
      }
    } catch {
      // Local fallback keeps account setup usable without DNS/network autodiscovery.
    } finally {
      window.clearTimeout(timeoutId);
    }
    return fallback;
  };

  // Generate beautiful simulated synced emails for newly registered accounts
  const generateEmailsForNewAccount = (email: string, provider: string): Email[] => {
    return [
      {
        id: `msg-welcome-${Date.now()}-1`,
        sender: 'Unique Mail Auto-Discovery',
        senderEmail: 'autodiscovery@unique-mail.de',
        subject: `Willkommen bei Unique Mail! IMAP-Konfiguration für ${email} erfolgreich`,
        date: new Date().toISOString(),
        preview: `Die Kontoeinrichtung für ${email} wurde über den Auto-Discovery-Dienst erfolgreich abgeschlossen.`,
        body: `Hallo,

Ihr E-Mail-Konto ${email} wurde erfolgreich über unseren C# Auto-Discovery-Service eingerichtet.

Folgende Verbindungsparameter wurden ermittelt und in der WPF SQLite Konfiguration hinterlegt:
- IMAP-Server: (über ${provider} synchronisiert)
- Port: 993 (SSL/TLS aktiv)
- Lokale Offline-Datenbank: SQLite v3.45

Die lokale Datenbankschnittstelle (SQLite) wurde instanziiert und die Synchronisations-Queues sind bereit. Sie können jetzt E-Mails senden und empfangen.

Dies ist eine automatisch generierte Willkommensnachricht nach erfolgreicher Kontenerkennung.

Mit freundlichen Grüßen,
Ihr Unique Mail Team`,
        isRead: false,
        isFlagged: true,
        hasAttachment: false,
        importance: 'high',
        category: 'System',
        folder: 'inbox',
        accountEmail: email
      },
      {
        id: `msg-welcome-${Date.now()}-2`,
        sender: 'Dr. Andreas Müller',
        senderEmail: 'andreas.mueller@dev-core.local',
        subject: 'WPF & MVVM: Erste Synchronisation abgeschlossen',
        date: new Date(Date.now() - 3600000).toISOString(),
        preview: `Hallo! Ihre erste Verbindung mit dem Server über MailKit war erfolgreich. Die lokale SQLite...`,
        body: `<div>
  <p>Hallo Herr Kollege,</p>
  <p>wir freuen uns sehr über Ihre Registrierung und Ihren Anschluss an die Unique Mail Infrastruktur.</p>
  <p>Ihre erste Verbindung für das Postfach <strong>${email}</strong> über die .NET 8 MailKit Bibliothek war erfolgreich. Alle IMAP Mailbox-Ordnerstrukturen wurden in das lokale SQLite Cache-Schema übersetzt.</p>
  
  <div style="margin: 20px 0; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
    <p style="font-size: 11px; color: #475569; font-weight: bold; margin-bottom: 8px;">NATIVE REPOSITORY PIPELINE SCHEMA (WPF & SQLITE)</p>
    <img 
      src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80" 
      alt="WPF SQLite Architecture Schema" 
      style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #cbd5e1; cursor: pointer; display: inline-block;"
      id="wpf-schema-diagram-img"
    />
    <p style="font-size: 10px; color: #64748b; margin-top: 6px;">C# Task-Queue & Entity Framework Core Model Mapping Diagram (Zur Offline-Synchronisation)</p>
  </div>
  
  <p>Einige wichtige Punkte für die WPF-Umsetzung:</p>
  <ul>
    <li><strong>Thread-Sicherheit</strong>: MailKit-Instanzen sind nicht thread-sicher. Alle Vorgänge laufen über die Task-Queue, um den WPF STA-Thread niemals zu blockieren.</li>
    <li><strong>Datenbank-Migrationen</strong>: Die SQLite-Datei wird unter <code>AppDomain.CurrentDomain.BaseDirectory</code> abgelegt.</li>
  </ul>
  <p>Beste Grüße,<br/><strong>Dr. Andreas Müller</strong><br/>Director of Engineering</p>
</div>`,
        isRead: false,
        isFlagged: false,
        isPinned: true,
        isFavorite: true,
        hasAttachment: true,
        importance: 'normal',
        category: 'Architektur',
        folder: 'inbox',
        accountEmail: email
      },
      {
        id: `msg-welcome-${Date.now()}-3`,
        sender: 'Sabine Hoffmann',
        senderEmail: 's.hoffmann@product.local',
        subject: `Offline-Modus & lokaler SQLite Cache für ${email}`,
        date: new Date(Date.now() - 7200000).toISOString(),
        preview: `Hallo, das Offline-Feature ist nun auch für Ihre Mailadresse einsatzbereit. Wenn Sie die...`,
        body: `Hallo zusammen,

das universelle Offline-Feature steht nun auch vollumfänglich für Ihr neues Postfach ${email} zur Verfügung!

Wenn Sie offline arbeiten (deaktivierbar rechts unten in der Statusleiste oder oben im Menü "Offline arbeiten"), greift Unique Mail unbemerkt auf die interne SQLite cache-Schicht zurück. Sie können alle E-Mails lesen, kategorisieren und sogar auf Entwürfe antworten. Sobald eine Internetverbindung wiederhergestellt wird, werden alle Aktionen im Hintergrund synchronisiert.

Für die Synchronisation wird der C# \`SyncEngineService\` verwendet, der im Dev-Menü im Detail eingesehen werden kann.

Mit freundlichen Grüßen,
Sabine Hoffmann
Product Management`,
        isRead: true,
        isFlagged: false,
        hasAttachment: false,
        importance: 'normal',
        category: 'Synchronisation',
        folder: 'inbox',
        accountEmail: email
      },
      {
        id: `msg-welcome-${Date.now()}-4`,
        sender: 'WPF Frontend Engine',
        senderEmail: 'wpf-engine@unique-mail.de',
        subject: `Optimierung für XAML DataTemplates für ${email}`,
        date: new Date(Date.now() - 14400000).toISOString(),
        preview: `Entwickler-Info: Die Benutzeroberfläche nutzt hochoptimierte DataTemplates für reibungsloses Scrollen...`,
        body: `Hallo Entwickler,

dies ist ein kurzer Statusbericht für ihr neu eingebundenes Postfach ${email} zur Leistung des WPF UserInterface Renderings.

Um ein absolut flüssiges Scrollen selbst in Postfächern mit über 100.000 Elementen zu garantieren, wurde ein \`VirtualizingStackPanel\` und asynchrones Bild-Laden implementiert. Die XAML Bindings werden komplett über ein bereinigtes \`InboxViewModel\` gebunden, welches das \`INotifyPropertyChanged\`-Muster nutzt.

Sollten Sie Fragen zum Design-System oder dem reaktiven Code haben, werfen Sie einen Blick in die Suite im Entwickler-Tab.

Beste Grüße,
WPF UI Core Team`,
        isRead: true,
        isFlagged: false,
        hasAttachment: false,
        importance: 'normal',
        category: 'Design-System',
        folder: 'inbox',
        accountEmail: email
      }
    ];
  };

  const triggerInstallerDownload = () => {
    const currentUrl = window.location.href;
    const scriptContent = `@echo off
chcp 65001 >nul
title Unique Mail Setup & Live Compiler (.NET 8 C# & WPF)
color 0B
cls
echo =======================================================================
echo     UNIQUE MAIL - DESKTOP INSTALLER & SETUP DIALOG (.NET 8 / C#)
echo =======================================================================
echo Willkommen beim schlüsselfertigen Setup & Live-Compiler für Unique Mail.
echo.
echo Bitte wählen Sie die gewünschte Installationsmethode:
echo.
echo [1] Standalone Desktop Web-Client (Schnellstart Windows App-Mode)
echo     Erstellt eine autarke, rahmenlose Desktop-App auf Ihrem Desktop.
echo     (Kein .NET-SDK nötig)
echo.
echo [2] Native C# WPF Desktop-App kompilieren (.NET 8 Windows Client)
echo     Erzeugt den vollständigen Visual Studio C# Quellcode lokal,
echo     bindet SQLite & MailKit ein und kompiliert die native executable (.EXE).
echo.
echo [3] Plattformübergreifende C# Console App / Background Daemon (.NET Core)
echo     Erstellt ein robustes, backend-taugliches C# / .NET 8 Konsolenprojekt
echo     mit SQLite Offline-Cache, MailKit IMAP Synchronisation und logger.
echo.
set /p opt="Auswahl der Installationsvariante (1-3): "

if "%opt%"=="1" goto webclient
if "%opt%"=="2" goto nativewpf
if "%opt%"=="3" goto nativeconsole
goto invalid

:webclient
echo.
echo Richte Standalone-Verzeichnis unter AppData ein...
set "APP_DIR=%APPDATA%\\UniqueMail"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"

set "LNK_PATH=%USERPROFILE%\\Desktop\\Unique Mail.lnk"
set "TARGET_URL=${currentUrl}"

echo Erstelle Verknüpfung auf Ihrem Desktop...
echo set WshShell = WScript.CreateObject("WScript.Shell") > "%APP_DIR%\\shortcut.vbs"
echo set oShellLink = WshShell.CreateShortcut("%LNK_PATH%") >> "%APP_DIR%\\shortcut.vbs"
echo oShellLink.TargetPath = "msedge.exe" >> "%APP_DIR%\\shortcut.vbs"
echo oShellLink.Arguments = "--app=%TARGET_URL%" >> "%APP_DIR%\\shortcut.vbs"
echo oShellLink.WindowStyle = 1 >> "%APP_DIR%\\shortcut.vbs"
echo oShellLink.IconLocation = "imageres.dll,220" >> "%APP_DIR%\\shortcut.vbs"
echo oShellLink.Description = "Unique Mail Standalone Client" >> "%APP_DIR%\\shortcut.vbs"
echo oShellLink.Save >> "%APP_DIR%\\shortcut.vbs"
cscript //nologo "%APP_DIR%\\shortcut.vbs"
del "%APP_DIR%\\shortcut.vbs"

echo.
echo =======================================================================
echo [ERFOLG] Die Standalone-Desktop-App "Unique Mail" wurde installiert!
echo.
echo Auf Ihrem Desktop befindet sich nun eine neue Verknüpfung: "Unique Mail".
echo per Doppelklick startet das System im rahmenlosen Windows-App-Modus.
echo =======================================================================
pause
exit

:nativewpf
echo.
echo Prüfe .NET Core SDK Voraussetzungen auf Ihrem PC...
dotnet --version >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [FEHLER] .NET Core 8 SDK wurde nicht gefunden!
    echo Um den Code lokal kompilieren zu können, installieren Sie bitte das .NET 8 SDK von:
    echo https://dotnet.microsoft.com/download/dotnet/8.0
    echo Starten Sie anschließend dieses Setup-Skript erneut.
    echo.
    pause
    exit
)
echo .NET SDK wurde erkannt.

echo.
echo Erzeuge Projektstruktur unter 'Desktop\\UniqueMail_Project'...
set "PROJ_DIR=%USERPROFILE%\\Desktop\\UniqueMail_Project"
if not exist "%PROJ_DIR%" mkdir "%PROJ_DIR%"
cd "%PROJ_DIR%"

echo [1/5] Erzeuge leeres WPF-Projekt...
dotnet new wpf -n UniqueMail --force
cd UniqueMail

echo [2/5] Binde NuGet-Pakete ein (SQLite & MailKit)...
dotnet add package Microsoft.Data.Sqlite
dotnet add package MailKit

echo [3/5] Schreibe C# Quellcodedefinitionen...

(
echo using System;
echo using System.Windows;
echo using System.Collections.Generic;
echo using Microsoft.Data.Sqlite;
echo using MailKit.Net.Imap;
echo using MailKit;
echo.
echo namespace UniqueMail
echo {
echo     public partial class MainWindow : Window
echo     {
echo         public MainWindow^(^)
echo         {
echo             InitializeComponent^(^);
echo             this.Loaded += MainWindow_Loaded;
echo         }
echo.
echo         private void MainWindow_Loaded^(object sender, RoutedEventArgs e^)
echo         {
echo             MessageBox.Show^("WPF Frontend initiiert. SQLite Offline-Cache wird bereitgestellt...", "Unique Mail Bootstrapper", MessageBoxButton.OK, MessageBoxImage.Information^);
echo         }
echo     }
echo }
) > MainWindow.xaml.cs

(
echo ^^^<Window x:Class="UniqueMail.MainWindow"
echo         xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
echo         xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
echo         Title="Unique Mail Client (Native WPF)" Height="550" Width="900"
echo         WindowStartupLocation="CenterScreen" Background="#F3F2F1"^^^>
echo     ^^^|Grid^^^|
echo         ^^^|Grid.RowDefinitions^^^|
echo             ^^^|RowDefinition Height="Auto"/^^^|
echo             ^^^|RowDefinition Height="*"/^^^|
echo             ^^^|RowDefinition Height="25"/^^^|
echo         ^^^|/Grid.RowDefinitions^^^|
echo.
echo         ^^^|!-- Unified Ribbon Bar --^^^|
echo         ^^^|Border Grid.Row="0" Height="60" Background="#F3F2F1" BorderBrush="#EDEBE9" BorderThickness="0,0,0,1"^^^|
echo             ^^^|StackPanel Orientation="Horizontal" VerticalAlignment="Center" Margin="10,0"^^^|
echo                 ^^^|Button Content="Neu verfassen" Width="100" Height="30" Margin="5" Background="#0078D4" Foreground="White" BorderThickness="0" FontWeight="Bold"/^^^|
echo                 ^^^|Button Content="Synchronisieren" Width="100" Height="30" Margin="5" Background="White" BorderBrush="#D2D0CE" FontWeight="SemiBold"/^^^|
echo                 ^^^|Button Content="Löschen" Width="80" Height="30" Margin="5" Background="White" BorderBrush="#D2D0CE" Foreground="#C8102E" FontWeight="SemiBold"/^^^|
echo             ^^^|/StackPanel^^^|
echo         ^^^|/Border^^^|
echo.
echo         ^^^|!-- App Split view --^^^|
echo         ^^^|Grid Grid.Row="1"^^^|
echo             ^^^|Grid.ColumnDefinitions^^^|
echo                 ^^^|ColumnDefinition Width="220"/^^^|
echo                 ^^^|ColumnDefinition Width="300"/^^^|
echo                 ^^^|ColumnDefinition Width="*" /^^^|
echo             ^^^|/Grid.ColumnDefinitions^^^|
echo.
echo             ^^^|!-- Folder Navigation --^^^|
echo             ^^^|Border Grid.Column="0" Background="#F3F2F1" BorderBrush="#D2D0CE" BorderThickness="0,0,1,0"^^^|
echo                 ^^^|StackPanel Margin="10"^^^|
echo                     ^^^|TextBlock Text="POSTFÄCHER" FontWeight="Bold" Foreground="#323130" FontSize="11" Margin="5,0,0,10"/^^^|
echo                     ^^^|TextBlock Text="Posteingang (4)" FontWeight="Bold" Foreground="#0078D4" Padding="5"/^^^|
echo                     ^^^|TextBlock Text="Gesendete Elemente" Foreground="#323130" Padding="5"/^^^|
echo                     ^^^|TextBlock Text="Gelöschte Elemente" Foreground="#323130" Padding="5"/^^^|
echo                     ^^^|TextBlock Text="Archiv" Foreground="#323130" Padding="5"/^^^|
echo                 ^^^|/StackPanel^^^|
echo             ^^^|/Border^^^|
echo.
echo             ^^^|!-- Item list pane --^^^|
echo             ^^^|Border Grid.Column="1" Background="White" BorderBrush="#D2D0CE" BorderThickness="0,0,1,0"^^^|
echo                 ^^^|StackPanel Margin="10"^^^|
echo                     ^^^|TextBlock Text="E-Mails" FontWeight="Bold" FontSize="13" Margin="0,0,0,10"/^^^|
echo                     ^^^|ListBox Height="400" BorderThickness="0"^^^|
echo                         ^^^|ListBoxItem Selected="True" BorderThickness="0,0,0,1" BorderBrush="#F3F2F1" Padding="10"^^^|
echo                             ^^^|StackPanel^^^|
echo                                 ^^^|TextBlock Text="Dr. Andreas Müller" FontWeight="Bold"/^^^|
echo                                 ^^^|TextBlock Text="WPF ^& MVVM: Sync abgeschlossen" FontSize="11" Foreground="#605E5C"/^^^|
echo                             ^^^|/StackPanel^^^|
echo                         ^^^|/ListBoxItem^^^|
echo                     ^^^|/ListBox^^^|
echo                 ^^^|/StackPanel^^^|
echo             ^^^|/Border^^^|
echo.
echo             ^^^|!-- Reading pane --^^^|
echo             ^^^|ScrollViewer Grid.Column="2" Padding="20" Background="White"^^^|
echo                 ^^^|StackPanel^^^|
echo                     ^^^|TextBlock Text="WPF ^& MVVM: Sync abgeschlossen" FontSize="18" FontWeight="Bold" Margin="0,0,0,10"/^^^|
echo                     ^^^|TextBlock Text="Von: Dr. Andreas Müller <andreas@dev-core.local>" FontSize="11" Foreground="#605E5C"/^^^|
echo                     ^^^|TextBlock Text="Datum: Heute" FontSize="11" Foreground="#605E5C" Margin="0,0,0,20"/^^^|
echo                     ^^^|TextBlock TextWrapping="Wrap" LineHeight="18" Text="Hallo! Die Verbindung für das Postfach wurde erfolgreich über die Client-Verschlüsselung TLS 1.3 etabliert. Die SQLite-Datenbank wurde initialisiert und enthält alle Cache-Dateien."/^^^|
echo                 ^^^|/StackPanel^^^|
echo             ^^^|/ScrollViewer^^^|
echo         ^^^|/Grid^^^|
echo.
echo         ^^^|!-- Status bar --^^^|
echo         ^^^|StatusBar Grid.Row="2" Background="#0078D4" Foreground="White" FontSize="11"^^^|
echo             ^^^|StatusBarItem Content="Verfasser-Modus: AKTIV"/^^^|
echo             ^^^|Separator Background="#106EBE"/^^^|
echo             ^^^|StatusBarItem Content="Datenbank: SQLite connected"/^^^|
echo         ^^^|/StatusBar^^^|
echo     ^^^|/Grid^^^|
echo ^^^</Window^^^>
) > MainWindow.xaml

powershell -Command "(cmd /c 'type MainWindow.xaml') -replace '\\^\\^\\^|', '<' -replace '\\^\\^\\^/', '</' -replace '\\^\\^\\^', '>' -replace '\\^\\|', '<' -replace '\\^/', '</' -replace '\\^', '>' | Out-File -Encoding utf8 MainWindow.xaml"

echo [4/5] Bereite Standalone-Veröffentlichung vor...
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

echo [5/5] Erstelle Desktop-Verknüpfung...
set "EXE_PATH=%PROJ_DIR%\\\\UniqueMail\\\\UniqueMail\\\\bin\\\\Release\\\\net8.0-windows\\\\win-x64\\\\publish\\\\UniqueMail.exe"
set "LNK_PATH=%USERPROFILE%\\\\Desktop\\\\Unique Mail Native.lnk"

echo set WshShell = WScript.CreateObject("WScript.Shell") > "%PROJ_DIR%\\\\shortcut.vbs"
echo set oShellLink = WshShell.CreateShortcut("%LNK_PATH%") >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.TargetPath = "%EXE_PATH%" >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.WindowStyle = 1 >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.IconLocation = "%EXE_PATH%,0" >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.Description = "Unique Mail Native Client" >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.Save >> "%PROJ_DIR%\\\\shortcut.vbs"
cscript //nologo "%PROJ_DIR%\\\\shortcut.vbs"
del "%PROJ_DIR%\\\\shortcut.vbs"

echo.
echo =======================================================================
echo [ERFOLG] Die native C# WPF-Anwendung wurde erfolgreich kompoliert!
echo.
echo Speicherort des Projekts: %PROJ_DIR%\\\\UniqueMail
echo Speicherort der .EXE-Datei: %EXE_PATH%
echo.
echo Auf Ihrem Desktop befindet sich nun ein Shortcut "Unique Mail Native".
echo Doppelklicken Sie darauf, um die native Windows-App zu starten!
echo =======================================================================
pause
exit

:nativeconsole
echo.
echo Prüfe .NET Core SDK Voraussetzungen auf Ihrem PC...
dotnet --version >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [FEHLER] .NET Core 8 SDK wurde nicht gefunden!
    echo Um den C# Code kompilieren zu können, installieren Sie bitte das .NET 8 SDK von:
    echo https://dotnet.microsoft.com/download/dotnet/8.0
    echo Starten Sie anschließend dieses Setup-Skript erneut.
    echo.
    pause
    exit
)
echo .NET SDK wurde erkannt.

echo.
echo Erzeuge C#-Projektstruktur unter 'Desktop\\UniqueMail_Daemon'...
set "PROJ_DIR=%USERPROFILE%\\Desktop\\UniqueMail_Daemon"
if not exist "%PROJ_DIR%" mkdir "%PROJ_DIR%"
cd "%PROJ_DIR%"

echo [1/5] Erzeuge C# .NET 8 Konsolen-Engine...
dotnet new console -n UniqueMailDaemon --force
cd UniqueMailDaemon

echo [2/5] Binde NuGet-Pakete ein (SQLite & MailKit)...
dotnet add package Microsoft.Data.Sqlite
dotnet add package MailKit

echo [3/5] Schreibe C# Daemon Quellcode...

(
echo using System;
echo using Microsoft.Data.Sqlite;
echo using MailKit.Net.Imap;
echo using System.Threading.Tasks;
echo.
echo namespace UniqueMailDaemon
echo {
echo     class Program
echo     {
echo         static async Task Main^(string[] args^)
echo         {
echo             Console.ForegroundColor = ConsoleColor.Cyan;
echo             Console.WriteLine^("================================================="^);
echo             Console.WriteLine^("    UNIQUE MAIL - PLATTFORMUEBERGREIFENDER DAEMON "^);
echo             Console.WriteLine^("================================================="^);
echo             Console.ResetColor^(^);
echo.
echo             Console.WriteLine^("Lese lokale SQLite Konfiguration..."^);
echo             try
echo             {
echo                 using ^(var conn = new SqliteConnection^("Data Source=uniquemail_daemon_cache.db"^)^)
echo                 {
echo                     conn.Open^(^);
echo                     using ^(var cmd = conn.CreateCommand^(^)^)
echo                     {
echo                         cmd.CommandText = "CREATE TABLE IF NOT EXISTS MailCache (MailId TEXT PRIMARY KEY, Subject TEXT, FromAddr TEXT, Body TEXT);";
echo                         cmd.ExecuteNonQuery^(^);
echo                     }
echo                 }
echo                 Console.WriteLine^("[SQLite OK] C# / .NET Datenbank-Cache erfolgreich initialisiert!"^);
echo             }
echo             catch ^(Exception ex^)
echo             {
echo                 Console.WriteLine^("[SQLite Hinweis] SQLite läuft mit lokalem Cache-Buffer: " + ex.Message^);
echo             }
echo.
echo             Console.ForegroundColor = ConsoleColor.Green;
echo             Console.WriteLine^("[Auto-Sync] IMAP ^& SMTP Service gestoppt: Bereit fuer regelmaessige Abfragen..."^);
echo             Console.WriteLine^("Core .NET Mail-Client laeuft auf Betriebssystem: " + Environment.OSVersion.ToString^(^)^);
echo             Console.ResetColor^(^);
echo             Console.WriteLine^("Daemon ist gestartet. Druecke eine beliebige Taste zum Beenden."^);
echo             Console.ReadKey^(^);
echo         }
echo     }
echo }
) > Program.cs

echo [4/5] Kompiliere standfeste .NET 8 Release Single-File Binary...
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

echo [5/5] Erstelle Verknüpfung auf Ihrem Desktop...
set "EXE_PATH=%PROJ_DIR%\\\\UniqueMailDaemon\\\\UniqueMailDaemon\\\\bin\\\\Release\\\\net8.0\\\\win-x64\\\\publish\\\\UniqueMailDaemon.exe"
set "LNK_PATH=%USERPROFILE%\\\\Desktop\\\\Unique Mail Daemon.lnk"

echo set WshShell = WScript.CreateObject("WScript.Shell") > "%PROJ_DIR%\\\\shortcut.vbs"
echo set oShellLink = WshShell.CreateShortcut("%LNK_PATH%") >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.TargetPath = "%EXE_PATH%" >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.WindowStyle = 1 >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.IconLocation = "%EXE_PATH%,0" >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.Description = "Unique Mail Background Daemon" >> "%PROJ_DIR%\\\\shortcut.vbs"
echo oShellLink.Save >> "%PROJ_DIR%\\\\shortcut.vbs"
cscript //nologo "%PROJ_DIR%\\\\shortcut.vbs"
del "%PROJ_DIR%\\\\shortcut.vbs"

echo.
echo =======================================================================
echo [ERFOLG] Die plattformübergreifende C# .NET 8 App wurde kompiliert!
echo.
echo Speicherort des Projekts: %PROJ_DIR%\\\\UniqueMailDaemon
echo Speicherort der .EXE-Datei: %EXE_PATH%
echo.
echo Auf Ihrem Desktop befindet sich nun ein Shortcut "Unique Mail Daemon".
echo =======================================================================
pause
exit

:invalid
echo Ungültige Auswahl. Programm wird beendet.
pause
exit`;

    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'setup_uniquemail.cmd';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Security gate for WPF Suite
  const [isWpfUnlocked, setIsWpfUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('outlook_wpf_unlocked') === 'true';
  });
  const [showPwdModal, setShowPwdModal] = useState<boolean>(false);
  const [pwdValue, setPwdValue] = useState<string>('');
  const [pwdError, setPwdError] = useState<string>('');

  // Categories list
  const [categoriesList, setCategoriesList] = useState<Category[]>(() => {
    return readJsonStorage<Category[]>('outlook_categories', [
      { name: 'Architektur', color: '#1d4ed8' },
      { name: 'Synchronisation', color: '#047857' },
      { name: 'Design-System', color: '#6d28d9' },
      { name: 'WPF Frontend', color: '#c2410c' },
      { name: 'Performance', color: '#b91c1c' },
      { name: 'Allgemein', color: '#4b5563' }
    ]);
  });

  const [showCategoriesModal, setShowCategoriesModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatColor, setNewCatColor] = useState<string>('#4b5563');
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editCatTitle, setEditCatTitle] = useState<string>('');
  const [editCatColor, setEditCatColor] = useState<string>('#4b5563');

  // Save categories
  useEffect(() => {
    localStorage.setItem('outlook_categories', JSON.stringify(categoriesList));
  }, [categoriesList]);

  const handleDeleteCategoryGlobal = (name: string) => {
    if (categoriesList.length <= 1) {
      alert("Es muss mindestens eine Kategorie vorhanden sein.");
      return;
    }
    if (confirm(`Möchten Sie die Kategorie "${name}" wirklich löschen?`)) {
      setCategoriesList(prev => prev.filter(c => c.name !== name));
    }
  };

  // Spacing & options states
  const [isDense, setIsDense] = useState<boolean>(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState<boolean>(false);
  const [optionsActiveTab, setOptionsActiveTab] = useState<'general' | 'language' | 'accounts' | 'security' | 'ai' | 'help' | 'vacation' | 'signature'>('general');
  const [autoMarkAsReadOnOpen, setAutoMarkAsReadOnOpen] = useState<boolean>(() => localStorage.getItem('uniquemail_auto_mark_read_on_open') !== 'false');
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => localStorage.getItem('uniquemail_ui_language') === 'en' ? 'en' : 'de');
  const [mailDateFormat, setMailDateFormat] = useState<string>(() => localStorage.getItem('uniquemail_mail_date_format') || DEFAULT_MAIL_DATE_FORMAT);
  const [attachmentDownloadDirectory, setAttachmentDownloadDirectory] = useState<string>(() => localStorage.getItem('uniquemail_attachment_download_directory') || '');
  const isEnglish = uiLanguage === 'en';

  const readSenderList = (storageKey: string) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  };

  const normalizeSenderAddress = (value?: string) => (value || '').trim().toLowerCase();
  const uniqueSenderList = (entries: string[]) => Array.from(new Set(entries.map(normalizeSenderAddress).filter(Boolean)));

  const [imageDownloadAllowList, setImageDownloadAllowList] = useState<string[]>(() => readSenderList('uniquemail_image_allow_senders'));
  const [imageDownloadDenyList, setImageDownloadDenyList] = useState<string[]>(() => readSenderList('uniquemail_image_deny_senders'));
  const [blockedSenderList, setBlockedSenderList] = useState<string[]>(() => readSenderList('uniquemail_blocked_senders'));
  const [appLockConfig, setAppLockConfig] = useState<AppLockConfig | null>(() => readStoredAppLockConfig());
  const [isAppUnlocked, setIsAppUnlocked] = useState<boolean>(() => !readStoredAppLockConfig());
  const [appUnlockPassword, setAppUnlockPassword] = useState<string>('');
  const [appUnlockError, setAppUnlockError] = useState<string>('');
  const [appLockCurrentPassword, setAppLockCurrentPassword] = useState<string>('');
  const [appLockNewPassword, setAppLockNewPassword] = useState<string>('');
  const [appLockConfirmPassword, setAppLockConfirmPassword] = useState<string>('');
  const [appLockStatus, setAppLockStatus] = useState<string>('');
  const securitySettingsImportInputRef = React.useRef<HTMLInputElement>(null);
  const [settingsBackupPassword, setSettingsBackupPassword] = useState<string>('');
  const [settingsBackupPasswordConfirm, setSettingsBackupPasswordConfirm] = useState<string>('');

  const isSenderBlockedAddress = (sender?: string) => blockedSenderList.some(entry => normalizeSenderAddress(entry) === normalizeSenderAddress(sender));
  const guardBlockedSenderMail = (mail: Email): Email => isSenderBlockedAddress(mail.senderEmail)
    ? { ...mail, folder: 'junk', imapFolder: 'junk' }
    : mail;

  const addSenderToList = (sender: string | undefined, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const normalized = normalizeSenderAddress(sender);
    if (!normalized) return;
    setter(prev => uniqueSenderList([...prev, normalized]));
  };

  const allowImagesForSender = (sender: string) => {
    const normalized = normalizeSenderAddress(sender);
    if (!normalized) return;
    setImageDownloadAllowList(prev => uniqueSenderList([...prev, normalized]));
    setImageDownloadDenyList(prev => prev.filter(entry => normalizeSenderAddress(entry) !== normalized));
  };

  const denyImagesForSender = (sender: string) => {
    const normalized = normalizeSenderAddress(sender);
    if (!normalized) return;
    setImageDownloadDenyList(prev => uniqueSenderList([...prev, normalized]));
    setImageDownloadAllowList(prev => prev.filter(entry => normalizeSenderAddress(entry) !== normalized));
  };


  const handleUnlockApp = async () => {
    if (!appLockConfig?.enabled) {
      setIsAppUnlocked(true);
      return;
    }
    const password = appUnlockPassword.trim();
    const hash = await hashAppLockPassword(password, appLockConfig.salt);
    if (hash === appLockConfig.hash) {
      setIsAppUnlocked(true);
      setAppUnlockPassword('');
      setAppUnlockError('');
    } else {
      setAppUnlockError('Falsches App-Passwort.');
    }
  };

  const handleSaveAppLockPassword = async () => {
    setAppLockStatus('');
    const nextPassword = appLockNewPassword.trim();
    const confirmPassword = appLockConfirmPassword.trim();
    if (!isValidAppLockPassword(nextPassword)) {
      setAppLockStatus('Das App-Passwort muss mindestens 4 Zeichen lang sein und darf nur Buchstaben oder Zahlen enthalten.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      setAppLockStatus('Die neue Passwort-Wiederholung stimmt nicht überein.');
      return;
    }
    if (appLockConfig?.enabled) {
      const currentHash = await hashAppLockPassword(appLockCurrentPassword.trim(), appLockConfig.salt);
      if (currentHash !== appLockConfig.hash) {
        setAppLockStatus('Das aktuelle App-Passwort ist falsch.');
        return;
      }
    }
    const salt = createAppLockSalt();
    const hash = await hashAppLockPassword(nextPassword, salt);
    setAppLockConfig({ enabled: true, salt, hash, updatedAt: new Date().toISOString() });
    setIsAppUnlocked(true);
    setAppLockCurrentPassword('');
    setAppLockNewPassword('');
    setAppLockConfirmPassword('');
    setAppLockStatus('App-Passwort wurde gespeichert. Beim nächsten Start wird es abgefragt.');
  };

  const handleRemoveAppLockPassword = async () => {
    if (!appLockConfig?.enabled) return;
    const currentHash = await hashAppLockPassword(appLockCurrentPassword.trim(), appLockConfig.salt);
    if (currentHash !== appLockConfig.hash) {
      setAppLockStatus('Zum Entfernen bitte zuerst das aktuelle App-Passwort korrekt eingeben.');
      return;
    }
    setAppLockConfig(null);
    setAppLockCurrentPassword('');
    setAppLockNewPassword('');
    setAppLockConfirmPassword('');
    setAppLockStatus('App-Passwort wurde entfernt.');
  };

  const extractSenderAddress = (mail: Partial<Email>) => {
    const explicit = normalizeSenderAddress(mail.senderEmail);
    if (explicit) return explicit;
    const senderText = String(mail.sender || '');
    const match = senderText.match(/<([^>]+@[^>]+)>/) || senderText.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    return normalizeSenderAddress(match?.[1] || match?.[0] || senderText);
  };

  const blockSender = (sender: string) => {
    const normalized = normalizeSenderAddress(sender);
    if (!normalized) return;
    setBlockedSenderList(prev => uniqueSenderList([...prev, normalized]));
    setImageDownloadDenyList(prev => uniqueSenderList([...prev, normalized]));
    const ids = emails.filter(mail => extractSenderAddress(mail) === normalized).map(mail => mail.id);
    if (ids.length > 0) {
      moveEmailsToFolder(ids, 'junk');
      setSyncStatusText(`Absender ${normalized} wurde gesperrt. ${ids.length} vorhandene E-Mail(s) wurden nach Spam/Junk verschoben.`);
    } else {
      setSyncStatusText('Absender wurde gesperrt. Neue Nachrichten dieses Absenders werden nach Spam verschoben.');
    }
  };

  const normalizeImportedSenderList = (value: unknown) => Array.isArray(value)
    ? uniqueSenderList(value.filter((item): item is string => typeof item === 'string'))
    : [];

  const readLocalStorageJson = (storageKey: string, fallback: any = []) => {
    try {
      const value = localStorage.getItem(storageKey);
      if (!value) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const sanitizeExportedAccounts = (items: any[]) => Array.isArray(items)
    ? items
        .filter(item => item && typeof item.email === 'string')
        .map(({ password, pass, accessToken, refreshToken, sessionPassword, ...account }) => account)
    : [];

  const makeMailPreferenceKey = (mail: Partial<Email>) => [
    mail.accountEmail || '',
    mail.imapFolder || mail.folder || '',
    mail.imapUid || '',
    mail.imapUidValidity || ''
  ].join('|').toLowerCase();

  const sanitizeMailPreferences = (items: Email[]) => Array.isArray(items)
    ? items
        .filter(mail => mail && (mail.id || mail.imapUid || mail.senderEmail))
        .map(mail => ({
          id: mail.id,
          accountEmail: mail.accountEmail || '',
          imapFolder: mail.imapFolder || mail.folder || '',
          imapUid: mail.imapUid,
          imapUidValidity: mail.imapUidValidity,
          senderEmail: mail.senderEmail,
          subject: mail.subject,
          date: mail.date,
          folder: mail.folder,
          isPinned: !!mail.isPinned,
          isFavorite: !!mail.isFavorite,
          isFlagged: !!mail.isFlagged,
          isFlagCompleted: !!mail.isFlagCompleted,
          category: mail.category || '',
          reminderDate: mail.reminderDate || '',
          reminderNote: mail.reminderNote || ''
        }))
    : [];

  const normalizeImportedArray = (value: unknown) => Array.isArray(value) ? value : [];

  const normalizeImportedAccounts = (value: unknown) => Array.isArray(value)
    ? value
        .filter((item: any) => item && typeof item.email === 'string')
        .map((item: any) => ({
          email: String(item.email || '').trim(),
          imapServer: String(item.imapServer || ''),
          imapPort: Number(item.imapPort) || 993,
          smtpServer: String(item.smtpServer || ''),
          smtpPort: Number(item.smtpPort) || 465,
          provider: String(item.provider || 'Importiertes Konto'),
          displayName: String(item.displayName || item.senderName || item.name || ''),
          senderName: String(item.senderName || item.displayName || item.name || ''),
          name: String(item.name || item.displayName || item.senderName || ''),
          username: String(item.username || item.email || '').trim(),
          imapSecurity: String(item.imapSecurity || 'ssl'),
          smtpSecurity: String(item.smtpSecurity || 'ssl'),
          folderMappings: item.folderMappings && typeof item.folderMappings === 'object' && !Array.isArray(item.folderMappings) ? item.folderMappings : {},
          customFolders: Array.isArray(item.customFolders) ? item.customFolders : [],
          serverFolders: Array.isArray(item.serverFolders) ? item.serverFolders : []
        }))
        .filter((item: any) => item.email && item.imapServer && item.smtpServer)
    : [];

  const handleExportSecuritySettings = async () => {
    const includeAccountPasswords = settingsBackupPassword.length > 0 || settingsBackupPasswordConfirm.length > 0;
    if (includeAccountPasswords && settingsBackupPassword.length < 4) {
      alert('Das optionale Backup-Passwort muss mindestens 4 Zeichen lang sein. Lassen Sie beide Felder leer, wenn keine Kontopasswörter exportiert werden sollen.');
      return;
    }
    if (includeAccountPasswords && settingsBackupPassword !== settingsBackupPasswordConfirm) {
      alert('Die beiden Backup-Passwörter stimmen nicht überein.');
      return;
    }
    const nativeApi = (window as any).uniqueMailNative;
    const exportedAccountPasswords = includeAccountPasswords
      ? await nativeApi?.exportAccountPasswords?.({ backupPassword: settingsBackupPassword }).catch((error: any) => ({ ok: false, error: error?.message || String(error) }))
      : null;
    if (includeAccountPasswords && !exportedAccountPasswords?.ok) {
      alert('Export fehlgeschlagen: ' + (exportedAccountPasswords?.error || 'Kontopasswörter konnten nicht gesichert werden.'));
      return;
    }
    const payload = {
      app: 'Unique Mail',
      schema: 'unique-mail.settings.v6',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: {
        general: {
          autoMarkAsReadOnOpen,
          isDarkMode,
          isDense,
          mailDateFormat,
          attachmentDownloadDirectory,
          contactSortLabels
        },
        accounts: sanitizeExportedAccounts(accounts),
        activeAccountEmail,
        security: {
          imageDownloadAllowList: uniqueSenderList(imageDownloadAllowList),
          imageDownloadDenyList: uniqueSenderList(imageDownloadDenyList),
          blockedSenderList: uniqueSenderList(blockedSenderList),
          appLock: appLockConfig,
          accountPasswordsIncluded: includeAccountPasswords,
          ...(exportedAccountPasswords ? { accountPasswords: exportedAccountPasswords } : {})
        },
        signatures: {
          signatureActive,
          signatureText,
          accountSignatures
        },
        vacation: {
          vacationActive,
          vacationStart,
          vacationEnd,
          vacationMessage
        },
        workspace: {
          notes,
          tasks,
          calendarItems: calendarItems.filter(item => !isSandboxCalendarItem(item)),
          categoriesList,
          folderFavorites: normalizeImportedArray(readLocalStorageJson('uniquemail_folder_favorites', [])),
          quickSteps,
          mailPreferences: sanitizeMailPreferences(emails)
        }
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'unique-mail-komplett-einstellungen-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 250);
    setSyncStatusText(includeAccountPasswords
      ? 'Einstellungen und verschlüsselte Kontopasswörter wurden exportiert.'
      : 'Einstellungen wurden ohne Kontopasswörter exportiert.');
  };

  const handleImportSecuritySettingsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const settings = parsed?.settings || parsed;
      const security = settings?.security || settings;
      const allow = normalizeImportedSenderList(security?.imageDownloadAllowList ?? security?.allow ?? security?.allowedSenders);
      const deny = normalizeImportedSenderList(security?.imageDownloadDenyList ?? security?.deny ?? security?.deniedSenders);
      const blocked = normalizeImportedSenderList(security?.blockedSenderList ?? security?.blocked ?? security?.blockedSenders);
      setImageDownloadAllowList(allow);
      setImageDownloadDenyList(uniqueSenderList([...deny, ...blocked]));
      setBlockedSenderList(blocked);
      const importedAppLock = security?.appLock;
      if (importedAppLock?.enabled && typeof importedAppLock.salt === 'string' && typeof importedAppLock.hash === 'string') {
        setAppLockConfig({ enabled: true, salt: importedAppLock.salt, hash: importedAppLock.hash, updatedAt: importedAppLock.updatedAt });
        setIsAppUnlocked(true);
      } else if (security && Object.prototype.hasOwnProperty.call(security, 'appLock') && !importedAppLock) {
        setAppLockConfig(null);
      }

      const nativeApi = (window as any).uniqueMailNative;
      const importedPasswordBackup = settings?.security?.accountPasswords;
      const importedPasswordCountIsDeclared = Object.prototype.hasOwnProperty.call(importedPasswordBackup || {}, 'accountCount');
      const importedPasswordCount = Number(importedPasswordBackup?.accountCount) || 0;
      const importedPasswordBackupIsEmpty = importedPasswordBackup?.format === 'unique-mail-credentials-omitted-v1'
        || (importedPasswordCountIsDeclared && importedPasswordCount === 0);
      const importContainsPortablePasswords = importedPasswordBackup?.format === 'unique-mail-portable-credentials-v1'
        && !importedPasswordBackupIsEmpty;
      if (importedPasswordBackup && !importedPasswordBackupIsEmpty) {
        if (importContainsPortablePasswords && settingsBackupPassword.length < 4) {
          throw new Error('Bitte vor dem Import das beim Export verwendete Backup-Passwort eingeben.');
        }
        const passwordImport = await nativeApi?.importAccountPasswords?.({
          backup: importedPasswordBackup,
          backupPassword: settingsBackupPassword
        }).catch((error: any) => ({ ok: false, error: error?.message || String(error) }));
        if (!passwordImport?.ok) {
          throw new Error(passwordImport?.error || 'Kontopasswörter konnten nicht importiert werden.');
        }
      }

      if (Array.isArray(settings?.accounts)) {
        const importedAccounts = normalizeImportedAccounts(settings.accounts);
        setAccounts(importedAccounts);
        const importedActive = typeof settings.activeAccountEmail === 'string' && importedAccounts.some((acc: any) => acc.email.toLowerCase() === settings.activeAccountEmail.toLowerCase())
          ? settings.activeAccountEmail
          : importedAccounts[0]?.email || '';
        setActiveAccountEmail(importedActive);
      }

      if (settings?.general && typeof settings.general.autoMarkAsReadOnOpen === 'boolean') {
        setAutoMarkAsReadOnOpen(settings.general.autoMarkAsReadOnOpen);
      }
      if (settings?.general && typeof settings.general.isDarkMode === 'boolean') {
        setIsDarkMode(settings.general.isDarkMode);
      }
      if (settings?.general && typeof settings.general.isDense === 'boolean') {
        setIsDense(settings.general.isDense);
      }
      if (settings?.general && typeof settings.general.mailDateFormat === 'string') {
        setMailDateFormat(settings.general.mailDateFormat);
      }
      if (settings?.general && typeof settings.general.attachmentDownloadDirectory === 'string') {
        setAttachmentDownloadDirectory(settings.general.attachmentDownloadDirectory);
      }
      if (settings?.general && Array.isArray(settings.general.contactSortLabels)) {
        const importedLabels = settings.general.contactSortLabels.map((item: any) => String(item || '').trim()).filter(Boolean);
        if (importedLabels.length > 0) setContactSortLabels(Array.from(new Set(importedLabels)));
      }

      if (settings?.signatures) {
        if (typeof settings.signatures.signatureActive === 'boolean') setSignatureActive(settings.signatures.signatureActive);
        if (typeof settings.signatures.signatureText === 'string') setSignatureText(settings.signatures.signatureText);
        if (settings.signatures.accountSignatures && typeof settings.signatures.accountSignatures === 'object' && !Array.isArray(settings.signatures.accountSignatures)) {
          setAccountSignatures(settings.signatures.accountSignatures);
        }
      }

      if (settings?.vacation) {
        if (typeof settings.vacation.vacationActive === 'boolean') setVacationActive(settings.vacation.vacationActive);
        if (typeof settings.vacation.vacationStart === 'string') setVacationStart(settings.vacation.vacationStart);
        if (typeof settings.vacation.vacationEnd === 'string') setVacationEnd(settings.vacation.vacationEnd);
        if (typeof settings.vacation.vacationMessage === 'string') setVacationMessage(settings.vacation.vacationMessage);
      }

      if (settings?.workspace) {
        if (Array.isArray(settings.workspace.notes)) setNotes(settings.workspace.notes);
        if (Array.isArray(settings.workspace.tasks)) setTasks(settings.workspace.tasks);
        if (Array.isArray(settings.workspace.calendarItems)) setCalendarItems(settings.workspace.calendarItems.filter((item: any) => !isSandboxCalendarItem(item)));
        if (Array.isArray(settings.workspace.categoriesList)) {
          const importedCategories = settings.workspace.categoriesList.filter((item: any) => item && typeof item.name === 'string' && typeof item.color === 'string');
          if (importedCategories.length > 0) setCategoriesList(importedCategories);
        }
        if (Array.isArray(settings.workspace.quickSteps)) setQuickSteps(settings.workspace.quickSteps);
        if (Array.isArray(settings.workspace.folderFavorites)) {
          localStorage.setItem('uniquemail_folder_favorites', JSON.stringify(settings.workspace.folderFavorites));
          window.dispatchEvent(new CustomEvent('uniquemail-folder-favorites-updated'));
        }
        if (Array.isArray(settings.workspace.mailPreferences)) {
          const byId = new Map<string, any>();
          const byKey = new Map<string, any>();
          settings.workspace.mailPreferences.forEach((pref: any) => {
            if (pref?.id) byId.set(String(pref.id), pref);
            const key = makeMailPreferenceKey(pref || {});
            if (key.replace(/\|/g, '')) byKey.set(key, pref);
          });
          setEmails(prev => prev.map(mail => {
            const pref = byId.get(mail.id) || byKey.get(makeMailPreferenceKey(mail));
            if (!pref) return mail;
            return {
              ...mail,
              isPinned: !!pref.isPinned,
              isFavorite: !!pref.isFavorite,
              isFlagged: typeof pref.isFlagged === 'boolean' ? pref.isFlagged : mail.isFlagged,
              isFlagCompleted: typeof pref.isFlagCompleted === 'boolean' ? pref.isFlagCompleted : mail.isFlagCompleted,
              category: typeof pref.category === 'string' ? pref.category || undefined : mail.category,
              reminderDate: typeof pref.reminderDate === 'string' ? pref.reminderDate : mail.reminderDate,
              reminderNote: typeof pref.reminderNote === 'string' ? pref.reminderNote : mail.reminderNote
            };
          }));
        }
      }

      await new Promise(resolve => window.setTimeout(resolve, 100));
      const storageResult = nativeApi?.persistRendererStorage?.();
      if (storageResult && !storageResult.ok) {
        throw new Error(storageResult.error || 'Importierte Einstellungen konnten nicht dauerhaft gespeichert werden.');
      }
      setSyncStatusText('Einstellungen und lokale Arbeitsdaten wurden importiert und dauerhaft gespeichert.');
      alert('Einstellungen wurden erfolgreich importiert.');
    } catch (error: any) {
      alert('Import fehlgeschlagen: ' + (error?.message || 'Die Datei ist keine gültige Unique-Mail-Einstellungsdatei.'));
    } finally {
      event.target.value = '';
    }
  };
  // Vacation / Abwesenheitsnotiz State (Persistently Stored)
  const [vacationActive, setVacationActive] = useState<boolean>(() => {
    return localStorage.getItem('uniquemail_vacation_active') === 'true';
  });
  const [vacationStart, setVacationStart] = useState<string>(() => {
    return localStorage.getItem('uniquemail_vacation_start') || '2026-06-15';
  });
  const [vacationEnd, setVacationEnd] = useState<string>(() => {
    return localStorage.getItem('uniquemail_vacation_end') || '2026-06-30';
  });
  const [vacationMessage, setVacationMessage] = useState<string>(() => {
    const defaultMsg = "Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Nachricht. Ich befinde mich derzeit im Urlaub und bin ab dem angegebenen Datum wieder für Sie erreichbar. Ihre E-Mail wird nicht weitergeleitet.\n\nMit freundlichen Grüßen,\nIhr Support-Team";
    return localStorage.getItem('uniquemail_vacation_message') || defaultMsg;
  });

  // Signature / E-Mail-Signatur State (Persistently Stored)
  const [signatureActive, setSignatureActive] = useState<boolean>(() => {
    return localStorage.getItem('uniquemail_signature_active') === 'true';
  });
  const [signatureText, setSignatureText] = useState<string>(() => {
    const defaultSig = "Mit freundlichen Grüßen,\nMax Mustermann\nProjektleiter .NET\nUnique Utilities S.A.\nTelefon: +49 (0) 123 456789";
    return localStorage.getItem('uniquemail_signature_text') || defaultSig;
  });
  const [accountSignatures, setAccountSignatures] = useState<Record<string, string>>(() => {
    return readJsonStorage<Record<string, string>>('uniquemail_account_signatures', {});
  });
  const [signatureAIPrompt, setSignatureAIPrompt] = useState<string>('');

  const [isOptimizingVacation, setIsOptimizingVacation] = useState<boolean>(false);
  const [isGeneratingSignature, setIsGeneratingSignature] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('uniquemail_image_allow_senders', JSON.stringify(uniqueSenderList(imageDownloadAllowList)));
  }, [imageDownloadAllowList]);

  useEffect(() => {
    localStorage.setItem('uniquemail_image_deny_senders', JSON.stringify(uniqueSenderList(imageDownloadDenyList)));
  }, [imageDownloadDenyList]);

  useEffect(() => {
    localStorage.setItem('uniquemail_blocked_senders', JSON.stringify(uniqueSenderList(blockedSenderList)));
    setEmails(prev => prev.map(mail => guardBlockedSenderMail(mail)));
  }, [blockedSenderList]);

  useEffect(() => {
    if (appLockConfig?.enabled) {
      localStorage.setItem('uniquemail_app_lock_config', JSON.stringify(appLockConfig));
    } else {
      localStorage.removeItem('uniquemail_app_lock_config');
      setIsAppUnlocked(true);
    }
  }, [appLockConfig]);
  useEffect(() => {
    localStorage.setItem('uniquemail_signature_active', signatureActive.toString());
  }, [signatureActive]);

  useEffect(() => {
    localStorage.setItem('uniquemail_signature_text', signatureText);
  }, [signatureText]);

  useEffect(() => {
    localStorage.setItem('uniquemail_account_signatures', JSON.stringify(accountSignatures));
  }, [accountSignatures]);

  useEffect(() => {
    localStorage.setItem('uniquemail_auto_mark_read_on_open', String(autoMarkAsReadOnOpen));
  }, [autoMarkAsReadOnOpen]);

  useEffect(() => {
    localStorage.setItem('uniquemail_attachment_download_directory', attachmentDownloadDirectory);
  }, [attachmentDownloadDirectory]);

  const handleChooseAttachmentDownloadDirectory = async () => {
    const nativeApi = (window as any).uniqueMailNative;
    if (!nativeApi?.chooseDownloadDirectory) {
      alert('Ordnerauswahl ist in dieser Umgebung nicht verfügbar.');
      return;
    }
    const result = await nativeApi.chooseDownloadDirectory();
    if (result?.directory) setAttachmentDownloadDirectory(result.directory);
  };
  const handleOptimizeVacation = async () => {
    setIsOptimizingVacation(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/optimize-vacation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: vacationMessage }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Fehler beim Aufruf der KI-API.');
      }
      const data = await response.json();
      if (data.optimized) {
        setVacationMessage(data.optimized.trim());
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Die KI-Optimierung ist fehlgeschlagen.');
    } finally {
      setIsOptimizingVacation(false);
    }
  };

  const handleGenerateSignature = async () => {
    if (!signatureAIPrompt.trim()) return;
    setIsGeneratingSignature(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/generate-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSignature: activeSignatureText, prompt: signatureAIPrompt }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Fehler beim Aufruf der KI-API.');
      }
      const data = await response.json();
      if (data.signature) {
        const nextSignature = data.signature.trim();
        setSignatureText(nextSignature);
        if (activeAccountEmail) {
          setAccountSignatures(prev => ({ ...prev, [activeAccountEmail]: nextSignature }));
        }
        setSignatureActive(true); // Automatically ensure active if generated
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Die Signatur-Generierung ist fehlgeschlagen.');
    } finally {
      setIsGeneratingSignature(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('uniquemail_vacation_active', vacationActive.toString());
  }, [vacationActive]);

  useEffect(() => {
    localStorage.setItem('uniquemail_vacation_start', vacationStart);
  }, [vacationStart]);

  useEffect(() => {
    localStorage.setItem('uniquemail_vacation_end', vacationEnd);
  }, [vacationEnd]);

  useEffect(() => {
    localStorage.setItem('uniquemail_vacation_message', vacationMessage);
  }, [vacationMessage]);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('uniquemail_darkmode') === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('uniquemail_darkmode', isDarkMode ? 'true' : 'false');
  }, [isDarkMode]);

  // KI API Integration & Toggle Settings
  const [aiApiKey, setAiApiKey] = useState<string>(() => {
    return localStorage.getItem('outlook_ai_apikey') || '';
  });
  const [aiApiProvider, setAiApiProvider] = useState<'deepseek' | 'claude' | 'gemini' | 'custom'>(() => {
    return (localStorage.getItem('outlook_ai_provider') as any) || 'claude';
  });

  // Support for arbitrary/other AI providers
  const [customAiProvider, setCustomAiProvider] = useState<string>(() => {
    return localStorage.getItem('outlook_custom_ai_provider') || 'Ollama / Llama 3';
  });
  const [customAiEndpoint, setCustomAiEndpoint] = useState<string>(() => {
    return localStorage.getItem('outlook_custom_ai_endpoint') || 'http://localhost:11434/v1';
  });

  const [aiToggles, setAiToggles] = useState<{
    autoScanContacts: boolean;
    autoCategorize: boolean;
    autoSmartReply: boolean;
    autoPhishingScan: boolean;
  }>(() => {
    return readJsonStorage('outlook_ai_toggles', {
      autoScanContacts: true,
      autoCategorize: true,
      autoSmartReply: true,
      autoPhishingScan: true
    });
  });

  // Persist KI parameters
  useEffect(() => {
    localStorage.setItem('outlook_ai_apikey', aiApiKey);
  }, [aiApiKey]);

  useEffect(() => {
    localStorage.setItem('outlook_ai_provider', aiApiProvider);
  }, [aiApiProvider]);

  useEffect(() => {
    localStorage.setItem('outlook_custom_ai_provider', customAiProvider);
  }, [customAiProvider]);

  useEffect(() => {
    localStorage.setItem('outlook_custom_ai_endpoint', customAiEndpoint);
  }, [customAiEndpoint]);

  useEffect(() => {
    localStorage.setItem('outlook_ai_toggles', JSON.stringify(aiToggles));
  }, [aiToggles]);
  
  // Local Database and Caching state with LocalStorage persistence
  const [emails, setEmails] = useState<Email[]>([]);
  const [browserMailCacheLoaded, setBrowserMailCacheLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    const frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        const cachedEmails = readJsonStorage<Email[]>('outlook_emails', []);
        setEmails(Array.isArray(cachedEmails) ? cachedEmails : []);
        setBrowserMailCacheLoaded(true);
      }, 50);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = readJsonStorage<Task[]>('outlook_tasks', []);
    return Array.isArray(saved) ? saved : [];
  });

  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = readJsonStorage<Note[]>('outlook_notes', []);
    return Array.isArray(saved) ? saved : [];
  });

  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = readJsonStorage<Contact[]>('outlook_contacts', []);
    return Array.isArray(saved) ? saved : [];
  });

  const [contactSortLabels, setContactSortLabels] = useState<string[]>(() => {
    const saved = localStorage.getItem('uniquemail_contact_sort_labels');
    if (!saved) return DEFAULT_CONTACT_SORT_LABELS;
    try {
      const parsed = JSON.parse(saved);
      const labels = Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [];
      return labels.length > 0 ? Array.from(new Set(labels)) : DEFAULT_CONTACT_SORT_LABELS;
    } catch {
      return DEFAULT_CONTACT_SORT_LABELS;
    }
  });

  useEffect(() => {
    localStorage.setItem('uniquemail_contact_sort_labels', JSON.stringify(contactSortLabels));
  }, [contactSortLabels]);

  const isSandboxCalendarItem = (item: any) => {
    const id = String(item?.id || '').toLowerCase();
    const text = `${item?.title || ''} ${item?.description || ''} ${item?.location || ''}`.toLowerCase();
    return ['cal-1', 'cal-2', 'cal-3', 'cal-4'].includes(id)
      || text.includes('roadmap')
      || text.includes('wpf')
      || text.includes('sprint-planning')
      || text.includes('architektur-sync')
      || text.includes('meeting room berlin');
  };

  const [calendarItems, setCalendarItems] = useState(() => {
    const saved = localStorage.getItem('outlook_calendar');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(item => !isSandboxCalendarItem(item)) : [];
    } catch {
      return [];
    }
  });

  const [accounts, setAccounts] = useState<any[]>(() => {
    const saved = readJsonStorage<any[]>('outlook_accounts', []);
    return Array.isArray(saved) ? saved : [];
  });

  const [accountSessionPasswords, setAccountSessionPasswords] = useState<Record<string, string>>({});
  const sessionPasswordResolverRef = useRef<((password: string | null) => void) | null>(null);
  const [sessionPasswordRequest, setSessionPasswordRequest] = useState<{ email: string } | null>(null);
  const [sessionPasswordInput, setSessionPasswordInput] = useState<string>('');
  const [feedbackDialog, setFeedbackDialog] = useState<{ type: FeedbackKind; title: string; body: string; isSending: boolean; error?: string } | null>(null);

  const [activeAccountEmail, setActiveAccountEmail] = useState<string>(() => {
    const saved = localStorage.getItem('outlook_active_account');
    return saved || '';
  });

  useEffect(() => {
    if (!activeAccountEmail && accounts.length > 0) {
      setActiveAccountEmail(accounts[0].email);
    }
  }, [activeAccountEmail, accounts]);

  // Derived state: scan emails for suggested contacts that do not exist in the permanent contacts database
  const suggestedContacts = useMemo<Contact[]>(() => {
    if (currentPage !== 'contacts' && currentPage !== 'crm') return [];
    const suggestions: Contact[] = [];
    const permanentEmails = new Set(contacts.map((c) => c.email.toLowerCase()));
    const seenEmails = new Set<string>();

    emails.forEach((email) => {
      // Only parse for emails matching the current account
      const accountLower = (email.accountEmail || activeAccountEmail).toLowerCase();
      const activeLower = activeAccountEmail.toLowerCase();
      if (accountLower !== activeLower) return;

      // Source 1: Sender (incoming mail)
      const senderE = email.senderEmail?.trim();
      if (senderE && senderE.toLowerCase() !== activeAccountEmail.toLowerCase()) {
        const emailLower = senderE.toLowerCase();
        if (!permanentEmails.has(emailLower) && !seenEmails.has(emailLower)) {
          seenEmails.add(emailLower);
          
          let first = '';
          let last = '';
          const senderParts = (email.sender || '').trim().split(' ');
          if (senderParts.length >= 2) {
            first = senderParts[0];
            last = senderParts.slice(1).join(' ');
          } else {
            first = email.sender || senderE.split('@')[0];
            last = 'E-Mail Kontakt';
          }
          
          suggestions.push({
            id: `suggested-sender-${email.id}`,
            firstName: first,
            lastName: last,
            email: senderE,
            company: 'E-Mail Verbindung',
            role: 'Automatischer E-Mail Vorschlag',
            notes: `Dieser Kontakt wurde automatisch gescannt aus E-Mail: "${email.subject}".`
          });
        }
      }

      // Source 2: Recipient (outgoing/sent mail)
      const recipientE = email.recipientEmail?.trim();
      if (recipientE && recipientE.toLowerCase() !== activeAccountEmail.toLowerCase()) {
        const emailLower = recipientE.toLowerCase();
        if (!permanentEmails.has(emailLower) && !seenEmails.has(emailLower)) {
          seenEmails.add(emailLower);
          
          const first = email.recipientName || recipientE.split('@')[0];
          const last = 'E-Mail Kontakt';
          
          suggestions.push({
            id: `suggested-recipient-${email.id}`,
            firstName: first,
            lastName: last,
            email: recipientE,
            company: 'Gesendete Verbindung',
            role: 'Automatischer E-Mail Vorschlag',
            notes: `Dieser Kontakt wurde automatisch gescannt aus Ihren gesendeten Elementen.`
          });
        }
      }
    });

    return suggestions;
  }, [emails, contacts, activeAccountEmail, currentPage]);

  // Combined contacts passed to layout lists & detail windows
  const combinedContacts = useMemo<Contact[]>(() => {
    if (aiToggles.autoScanContacts) {
      return [...contacts, ...suggestedContacts];
    }
    return contacts;
  }, [contacts, suggestedContacts, aiToggles.autoScanContacts]);

  // Save auto-scanned suggestion onto permanent storage list
  const handleSaveSuggestedContact = (suggested: Contact) => {
    if (contacts.some((c) => c.email.toLowerCase() === suggested.email.toLowerCase())) {
      alert("Dieser Kontakt ist bereits in Ihrem Adressbuch gespeichert.");
      return;
    }

    const newContact: Contact = {
      ...suggested,
      id: `con-${Date.now()}`, // permanent ID
      company: suggested.company?.includes('Verbindung') ? 'E-Mail Verbindung' : suggested.company,
      role: 'Projekt-Partner',
      group: suggested.group,
      notes: (suggested.notes || '') + '\n\n[Aus E-Mail-Scan permanent gesichert]'
    };

    setContacts((prev) => {
      const updated = [newContact, ...prev];
      localStorage.setItem('outlook_contacts', JSON.stringify(updated));
      return updated;
    });

    setSelectedContactId(newContact.id);
    alert(`Der Kontakt "${newContact.firstName} ${newContact.lastName}" (${newContact.email}) wurde erfolgreich permanent in Ihrer WPF SQLite Datenbank hinterlegt!`);
  };

   const [showQuickStepsModal, setShowQuickStepsModal] = useState<boolean>(false);

  // QuickSteps form states
  const [qsName, setQsName] = useState<string>('');
  const [qsColor, setQsColor] = useState<string>('#3b82f6');
  const [qsAction, setQsAction] = useState<string>('mark_read_and_archive');
  const [qsTargetCategory, setQsTargetCategory] = useState<string>('');
  const [editingQsId, setEditingQsId] = useState<string | null>(null);

  const [quickSteps, setQuickSteps] = useState<any[]>(() => {
    const saved = readJsonStorage<any[]>('outlook_quicksteps', []);
    return Array.isArray(saved) ? saved : [];
  });

  // Selection states
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(() => {
    const parsed = readJsonStorage<Contact[]>('outlook_contacts', []);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].id : null;
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    const parsed = readJsonStorage<Task[]>('outlook_tasks', []);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].id : null;
  });
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(() => {
    const parsed = readJsonStorage<CalendarItem[]>('outlook_calendar', []);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].id : null;
  });

  // Interactive controls
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isWritingEmail, setIsWritingEmail] = useState<boolean>(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('new');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState<boolean>(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('inbox');

  // Follow-up Wiedervorlage states & handlers
  const [reminderModalEmailId, setReminderModalEmailId] = useState<string | null>(null);
  const [reminderModalDate, setReminderModalDate] = useState<string>('');
  const [reminderModalTime, setReminderModalTime] = useState<string>('09:00');
  const [reminderModalNote, setReminderModalNote] = useState<string>('');
  const [triggeredReminderIds, setTriggeredReminderIds] = useState<string[]>([]);

  // Open set reminder configuration modal
  const handleOpenSetReminder = (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    let defDate = new Date();
    defDate.setDate(defDate.getDate() + 1); // default to tomorrow
    const yyyy = defDate.getFullYear();
    const mm = String(defDate.getMonth() + 1).padStart(2, '0');
    const dd = String(defDate.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (email.reminderDate) {
      try {
        const emailRemDate = new Date(email.reminderDate);
        if (!isNaN(emailRemDate.getTime())) {
          const ey = emailRemDate.getFullYear();
          const em = String(emailRemDate.getMonth() + 1).padStart(2, '0');
          const ed = String(emailRemDate.getDate()).padStart(2, '0');
          const eh = String(emailRemDate.getHours()).padStart(2, '0');
          const emin = String(emailRemDate.getMinutes()).padStart(2, '0');
          setReminderModalDate(`${ey}-${em}-${ed}`);
          setReminderModalTime(`${eh}:${emin}`);
        } else {
          setReminderModalDate(todayStr);
          setReminderModalTime('09:00');
        }
      } catch (error) {
        setReminderModalDate(todayStr);
        setReminderModalTime('09:00');
      }
    } else {
      setReminderModalDate(todayStr);
      setReminderModalTime('09:00');
    }
    setReminderModalNote(email.reminderNote || '');
    setReminderModalEmailId(emailId);
  };

  // Save the configured follow up reminder in email and calendar items
  const handleSaveReminder = () => {
    if (!reminderModalEmailId) return;
    const email = emails.find(e => e.id === reminderModalEmailId);
    if (!email) return;

    if (!reminderModalDate || !reminderModalTime) {
      alert("Bitte wählen Sie ein gültiges Datum und eine Uhrzeit.");
      return;
    }

    const isoDateTimeString = `${reminderModalDate}T${reminderModalTime}:00`;

    // Update email state
    setEmails(prev => prev.map(e => e.id === reminderModalEmailId ? {
      ...e,
      isFlagged: true,
      reminderDate: isoDateTimeString,
      reminderNote: reminderModalNote,
      reminderTriggered: false
    } : e));

    // Calendar sync setup
    const calId = `reminder-cal-${reminderModalEmailId}`;
    const startIso = isoDateTimeString;
    const startDt = new Date(isoDateTimeString);
    const endDt = new Date(startDt.getTime() + 30 * 60 * 1050); // 30 mins duration
    const endIso = endDt.toISOString();

    setCalendarItems(prev => {
      const filtered = prev.filter(c => c.id !== calId);
      const newCalEvent = {
        id: calId,
        title: `Wiedervorlage: ${email.subject}`,
        start: startIso,
        end: endIso,
        location: "Wiedervorlage-Client",
        category: "Wiedervorlage",
        description: `Archivierte Wiedervorlage für die E-Mail von:\n${email.sender} (${email.senderEmail})\n\nBetreff: ${email.subject}\n\nNotiz:\n${reminderModalNote || 'Keine zusätzlichen Notizen.'}`,
        emailAttachmentId: email.id,
        emailAttachmentSubject: email.subject
      };
      return [...filtered, newCalEvent];
    });

    setReminderModalEmailId(null);
  };

  // Remove follow-up reminder completely
  const handleRemoveReminder = () => {
    if (!reminderModalEmailId) return;
    const email = emails.find(e => e.id === reminderModalEmailId);
    if (!email) return;

    // Remove reminder fields
    setEmails(prev => prev.map(e => e.id === reminderModalEmailId ? {
      ...e,
      reminderDate: undefined,
      reminderNote: undefined,
      reminderTriggered: false
    } : e));

    // Remove from calendar items
    const calId = `reminder-cal-${reminderModalEmailId}`;
    setCalendarItems(prev => prev.filter(c => c.id !== calId));

    setReminderModalEmailId(null);
  };

  // Triggered alarm intervals to scan emails
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const newlyTriggered: string[] = [];

      emails.forEach(email => {
        if (email.isFlagged && email.reminderDate && !email.reminderTriggered) {
          const reminderTime = new Date(email.reminderDate);
          if (now >= reminderTime) {
            newlyTriggered.push(email.id);
          }
        }
      });

      if (newlyTriggered.length > 0) {
        setEmails(prev => prev.map(e => newlyTriggered.includes(e.id) ? { ...e, reminderTriggered: true } : e));
        setTriggeredReminderIds(prev => {
          const combined = [...prev, ...newlyTriggered];
          return Array.from(new Set(combined));
        });
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [emails]);

  // View linked email attachment from calendar or notification
  const handleOpenEmailAttachment = (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) {
      alert("Die verknüpfte E-Mail wurde in der lokalen Datenbank nicht gefunden.");
      return;
    }

    const ownerEmail = email.accountEmail || (accounts[0] ? accounts[0].email : '');
    if (ownerEmail && ownerEmail.toLowerCase() !== activeAccountEmail.toLowerCase()) {
      setActiveAccountEmail(ownerEmail);
    }

    setCurrentPage('mail');
    setSelectedFolder(email.folder || 'inbox');
    setSelectedEmailId(email.id);
  };

  // New account management form variables
  const [newAccEmail, setNewAccEmail] = useState<string>('');
  const [newAccDisplayName, setNewAccDisplayName] = useState<string>('');
  const [newAccPass, setNewAccPass] = useState<string>('');
  const [newAccUseAutodiscovery, setNewAccUseAutodiscovery] = useState<boolean>(true);
  const [newAccImapServer, setNewAccImapServer] = useState<string>('imap.domain.de');
  const [newAccImapPort, setNewAccImapPort] = useState<number>(993);
  const [newAccSmtpServer, setNewAccSmtpServer] = useState<string>('smtp.domain.de');
  const [newAccSmtpPort, setNewAccSmtpPort] = useState<number>(465);
  const [newAccProvider, setNewAccProvider] = useState<string>('Internet-Dienst');
  const [optionsSyncLogs, setOptionsSyncLogs] = useState<string[]>([]);
  const [isOptionsSyncing, setIsOptionsSyncing] = useState<boolean>(false);
  const latestOptionsSyncLog = optionsSyncLogs[optionsSyncLogs.length - 1] || '[INFO] Verbindung wird vorbereitet...';
  const latestOptionsSyncStatus = latestOptionsSyncLog.replace(/^\[[^\]]+\]\s*/, '');
  const accountInputGuards: React.InputHTMLAttributes<HTMLInputElement> = {
    spellCheck: false
  };

  // Dev tab specific section
  const [activeDevSection, setActiveDevSection] = useState<string>('architecture');

  // Discovered settings for active account
  const activeAccount = accounts.find(a => a.email.toLowerCase() === activeAccountEmail.toLowerCase()) || accounts[0];
  const activeSignatureText = activeAccountEmail ? (accountSignatures[activeAccountEmail] ?? signatureText) : signatureText;
  const [discoveredSettings, setDiscoveredSettings] = useState<any>({
    imapServer: activeAccount?.imapServer || 'imap.local',
    imapPort: activeAccount?.imapPort || 993,
    smtpServer: activeAccount?.smtpServer || 'smtp.local',
    smtpPort: activeAccount?.smtpPort || 465,
    provider: activeAccount?.provider || 'Unique Mail Server'
  });

  // Keep discoveredSettings in sync with activeAccount changes
  useEffect(() => {
    if (activeAccount) {
      setDiscoveredSettings({
        imapServer: activeAccount.imapServer,
        imapPort: activeAccount.imapPort,
        smtpServer: activeAccount.smtpServer,
        smtpPort: activeAccount.smtpPort,
        provider: activeAccount.provider
      });
    }
  }, [activeAccountEmail, accounts]);

  // Synchronizers to local storage
  useEffect(() => {
    if (!browserMailCacheLoaded) return;
    const timeoutId = window.setTimeout(() => {
      try {
        // The complete mailbox remains in the disk cache. LocalStorage only keeps a fast startup snapshot.
        localStorage.setItem('outlook_emails', JSON.stringify(emails.slice(0, 2000)));
      } catch (error) {
        console.error('Mail-Schnellcache konnte nicht gespeichert werden.', error);
      }
    }, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [emails, browserMailCacheLoaded]);

  useEffect(() => {
    localStorage.setItem('outlook_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('outlook_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('outlook_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    if (!localStorage.getItem('outlook_calendar_sandbox_cleanup_v021')) {
      setCalendarItems(prev => prev.filter(item => !isSandboxCalendarItem(item)));
      localStorage.setItem('outlook_calendar_sandbox_cleanup_v021', '1');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('outlook_calendar', JSON.stringify(calendarItems.filter(item => !isSandboxCalendarItem(item))));
  }, [calendarItems]);

  useEffect(() => {
    localStorage.setItem('outlook_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('outlook_active_account', activeAccountEmail);
  }, [activeAccountEmail]);

  useEffect(() => {
    localStorage.setItem('outlook_quicksteps', JSON.stringify(quickSteps));
  }, [quickSteps]);

  const handleAccountConfigured = (email: string, settings: any) => {
    setActiveAccountEmail(email);
    setDiscoveredSettings(settings);
    
    // Add to accounts list
    setAccounts(prev => {
      if (prev.find(a => a.email.toLowerCase() === email.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        {
          email,
          imapServer: settings.imapServer,
          imapPort: settings.imapPort,
          smtpServer: settings.smtpServer,
          smtpPort: settings.smtpPort,
          provider: settings.provider || 'Auto Discovered',
          customFolders: []
        }
      ];
    });
    
    setSelectedEmailId(null);
    setCurrentPage('mail');
    setActiveTab('start');
  };

  // Manual Trigger Sync variables
  const [syncProgress, setSyncProgress] = useState<number>(100);
  const [syncStatusText, setSyncStatusText] = useState<string>('Alle Ordner sind aktuell.');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const postActionSyncInFlightRef = useRef(false);
  const postActionSyncQueuedRef = useRef(false);
  const postActionSyncTimerRef = useRef<number | null>(null);
  const lastPostActionSyncAtRef = useRef(0);

  const normalizeMailFolderKey = (value?: string) => (value || 'inbox').trim().replace(/\\/g, '/').toLowerCase();
  const mailFolderMatches = (mailFolderRaw: string | undefined, selectedFolderRaw: string) => {
    const mailFolder = normalizeMailFolderKey(mailFolderRaw);
    const selected = normalizeMailFolderKey(selectedFolderRaw);
    if (mailFolder === selected) return true;
    if (selected === 'inbox') return mailFolder === 'inbox' || mailFolder.endsWith('/inbox') || mailFolder.includes('posteingang');
    if (selected === 'sent') return mailFolder.includes('sent') || mailFolder.includes('gesendet');
    if (selected === 'outbox') return mailFolder.includes('outbox') || mailFolder.includes('postausgang');
    if (selected === 'deleted') return mailFolder.includes('trash') || mailFolder.includes('deleted') || mailFolder.includes('papierkorb');
    if (selected === 'drafts') return mailFolder.includes('draft') || mailFolder.includes('entwurf');
    if (selected === 'junk') return mailFolder.includes('junk') || mailFolder.includes('spam');
    if (selected === 'archive') return mailFolder.includes('archive') || mailFolder.includes('archiv');
    return false;
  };
  const pickVisibleFolderAfterSync = (syncedEmails: Email[], folders: any[]) => {
    const mailFolders = syncedEmails.map(mail => mail.imapFolder || mail.folder || 'inbox').filter(Boolean);
    const inboxFromMail = mailFolders.find(folder => mailFolderMatches(folder, 'inbox'));
    if (inboxFromMail) return inboxFromMail;
    if (mailFolders[0]) return mailFolders[0];
    const selectable = folders.find(folder => !(folder.flags || []).some((flag: string) => flag.toLowerCase() === '\noselect'));
    return selectable?.path || selectable?.id || 'inbox';
  };
  const pickVisibleEmailAfterSync = (syncedEmails: Email[], folder: string) => {
    return syncedEmails.find(mail => mailFolderMatches(mail.imapFolder || mail.folder, folder))?.id || syncedEmails[0]?.id || null;
  };

  // Sync animation simulation
  const handleTriggerSync = async () => {
    if (isOffline) {
      alert("Synchronisation fehlgeschlagen: Sie arbeiten aktuell offline. Bitte deaktivieren Sie 'Offline arbeiten'.");
      return;
    }
    if (isSyncing) return;

    const active = accounts.find(acc => acc.email.toLowerCase() === activeAccountEmail.toLowerCase()) || accounts[0];
    if (!active) {
      alert("Bitte zuerst ein E-Mail-Konto hinzufügen.");
      return;
    }

    const password = await getSessionPassword(active);
    if (!password) return;

    setIsSyncing(true);
    setSyncProgress(10);
    setSyncStatusText(`Verbinde mit ${active.imapServer}:${active.imapPort}...`);

    try {
      setSyncProgress(35);
      setSyncStatusText("Ordnerstruktur vom Server laden...");
      const syncResult = await syncInboxForAccount(active, password);
      setSyncProgress(80);
      if (syncResult.folders.length > 0) {
        setAccounts(prev => prev.map(acc => acc.email.toLowerCase() === active.email.toLowerCase() ? { ...acc, serverFolders: syncResult.folders } : acc));
      }
      const nextFolder = pickVisibleFolderAfterSync(syncResult.emails, syncResult.folders);
      setEmails(prev => mergeSyncedEmails(prev, active.email, syncResult.emails));
      setSelectedFolder(nextFolder);
      setSelectedEmailId(pickVisibleEmailAfterSync(syncResult.emails, nextFolder));
      setSyncProgress(100);
      setSyncStatusText(`${syncResult.emails.length} E-Mail(s) aus ${syncResult.folders.length} Serverordner(n) geladen.`);
    } catch (error: any) {
      setSyncStatusText(`Synchronisation fehlgeschlagen: ${error.message || error}`);
      alert(`Synchronisation fehlgeschlagen:\n\n${error.message || error}`);
    } finally {
      setIsSyncing(false);
    }
    return;

    setIsSyncing(true);
    setSyncProgress(10);
    setSyncStatusText("Verbindung mit exchange.dev-core.local wird hergestellt...");

    setTimeout(() => {
      setSyncProgress(35);
      setSyncStatusText("Ordnerstrukturen abgleichen (IMAP UIDVALIDITY)...");
    }, 800);

    setTimeout(() => {
      setSyncProgress(70);
      setSyncStatusText("Abrufen von neuen E-Mails ab höchster lokaler UID...");
      
      // Injecting a simulated incoming email about WPF performance as standard sync
      const incomingMail: Email = {
        id: `msg-${Date.now()}`,
        sender: 'Julia Koch',
        senderEmail: 'j.koch@performance.local',
        subject: `Live-Sync: SQLite Schreibzugriff auf ${emails.length + 1} Elemente erhöht`,
        date: new Date().toISOString(),
        preview: 'Hi Team, der SQLite Index meldet optimalen Durchlauf. Delta-Sync wurde soeben abgeschlossen...',
        body: `Hallo zusammen,

der SQLite Index für die Volltextsuche meldet hervorragende Durchlaufwerte.

Sämtliche synchronisierten E-Mails wurden atomar in die Tabelle geschrieben. Der Delta-Sync-Algorithmus hat nur die ausstehenden Nachrichtendatensätze heruntergeladen.

WPF-seitig läuft das Rendering flüssig und die DataTemplates sind up to date.

Beste Grüße,
Julia`,
        isRead: false,
        isFlagged: false,
        hasAttachment: false,
        importance: 'normal',
        category: 'Synchronisation'
      };
      
      // Prepend to current emails list
      // Demo sync disabled: real IMAP integration will populate this list.
    }, 1600);

    setTimeout(() => {
      setSyncProgress(95);
      setSyncStatusText("Sichern der lokalen SQLite Transaktionsprotokolle...");
    }, 2400);

    setTimeout(() => {
      setSyncProgress(100);
      setSyncStatusText("Alle Ordner sind aktuell. Synchronisierung erfolgreich abgeschlossen.");
      setIsSyncing(false);
    }, 3000);
  };

  // Toggle offline works instantly and sync indicators reacts
  const handleToggleOffline = () => {
    setIsOffline(prev => {
      const next = !prev;
      if (next) {
        setSyncStatusText("Offline arbeiten aktiv.");
        setSyncProgress(0);
      } else {
        setSyncStatusText("Verbunden mit Microsoft Exchange.");
        setSyncProgress(100);
      }
      return next;
    });
  };

  // Reply to active mail triggers writing form automatically
  const handleReplyMail = () => {
    const active = emails.find(e => e.id === selectedEmailId);
    if (!active) return;

    setComposeMode('reply');
    setIsWritingEmail(true);
    setCurrentPage('mail');
  };

  // Delete Mail remove from state or select next
  const handleDeleteMail = () => {
    if (!selectedEmailId) return;
    moveEmailsToFolder([selectedEmailId], 'deleted');
  };

  // Compose / Write Email
  const handleNewEmailTrigger = () => {
    setSelectedEmailId(null);
    setComposeMode('new');
    setIsWritingEmail(true);
    setCurrentPage('mail');
  };

  // Send email through the configured SMTP account and persist a local sent/outbox copy.
  const handleSaveDraft = (message: ComposeMailPayload) => {
    const requestedAccountEmail = message.accountEmail || activeAccountEmail;
    const active = accounts.find(acc => acc.email.toLowerCase() === requestedAccountEmail.toLowerCase()) || accounts[0];
    if (!active) {
      setSyncStatusText('Entwurf konnte nicht gespeichert werden: kein Konto vorhanden.');
      return;
    }

    const draftId = message.sourceId || `draft-${Date.now()}`;
    const draftMail: Email = {
      id: draftId,
      sender: getAccountDisplayName(active) || active.email,
      senderEmail: active.email,
      subject: message.subject || '(Kein Betreff)',
      date: new Date().toISOString(),
      preview: message.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180),
      body: message.body,
      isRead: true,
      isFlagged: false,
      hasAttachment: message.attachments.length > 0,
      importance: 'normal',
      category: 'Entwurf',
      folder: 'drafts',
      imapFolder: 'drafts',
      accountEmail: active.email,
      recipientEmail: message.to,
      ccEmail: message.cc,
      bccEmail: message.bcc,
      attachments: message.attachments.map(item => ({ filename: item.filename, contentType: item.contentType, contentBase64: item.contentBase64 })),
      draftAttachments: message.attachments,
      sendStatus: 'queued'
    };

    setEmails(prev => prev.some(mail => mail.id === draftId)
      ? prev.map(mail => mail.id === draftId ? draftMail : mail)
      : [draftMail, ...prev]
    );
    setSelectedEmailId(draftId);
    setSyncStatusText('Entwurf lokal gespeichert.');
    triggerPostActionSync('Entwurf gespeichert', [draftMail]);
  };

  const handleEditStoredEmail = (id: string, mode: 'draft' | 'outbox') => {
    setSelectedEmailId(id);
    setComposeMode(mode);
    setIsWritingEmail(true);
    setCurrentPage('mail');
  };

  const getAccountDisplayName = (account: any) => String(account?.displayName || account?.senderName || account?.name || '').trim();
  const formatSenderAddress = (account: any) => {
    const email = String(account?.email || '').trim();
    const displayName = getAccountDisplayName(account);
    if (!displayName) return email;
    return `"${displayName.replace(/["\\]/g, '')}" <${email}>`;
  };
  const updateAccountDisplayName = (email: string, displayName: string) => {
    setAccounts(prev => prev.map(acc => acc.email.toLowerCase() === email.toLowerCase()
      ? { ...acc, displayName, senderName: displayName }
      : acc
    ));
  };
  const handleSendEmail = async (message: ComposeMailPayload) => {
    const requestedAccountEmail = message.accountEmail || activeAccountEmail;
    const active = accounts.find(acc => acc.email.toLowerCase() === requestedAccountEmail.toLowerCase()) || accounts[0];
    if (!active) {
      throw new Error('Bitte zuerst ein E-Mail-Konto hinzufügen.');
    }

    const sentFolder = resolveServerFolderPath(active, 'sent');
    const now = new Date().toISOString();
    const queuedId = message.sourceId && message.sourceId.startsWith('outbox-') ? message.sourceId : `outbox-${Date.now()}`;
    const preview = message.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    const baseMail: Email = {
      id: queuedId,
      sender: getAccountDisplayName(active) || active.email,
      senderEmail: active.email,
      subject: message.subject || '(Kein Betreff)',
      date: now,
      preview,
      body: message.body,
      isRead: true,
      isFlagged: false,
      hasAttachment: message.attachments.length > 0,
      importance: 'normal',
      category: 'Postausgang',
      folder: 'outbox',
      imapFolder: 'outbox',
      accountEmail: active.email,
      recipientEmail: message.to,
      ccEmail: message.cc,
      bccEmail: message.bcc,
      attachments: message.attachments.map(item => ({ filename: item.filename, contentType: item.contentType, contentBase64: item.contentBase64 })),
      draftAttachments: message.attachments,
      sendStatus: 'queued'
    };

    setEmails(prev => [baseMail, ...prev.filter(mail => mail.id !== queuedId && mail.id !== message.sourceId)]);
    setSelectedFolder('outbox');
    setSelectedEmailId(queuedId);
    setSyncStatusText('E-Mail wurde in den Postausgang gelegt. Versand läuft im Hintergrund...');

    void enqueueBackgroundJob(`send:${queuedId}`, 90, async () => {
      const failQueuedMail = (errorMessage: string) => {
        setEmails(prev => prev.map(mail => mail.id === queuedId
          ? { ...mail, sendStatus: 'failed' as const, sendError: errorMessage, category: 'Postausgang' }
          : mail
        ));
        setSyncStatusText(`SMTP fehlgeschlagen, Mail bleibt im Postausgang: ${errorMessage}`);
      };

      try {
        const password = await getSessionPassword(active);
        if (!password) {
          failQueuedMail('Kein Sitzungspasswort eingegeben.');
          return;
        }

        const response = await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: active.email,
            password,
            imapServer: active.imapServer,
            imapPort: active.imapPort,
            smtpServer: active.smtpServer,
            smtpPort: active.smtpPort,
            from: formatSenderAddress(active),
            to: message.to,
            cc: message.cc,
            bcc: message.bcc,
            subject: message.subject || '(Kein Betreff)',
            html: message.body,
            sentFolder,
            attachments: message.attachments
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          failQueuedMail(data.error || 'SMTP-Versand fehlgeschlagen.');
          return;
        }

        const sentMail: Email = {
          ...baseMail,
          id: data.messageId ? `smtp-${data.messageId}` : `smtp-${Date.now()}`,
          folder: sentFolder,
          imapFolder: sentFolder,
          category: 'Gesendet',
          sendStatus: 'sent' as const,
          sendError: undefined,
          date: data.sentAt || new Date().toISOString()
        };

        setEmails(prev => [sentMail, ...prev.filter(mail => mail.id !== queuedId && mail.id !== message.sourceId)]);
        setSelectedEmailId(prev => prev === queuedId ? sentMail.id : prev);
        setSelectedFolder(prev => prev === 'outbox' ? sentFolder : prev);
        setSyncStatusText(data.sentAppend?.ok
          ? `E-Mail im Hintergrund gesendet und in '${sentFolder}' abgelegt.`
          : `E-Mail im Hintergrund gesendet. Lokale Kopie gespeichert${data.sentAppend?.error ? `; Server-Gesendet-Kopie fehlgeschlagen: ${data.sentAppend.error}` : '.'}`
        );
        triggerPostActionSync('Versand', [sentMail]);
      } catch (error: any) {
        failQueuedMail(error?.message || String(error) || 'SMTP-Versand fehlgeschlagen.');
      }
    });
  };
  const handleRetryOutboxEmail = async (id: string) => {
    const mail = emails.find(item => item.id === id);
    if (!mail) return;
    await handleSendEmail({
      to: mail.recipientEmail || '',
      cc: mail.ccEmail || '',
      bcc: mail.bccEmail || '',
      subject: mail.subject,
      body: mail.body,
      attachments: mail.draftAttachments || [],
      sourceId: mail.id
    });
  };
  // Archive mail moves active mail to archive folder
  const handleArchiveMail = () => {
    if (!selectedEmailId) return;
    moveEmailsToFolder([selectedEmailId], 'archive');
  };

  // Report Phishing
  const handleReportPhishing = () => {
    if (!selectedEmailId) return;
    alert("Das Element wurde erfolgreich an die Heuristik gemeldet und wird analysiert.");
  };

  // Mark all as read in current folder
  const handleMarkAllAsRead = () => {
    const ids = emails
      .filter(e => {
        const emailAccount = (e.accountEmail || activeAccountEmail).toLowerCase();
        const mailFolder = e.folder || 'inbox';
        return emailAccount === activeAccountEmail.toLowerCase() && mailFolderMatches(mailFolder, selectedFolder);
      })
      .map(e => e.id);
    setEmailsReadState(ids, true);
  };

  // Add folder dynamically per account
  const handleAddFolder = () => {
    const fName = safePrompt("Geben Sie den Namen des neuen Ordners ein:");
    if (!fName || fName.trim() === "") return;
    setAccounts(prev => prev.map(acc => {
      if (acc.email.toLowerCase() === activeAccountEmail.toLowerCase()) {
        const folders = acc.customFolders || [];
        if (folders.map(f => f.toLowerCase()).includes(fName.trim().toLowerCase())) {
          alert("Ein Ordner mit diesem Namen existiert bereits.");
          return acc;
        }
        return {
          ...acc,
          customFolders: [...folders, fName.trim()]
        };
      }
      return acc;
    }));
  };

  // Toggle flag state
  const handleToggleFlag = () => {
    if (!selectedEmailId) return;
    const currentMail = emails.find(e => e.id === selectedEmailId);
    if (!currentMail) return;

    const willBeFlagged = !currentMail.isFlagged;
    
    setEmails(prev => prev.map(e => e.id === selectedEmailId ? { ...e, isFlagged: willBeFlagged } : e));
    triggerPostActionSync('Nachverfolgung geändert', [currentMail]);

    if (willBeFlagged) {
      // Automatically trigger the Wiedervorlage / Erinnerung scheduler modal
      handleOpenSetReminder(selectedEmailId);
    } else {
      // If unflagged, also clear calendar reminder entries and email fields
      setEmails(prev => prev.map(e => e.id === selectedEmailId ? {
        ...e,
        reminderDate: undefined,
        reminderNote: undefined,
        reminderTriggered: false
      } : e));
      const calId = `reminder-cal-${selectedEmailId}`;
      setCalendarItems(prev => prev.filter(c => c.id !== calId));
    }
  };

  // Toggle flag completed state (interactive green check / red flag)
  const handleToggleFlagCompleted = (id: string) => {
    const target = emails.find(e => e.id === id);
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isFlagCompleted: !e.isFlagCompleted } : e));
    if (target) triggerPostActionSync('Nachverfolgung aktualisiert', [target]);
  };

  // Categorize select
  const handleCategorySelect = (category: string) => {
    if (!selectedEmailId) return;
    const target = emails.find(e => e.id === selectedEmailId);
    setEmails(prev => prev.map(e => e.id === selectedEmailId ? { ...e, category } : e));
    if (target) triggerPostActionSync('Kategorie geändert', [target]);
  };

  // Apply QuickStep action
  const handleApplyQuickStep = (qs: any) => {
    if (!selectedEmailId) {
      alert("Bitte wählen Sie zuerst eine E-Mail aus.");
      return;
    }
    const currentMail = emails.find(e => e.id === selectedEmailId);
    if (!currentMail) return;

    if (qs.action === 'forward') {
      setComposeMode('forward');
      setIsWritingEmail(true);
      setCurrentPage('mail');
      alert(`QuickStep '${qs.name}' ausgeführt: Das Mail-Schreibfenster wurde für '${currentMail.subject}' geladen.`);
    } else if (qs.action === 'mark_read_and_archive') {
      setEmails(prev => prev.map(e => e.id === selectedEmailId ? { ...e, category: qs.targetCategory || e.category } : e));
      setEmailsReadState([selectedEmailId], true);
      moveEmailsToFolder([selectedEmailId], 'archive');
      alert(`QuickStep '${qs.name}' ausgeführt: E-Mail als gelesen markiert und archiviert.`);
    } else if (qs.action === 'archive') {
      setEmails(prev => prev.map(e => e.id === selectedEmailId ? { ...e, category: qs.targetCategory || e.category } : e));
      moveEmailsToFolder([selectedEmailId], 'archive');
      alert(`QuickStep '${qs.name}' ausgeführt: In Archiv verschoben.`);
    } else if (qs.action === 'mark_read') {
      setEmailsReadState([selectedEmailId], true);
      alert(`QuickStep '${qs.name}' ausgeführt: Als gelesen markiert.`);
    } else if (qs.action === 'mark_unread') {
      setEmailsReadState([selectedEmailId], false);
      alert(`QuickStep '${qs.name}' ausgeführt: Als ungelesen markiert.`);
    } else if (qs.action === 'assign_category') {
      setEmails(prev => prev.map(e => e.id === selectedEmailId ? { ...e, category: qs.targetCategory } : e));
      triggerPostActionSync('Kategorie geändert', [currentMail]);
      alert(`QuickStep '${qs.name}' ausgeführt: Kategorie '${qs.targetCategory || 'Keine'}' zugewiesen.`);
    }
  };

  // CRUD handlers for custom Quicksteps
  const handleSaveQuickStep = () => {
    if (!qsName.trim()) {
      alert("Bitte geben Sie einen Namen für den QuickStep ein.");
      return;
    }

    if (editingQsId) {
      // Edit existing
      setQuickSteps(prev => prev.map(qs => qs.id === editingQsId ? {
        ...qs,
        name: qsName.trim(),
        color: qsColor,
        action: qsAction,
        targetCategory: qsTargetCategory || undefined
      } : qs));
      alert(`QuickStep "${qsName}" wurde erfolgreich aktualisiert.`);
    } else {
      // Add new
      const newQs = {
        id: `qs-custom-${Date.now()}`,
        name: qsName.trim(),
        color: qsColor,
        action: qsAction,
        targetCategory: qsTargetCategory || undefined
      };
      setQuickSteps(prev => [...prev, newQs]);
      alert(`QuickStep "${qsName}" wurde erfolgreich angelegt.`);
    }

    // Reset Form
    handleResetQuickStepForm();
  };

  const handleDeleteQuickStep = (id: string, name: string) => {
    if (confirm(`Möchten Sie den QuickStep "${name}" wirklich löschen?`)) {
      setQuickSteps(prev => prev.filter(qs => qs.id !== id));
      if (editingQsId === id) {
        handleResetQuickStepForm();
      }
    }
  };

  const handleResetQuickStepForm = () => {
    setQsName('');
    setQsColor('#3b82f6');
    setQsAction('mark_read_and_archive');
    setQsTargetCategory('');
    setEditingQsId(null);
  };

  // Reply All and Forward quick triggers
  const handleReplyAll = () => {
    if (!selectedEmailId) return;
    setComposeMode('replyAll');
    setIsWritingEmail(true);
    setCurrentPage('mail');
  };

  const handleForward = () => {
    if (!selectedEmailId) return;
    setComposeMode('forward');
    setIsWritingEmail(true);
    setCurrentPage('mail');
  };

  const createCalendarItem = (dateSeed: Date, defaultTitle = '', draft?: CalendarItemDraft) => {
    if (draft) {
      const cleanTitle = draft.title.trim();
      if (!cleanTitle) return;
      const startValue = draft.start || dateSeed.toISOString();
      const endValue = draft.end || startValue;
      const newItem: CalendarItem = {
        id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: cleanTitle,
        start: startValue,
        end: endValue,
        location: draft.location || '',
        description: draft.description || '',
        isAllDay: false
      };
      setCalendarItems(prev => [newItem, ...prev]);
      setSelectedCalendarId(newItem.id);
      setCurrentPage('calendar');
      setSyncStatusText(`Termin '${cleanTitle}' wurde gespeichert.`);
      return;
    }

    const title = safePrompt("Titel des neuen Termins:", defaultTitle);
    if (!title) return;
    const year = dateSeed.getFullYear();
    const month = String(dateSeed.getMonth() + 1).padStart(2, '0');
    const day = String(dateSeed.getDate()).padStart(2, '0');
    const timeStr = safePrompt("Uhrzeit (HH:MM):", "09:00") || "09:00";
    const location = safePrompt("Ort:") || "";
    const description = safePrompt("Beschreibung:") || "";
    const start = year + '-' + month + '-' + day + 'T' + timeStr + ':00';
    const endDate = new Date(start);
    endDate.setHours(endDate.getHours() + 1);
    const newItem = {
      id: 'cal-' + Date.now(),
      title,
      start,
      end: endDate.toISOString(),
      location,
      description
    };
    setCalendarItems(prev => [newItem, ...prev]);
    setSelectedCalendarId(newItem.id);
    setCurrentPage('calendar');
  };

  const handleCreateCalendarItemForDate = (date: Date, draft?: CalendarItemDraft) => {
    createCalendarItem(date, '', draft);
  };

  const handleNewCalendarItem = () => {
    const title = safePrompt("Titel des neuen Termins:");
    if (!title) return;
    const startStr = safePrompt("Startzeitpunkt (Format: YYYY-MM-DD THH:MM):", new Date().toISOString().substring(0, 16));
    if (!startStr) return;
    const location = safePrompt("Ort:") || "";
    
    const newItem = {
      id: `cal-${Date.now()}`,
      title,
      start: startStr,
      end: startStr,
      location,
      description: "Manuell erstellter Kalendereintrag."
    };
    setCalendarItems(prev => [newItem, ...prev]);
    setSelectedCalendarId(newItem.id);
    setCurrentPage('calendar');
    alert(`Termin '${title}' wurde erfolgreich im SQLite Kalender-Modul hinterlegt.`);
  };

  const handleNewContact = () => {
    const firstName = safePrompt("Vorname:");
    if (!firstName) return;
    const lastName = safePrompt("Nachname:") || "";
    const emailStr = safePrompt("E-Mail:") || "";
    const company = safePrompt("Firma:") || "";

    const newCon = {
      id: `con-${Date.now()}`,
      firstName,
      lastName,
      email: emailStr,
      phone: "+49 (0) 1234 56789",
      company,
      role: company ? 'CRM-Kontakt' : 'Kontakt',
      group: company ? 'Beruflich' : 'Privat',
      notes: "Neu angelegter Kontakt."
    };
    setContacts(prev => [newCon, ...prev]);
    setSelectedContactId(newCon.id);
    setCurrentPage('crm');
    alert(`Kontakt '${firstName} ${lastName}' wurde erfolgreich im Adressbuch gespeichert.`);
  };

  const [serverDiskCacheLoaded, setServerDiskCacheLoaded] = useState(false);

  const mergeSyncedEmails = (previous: Email[], accountEmail: string, syncedEmails: Email[]) => {
    const accountLower = accountEmail.toLowerCase();
    const guardedSyncedEmails = syncedEmails.map(guardBlockedSenderMail);
    const incomingById = new Map(guardedSyncedEmails.map(mail => [mail.id, mail]));
    const merged = previous.map(mail => {
      const owner = (mail.accountEmail || '').toLowerCase();
      if (owner !== accountLower) return mail;
      const incoming = incomingById.get(mail.id);
      if (!incoming) return mail;
      incomingById.delete(mail.id);
      return {
        ...mail,
        ...incoming,
        isPinned: mail.isPinned,
        isFavorite: mail.isFavorite,
        category: mail.category || incoming.category,
        reminderDate: mail.reminderDate,
        reminderNote: mail.reminderNote,
        reminderTriggered: mail.reminderTriggered
      };
    });

    return [...Array.from(incomingById.values()), ...merged].map(guardBlockedSenderMail);
  };

  useEffect(() => {
    if (!browserMailCacheLoaded || serverDiskCacheLoaded || accounts.length === 0) return;
    setServerDiskCacheLoaded(true);

    let cancelled = false;
    void (async () => {
      for (const account of accounts) {
        if (cancelled) return;
        try {
          const data = await enqueueBackgroundJob(`startup-cache:${account.email}`, 20, async () => {
            const response = await fetch(`/api/mail/cache/${encodeURIComponent(account.email)}`);
            if (!response.ok) return null;
            return response.json();
          });
          if (!data || cancelled) continue;
          const cachedFolders = Array.isArray(data.folders) ? data.folders : [];
          const cachedEmails = Array.isArray(data.emails) ? data.emails : [];

          if (cachedFolders.length > 0) {
            setAccounts(prev => prev.map(acc => (
              acc.email.toLowerCase() === account.email.toLowerCase() && !(acc.serverFolders && acc.serverFolders.length > 0)
                ? { ...acc, serverFolders: cachedFolders }
                : acc
            )));
          }

          if (cachedEmails.length > 0) {
            const nextFolder = pickVisibleFolderAfterSync(cachedEmails, cachedFolders);
            setEmails(prev => mergeSyncedEmails(prev, account.email, cachedEmails));
            if (!selectedEmailId) {
              setSelectedFolder(nextFolder);
              setSelectedEmailId(pickVisibleEmailAfterSync(cachedEmails, nextFolder));
            }
          }
        } catch {
          // Local cache is optional; the visible client still starts with browser storage.
        }
        await new Promise(resolve => window.setTimeout(resolve, 25));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accounts, browserMailCacheLoaded, serverDiskCacheLoaded]);
  const getMailUid = (mail: Email) => {
    const fromField = Number(mail.imapUid);
    if (Number.isFinite(fromField) && fromField > 0) return fromField;
    const match = mail.id.match(/-(\d+)$/);
    const fromId = match ? Number(match[1]) : NaN;
    return Number.isFinite(fromId) && fromId > 0 ? fromId : null;
  };

  const getAccountForMail = (mail: Email) => {
    const owner = (mail.accountEmail || activeAccountEmail || '').toLowerCase();
    return accounts.find(acc => acc.email.toLowerCase() === owner) || accounts[0];
  };
  useEffect(() => {
    const selectedMail = emails.find(mail => mail.id === selectedEmailId);
    const bodyLooksBroken = !!selectedMail?.body && (selectedMail.body.includes('\\uFFFD') || /[\\u00c3\\u00c2\\u00e2\\u00c6\\u00c5\\u00f0]/.test(selectedMail.body));
    if (!selectedMail || !selectedMail.imapUid || !selectedMail.imapFolder) return;
    const attachmentsNeedFullLoad = !!selectedMail.hasAttachment && (!Array.isArray(selectedMail.attachments) || selectedMail.attachments.length === 0 || selectedMail.attachments.some(item => !item.contentBase64));
    if (selectedMail.body && !bodyLooksBroken && !attachmentsNeedFullLoad) return;
    const account = getAccountForMail(selectedMail);
    if (!account) return;

    let cancelled = false;
    void (async () => {
      const password = await getSessionPassword(account);
      if (!password || cancelled) return;

      await enqueueBackgroundJob(`message-body:${selectedMail.id}`, 100, async () => {
          const response = await fetch('/api/mail/message-body', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: account.email,
              password,
              imapServer: account.imapServer,
              imapPort: account.imapPort,
              folder: selectedMail.imapFolder,
              uid: selectedMail.imapUid
            })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Nachrichtentext konnte nicht geladen werden.');
          return data.email as Email | undefined;
        })
        .then(fullEmail => {
          if (!fullEmail || cancelled) return;
          setEmails(prev => prev.map(mail => mail.id === selectedMail.id ? { ...mail, ...fullEmail } : mail));
        })
        .catch(error => {
          if (!cancelled) setSyncStatusText(`Nachrichtentext konnte nicht geladen werden: ${error.message || error}`);
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEmailId, emails, accounts]);


  const rememberSessionPassword = (email: string, password: string) => {
    setAccountSessionPasswords(prev => ({ ...prev, [email.toLowerCase()]: password }));
  };

  const persistAccountPassword = async (email: string, password: string) => {
    if (!email || !password) return;
    rememberSessionPassword(email, password);
    const nativeApi = (window as any).uniqueMailNative;
    const result = await nativeApi?.setAccountPassword?.({ email, password });
    if (result && result.ok === false) {
      setSyncStatusText(`Passwort konnte nicht dauerhaft gespeichert werden: ${result.error || 'Unbekannter Fehler'}`);
    }
  };

  const safePrompt = (message: string, defaultValue = '') => {
    try {
      return window.prompt(message, defaultValue);
    } catch {
      setSyncStatusText('Dialog blockiert: Diese Aktion nutzt noch eine alte Eingabeabfrage. Bitte die entsprechende neue Dialogfunktion verwenden.');
      return defaultValue || null;
    }
  };

  useEffect(() => {
    const openFeedbackDialog = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: FeedbackKind }>).detail;
      const type: FeedbackKind = detail?.type === 'feature' ? 'feature' : 'bug';
      setFeedbackDialog({ type, title: '', body: '', isSending: false });
    };
    window.addEventListener('unique-mail-feedback-open', openFeedbackDialog as EventListener);
    return () => window.removeEventListener('unique-mail-feedback-open', openFeedbackDialog as EventListener);
  }, []);

  const handleSubmitFeedback = async () => {
    if (!feedbackDialog) return;
    const title = feedbackDialog.title.trim();
    const body = feedbackDialog.body.trim();
    if (!title || !body || feedbackDialog.isSending) return;

    setFeedbackDialog(prev => prev ? { ...prev, isSending: true, error: undefined } : prev);
    try {
      const response = await fetch('/api/feedback/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: feedbackDialog.type, title, body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Feedback konnte nicht gesendet werden.');
      setFeedbackDialog(null);
      setSyncStatusText(feedbackDialog.type === 'bug' ? 'Bug Report wurde gesendet.' : 'Feature Request wurde gesendet.');
    } catch (error: any) {
      setFeedbackDialog(prev => prev ? { ...prev, isSending: false, error: error?.message || 'Feedback konnte nicht gesendet werden.' } : prev);
    }
  };
  const completeSessionPasswordRequest = (password: string | null) => {
    const resolver = sessionPasswordResolverRef.current;
    const requestEmail = sessionPasswordRequest?.email;
    sessionPasswordResolverRef.current = null;
    if (password && requestEmail) {
      void persistAccountPassword(requestEmail, password);
    }
    setSessionPasswordInput('');
    setSessionPasswordRequest(null);
    resolver?.(password);
  };

  const getSessionPassword = async (account: any): Promise<string | null> => {
    const key = account.email.toLowerCase();
    const existing = accountSessionPasswords[key];
    if (existing) return existing;

    const nativeApi = (window as any).uniqueMailNative;
    const stored = await nativeApi?.getAccountPassword?.(account.email).catch(() => null);
    if (stored?.password) {
      rememberSessionPassword(account.email, stored.password);
      return stored.password;
    }

    return new Promise<string | null>((resolve) => {
      sessionPasswordResolverRef.current?.(null);
      sessionPasswordResolverRef.current = resolve;
      setSessionPasswordInput('');
      setSessionPasswordRequest({ email: account.email });
    });
  };

  const getStoredAccountPasswordNoPrompt = async (account: any): Promise<string | null> => {
    if (!account?.email) return null;
    const key = account.email.toLowerCase();
    const existing = accountSessionPasswords[key];
    if (existing) return existing;

    const nativeApi = (window as any).uniqueMailNative;
    const stored = await nativeApi?.getAccountPassword?.(account.email).catch(() => null);
    if (stored?.password) {
      rememberSessionPassword(account.email, stored.password);
      return stored.password;
    }
    return null;
  };

  const uniqueAccountsForSync = (preferredAccounts: any[] = []) => {
    const active = accounts.find(acc => acc.email.toLowerCase() === activeAccountEmail.toLowerCase()) || accounts[0];
    const ordered = (preferredAccounts.length > 0 ? preferredAccounts : [active]).filter(Boolean);
    const seen = new Set<string>();
    return ordered.filter(account => {
      const key = String(account.email || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const accountsForEmails = (targetEmails: Email[]) => uniqueAccountsForSync(
    targetEmails
      .map(mail => getAccountForMail(mail))
      .filter(Boolean)
  );

  const runPostActionBackgroundSync = async (reason: string, preferredAccounts: any[] = []) => {
    if (isOffline || accounts.length === 0) return;
    if (postActionSyncInFlightRef.current || isSyncing) {
      postActionSyncQueuedRef.current = true;
      return;
    }

    postActionSyncInFlightRef.current = true;
    lastPostActionSyncAtRef.current = Date.now();
    setIsSyncing(true);
    setSyncProgress(18);
    setSyncStatusText(reason + ': Änderung wird synchronisiert, Server wird geprüft...');

    let syncedAccounts = 0;
    let syncedEmails = 0;
    let syncedFolders = 0;

    try {
      const candidates = uniqueAccountsForSync(preferredAccounts);
      for (const account of candidates) {
        const password = await getStoredAccountPasswordNoPrompt(account);
        if (!password) continue;

        setSyncProgress(prev => Math.max(25, Math.min(85, prev + 12)));
        setSyncStatusText(reason + ': Prüfe ' + account.email + ' auf neue Nachrichten...');
        const syncResult = await syncInboxForAccount(account, password);
        syncedAccounts += 1;
        syncedEmails += syncResult.emails.length;
        syncedFolders += syncResult.folders.length;

        if (syncResult.folders.length > 0) {
          setAccounts(prev => prev.map(acc => acc.email.toLowerCase() === account.email.toLowerCase()
            ? { ...acc, serverFolders: syncResult.folders }
            : acc
          ));
        }
        setEmails(prev => mergeSyncedEmails(prev, account.email, syncResult.emails));
      }

      setSyncProgress(100);
      setSyncStatusText(syncedAccounts > 0
        ? reason + ': synchronisiert. ' + syncedEmails + ' E-Mail(s) aus ' + syncedFolders + ' Serverordner(n) geprüft.'
        : reason + ': lokal gespeichert. Hintergrundabruf übersprungen, weil kein gespeichertes Kontopasswort verfügbar ist.'
      );
    } catch (error: any) {
      setSyncStatusText(reason + ': Hintergrundsync fehlgeschlagen: ' + (error.message || error));
    } finally {
      setIsSyncing(false);
      postActionSyncInFlightRef.current = false;
      if (postActionSyncQueuedRef.current) {
        postActionSyncQueuedRef.current = false;
        window.setTimeout(() => {
          void enqueueBackgroundJob('maintenance-sync:nachlauf', 10, () => runPostActionBackgroundSync('Nachlauf-Sync', preferredAccounts));
        }, 3500);
      }
    }
  };

  const triggerPostActionSync = (reason: string, targetEmails: Email[] = []) => {
    if (isOffline || accounts.length === 0) return;
    const preferredAccounts = accountsForEmails(targetEmails);
    if (postActionSyncTimerRef.current) window.clearTimeout(postActionSyncTimerRef.current);
    const elapsed = Date.now() - lastPostActionSyncAtRef.current;
    const delay = Math.max(2500, 15000 - elapsed);
    postActionSyncTimerRef.current = window.setTimeout(() => {
      postActionSyncTimerRef.current = null;
      void enqueueBackgroundJob(`maintenance-sync:${reason}`, 10, () => runPostActionBackgroundSync(reason, preferredAccounts));
    }, delay);
  };

  const resolveServerFolderPath = (account: any, role: 'deleted' | 'archive' | 'sent' | 'drafts' | 'junk') => {
    const folders = Array.isArray(account?.serverFolders) ? account.serverFolders : [];
    const candidates: Record<string, string[]> = {
      deleted: ['\\trash', 'trash', 'deleted', 'papierkorb', 'gelöscht', 'gelöschte'],
      archive: ['\\archive', 'archive', 'archiv'],
      sent: ['\\sent', 'sent', 'gesendet'],
      drafts: ['\\drafts', 'draft', 'entwurf', 'entwürfe'],
      junk: ['\\junk', 'junk', 'spam']
    };
    const needles = candidates[role] || [role];
    const bySpecial = folders.find((folder: any) => needles.some(needle => (folder.specialUse || '').toLowerCase().includes(needle.replace('\\', ''))));
    if (bySpecial?.path || bySpecial?.id) return bySpecial.path || bySpecial.id;
    const byPath = folders.find((folder: any) => {
      const value = `${folder.path || folder.id || ''} ${folder.label || ''}`.toLowerCase();
      return needles.some(needle => value.includes(needle.replace('\\', '')));
    });
    return byPath?.path || byPath?.id || role;
  };

  const postReadStateForEmails = async (targetEmails: Email[], isRead: boolean) => {
    const groups = new Map<string, { account: any; folder: string; uids: number[] }>();
    for (const mail of targetEmails) {
      const account = getAccountForMail(mail);
      const uid = getMailUid(mail);
      const folder = mail.imapFolder || mail.folder || 'inbox';
      if (!account || !uid || !folder) continue;
      const key = `${account.email.toLowerCase()}::${folder}`;
      const group = groups.get(key) || { account, folder, uids: [] };
      group.uids.push(uid);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      const password = await getSessionPassword(group.account);
      if (!password) {
        setSyncStatusText('Lesestatus nur lokal geändert: Passwort wurde nicht eingegeben.');
        continue;
      }
      const response = await fetch('/api/mail/messages/read-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: group.account.email,
          password,
          imapServer: group.account.imapServer,
          imapPort: group.account.imapPort,
          folder: group.folder,
          uids: group.uids,
          isRead
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Lesestatus konnte nicht synchronisiert werden.');
      }
    }
  };

  const postMoveForEmails = async (targetEmails: Email[], targetRole: 'deleted' | 'archive' | 'junk') => {
    const groups = new Map<string, { account: any; folder: string; destinationFolder: string; uids: number[] }>();
    for (const mail of targetEmails) {
      const account = getAccountForMail(mail);
      const uid = getMailUid(mail);
      const folder = mail.imapFolder || mail.folder || 'inbox';
      if (!account || !uid || !folder) continue;
      const destinationFolder = resolveServerFolderPath(account, targetRole);
      const key = `${account.email.toLowerCase()}::${folder}::${destinationFolder}`;
      const group = groups.get(key) || { account, folder, destinationFolder, uids: [] };
      group.uids.push(uid);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      const password = await getSessionPassword(group.account);
      if (!password) {
        setSyncStatusText('Verschieben nur lokal durchgeführt: Passwort wurde nicht eingegeben.');
        continue;
      }
      const response = await fetch('/api/mail/messages/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: group.account.email,
          password,
          imapServer: group.account.imapServer,
          imapPort: group.account.imapPort,
          folder: group.folder,
          destinationFolder: group.destinationFolder,
          uids: group.uids
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Nachrichten konnten nicht verschoben werden.');
      }

      const uidMap = Array.isArray(data.uidMap) ? data.uidMap : [];
      if (uidMap.length > 0) {
        setEmails(prev => prev.map(mail => {
          const account = getAccountForMail(mail);
          const uid = getMailUid(mail);
          const mapped = uidMap.find((item: any) => Number(item.from) === uid);
          const folder = mail.imapFolder || mail.folder || 'inbox';
          if (!mapped || !account || account.email.toLowerCase() !== group.account.email.toLowerCase() || folder !== group.folder) return mail;
          const nextUid = Number(mapped.to);
          return {
            ...mail,
            id: `imap-${group.account.email}-${group.destinationFolder}-${nextUid}`,
            folder: group.destinationFolder,
            imapFolder: group.destinationFolder,
            imapUid: nextUid
          };
        }));
      }
    }
  };

  const postMoveForEmailsToFolder = async (targetEmails: Email[], destinationFolder: string) => {
    const groups = new Map<string, { account: any; folder: string; uids: number[] }>();
    for (const mail of targetEmails) {
      const account = getAccountForMail(mail);
      const uid = getMailUid(mail);
      const folder = mail.imapFolder || mail.folder || 'inbox';
      if (!account || !uid || !folder || folder === destinationFolder) continue;
      const key = account.email.toLowerCase() + '::' + folder;
      const group = groups.get(key) || { account, folder, uids: [] };
      group.uids.push(uid);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      const password = await getSessionPassword(group.account);
      if (!password) {
        setSyncStatusText('Verschieben nur lokal durchgeführt: Passwort wurde nicht eingegeben.');
        continue;
      }
      const response = await fetch('/api/mail/messages/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: group.account.email,
          password,
          imapServer: group.account.imapServer,
          imapPort: group.account.imapPort,
          folder: group.folder,
          destinationFolder,
          uids: group.uids
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Nachrichten konnten nicht verschoben werden.');
      }

      const uidMap = Array.isArray(data.uidMap) ? data.uidMap : [];
      if (uidMap.length > 0) {
        setEmails(prev => prev.map(mail => {
          const account = getAccountForMail(mail);
          const uid = getMailUid(mail);
          const mapped = uidMap.find((item: any) => Number(item.from) === uid);
          const folder = mail.imapFolder || mail.folder || 'inbox';
          if (!mapped || !account || account.email.toLowerCase() !== group.account.email.toLowerCase() || folder !== group.folder) return mail;
          const nextUid = Number(mapped.to);
          return {
            ...mail,
            id: 'imap-' + group.account.email + '-' + destinationFolder + '-' + nextUid,
            folder: destinationFolder,
            imapFolder: destinationFolder,
            imapUid: nextUid
          };
        }));
      }
    }
  };

  const moveEmailsToSpecificFolder = (ids: string[], destinationFolder: string) => {
    const targetEmails = emails.filter(mail => ids.includes(mail.id));
    if (targetEmails.length === 0) return;
    setEmails(prev => prev.map(mail => ids.includes(mail.id) ? { ...mail, folder: destinationFolder, imapFolder: destinationFolder } : mail));
    setSelectedEmailId(null);
    void enqueueBackgroundJob(`move-folder:${destinationFolder}:${ids.join(',')}`, 90, () => postMoveForEmailsToFolder(targetEmails, destinationFolder))
      .then(() => setSyncStatusText(ids.length + ' E-Mail(s) nach ' + destinationFolder + ' verschoben und synchronisiert.'))
      .catch((error) => setSyncStatusText('Verschieben lokal durchgeführt, Server-Sync fehlgeschlagen: ' + (error.message || error)))
      .finally(() => triggerPostActionSync('Verschieben', targetEmails));
  };
  const setEmailsReadState = (ids: string[], isRead: boolean) => {
    const targetEmails = emails.filter(mail => ids.includes(mail.id));
    if (targetEmails.length === 0) return;
    setEmails(prev => prev.map(mail => ids.includes(mail.id) ? { ...mail, isRead } : mail));
    void enqueueBackgroundJob(`read-state:${isRead}:${ids.join(',')}`, 90, () => postReadStateForEmails(targetEmails, isRead))
      .then(() => setSyncStatusText(`${ids.length} E-Mail(s) ${isRead ? 'als gelesen' : 'als ungelesen'} synchronisiert.`))
      .catch((error) => setSyncStatusText(`Lesestatus lokal geändert, Server-Sync fehlgeschlagen: ${error.message || error}`))
      .finally(() => triggerPostActionSync(isRead ? 'Als gelesen markieren' : 'Als ungelesen markieren', targetEmails));
  };

  const moveEmailsToFolder = (ids: string[], targetRole: 'deleted' | 'archive' | 'junk') => {
    const targetEmails = emails.filter(mail => ids.includes(mail.id));
    if (targetEmails.length === 0) return;
    setEmails(prev => prev.map(mail => {
      if (!ids.includes(mail.id)) return mail;
      const account = getAccountForMail(mail);
      const localTarget = account ? resolveServerFolderPath(account, targetRole) : targetRole;
      return { ...mail, folder: localTarget, imapFolder: localTarget };
    }));
    setSelectedEmailId(null);
    void enqueueBackgroundJob(`move-role:${targetRole}:${ids.join(',')}`, 90, () => postMoveForEmails(targetEmails, targetRole))
      .then(() => setSyncStatusText(`${ids.length} E-Mail(s) nach ${targetRole === 'deleted' ? 'Papierkorb' : targetRole === 'junk' ? 'Spam/Junk' : 'Archiv'} verschoben und synchronisiert.`))
      .catch((error) => setSyncStatusText(`Verschieben lokal durchgeführt, Server-Sync fehlgeschlagen: ${error.message || error}`))
      .finally(() => triggerPostActionSync(targetRole === 'deleted' ? 'Löschen' : targetRole === 'junk' ? 'Spam/Junk' : 'Archivieren', targetEmails));
  };
  // Options add/remove multiple accounts
  const syncInboxForAccount = async (account: any, password: string): Promise<{ emails: Email[]; folders: any[] }> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch('/api/mail/sync-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          email: account.email,
          password,
          imapServer: account.imapServer,
          imapPort: account.imapPort
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'IMAP-Synchronisation fehlgeschlagen.');
      }

      return {
        emails: Array.isArray(data.emails) ? data.emails : [],
        folders: Array.isArray(data.folders) ? data.folders : []
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('IMAP-Verbindung nach 3 Minuten abgebrochen. Bitte Server, Port, Passwort und Internetverbindung pruefen.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const addAccountAndSync = async (newAccount: any, emailSeed: string, password: string) => {
    setAccounts(prev => prev.some(acc => acc.email.toLowerCase() === emailSeed.toLowerCase()) ? prev : [...prev, newAccount]);
    setActiveAccountEmail(emailSeed);
    setSelectedEmailId(null);
    setCurrentPage('mail');
    setSelectedFolder('inbox');
    setActiveTab('start');
    setIsOptionsSyncing(true);
    setOptionsSyncLogs(prev => [...prev, `[IMAP] Verbinde mit ${newAccount.imapServer}:${newAccount.imapPort} und lade Serverordner...`]);

    try {
      await persistAccountPassword(emailSeed, password);
      const syncResult = await syncInboxForAccount(newAccount, password);
      const syncedEmails = syncResult.emails;
      const serverFolders = syncResult.folders;
      if (serverFolders.length > 0) {
        setAccounts(prev => prev.map(acc => acc.email.toLowerCase() === emailSeed.toLowerCase() ? { ...acc, serverFolders } : acc));
      }
      const nextFolder = pickVisibleFolderAfterSync(syncedEmails, serverFolders);
      setEmails(prev => mergeSyncedEmails(prev, emailSeed, syncedEmails));
      setSelectedFolder(nextFolder);
      setSelectedEmailId(pickVisibleEmailAfterSync(syncedEmails, nextFolder));
      setOptionsSyncLogs(prev => [...prev, `[OK] ${syncedEmails.length} E-Mail(s) aus allen Serverordnern geladen.`]);
    } catch (error: any) {
      setOptionsSyncLogs(prev => [...prev, `[FEHLER] ${error.message || 'IMAP-Synchronisation fehlgeschlagen.'}`]);
      alert(`Konto ${emailSeed} wurde gespeichert, aber der Mailabruf ist fehlgeschlagen:\n\n${error.message || error}`);
    } finally {
      setIsOptionsSyncing(false);
      setNewAccEmail('');
      setNewAccPass('');
    }
  };

  const handleOptionsAddAccount = () => {
    if (!newAccEmail || !newAccEmail.includes('@')) {
      alert("Bitte geben Sie eine gültige E-Mail-Adresse ein.");
      return;
    }

    if (!newAccPass) {
      alert("Bitte geben Sie das Passwort oder App-Passwort des E-Mail-Kontos ein.");
      return;
    }

    const emailSeed = normalizeEmailAddressForProvider(newAccEmail);
    const accountDisplayName = (newAccDisplayName.trim() || emailSeed);

    if (accounts.map(a => a.email.toLowerCase()).includes(emailSeed.toLowerCase())) {
      alert("Dieses Konto ist bereits im Client konfiguriert.");
      return;
    }

    if (newAccUseAutodiscovery) {
      setIsOptionsSyncing(true);
      setOptionsSyncLogs(["[INFO] Serverdaten werden vorbereitet..."]);
      
      setTimeout(() => {
        setOptionsSyncLogs(prev => [...prev, `[OK] Domain '${emailSeed.split('@')[1]}' ausgewertet.`]);
      }, 600);

      setTimeout(() => {
        setOptionsSyncLogs(prev => [...prev, `[OK] IMAP-Port 993/TLS ausgewaehlt.`]);
      }, 1200);

      setTimeout(() => {
        setOptionsSyncLogs(prev => [...prev, `[INFO] Lokaler Cache wird fuer dieses Konto vorbereitet.`]);
      }, 1800);

      setTimeout(() => {
        void (async () => {
        const settings = await resolveServerSettingsOnline(emailSeed);
        setOptionsSyncLogs(prev => [...prev, `[OK] ${settings.provider} erkannt: ${settings.imapServer}:${settings.imapPort}`]);
        const newAccount = {
          email: emailSeed,
          displayName: accountDisplayName,
          senderName: accountDisplayName,
          imapServer: settings.imapServer,
          imapPort: settings.imapPort,
          smtpServer: settings.smtpServer,
          smtpPort: settings.smtpPort,
          provider: settings.provider,
          customFolders: []
        };

        void addAccountAndSync(newAccount, emailSeed, newAccPass);
        })();
      }, 2500);

    } else {
      const providerName = newAccProvider || 'Postkontoverbindung';
      const newAccount = {
        email: emailSeed,
        displayName: accountDisplayName,
        senderName: accountDisplayName,
        imapServer: newAccImapServer,
        imapPort: newAccImapPort,
        smtpServer: newAccSmtpServer,
        smtpPort: newAccSmtpPort,
        provider: providerName,
        customFolders: []
      };

      void addAccountAndSync(newAccount, emailSeed, newAccPass);
    }
  };

  const handleRemoveAccount = (emailToRemove: string) => {
    if (window.confirm(`Möchten Sie das Konto ${emailToRemove} wirklich entfernen?`)) {
      const remainingAccs = accounts.filter(a => a.email.toLowerCase() !== emailToRemove.toLowerCase());
      setAccounts(remainingAccs);
      if (activeAccountEmail.toLowerCase() === emailToRemove.toLowerCase()) {
        setActiveAccountEmail(remainingAccs[0]?.email || '');
        setSelectedEmailId(null);
      }
    }
  };

  // Mark email as read
  const handleMarkAsRead = (id: string) => {
    const current = emails.find(e => e.id === id);
    if (!current || current.isRead) return;
    setEmailsReadState([id], true);
  };

  // Change task percentage
  const selectedEmailForActions = emails.find(e => e.id === selectedEmailId) || null;

  const toggleEmailPinById = (id: string) => {
    const target = emails.find(e => e.id === id);
    if (!target) return;
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isPinned: !e.isPinned } : e));
    triggerPostActionSync('Markierung geändert', [target]);
  };

  const toggleEmailFavoriteById = (id: string) => {
    const target = emails.find(e => e.id === id);
    if (!target) return;
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isFavorite: !e.isFavorite } : e));
    triggerPostActionSync('Favorit geändert', [target]);
  };

  const handleToggleSelectedPin = () => {
    if (!selectedEmailId) return;
    toggleEmailPinById(selectedEmailId);
  };

  const handleToggleSelectedFavorite = () => {
    if (!selectedEmailId) return;
    toggleEmailFavoriteById(selectedEmailId);
  };

  const handleToggleSelectedReadUnread = () => {
    const current = emails.find(e => e.id === selectedEmailId);
    if (current) setEmailsReadState([current.id], !current.isRead);
  };

  const handleBlockSelectedSender = () => {
    const current = emails.find(e => e.id === selectedEmailId);
    const sender = current ? extractSenderAddress(current) : '';
    if (!sender) {
      setSyncStatusText('Absender konnte nicht ermittelt werden.');
      return;
    }
    blockSender(sender);
  };

  const handleChangeTaskPercent = (id: string, newPercent: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          percentComplete: newPercent,
          isCompleted: newPercent === 100
        };
      }
      return t;
    }));
  };

  // Page change with security lock verification
  const renderSenderRuleList = (
    title: string,
    description: string,
    entries: string[],
    setEntries: React.Dispatch<React.SetStateAction<string[]>>,
    emptyText: string
  ) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2">
      <div>
        <h4 className="text-[10.5px] font-extrabold text-slate-800 uppercase tracking-wider">{title}</h4>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-4">{description}</p>
      </div>
      <div className="space-y-1.5">
        {entries.length === 0 && <div className="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-2">{emptyText}</div>}
        {entries.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={entry}
              onChange={(e) => setEntries(prev => prev.map((item, itemIndex) => itemIndex === index ? e.target.value : item))}
              onBlur={() => setEntries(prev => uniqueSenderList(prev))}
              className="flex-1 text-[11px] p-2 border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-none focus:border-[#0078d4]"
              placeholder="absender@domain.de"
            />
            <button
              type="button"
              onClick={() => setEntries(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
              className="px-2 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-100"
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setEntries(prev => [...prev, ''])}
        className="text-[10px] font-extrabold text-[#0078d4] hover:underline"
      >
        Eintrag hinzufügen
      </button>
    </div>
  );
  const handlePageChange = (page: AppPage) => {
    if (page === 'dev' && !isWpfUnlocked) {
      setPwdValue('');
      setPwdError('');
      setShowPwdModal(true);
    } else {
      setCurrentPage(page);
      setActiveTab(page === 'dev' ? 'dev' : 'start');
    }
  };

  const handleVerifyPassword = () => {
    const trimmed = pwdValue.trim();
    if (trimmed === '4620' || trimmed.includes('4620') || trimmed.toLowerCase() === 'admin') {
      setIsWpfUnlocked(true);
      localStorage.setItem('outlook_wpf_unlocked', 'true');
      setShowPwdModal(false);
      setCurrentPage('dev');
      setActiveTab('dev');
    } else {
      setPwdError('Falscher Systemschlüssel (Passwort: 4620). Zugriff verweigert.');
    }
  };

  return (
    <div id="outlook-app-frame" className="h-screen w-full flex flex-col bg-white overflow-hidden text-[#323130] font-sans text-xs">
      {appLockConfig?.enabled && !isAppUnlocked && (
        <div id="unique-app-lock-overlay" className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleUnlockApp();
            }}
            className="w-[420px] max-w-full rounded-2xl border border-blue-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0078d4] shadow-inner">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h2 className="text-base font-black text-slate-900">Unique Mail ist geschützt</h2>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">Bitte geben Sie Ihr App-Passwort ein.</p>
            </div>
            <input
              autoFocus
              type="password"
              value={appUnlockPassword}
              onChange={(event) => {
                setAppUnlockPassword(event.target.value);
                setAppUnlockError('');
              }}
              className="w-full rounded-xl border border-slate-250 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#0078d4] focus:ring-4 focus:ring-blue-100"
              placeholder="App-Passwort"
            />
            {appUnlockError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{appUnlockError}</div>}
            <button type="submit" className="mt-4 w-full rounded-xl bg-[#0078d4] px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#106ebe]">
              Entsperren
            </button>
          </form>
        </div>
      )}

      
      {/* 1. Ribbon Bar Component */}
      <Ribbon 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewEmail={handleNewEmailTrigger}
        onTriggerSync={handleTriggerSync}
        isOffline={isOffline}
        toggleOffline={handleToggleOffline}
        currentPage={currentPage}
        setCurrentPage={handlePageChange}
        selectedEmailId={selectedEmailId}
        onReply={handleReplyMail}
        onDeleteMail={handleDeleteMail}
        onToggleSelectedPin={handleToggleSelectedPin}
        onToggleSelectedReadUnread={handleToggleSelectedReadUnread}
        onToggleSelectedFavorite={handleToggleSelectedFavorite}
        selectedEmailIsRead={selectedEmailForActions?.isRead ?? true}
        selectedEmailIsPinned={!!selectedEmailForActions?.isPinned}
        selectedEmailIsFavorite={!!selectedEmailForActions?.isFavorite}
        activeDevSection={activeDevSection}
        setActiveDevSection={setActiveDevSection}
        userEmail={activeAccountEmail}
        isDense={isDense}
        setIsDense={setIsDense}
        onOpenOptions={() => setIsOptionsModalOpen(true)}
        isSyncing={isSyncing}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onArchiveMail={handleArchiveMail}
        onReportPhishing={handleReportPhishing}
        onMarkAllAsRead={handleMarkAllAsRead}
        onAddFolder={handleAddFolder}
        onToggleFlag={handleToggleFlag}
        onCategorySelect={handleCategorySelect}
        quickSteps={quickSteps}
        onApplyQuickStep={handleApplyQuickStep}
        onReplyAll={handleReplyAll}
        onForward={handleForward}
        onNewCalendarItem={handleNewCalendarItem}
        onNewContact={handleNewContact}
        categoriesList={categoriesList}
        onManageCategories={() => setShowCategoriesModal(true)}
        onDeleteCategoryGlobal={handleDeleteCategoryGlobal}
        onManageQuickSteps={() => setShowQuickStepsModal(true)}
      />

      {/* 2. Main Workspace Layout Area */}
      <div id="outlook-workspace" className="flex-1 flex overflow-hidden min-h-0 min-w-0 max-w-full">
        
        {/* Navigation Rail extreme left */}
        <NavigationRail 
          currentPage={currentPage}
          setCurrentPage={handlePageChange}
        />

        {/* Dynamic Inner Layout Page depending on selection */}
        {accounts.length === 0 ? (
          <div className="flex-1 bg-slate-50/50 dark:bg-[#0b0f19] flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-white dark:bg-[#0f172a] border border-slate-205 dark:border-[#1e293b] rounded-3xl shadow-2xl w-full max-w-xl p-8 flex flex-col relative overflow-hidden transition-all">
              {/* Upper styling decor for WPF feel */}
              <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-[#0078d4] via-purple-600 to-emerald-500"></div>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#0078d4] text-white flex items-center justify-center mx-auto mb-4.5 shadow-lg shadow-[#0078d4]/10">
                  <Mail className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Konto einrichten
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed font-semibold font-sans">
                  Willkommen bei <b>Unique Mail GmbH</b>. Es ist derzeit keine aktive IMAP-Mailschnittstelle parametrisiert. Bitte verbinden Sie Ihr E-Mail-Konto.
                </p>
              </div>

              {/* Form area */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                    Kontoname / Absendername:
                  </label>
                  <input
                    type="text"
                    {...accountInputGuards}
                    value={newAccDisplayName}
                    onChange={(e) => setNewAccDisplayName(e.target.value)}
                    placeholder="z.B. Stefan Steiner"
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078d4]/20 focus:border-[#0078d4] text-slate-800 dark:text-white font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      E-Mail-Adresse:
                    </label>
                    <input 
                      type="email"
                      {...accountInputGuards}
                      value={newAccEmail}
                      onChange={(e) => setNewAccEmail(e.target.value)}
                      placeholder="z.B. name@domain.de"
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078d4]/20 focus:border-[#0078d4] text-slate-800 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                      Gegenstellen-Passwort:
                    </label>
                    <input 
                      type="password"
                      {...accountInputGuards}
                      value={newAccPass}
                      onChange={(e) => setNewAccPass(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078d4]/20 focus:border-[#0078d4] text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <input 
                    type="checkbox"
                    id="wizard-autodiscover"
                    checked={newAccUseAutodiscovery}
                    onChange={(e) => setNewAccUseAutodiscovery(e.target.checked)}
                    className="rounded h-4 w-4 accent-[#0078d4] cursor-pointer"
                    disabled={isOptionsSyncing}
                  />
                  <label htmlFor="wizard-autodiscover" className="text-[11.5px] text-slate-705 dark:text-slate-300 font-extrabold select-none cursor-pointer">
                    DNS Autodiscover-Dienst zur automatischen Portsuche auslösen (Empfohlen)
                  </label>
                </div>

                {/* Manual details expand */}
                {!newAccUseAutodiscovery && (
                  <div className="p-4 bg-slate-50 dark:bg-[#1e293b]/50 rounded-2xl border border-slate-200 dark:border-[#334155] space-y-3 shadow-inner-sm overflow-y-auto max-h-52">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">IMAP Server:</label>
                        <input 
                          type="text" 
                          {...accountInputGuards}
                          value={newAccImapServer} 
                          onChange={(e) => setNewAccImapServer(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-lg text-xs font-mono text-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Port (SSL/TLS):</label>
                        <input 
                          type="number" 
                          {...accountInputGuards}
                          value={newAccImapPort} 
                          onChange={(e) => setNewAccImapPort(parseInt(e.target.value) || 993)}
                          className="w-full p-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-lg text-xs font-mono text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">SMTP Server:</label>
                        <input 
                          type="text" 
                          {...accountInputGuards}
                          value={newAccSmtpServer} 
                          onChange={(e) => setNewAccSmtpServer(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-lg text-xs font-mono text-slate-805 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Port (SMTP):</label>
                        <input 
                          type="number" 
                          {...accountInputGuards}
                          value={newAccSmtpPort} 
                          onChange={(e) => setNewAccSmtpPort(parseInt(e.target.value) || 465)}
                          className="w-full p-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-lg text-xs font-mono text-slate-805 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Anbieter Name:</label>
                      <input 
                        type="text" 
                        {...accountInputGuards}
                        value={newAccProvider} 
                        onChange={(e) => setNewAccProvider(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-lg text-xs font-mono text-slate-805 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Sync Logging Stream */}
                {isOptionsSyncing && (
                  <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-[10.5px] font-mono h-32 overflow-y-auto space-y-1.5 shadow-inner border border-slate-800 leading-relaxed select-text">
                    {optionsSyncLogs.map((log, li) => (
                      <p key={li} className="animate-fade-in">✓ {log}</p>
                    ))}
                    <div className="flex items-center space-x-2.5 pt-1.5 font-bold animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      <span className="text-amber-400">{latestOptionsSyncStatus}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleOptionsAddAccount}
                    disabled={isOptionsSyncing}
                    className="px-6 py-2.5 text-xs bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-xl font-bold tracking-wide shadow-lg cursor-pointer transition-all flex items-center space-x-2"
                  >
                    {isOptionsSyncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verbindungsaufbau läuft...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Konto verbinden (via IMAP)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : currentPage === 'dev' ? (
          
          /* --- DESIGN WORKSPACE FOR DEVELOPERS (ARCH & ROADMAP) --- */
          <ArchTab 
            activeDevSection={activeDevSection}
            setActiveDevSection={setActiveDevSection}
            roadmapPhases={roadmapPhases}
            codeFiles={wpfCodeFiles}
            userEmail={activeAccountEmail}
            onAccountConfigured={handleAccountConfigured}
            discoveredSettings={discoveredSettings}
          />

        ) : currentPage === 'notes' ? (

          /* --- TRADITIONAL CLASSIC OUTLOOK STICKY NOTES CANVAS --- */
          <NotesView 
            notes={notes}
            setNotes={setNotes}
            accounts={accounts}
            activeAccountEmail={activeAccountEmail}
          />

        ) : (

          /* --- TRADITIONAL CLASSIC 3-COLUMN OUTLOOK STRUCTURE --- */
          <>
            {/* Column 1: Mail Folder Hierarchies */}
            {currentPage === 'mail' && (
              <FolderTree 
                selectedFolder={selectedFolder}
                setSelectedFolder={setSelectedFolder}
                emails={emails}
                isOffline={isOffline}
                accounts={accounts}
                activeAccountEmail={activeAccountEmail}
                setActiveAccountEmail={setActiveAccountEmail}
                onMoveEmailsToFolder={moveEmailsToSpecificFolder}
              />
            )}

            {/* Column 2: Items list browser (Emails, Tasks, Calendar list format, Contacts card browse) */}
            <ItemList 
              currentPage={currentPage}
              emails={emails}
              selectedEmailId={selectedEmailId}
              setSelectedEmailId={setSelectedEmailId}
              contacts={combinedContacts}
              selectedContactId={selectedContactId}
              setSelectedContactId={setSelectedContactId}
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              setSelectedTaskId={setSelectedTaskId}
              calendarItems={calendarItems}
              selectedCalendarId={selectedCalendarId}
              setSelectedCalendarId={setSelectedCalendarId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterUnreadOnly={filterUnreadOnly}
              setFilterUnreadOnly={setFilterUnreadOnly}
              isDense={isDense}
              activeAccountEmail={activeAccountEmail}
              selectedFolder={selectedFolder}
              onReplyMail={handleReplyMail}
              onReplyAll={handleReplyAll}
              onForwardMail={handleForward}
              onDeleteMail={handleDeleteMail}
              onArchiveMail={handleArchiveMail}
              onReportPhishing={handleReportPhishing}
              onToggleFlag={handleToggleFlag}
              onToggleFlagCompleted={handleToggleFlagCompleted}
              onToggleReadUnread={(id) => {
                const current = emails.find(e => e.id === id);
                if (current) setEmailsReadState([id], !current.isRead);
              }}
              onTogglePin={toggleEmailPinById}
              onToggleFavorite={toggleEmailFavoriteById}
              onDeleteEmails={(ids) => moveEmailsToFolder(ids, 'deleted')}
              onSetEmailsReadState={(ids, isRead) => setEmailsReadState(ids, isRead)}
              categoriesList={categoriesList}
              onSetReminder={handleOpenSetReminder}
              contactSortLabels={contactSortLabels}
              onContactSortLabelsChange={setContactSortLabels}
              onNewContact={handleNewContact}
            />

            {/* Column 3: Rich detail viewer reading pane */}
            <ReadingPane 
              currentPage={currentPage}
              emails={emails}
              selectedEmailId={selectedEmailId}
              contacts={combinedContacts}
              selectedContactId={selectedContactId}
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onChangeTaskPercent={handleChangeTaskPercent}
              onMarkEmailAsRead={handleMarkAsRead}
              autoMarkAsReadOnOpen={autoMarkAsReadOnOpen}
              calendarItems={calendarItems}
              selectedCalendarId={selectedCalendarId}
              isWritingEmail={isWritingEmail}
              setIsWritingEmail={setIsWritingEmail}
              composeMode={composeMode}
              onSendEmail={handleSendEmail}
              onSaveDraft={handleSaveDraft}
              onRetryOutboxEmail={handleRetryOutboxEmail}
              onEditStoredEmail={handleEditStoredEmail}
              onAddContact={handleSaveSuggestedContact}
              onSetReminder={handleOpenSetReminder}
              onOpenEmailAttachment={handleOpenEmailAttachment}
              onToggleFlagCompleted={handleToggleFlagCompleted}
              signatureActive={signatureActive}
              signatureText={activeSignatureText}
              imageDownloadAllowList={imageDownloadAllowList}
              imageDownloadDenyList={imageDownloadDenyList}
              blockedSenderList={blockedSenderList}
              onAllowImagesForSender={allowImagesForSender}
              onDenyImagesForSender={denyImagesForSender}
              onBlockSender={blockSender}
              attachmentDownloadDirectory={attachmentDownloadDirectory}
              accounts={accounts}
              activeAccountEmail={activeAccountEmail}
              onCreateCalendarItemForDate={handleCreateCalendarItemForDate}
            />
          </>

        )}

      </div>

      {/* 3. Footer Accent Status bar */}
      <div id="outlook-statusbar" className="h-6 bg-[#f3f2f1] border-t border-[#dedede] flex items-center justify-between px-3 text-[10.5px] select-none text-[#595959] shrink-0 font-sans">
        
        <div className="flex items-center space-x-3.5">
          <span className="font-medium">
            Elemente: {
              currentPage === 'mail' ? emails.length :
              currentPage === 'calendar' ? calendarItems.length :
              currentPage === 'contacts' || currentPage === 'crm' ? contacts.length :
              currentPage === 'tasks' ? tasks.length :
              currentPage === 'notes' ? notes.length : 1
            }
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 inline-block"></span>
            <span>Konzept: WPF Classic Desktop-Replika (C# .NET 8)</span>
          </div>
        </div>

        {/* Sync loading progress and Server Connect state */}
        <div className="flex items-center space-x-3 text-[10.5px]">
          {isSyncing && (
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-3 h-3 text-[#0078d4] animate-spin" />
              <div className="w-16 bg-slate-200 h-1.5 rounded overflow-hidden">
                <div style={{ width: `${syncProgress}%` }} className="bg-[#0078d4] h-full duration-300"></div>
              </div>
            </div>
          )}
          <span className="font-sans text-slate-550 font-medium">
            {syncStatusText}
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-700">
            100% Ordnergeschützt
          </span>
        </div>

      </div>

      {/* 4. WPF Options Modal Dialog ("Optionen") */}
      {isOptionsModalOpen && (
        <div id="outlook-options-modal" className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-fade-in">
          <div className="bg-slate-50 w-[920px] max-w-[calc(100vw-32px)] h-[680px] max-h-[calc(100vh-32px)] rounded-xl shadow-2xl border border-slate-205 flex flex-col overflow-hidden text-[#323130] font-sans">
            {/* Title Bar - Modern Clean Slate */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between font-bold text-xs select-none border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <Settings className="w-4 h-4 text-[#0078d4]" />
                <span className="uppercase tracking-wider">EINSTELLUNGEN</span>
              </div>
              <button 
                onClick={() => setIsOptionsModalOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content body split left/right */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left sidebar nav tabs */}
              <div className="w-56 bg-slate-100 border-r border-slate-200 flex flex-col p-3 space-y-1.5 select-none shrink-0 justify-between">
                <div className="space-y-1.5">
                  <button 
                    onClick={() => setOptionsActiveTab('general')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'general'
                        ? 'bg-white text-black shadow-xs border-l-3 border-l-[#0078d4]'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Allgemein
                  </button>                  <button 
                    onClick={() => setOptionsActiveTab('language')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'language'
                        ? 'bg-white text-blue-950 shadow-xs border-l-3 border-l-sky-500'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Sprache / Language
                  </button>
                  <button 
                    onClick={() => setOptionsActiveTab('accounts')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'accounts'
                        ? 'bg-white text-black shadow-xs border-l-3 border-l-[#0078d4]'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    E-Mail-Konten
                  </button>
                  <button 
                    onClick={() => setOptionsActiveTab('security')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'security'
                        ? 'bg-white text-red-950 shadow-xs border-l-3 border-l-red-500'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Bilder & Absender
                  </button>
                  <button 
                    onClick={() => setOptionsActiveTab('signature')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'signature'
                        ? 'bg-white text-purple-950 shadow-xs border-l-3 border-l-purple-500'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Signatur
                  </button>
                  <button 
                    onClick={() => setOptionsActiveTab('vacation')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'vacation'
                        ? 'bg-white text-orange-950 shadow-xs border-l-3 border-l-orange-500'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Abwesenheit
                  </button>
                  <button 
                    onClick={() => setOptionsActiveTab('ai')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'ai'
                        ? 'bg-white text-purple-950 shadow-xs border-l-3 border-l-purple-500'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    KI-Agent Setup
                  </button>
                  <button 
                    onClick={() => setOptionsActiveTab('help')}
                    className={`w-full text-left px-3.5 py-2 rounded-xl transition-all font-bold text-[11px] cursor-pointer ${
                      optionsActiveTab === 'help'
                        ? 'bg-white text-teal-950 shadow-xs border-l-3 border-l-teal-500'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Hilfe und Sonstiges
                  </button>
                  <button className="text-left px-3.5 py-2 rounded-xl text-slate-400 text-[11px] opacity-70 cursor-not-allowed font-medium">
                    SQLite Datenbank
                  </button>
                  <button className="text-left px-3.5 py-2 rounded-xl text-slate-400 text-[11px] opacity-70 cursor-not-allowed font-medium">
                    WPF Frontend (STA)
                  </button>
                  <button className="text-left px-3.5 py-2 rounded-xl text-slate-400 text-[11px] opacity-70 cursor-not-allowed font-medium">
                    Sicherheit & SPF
                  </button>
                </div>
                <div className="p-2 border-t border-slate-200 text-[9px] text-slate-500 font-mono font-bold leading-relaxed">
                  Unique Mail v{APP_VERSION}<br />
                  Installierte Desktop-Version
                </div>
              </div>

              {/* Right content display panel */}
              <div className="flex-1 min-w-0 bg-white p-5 overflow-y-auto">
                {optionsActiveTab === 'general' ? (
                  <div className="space-y-5 animate-fade-in">
                    <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest pb-2 border-b-2 border-slate-200">
                        Allgemeine Einstellungen
                      </h3>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Mail beim Öffnen automatisch als gelesen markieren</p>
                          <p className="text-[10px] text-slate-500 mt-1 leading-4">Wenn deaktiviert, bleibt eine ungelesene Mail auch nach dem Anklicken ungelesen, bis sie manuell umgestellt wird.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                          <input
                            type="checkbox"
                            checked={autoMarkAsReadOnOpen}
                            onChange={(e) => setAutoMarkAsReadOnOpen(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0078d4]"></div>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">App-Passwort und Zugangsschutz</h3>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500 leading-5">
                            Legen Sie ein App-Passwort fest. Beim Öffnen von Unique Mail wird es einmalig abgefragt.
                          </p>
                        </div>
                        <span className={
                          appLockConfig?.enabled
                            ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-emerald-700'
                            : 'rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-500'
                        }>
                          {appLockConfig?.enabled ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {appLockConfig?.enabled && (
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            Aktuelles Passwort
                            <input
                              type="password"
                              value={appLockCurrentPassword}
                              onChange={(event) => setAppLockCurrentPassword(event.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-blue-100"
                            />
                          </label>
                        )}
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Neues Passwort
                          <input
                            type="password"
                            value={appLockNewPassword}
                            onChange={(event) => setAppLockNewPassword(event.target.value)}
                            placeholder="mind. 4 Zeichen"
                            className="mt-1 w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Wiederholen
                          <input
                            type="password"
                            value={appLockConfirmPassword}
                            onChange={(event) => setAppLockConfirmPassword(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-250 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <p className="text-[10.5px] font-semibold text-slate-500">Erlaubt sind Buchstaben und Zahlen, mindestens 4 Zeichen.</p>
                        <div className="flex items-center gap-2">
                          {appLockConfig?.enabled && (
                            <button type="button" onClick={handleRemoveAppLockPassword} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-extrabold text-red-700 hover:bg-red-100">
                              Passwort entfernen
                            </button>
                          )}
                          <button type="button" onClick={handleSaveAppLockPassword} className="rounded-lg bg-[#0078d4] px-3 py-2 text-[10px] font-extrabold text-white shadow-sm hover:bg-[#106ebe]">
                            Passwort speichern
                          </button>
                        </div>
                      </div>
                      {appLockStatus && <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800">{appLockStatus}</div>}
                    </div>

                    <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest pb-2 border-b-2 border-slate-200">
                        Einstellungen übertragen
                      </h3>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-extrabold text-slate-800 uppercase tracking-wider">Export / Import</p>
                          <p className="text-[10px] text-slate-500 leading-4">Das Backup-Passwort ist optional. Ohne Passwort werden Konten und Einstellungen, aber keine Kontopasswörter exportiert.</p>
                        </div>
                        <div className="grid min-w-[330px] grid-cols-2 gap-2 shrink-0">
                          <input
                            type="password"
                            value={settingsBackupPassword}
                            onChange={(event) => setSettingsBackupPassword(event.target.value)}
                            placeholder="Optionales Backup-Passwort"
                            aria-label="Backup-Passwort"
                            className="col-span-1 px-3 py-2 text-[10px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0078d4]"
                          />
                          <input
                            type="password"
                            value={settingsBackupPasswordConfirm}
                            onChange={(event) => setSettingsBackupPasswordConfirm(event.target.value)}
                            placeholder="Optional bestätigen"
                            aria-label="Backup-Passwort bestätigen"
                            className="col-span-1 px-3 py-2 text-[10px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0078d4]"
                          />
                          <button type="button" onClick={handleExportSecuritySettings} className="px-3 py-2 text-[10px] font-extrabold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportieren</span>
                          </button>
                          <button type="button" onClick={() => securitySettingsImportInputRef.current?.click()} className="px-3 py-2 text-[10px] font-extrabold text-[#0078d4] bg-white border border-blue-100 rounded-lg hover:bg-blue-50 flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Importieren</span>
                          </button>
                          <input ref={securitySettingsImportInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportSecuritySettingsFile} />
                        </div>
                      </div>
                    </div>
                  </div>                ) : optionsActiveTab === 'language' ? (
                  <div className="space-y-5 animate-fade-in">
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest pb-1 border-b border-slate-100">
                        Sprache und Datumsformat
                      </h3>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                        <label className="block">
                          <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Oberflächensprache</span>
                          <select
                            value={uiLanguage}
                            onChange={(e) => setUiLanguage(e.target.value === 'en' ? 'en' : 'de')}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#0078d4]"
                          >
                            <option value="de">Deutsch</option>
                            <option value="en">English</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Datumsformat in der Nachrichtenliste</span>
                          <select
                            value={mailDateFormat}
                            onChange={(e) => setMailDateFormat(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#0078d4]"
                          >
                            {MAIL_DATE_FORMAT_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>{isEnglish ? option.en : option.de}</option>
                            ))}
                          </select>
                        </label>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                          <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Download-Ziel für Anhänge</span>
                          <div className="flex items-center gap-2">
                            <input
                              value={attachmentDownloadDirectory}
                              onChange={(e) => setAttachmentDownloadDirectory(e.target.value)}
                              placeholder="Standard: Windows Downloads"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:border-[#0078d4]"
                            />
                            <button type="button" onClick={handleChooseAttachmentDownloadDirectory} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-extrabold hover:bg-slate-100">
                              Ordner wählen
                            </button>
                            <button type="button" onClick={() => setAttachmentDownloadDirectory('')} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-[10px] font-extrabold text-slate-500 hover:bg-slate-50">
                              Standard
                            </button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-sky-100 bg-white p-3 text-[11px] text-slate-600 leading-5">
                          {isEnglish
                            ? 'The main mail shell, navigation, ribbon and message-list labels switch to English. Message dates always include the year and follow this selected format.'
                            : 'Die Hauptnavigation, das Ribbon und die Nachrichtenliste wechseln auf Englisch. Mail-Daten enthalten immer das Jahr und folgen diesem ausgewählten Format.'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : optionsActiveTab === 'accounts' ? (
                  <div className="space-y-5 animate-fade-in">
                    {/* Section 1: Connected Accounts list */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest pb-1 border-b border-slate-100 flex items-center justify-between">
                        <span>Aktive E-Mail-Konten ({accounts.length})</span>
                        <span className="text-[9.5px] text-slate-400 font-mono font-bold">WPF SQLite Register</span>
                      </h3>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200/80 bg-slate-50/50 p-2 rounded-xl shadow-inner-sm">
                        {accounts.map((acc) => {
                          const isActive = acc.email.toLowerCase() === activeAccountEmail.toLowerCase();
                          return (
                            <div 
                              key={acc.email} 
                              className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                                isActive ? 'bg-white border-[#0078d4] shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 truncate">
                                <Mail className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0078d4]' : 'text-slate-400'}`} />
                                <div className="truncate">
                                  <input
                                    value={getAccountDisplayName(acc)}
                                    onChange={(e) => updateAccountDisplayName(acc.email, e.target.value)}
                                    placeholder="Kontoname / Absendername"
                                    className="w-full text-[11px] font-extrabold text-slate-900 truncate bg-transparent border border-transparent hover:border-slate-200 focus:border-[#0078d4] focus:bg-white rounded px-1 py-0.5 outline-none"
                                  />
                                  <p className="text-[10px] text-slate-500 font-mono font-semibold truncate">{acc.email}</p>
                                  <p className="text-[10px] text-slate-400 font-mono font-semibold truncate">{acc.imapServer} • {acc.provider}</p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 shrink-0">
                                {!isActive ? (
                                  <button
                                    onClick={() => setActiveAccountEmail(acc.email)}
                                    className="text-[10.5px] hover:underline text-[#0078d4] font-bold px-2 py-0.5 cursor-pointer"
                                  >
                                    Standard
                                  </button>
                                ) : (
                                  <span className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                    Aktiv
                                  </span>
                                )}
                                <button
                                  onClick={() => handleRemoveAccount(acc.email)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title="Dieses Postfach vom SQLite-Cache trennen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>


                    {/* Section 2: Add New Account with styled forms */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest pb-1 border-b border-slate-100">
                        Übertragungs-Postfach hinzufügen
                      </h3>

                      <div className="space-y-3 p-4 bg-slate-50/70 rounded-xl border border-slate-200 shadow-xs">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                          <div className="xl:col-span-2">
                            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wider">Kontoname / Absendername:</label>
                            <input
                              type="text"
                              {...accountInputGuards}
                              placeholder="z.B. Stefan Steiner"
                              value={newAccDisplayName}
                              onChange={(e) => setNewAccDisplayName(e.target.value)}
                              className="w-full text-xs p-2 bg-white border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] transition-all text-slate-800 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wider">E-Mail-Adresse:</label>
                            <input 
                              type="email"
                              {...accountInputGuards}
                              placeholder="beispiel@gmx.de, mail@domain.de"
                              value={newAccEmail}
                              onChange={(e) => setNewAccEmail(e.target.value)}
                              className="w-full text-xs p-2 bg-white border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] transition-all text-slate-800 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wider">Gegenstellen-Kennwort:</label>
                            <input 
                              type="password"
                              {...accountInputGuards}
                              placeholder="••••••••"
                              value={newAccPass}
                              onChange={(e) => setNewAccPass(e.target.value)}
                              className="w-full text-xs p-2 bg-white border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] transition-all text-slate-800"
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 py-0.5">
                          <input 
                            type="checkbox"
                            id="opt-autodiscover-chk"
                            checked={newAccUseAutodiscovery}
                            onChange={(e) => setNewAccUseAutodiscovery(e.target.checked)}
                            className="rounded-lg h-3.5 w-3.5 accent-[#0078d4] cursor-pointer"
                            disabled={isOptionsSyncing}
                          />
                          <label htmlFor="opt-autodiscover-chk" className="text-[11px] text-slate-700 select-none cursor-pointer font-bold">
                            DNS & Autodiscover-Dienst zur Parametrierung auslösen
                          </label>
                        </div>

                        {/* Manual Settings block */}
                        {!newAccUseAutodiscovery && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5 text-xs animate-fade-in shadow-xs">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">IMAP-Server:</label>
                                <input 
                                  type="text"
                                  {...accountInputGuards}
                                  value={newAccImapServer}
                                  onChange={(e) => setNewAccImapServer(e.target.value)}
                                  className="w-full text-xs p-1.5 border border-slate-255 rounded-lg font-mono text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Port (SSL/TLS):</label>
                                <input 
                                  type="number"
                                  {...accountInputGuards}
                                  value={newAccImapPort}
                                  onChange={(e) => setNewAccImapPort(parseInt(e.target.value) || 993)}
                                  className="w-full text-xs p-1.5 border border-slate-255 rounded-lg font-mono text-slate-800"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">SMTP-Server:</label>
                                  <input 
                                    type="text"
                                    {...accountInputGuards}
                                    value={newAccSmtpServer}
                                    onChange={(e) => setNewAccSmtpServer(e.target.value)}
                                    className="w-full text-xs p-1.5 border border-slate-255 rounded-lg font-mono text-slate-800"
                                  />
                              </div>
                              <div>
                                <label className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Port (STARTTLS):</label>
                                <input 
                                  type="number"
                                  {...accountInputGuards}
                                  value={newAccSmtpPort}
                                  onChange={(e) => setNewAccSmtpPort(parseInt(e.target.value) || 465)}
                                  className="w-full text-xs p-1.5 border border-slate-255 rounded-lg font-mono text-slate-800"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider">Schnittstellenname (Label):</label>
                              <input 
                                type="text"
                                {...accountInputGuards}
                                value={newAccProvider}
                                onChange={(e) => setNewAccProvider(e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-255 rounded-lg font-mono text-slate-800"
                              />
                            </div>
                          </div>
                        )}

                        {/* Logging progress area */}
                        {isOptionsSyncing && (
                          <div className="bg-slate-900 text-[#10b981] p-3 rounded-xl text-[10px] font-mono h-20 overflow-y-auto space-y-1.5 shadow-inner">
                            {optionsSyncLogs.map((log, li) => (
                              <p key={li} className="leading-relaxed">{log}</p>
                            ))}
                            <div className="flex items-center space-x-2 pt-1 animate-pulse">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                              <span className="text-amber-400 font-bold">{latestOptionsSyncStatus}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleOptionsAddAccount}
                            disabled={isOptionsSyncing}
                            className="px-4 py-2 text-xs bg-[#0078d4] hover:bg-[#106ebe] text-white rounded-lg font-bold shadow-md flex items-center space-x-1.5 disabled:opacity-50 transition-all cursor-pointer select-none active:scale-97"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Konto registrieren</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : optionsActiveTab === 'security' ? (
                  <div className="space-y-5 animate-fade-in">
                    {/* Section 3: Sender security and image privacy */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest pb-1 border-b border-slate-100">
                        Bilder & Absender-Schutz
                      </h3>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-extrabold text-slate-800 uppercase tracking-wider">Export / Import</p>
                          <p className="text-[10px] text-slate-500 leading-4">Das Backup-Passwort ist nur erforderlich, wenn die JSON-Datei tatsächlich verschlüsselte Kontopasswörter enthält.</p>
                        </div>
                        <div className="grid min-w-[330px] grid-cols-2 gap-2 shrink-0">
                          <input
                            type="password"
                            value={settingsBackupPassword}
                            onChange={(event) => setSettingsBackupPassword(event.target.value)}
                            placeholder="Optionales Backup-Passwort"
                            aria-label="Backup-Passwort"
                            className="col-span-1 px-3 py-2 text-[10px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0078d4]"
                          />
                          <input
                            type="password"
                            value={settingsBackupPasswordConfirm}
                            onChange={(event) => setSettingsBackupPasswordConfirm(event.target.value)}
                            placeholder="Optional bestätigen"
                            aria-label="Backup-Passwort bestätigen"
                            className="col-span-1 px-3 py-2 text-[10px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0078d4]"
                          />
                          <button type="button" onClick={handleExportSecuritySettings} className="px-3 py-2 text-[10px] font-extrabold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportieren</span>
                          </button>
                          <button type="button" onClick={() => securitySettingsImportInputRef.current?.click()} className="px-3 py-2 text-[10px] font-extrabold text-[#0078d4] bg-white border border-blue-100 rounded-lg hover:bg-blue-50 flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Importieren</span>
                          </button>
                          <input ref={securitySettingsImportInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportSecuritySettingsFile} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                        {renderSenderRuleList(
                          'Bilder automatisch laden',
                          'Externe Bilder und Inhalte werden für diese Absender automatisch angezeigt.',
                          imageDownloadAllowList,
                          setImageDownloadAllowList,
                          'Noch keine automatisch zugelassenen Absender.'
                        )}
                        {renderSenderRuleList(
                          'Bilder nie laden',
                          'Externe Bilder bleiben für diese Absender blockiert, bis der Eintrag entfernt wird.',
                          imageDownloadDenyList,
                          setImageDownloadDenyList,
                          'Noch keine abgelehnten Absender.'
                        )}
                        {renderSenderRuleList(
                          'Gesperrte Absender',
                          'Mails dieser Absender werden automatisch in Spam/Junk einsortiert.',
                          blockedSenderList,
                          setBlockedSenderList,
                          'Noch keine gesperrten Absender.'
                        )}
                      </div>
                    </div>

                  </div>
                ) : optionsActiveTab === 'ai' ? (
                  /* ================= KI-AGENT SETTINGS TAB ================= */
                  <div className="space-y-4 animate-fade-in pb-4">
                    <h3 className="text-xs font-extrabold text-purple-950 uppercase tracking-widest pb-1 border-b border-purple-100 flex items-center justify-between">
                      <span>KI-Schnittstelle & Automatische Hintergrund-Tasks</span>
                      <span className="text-[9.5px] text-purple-600 font-mono font-bold">Zentrales KI-Controlboard</span>
                    </h3>

                    {/* API Options and Inputs */}
                    <div className="space-y-3.5 bg-purple-50/20 border border-purple-100 p-4 rounded-xl shadow-xs">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-2 uppercase tracking-wider">
                          1. KI-Anbieter (Provider) wählen:
                        </label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                          {[
                            { id: 'claude', name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet' },
                            { id: 'deepseek', name: 'DeepSeek AI', desc: 'DeepSeek R1 / V3' },
                            { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 2.5 Flash' },
                            { id: 'custom', name: 'Sonstige KI', desc: 'Beliebiger API Server' }
                          ].map((p) => {
                            const isSel = aiApiProvider === p.id;
                            return (
                              <button
                                key={p.id}
                                onClick={() => setAiApiProvider(p.id as any)}
                                className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                  isSel
                                    ? 'bg-purple-900 border-purple-800 text-white shadow-md'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-purple-200 hover:bg-purple-50/30'
                                }`}
                              >
                                <div className="text-[10px] font-extrabold">{p.name}</div>
                                <div className={`text-[8.5px] mt-0.5 font-mono ${isSel ? 'text-purple-200' : 'text-slate-400'}`}>
                                  {p.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom AI Fields */}
                      {aiApiProvider === 'custom' && (
                        <div className="p-3 bg-white border border-purple-100 rounded-xl space-y-3 shadow-inner-sm animate-fade-in grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-extrabold text-purple-950 uppercase tracking-wider mb-1">
                              KI Name (z.B. Llama3, Ollama, GPT-4o):
                            </label>
                            <input
                              type="text"
                              value={customAiProvider}
                              onChange={(e) => setCustomAiProvider(e.target.value)}
                              placeholder="z.B. Ollama Llama 3"
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-extrabold text-purple-950 uppercase tracking-wider mb-1">
                              API Endpunkt / Base URL:
                            </label>
                            <input
                              type="text"
                              value={customAiEndpoint}
                              onChange={(e) => setCustomAiEndpoint(e.target.value)}
                              placeholder="z.B. http://localhost:11434/v1"
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 focus:border-purple-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="pt-1.5">
                        <label className="block text-[10px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wider">
                          2. API-Schlüssel (Key) hinterlegen:
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            value={aiApiKey}
                            onChange={(e) => setAiApiKey(e.target.value)}
                            placeholder={`Geben Sie Ihren ${aiApiProvider === 'claude' ? 'Claude' : aiApiProvider === 'deepseek' ? 'DeepSeek' : aiApiProvider === 'gemini' ? 'Gemini' : customAiProvider} API-Schlüssel ein...`}
                            className="w-full text-xs p-2 px-3 bg-white border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-250 focus:border-purple-600 transition-all text-slate-800 font-mono pr-20"
                          />
                          <div className="absolute right-2 top-1.5 flex items-center bg-transparent">
                            {aiApiKey ? (
                              <span className="text-[10px] bg-green-150 text-green-750 font-bold px-2 py-0.5 rounded-md flex items-center border border-green-250">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-550 mr-1.5"></span>
                                Aktiv
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-md flex items-center border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-550 mr-1.5 animate-pulse"></span>
                                Keiner
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          Ihr Schlüssel wird ausschließlich verschlüsselt in Ihrer lokalen Sandbox geladen und zur auto-discovery & automatischen Postfachbearbeitung direkt verwendet. Er verlässt Ihren Browser niemals.
                        </p>
                      </div>
                    </div>

                    {/* Task list Toggles */}
                    <div className="space-y-3">
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wider">
                        3. KI-Hintergrund-Tasks aktivieren / deaktivieren:
                      </label>
                      
                      <div className="space-y-2">
                        {[
                          {
                            key: 'autoScanContacts',
                            title: 'Kontakte automatisch scannen & vorschlagen',
                            desc: 'Erfasst jede E-Mail-Adresse, von der Sie Mails empfangen oder an die Sie senden, gleicht sie mit dem Adressbuch ab und schlägt diese unter "Kontakte" zur direkten Speicherung vor.'
                          },
                          {
                            key: 'autoCategorize',
                            title: 'Automatische E-Mail-Kategorisierung',
                            desc: 'Kategorisiert eingehende E-Mails mittels KI-Voranalyse nach Dringlichkeit und Projekten und versieht sie mit strukturierten XAML/C# Tags.'
                          },
                          {
                            key: 'autoSmartReply',
                            title: 'Automatische Smart-Reply Antwortentwürfe',
                            desc: 'Generiert im Lese-Bereich einer E-Mail reaktiv KI-Entwürfe zur schnellen Beantwortung im WPF-Editor.'
                          },
                          {
                            key: 'autoPhishingScan',
                            title: 'Intelligenter Phishing- & Header-Sicherheitsscan',
                            desc: 'Scant jede Mail reaktiv auf betrügerische Links, gefälschte Server und unregelmäßige Mail-Header. Kennzeichnet verdächtige Inhalte mit einer unübersehbaren Sicherheitswarnung.'
                          }
                        ].map((t) => {
                          const val = (aiToggles as any)[t.key];
                          return (
                            <div 
                              key={t.key} 
                              onClick={() => {
                                setAiToggles(prev => ({
                                  ...prev,
                                  [t.key]: !(prev as any)[t.key]
                                }));
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                val
                                  ? 'bg-purple-50/20 border-purple-200/80 hover:bg-purple-50/30'
                                  : 'bg-white border-slate-200 hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="flex-1 pr-6 select-none">
                                <h4 className="text-[11.5px] font-bold text-slate-800 flex items-center space-x-1.5">
                                  <span>{t.title}</span>
                                  {val && (
                                    <span className="bg-purple-100 text-purple-700 text-[8px] px-1.5 py-0.2 rounded-md font-extrabold uppercase">
                                      Aktiv
                                    </span>
                                  )}
                                </h4>
                                <p className="text-[10.5px] text-slate-450 mt-0.5 leading-relaxed">
                                  {t.desc}
                                </p>
                              </div>

                              {/* Styled Switch Toggle */}
                              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${val ? 'bg-purple-900' : 'bg-slate-200'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-xs transform duration-300 ${val ? 'translate-x-4' : 'translate-x-0'}`}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Simulator Interactive Logs terminal */}
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-inner">
                      <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono font-bold mb-1.5 uppercase tracking-wider">
                        <span>KI Hintergrund-Prozessüberwachung (Simulation)</span>
                        <span className="text-purple-400 font-extrabold animate-pulse">System Live</span>
                      </div>
                      <div className="font-mono text-[9px] text-[#22c55e] space-y-1">
                        <p className="text-slate-400">
                          [{new Date().toLocaleTimeString()}] KI-Hintergrunddienst geladen (Provider: {aiApiProvider === 'custom' ? customAiProvider.toUpperCase() : aiApiProvider.toUpperCase()})
                        </p>
                        <p className="text-slate-400 font-medium">
                          [{new Date().toLocaleTimeString()}] Gefundene Mail-Adressen: {suggestedContacts.length} Vorschläge bereit.
                        </p>
                        {aiToggles.autoScanContacts && (
                          <p className="text-purple-300 font-medium animate-pulse">
                            [{new Date().toLocaleTimeString()}] Kontakt-Scan aktiv. {suggestedContacts.length} ungespeicherte Kontakte im Scan Puffer!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : optionsActiveTab === 'vacation' ? (
                  <div className="space-y-6 animate-fade-in pb-4">
                    {/* Section 1: Vacation response */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-extrabold text-[#323130] dark:text-slate-200 uppercase tracking-widest pb-1 border-b border-slate-205 dark:border-slate-800 flex items-center justify-between">
                        <span>Automatische Abwesenheitsantworten (OOF)</span>
                        <span className="text-[9.5px] text-orange-600 font-mono font-bold">Exchange / OOF Server Simulator</span>
                      </h3>

                      <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60 p-4 rounded-xl space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="p-1 px-2.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 font-bold text-xs rounded-lg select-none">Status</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Automatische Antworten senden</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={vacationActive} 
                              onChange={(e) => setVacationActive(e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-slate-350 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                          </label>
                        </div>

                        <p className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
                          Verwenden Sie automatische Antworten, um Personen darüber zu informieren, dass Sie abwesend sind, sich im Urlaub befinden oder nicht auf E-Mails antworten können.
                        </p>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3.5 shadow-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                              Startdatum (Von):
                            </label>
                            <input 
                              type="date" 
                              value={vacationStart}
                              onChange={(e) => setVacationStart(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-orange-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                              Enddatum (Bis):
                            </label>
                            <input 
                              type="date" 
                              value={vacationEnd}
                              onChange={(e) => setVacationEnd(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-orange-500 outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Abwesenheitsnachricht für Absender:
                          </label>
                          <textarea 
                            rows={5}
                            value={vacationMessage}
                            onChange={(e) => setVacationMessage(e.target.value)}
                            className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg font-sans text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-orange-500 outline-none resize-none leading-relaxed"
                            placeholder="Geben Sie hier Ihren automatischen Antworttext ein..."
                          />
                        </div>

                        {/* AI Button and error message */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold font-mono">
                            INFO: Wird in der WPF SQLite Datenbank synchronisiert.
                          </span>
                          <button
                            type="button"
                            onClick={handleOptimizeVacation}
                            disabled={isOptimizingVacation}
                            className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all active:scale-97 flex items-center space-x-1.5 shadow-sm select-none ${
                              isOptimizingVacation 
                                ? 'bg-orange-100 dark:bg-orange-950 text-orange-500 animate-pulse cursor-not-allowed' 
                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                            }`}
                          >
                            <span>✨</span>
                            <span>{isOptimizingVacation ? 'Wird optimiert...' : 'Mit KI optimieren'}</span>
                          </button>
                        </div>
                      </div>
                    </div>


                    {/* AI Error overlay message if present */}
                    {aiError && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold leading-relaxed animate-fade-in flex items-start space-x-2">
                        <span>Hinweis</span>
                        <div>
                          <strong>Fehler:</strong> {aiError}
                          <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 font-semibold">Tipp: Stellen Sie sicher, dass Ihr GEMINI_API_KEY im "Settings &gt; Secrets" Menü hinterlegt ist.</p>
                        </div>
                      </div>
                    )}

                  </div>
                ) : optionsActiveTab === 'signature' ? (
                  <div className="space-y-6 animate-fade-in pb-4">
                    {/* Section 2: Email Signature */}
                    <div className="space-y-4 pt-1">
                      <h3 className="text-xs font-extrabold text-[#323130] dark:text-slate-200 uppercase tracking-widest pb-1 border-b border-slate-205 dark:border-slate-800 flex items-center justify-between">
                        <span>E-Mail-Signatur (WPF &amp; SMTP)</span>
                        <span className="text-[9.5px] text-purple-600 font-mono font-bold">Zugeordnete User-Signatur</span>
                      </h3>

                      <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 p-4 rounded-xl space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="p-1 px-2.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-lg select-none font-mono">XAML</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Automatische Signatur an neue E-Mails anfügen</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={signatureActive} 
                              onChange={(e) => setSignatureActive(e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-slate-350 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                          </label>
                        </div>

                        <p className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
                          Ihre Signatur wird am Ende neuer E-Mails und standardmäßig vor dem zitierten Text in Antworten eingefügt.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left half: Manual Signature Editor */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3 shadow-sm flex flex-col justify-between">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                              Signatur bearbeiten:
                            </label>
                            <textarea 
                              rows={5}
                              value={activeSignatureText}
                              onChange={(e) => {
                                setSignatureText(e.target.value);
                                if (activeAccountEmail) {
                                  setAccountSignatures(prev => ({ ...prev, [activeAccountEmail]: e.target.value }));
                                }
                              }}
                              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-purple-500 outline-none resize-none leading-relaxed"
                              placeholder="Mit freundlichen Grüßen,..."
                            />
                          </div>
                          <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-semibold italic mt-2">
                            Tipp: Sie können auch HTML-Tags wie &lt;b&gt; oder Web-Links eingeben.
                          </p>
                        </div>

                        {/* Right half: AI Signature Wizard */}
                        <div className="bg-purple-50/30 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900 p-4 rounded-xl space-y-3.5 flex flex-col justify-between shadow-sm">
                          <div className="space-y-2">
                            <label className="block text-[10px] font-extrabold text-purple-750 dark:text-purple-400 uppercase tracking-wider">
                              Signatur mit KI erstellen / optimieren:
                            </label>
                            <p className="text-[10.5px] text-slate-550 dark:text-slate-450 font-semibold leading-relaxed">
                              Beschreiben Sie im Prompt-Feld Ihren Berufsbereich, gewünschte Kontaktdaten oder wie sich Ihre Signatur verändern soll:
                            </p>
                            <textarea 
                              rows={3}
                              value={signatureAIPrompt}
                              onChange={(e) => setSignatureAIPrompt(e.target.value)}
                              className="w-full text-xs p-2.5 border border-purple-200/60 dark:border-purple-900/60 rounded-lg font-sans text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-purple-500 outline-none resize-none leading-normal"
                              placeholder="Z.B.: 'Erstelle eine kreative, moderne Signatur für Max Steiner als leitender C# Architekt, verwende schicke Striche, eine Demo-Festnetznummer und Platzhalter für Website.'"
                            />
                          </div>

                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={handleGenerateSignature}
                              disabled={isGeneratingSignature || !signatureAIPrompt.trim()}
                              className={`w-full py-2 text-xs font-bold rounded-lg cursor-pointer transition-all active:scale-97 flex items-center justify-center space-x-1.5 shadow-sm tracking-wide select-none ${
                                !signatureAIPrompt.trim()
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                  : isGeneratingSignature
                                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-500 animate-pulse cursor-not-allowed'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                              }`}
                            >
                              <span></span><span>{isGeneratingSignature ? 'Generiere Signatur...' : 'Signatur generieren'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>


                    {/* AI Error overlay message if present */}
                    {aiError && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold leading-relaxed animate-fade-in flex items-start space-x-2">
                        <span>Hinweis</span>
                        <div>
                          <strong>Fehler:</strong> {aiError}
                          <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 font-semibold">Tipp: Stellen Sie sicher, dass Ihr GEMINI_API_KEY im "Settings &gt; Secrets" Menü hinterlegt ist.</p>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  /* ================= HILFE UND SONSTIGES TAB ================= */
                  <div className="space-y-4 animate-fade-in pb-4 select-text">
                    <h3 className="text-xs font-extrabold text-[#323130] uppercase tracking-widest pb-1 border-b border-slate-200 flex items-center justify-between">
                      <span>Hilfe, Impressum &amp; Datenschutz</span>
                      <span className="text-[9.5px] text-[#0078d4] font-mono font-bold">Produktkonformität</span>
                    </h3>

                    {/* Section 1: Impressum */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                        <span className="mr-1.5">Hinweis</span> Impressum (Gesetzliche Angaben)
                      </h4>
                      <div className="text-[11px] text-slate-600 leading-relaxed font-semibold space-y-1 pl-2 border-l-2 border-slate-300">
                        <p><strong>Umfang:</strong> Impressum, Datenschutz &amp; Geschäftsbedingungen</p>
                        <p><strong>Unternehmen:</strong> PACOPAR</p>
                        <p><strong>Anbieter-Adresse:</strong> Ruta 2, Km57, Mariscal Estigarribia, 03000 Caacupe, PARAGUAY</p>
                        <p><strong>Kontakt &amp; Support:</strong> hello@unique-utilities.com</p>
                      </div>
                    </div>

                    {/* Section 2: Datenschutz */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                        <span className="mr-1.5">Hinweis</span> Datenschutz (Privacy Policy)
                      </h4>
                      <p className="text-xs text-slate-650 leading-relaxed font-semibold pl-2">
                        Ihre Privatsphäre und Datensicherheit stehen für uns an oberster Stelle. Dementsprechend gilt für <strong>Unique Mail</strong>:
                      </p>
                      <ul className="text-[11px] text-slate-500 list-disc list-inside space-y-1 pl-3 font-medium">
                        <li><strong>Lokale Datenhaltung:</strong> Sämtliche Passwörter (IMAP, SMTP), E-Mails, Termine und Kontakte werden ausschließlich lokal auf Ihrem Rechner in einer passwortgeschützten SQLite-Datenbank (<code className="bg-slate-100 font-mono px-1 rounded">outlook.db</code>) gespeichert.</li>
                        <li><strong>SSL-Verschlüsselung:</strong> Alle Übertragungen zu Ihren IMAP- und SMTP-Mailservern erfolgen über TLS-gesicherte Punkt-zu-Punkt-Verbindungen.</li>
                        <li><strong>Kein Tracking:</strong> Die Anwendung sendet keinerlei Nutzungsverhalten, Telemetriedaten oder Logdateien an uns. Ihre Daten gehören zu 100% Ihnen.</li>
                      </ul>
                    </div>

                    {/* Section 3: Open-Source-Lizenzen */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                        <span className="mr-1.5">Hinweis</span> Open-Source-Lizenzen &amp; Urheberrechte
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-semibold pl-2">
                        Diese Anwendung nutzt zur Sicherstellung offener Standards folgende lizensierte Open-Source-Bibliotheken:
                      </p>
                      <ul className="text-[11px] text-slate-550 space-y-1.5 font-medium pl-3">
                        <li>• <strong>MailKit / MimeKit (.NET):</strong> Leistungsstarker MIT-lizenzierter E-Mail-Parser &amp; IMAP/SMTP Client für .NET Core 8.</li>
                        <li>• <strong>Microsoft.Data.Sqlite:</strong> SQLite-Assembly (MIT-Lizenz) zur transaktionssicheren lokalen Aufbewahrung.</li>
                        <li>• <strong>@google/genai &amp; lucide-react:</strong> Genutzt für dynamische Interface-Icons (MIT) und KI-Dienste (Apache 2.0).</li>
                      </ul>
                    </div>

                    {/* Section 4: Sonstige Angaben */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center">
                        <span className="mr-1.5">Hinweis</span> Sonstige Angaben zum Vertrieb
                      </h4>
                      <div className="text-[11px] text-slate-500 leading-relaxed font-semibold pl-2 space-y-1">
                        <p><strong>System-Identifikationsnummer (UID):</strong> UM-WPF-802</p>
                        <p><strong>Zertifizierung:</strong> Konforme Code-Signierung für Microsoft Windows App Store Sandbox-Kriterien im Rahmen von Windows Secure App-Sicherheitsrichtlinien.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions footer */}
            <div className="bg-slate-100 h-14 border-t border-slate-200 flex items-center justify-end px-4 space-x-2 select-none">
              <button 
                onClick={() => setIsOptionsModalOpen(false)}
                className="px-4 py-1.8 text-xs border border-slate-250 rounded-xl hover:bg-slate-200 bg-white text-slate-700 font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                Schließen
              </button>
              <button 
                onClick={() => {
                  setIsOptionsModalOpen(false);
                }}
                className="px-4.5 py-1.8 text-xs bg-[#0078d4] text-white rounded-xl hover:bg-[#106ebe] font-bold shadow-md transition-all cursor-pointer active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {feedbackDialog && (
        <div id="unique-feedback-modal" className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center z-[160] animate-fade-in p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmitFeedback();
            }}
            className="w-[520px] max-w-full overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50 px-5 py-4">
              <div>
                <h3 className="text-[15px] font-black text-slate-900 tracking-tight">
                  {feedbackDialog.type === 'bug' ? 'Bug Report' : 'Feature Request'}
                </h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Feedback senden oder lokal speichern, falls noch keine SMTP-Feedback-Konfiguration eingerichtet ist.</p>
              </div>
              <button type="button" onClick={() => setFeedbackDialog(null)} className="h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-500 font-black hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" aria-label="Feedback schliessen">x</button>
            </div>
            <div className="space-y-4 p-5 text-xs">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Titel
                <input autoFocus value={feedbackDialog.title} onChange={(event) => setFeedbackDialog(prev => prev ? { ...prev, title: event.target.value, error: undefined } : prev)} className="mt-1.5 w-full rounded-xl border border-slate-250 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" placeholder="Kurzer Betreff" />
              </label>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Beschreibung
                <textarea value={feedbackDialog.body} onChange={(event) => setFeedbackDialog(prev => prev ? { ...prev, body: event.target.value, error: undefined } : prev)} className="mt-1.5 h-40 w-full resize-none rounded-xl border border-slate-250 bg-white px-3 py-2.5 text-sm font-medium leading-6 text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" placeholder="Was soll verbessert oder geprueft werden?" />
              </label>
              {feedbackDialog.error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{feedbackDialog.error}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button type="button" disabled={feedbackDialog.isSending} onClick={() => setFeedbackDialog(null)} className="rounded-xl border border-slate-250 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-60">Abbrechen</button>
              <button type="submit" disabled={feedbackDialog.isSending || !feedbackDialog.title.trim() || !feedbackDialog.body.trim()} className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-black text-white shadow-md hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-55">{feedbackDialog.isSending ? 'Senden...' : 'Senden'}</button>
            </div>
          </form>
        </div>
      )}
      {/* Mail account session password modal */}
      {sessionPasswordRequest && (
        <div id="mail-session-password-modal" className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center z-130 animate-fade-in p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              completeSessionPasswordRequest(sessionPasswordInput.trim() || null);
            }}
            className="bg-white rounded-2xl w-[420px] max-w-full border border-slate-200 shadow-2xl p-6 select-none font-sans text-xs"
          >
            <div className="flex flex-col items-center text-center space-y-3 mb-5">
              <div className="p-3 bg-blue-50 text-blue-650 rounded-2xl shadow-inner border border-blue-100 flex items-center justify-center">
                <Mail className="w-7 h-7 text-[#0078d4]" />
              </div>
              <div>
                <h3 className="text-[14px] font-extrabold text-slate-800 tracking-tight">Postfach-Passwort eingeben</h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-1 break-all">{sessionPasswordRequest.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1.5">Passwort oder App-Passwort</label>
                <input
                  id="mail-session-password-input"
                  type="password"
                  value={sessionPasswordInput}
                  onChange={(e) => setSessionPasswordInput(e.target.value)}
                  autoFocus
                  placeholder="Passwort wird lokal gespeichert"
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-[#0078d4] font-medium"
                />
                <p className="text-[10px] text-slate-500 mt-2 leading-4">Das Passwort wird lokal verschlüsselt gespeichert und im Einstellungs-Export mit dem separat gewählten Backup-Passwort übertragbar verschlüsselt.</p>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => completeSessionPasswordRequest(null)}
                  className="w-1/2 py-2.2 text-xs border border-slate-250 rounded-xl hover:bg-slate-100 font-bold text-slate-600 cursor-pointer transition-all active:scale-95 text-center"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={!sessionPasswordInput.trim()}
                  className="w-1/2 py-2.2 text-xs bg-[#0078d4] text-white rounded-xl hover:bg-[#106ebe] font-bold shadow-md transition-all cursor-pointer active:scale-95 text-center disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  Weiter
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* WPF Suite / Developer Mode Password Gate Modal */}
      {showPwdModal && (
        <div id="wpf-password-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-120 animate-fade-in">
          <div className="bg-white rounded-2xl w-[380px] border border-slate-200 shadow-2xl p-6 select-none font-sans text-xs">
            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="p-3 bg-blue-50 text-blue-650 rounded-2xl shadow-inner border border-blue-100 flex items-center justify-center">
                <AppLogo size={38} />
              </div>
              <div>
                <h3 className="text-[14px] font-extrabold text-slate-800 tracking-tight">WPF Suite freischalten</h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">Das Entwickler-Menü ist systemgeschützt.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1.5">Mitarbeiterschlüssel (Passwort)</label>
                <input 
                  id="wpf-pwd-input"
                  type="password"
                  value={pwdValue}
                  onChange={(e) => {
                    setPwdValue(e.target.value);
                    setPwdError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyPassword();
                  }}
                  autoFocus
                  placeholder="Geben Sie den Admin-Schlüssel ein..."
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-[#0078d4] font-medium"
                />
                {pwdError && (
                  <p id="wpf-pwd-error" className="text-red-700 font-bold text-[10px] mt-1.5 flex items-center space-x-1">
                    <span></span><span>{pwdError}</span>
                  </p>
                )}
                <div 
                  onClick={() => {
                    setPwdValue('4620');
                    setPwdError('');
                  }}
                  className="text-[10.5px] text-blue-600 hover:text-blue-800 mt-2 font-bold cursor-pointer transition-colors hover:underline flex items-center space-x-1"
                  title="Klicken, um den Systemschlüssel automatisch einzutragen"
                >
                  <span>✨</span>
                  <span>Hinweis: Systemschlüssel hinterlegt (Klick für Auto-Fill)</span>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => setShowPwdModal(false)}
                  className="w-1/2 py-2.2 text-xs border border-slate-250 rounded-xl hover:bg-slate-100 font-bold text-slate-600 cursor-pointer transition-all active:scale-95 text-center"
                >
                  Abbrechen
                </button>
                <button
                  id="submit-wpf-password"
                  onClick={handleVerifyPassword}
                  className="w-1/2 py-2.2 text-xs bg-[#0078d4] text-white rounded-xl hover:bg-[#106ebe] font-bold shadow-md transition-all cursor-pointer active:scale-95 text-center"
                >
                  Verifizieren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal ("inklusive Titel und Farben") */}
      {showCategoriesModal && (
        <div id="categories-manager-modal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-110 animate-fade-in">
          <div className="bg-white rounded-2xl w-[460px] max-h-[520px] border border-slate-250 shadow-2xl flex flex-col select-none font-sans text-xs">
            
            {/* Modal Header */}
            <div className="h-12 border-b border-slate-205 flex items-center justify-between px-4 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Kategorien verwalten</h3>
              </div>
              <button 
                onClick={() => {
                  setShowCategoriesModal(false);
                  setEditingCatName(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-base px-2 rounded-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              
              {/* List of active categories */}
              <div className="space-y-2">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Existierende Kategorien</h4>
                <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 max-h-[160px] overflow-y-auto bg-slate-50/50">
                  {categoriesList.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50">
                      <div className="flex items-center space-x-2 max-w-[200px] truncate">
                        <div className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: cat.color }}></div>
                        <span className="font-bold text-slate-800">{cat.name}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => {
                            setEditingCatName(cat.name);
                            setEditCatTitle(cat.name);
                            setEditCatColor(cat.color);
                          }}
                          className="px-2 py-1 text-[10.5px] border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 font-bold cursor-pointer"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => {
                            if (categoriesList.length <= 1) {
                              alert("Es muss mindestens eine Kategorie vorhanden sein.");
                              return;
                            }
                            if (confirm(`Möchten Sie die Kategorie "${cat.name}" wirklich löschen?`)) {
                              setCategoriesList(prev => prev.filter(c => c.name !== cat.name));
                            }
                          }}
                          className="px-2 py-1 text-[10.5px] text-red-750 hover:bg-red-50 rounded-lg font-bold cursor-pointer"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit Existing Category Area */}
              {editingCatName && (
                <div className="p-3.5 bg-amber-50/30 border border-amber-100 rounded-xl space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-extrabold text-amber-900 flex items-center space-x-1">
                      <Palette className="w-3.5 h-3.5 mr-1" />
                      <span>Kategorie &bdquo;{editingCatName}&ldquo; bearbeiten</span>
                    </span>
                    <button 
                      onClick={() => setEditingCatName(null)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Abbrechen
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Titel</label>
                      <input 
                        type="text"
                        value={editCatTitle}
                        onChange={(e) => setEditCatTitle(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.8 bg-white border border-slate-250 rounded-lg font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color"
                          value={editCatColor}
                          onChange={(e) => setEditCatColor(e.target.value)}
                          className="w-8 h-[27px] rounded-lg border border-slate-250 cursor-pointer p-0 bg-transparent"
                        />
                        <span className="text-[11px] font-mono text-slate-500 uppercase">{editCatColor}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!editCatTitle.trim()) return;
                      setCategoriesList(prev => prev.map(c => c.name === editingCatName ? { name: editCatTitle.trim(), color: editCatColor } : c));
                      setEmails(prev => prev.map(e => e.category === editingCatName ? { ...e, category: editCatTitle.trim() } : e));
                      setEditingCatName(null);
                    }}
                    className="w-full py-1.8 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs text-center"
                  >
                    Änderungen speichern
                  </button>
                </div>
              )}

              {/* Create New Category Area */}
              {!editingCatName && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-[10.5px] font-extrabold text-slate-800 flex items-center space-x-1">
                    <Plus className="w-3.5 h-3.5 text-[#0078d4] mr-1" />
                    <span>Neue Kategorie anlegen</span>
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Titel</label>
                      <input 
                        type="text"
                        placeholder="Z.B. Finanzen..."
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.8 bg-white border border-slate-250 rounded-lg font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="color"
                          value={newCatColor}
                          onChange={(e) => setNewCatColor(e.target.value)}
                          className="w-8 h-[27px] rounded-lg border border-slate-250 cursor-pointer p-0 bg-transparent"
                        />
                        <span className="text-[11px] font-mono text-slate-500 uppercase">{newCatColor}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!newCatName.trim()) {
                        alert("Bitte geben Sie einen Titel für die neue Kategorie ein.");
                        return;
                      }
                      if (categoriesList.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
                        alert("Eine Kategorie mit diesem Namen existiert bereits.");
                        return;
                      }
                      setCategoriesList(prev => [...prev, { name: newCatName.trim(), color: newCatColor }]);
                      setNewCatName('');
                    }}
                    className="w-full py-1.8 bg-[#0078d4] hover:bg-[#106ebe] text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs text-center"
                  >
                    Kategorie hinzufügen
                  </button>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 h-14 border-t border-slate-250 flex items-center justify-end px-4 rounded-b-2xl">
              <button 
                onClick={() => {
                  setShowCategoriesModal(false);
                  setEditingCatName(null);
                }}
                className="px-4.5 py-1.8 text-xs bg-slate-800 text-white rounded-xl hover:bg-slate-900 font-bold shadow-md transition-all cursor-pointer active:scale-95 text-center text-xs"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Custom Outlook Classic QuickSteps Manager Modal */}
      {showQuickStepsModal && (
        <div id="quicksteps-manager-modal" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-110 animate-fade-in p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-[620px] h-[480px] border border-slate-250 dark:border-slate-800 shadow-2xl flex flex-col select-none font-sans text-xs overflow-hidden">
            
            {/* Modal Header */}
            <div className="h-13 border-b border-slate-205 dark:border-slate-800 flex items-center justify-between px-5 bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
              <div className="flex items-center space-x-2.5">
                <Zap className="w-5 h-5 text-[#0078d4] animate-pulse" />
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">Eigene QuickSteps verwalten</h3>
              </div>
              <button 
                onClick={() => {
                  setShowQuickStepsModal(false);
                  handleResetQuickStepForm();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-base px-2 rounded-lg cursor-pointer transition-colors"
                title="Schließen"
              >
                ✕
              </button>
            </div>

            {/* Split Content Area */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Panel: List of active QuickSteps */}
              <div className="w-[260px] border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 overflow-y-auto flex flex-col justify-between">
                <div>
                  <h4 className="text-[9.5px] text-slate-400 font-bold uppercase tracking-widest mb-2 select-none">Aktive QuickSteps</h4>
                  
                  {quickSteps.length === 0 ? (
                    <div className="p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-[10px] text-slate-400 italic font-semibold select-none leading-relaxed mt-2 bg-white dark:bg-slate-900">
                      Keine QuickSteps eingerichtet. Verfassen Sie Ihren ersten QuickStep im rechten Formular.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {quickSteps.map((qs) => (
                        <div 
                          key={qs.id} 
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                            editingQsId === qs.id 
                              ? 'bg-[#0078d4]/10 border-[#0078d4] text-slate-900 dark:text-white' 
                              : 'bg-white dark:bg-slate-900 border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-705 dark:text-slate-200'
                          }`}
                          onClick={() => {
                            setEditingQsId(qs.id);
                            setQsName(qs.name);
                            setQsColor(qs.color);
                            setQsAction(qs.action);
                            setQsTargetCategory(qs.targetCategory || '');
                          }}
                        >
                          <div className="flex items-center space-x-2 truncate pr-1">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: qs.color }} />
                            <span className="font-extrabold text-xs truncate">{qs.name}</span>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuickStep(qs.id, qs.name);
                            }}
                            className="p-1 hover:text-red-600 text-slate-450 dark:hover:text-red-450 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 select-none leading-relaxed font-semibold">
                  ⚡ <strong>Outlook Classic:</strong> Wählen Sie links einen QuickStep zur Bearbeitung aus oder drücken Sie unten &bdquo;Neu anlegen&ldquo;.
                </div>
              </div>

              {/* Right Panel: Add / Edit Form */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block select-none">
                  {editingQsId ? 'QuickStep bearbeiten' : 'Neuen QuickStep anlegen'}
                </h4>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      QuickStep Name:
                    </label>
                    <input 
                      type="text"
                      placeholder="Z.B. Gelesen & Archivieren..."
                      value={qsName}
                      onChange={(e) => setQsName(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-1 focus:ring-[#0078d4]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Auszuführende Aktion:
                    </label>
                    <select
                      value={qsAction}
                      onChange={(e) => {
                        setQsAction(e.target.value);
                        if (e.target.value === 'assign_category' && categoriesList.length > 0 && !qsTargetCategory) {
                          setQsTargetCategory(categoriesList[0].name);
                        }
                      }}
                      className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-1 focus:ring-[#0078d4]"
                    >
                      <option value="mark_read_and_archive">Als gelesen markieren &amp; archivieren</option>
                      <option value="archive">Archiv verschieben (unverändert)</option>
                      <option value="mark_read">Als gelesen markieren</option>
                      <option value="mark_unread">Als ungelesen markieren</option>
                      <option value="assign_category">Kategorie hinzufügen...</option>
                      <option value="forward">E-Mail weiterleiten</option>
                    </select>
                  </div>

                  {/* Optional Target Category Selection if applicable */}
                  {(qsAction === 'assign_category' || qsAction === 'mark_read_and_archive' || qsAction === 'archive') && (
                    <div className="animate-fade-in">
                      <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Ziel-Kategorie (Zuweisung):
                      </label>
                      <select
                        value={qsTargetCategory}
                        onChange={(e) => setQsTargetCategory(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 font-bold outline-none focus:ring-1 focus:ring-[#0078d4]"
                      >
                        <option value="">-- Keine Änderung / Keine --</option>
                        {categoriesList.map((cat) => (
                          <option key={cat.name} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Kennzeichnungsfarbe (Symbolfarbe):
                    </label>
                    <div className="flex flex-wrap gap-2 block">
                      {['#3b82f6', '#10b981', '#ef4444', '#f97316', '#a855f7', '#ec4899', '#eab308', '#64748b'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setQsColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-6.5 h-6.5 rounded-full border cursor-pointer transition-all ${
                            qsColor === c ? 'ring-2 ring-black dark:ring-white scale-110 border-white' : 'border-transparent hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  {editingQsId && (
                    <button
                      onClick={handleResetQuickStepForm}
                      className="flex-1 py-2 bg-slate-150 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all cursor-pointer active:scale-97 text-center border border-slate-200 dark:border-slate-750"
                    >
                      Neu anlegen
                    </button>
                  )}
                  <button
                    onClick={handleSaveQuickStep}
                    className="flex-1 py-2 bg-[#0078d4] hover:bg-[#106ebe] text-white rounded-xl font-bold transition-all cursor-pointer active:scale-97 text-center shadow-md animate-pulse"
                  >
                    {editingQsId ? 'Änderungen übernehmen' : 'QuickStep hinzufügen'}
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-950 h-14 border-t border-slate-205 dark:border-slate-800 flex items-center justify-end px-5 rounded-b-2xl">
              <button 
                onClick={() => {
                  setShowQuickStepsModal(false);
                  handleResetQuickStepForm();
                }}
                className="px-5 py-2 text-xs bg-slate-800 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-705 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer active:scale-95 text-center"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Wiedervorlage / Reminder Editor Modal */}
      {reminderModalEmailId && (() => {
        const mail = emails.find(e => e.id === reminderModalEmailId);
        if (!mail) return null;

        return (
          <div id="wiedervorlage-scheduler-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-130 animate-fade-in p-4 text-xs font-sans">
            <div className="bg-white rounded-2xl w-[450px] border border-slate-250 shadow-2xl flex flex-col select-none overflow-hidden max-w-full">
              {/* Modal Header */}
              <div className="h-13 bg-slate-50 border-b border-slate-200 px-5 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 text-slate-800">
                  <span className="text-base text-amber-500">Hinweis</span>
                  <span className="font-extrabold uppercase tracking-wide text-xs">Wiedervorlage einrichten</span>
                </div>
                <button
                  onClick={() => setReminderModalEmailId(null)}
                  className="text-slate-400 hover:text-slate-650 text-xl font-bold p-1 rounded-md cursor-pointer transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Informative selected email block */}
              <div className="p-5 bg-amber-50/20 border-b border-slate-100 space-y-1.5 font-medium">
                <p className="text-[10px] text-amber-800 font-extrabold uppercase tracking-widest">Markierte E-Mail</p>
                <div className="text-xs">
                  <p className="font-extrabold text-slate-800 truncate">{mail.subject}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5 truncate">Von: {mail.sender} ({mail.senderEmail})</p>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1.5">Datum</label>
                    <input 
                      type="date"
                      value={reminderModalDate}
                      onChange={(e) => setReminderModalDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-slate-800 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1.5">Uhrzeit</label>
                    <input 
                      type="time"
                      value={reminderModalTime}
                      onChange={(e) => setReminderModalTime(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-slate-800 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1.5">Zusätzliche Notizen (Optional)</label>
                  <textarea
                    placeholder="Wiedervorlage-Zweck, z.B. 'Andreas Müller anrufen bzgl. EF Core Bugfixes'..."
                    value={reminderModalNote}
                    onChange={(e) => setReminderModalNote(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-slate-850 text-xs leading-5"
                  />
                </div>

                <div className="bg-blue-50/40 rounded-xl p-3 border border-blue-150 text-[10.5px] leading-4.5 text-blue-900 flex items-start space-x-2">
                  <span className="text-sm shrink-0">Hinweis</span>
                  <p className="font-medium">
                    Speichern wird diesen Eintrag als <strong>Wiedervorlage-Termin</strong> in Ihrem <strong>Kalender</strong> anlegen. Eine Benachrichtigung meldet sich punktgenau.
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="h-14 bg-slate-50 border-t border-slate-200 px-5 flex items-center justify-between">
                <div>
                  {mail.reminderDate && (
                    <button
                      id="btn-remove-wiedervorlage"
                      onClick={handleRemoveReminder}
                      className="px-3.5 py-1.8 bg-red-50 hover:bg-red-100 text-red-650 font-bold rounded-lg text-xs transition-colors cursor-pointer border border-red-200/50"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setReminderModalEmailId(null)}
                    className="px-4 py-1.8 bg-white border border-slate-255 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    id="btn-save-wiedervorlage"
                    onClick={handleSaveReminder}
                    className="px-4 py-1.8 bg-[#0078d4] hover:bg-[#005a9e] text-white font-extrabold rounded-lg text-xs flex items-center shadow-md cursor-pointer transition-colors active:scale-97"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. Active Reminder Alerts Manager Popup Modal */}
      {triggeredReminderIds.length > 0 && (() => {
        return (
          <div id="wiedervorlage-alarm-popup" className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-200 animate-fade-in p-4 text-xs font-sans">
            <div className="bg-[#f3f2f1] rounded-2xl w-[480px] border border-slate-300 shadow-2xl flex flex-col select-none overflow-hidden max-h-[560px] max-w-full">
              {/* Outlook classic Reminders Title bar */}
              <div className="h-11 bg-[#0078d4] px-4 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center space-x-2 font-extrabold text-xs uppercase tracking-wider">
                  <span></span><span>{triggeredReminderIds.length} Erinnerung(en) fällig</span>
                </div>
                <button
                  onClick={() => setTriggeredReminderIds([])}
                  className="text-white/80 hover:text-white hover:bg-white/10 text-lg font-bold w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                  title="Alle schließen"
                >
                  ×
                </button>
              </div>

              {/* Informative Sub-header */}
              <div className="p-3 bg-white border-b border-slate-200 leading-4 text-[10.5px] text-slate-500 font-semibold uppercase tracking-wider flex items-center justify-between shrink-0">
                <span>Outlook Classic Wiedervorlage-Agent</span>
                <span className="font-mono bg-blue-100 px-2 py-0.5 text-blue-800 text-[9px] rounded-full">Dringend</span>
              </div>

              {/* Reminders list scrollable body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {triggeredReminderIds.map(emailId => {
                  const mail = emails.find(e => e.id === emailId);
                  if (!mail) return null;

                  return (
                    <div 
                      key={emailId}
                      className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] text-amber-800 font-extrabold uppercase tracking-widest flex items-center font-bold">
                            <span className="mr-1.5 shrink-0">Hinweis</span> WIEDERVORLAGE FÄLLIG
                          </p>
                          <h4 className="font-extrabold text-slate-800 text-[12.5px] leading-snug">{mail.subject}</h4>
                          <p className="text-[11px] text-slate-500">Von: <strong>{mail.sender}</strong> ({mail.senderEmail})</p>
                        </div>
                        <span className="text-[10px] bg-amber-55/40 rounded border border-amber-200 px-2 py-0.5 text-amber-850 font-mono font-bold shrink-0">
                          {mail.reminderDate ? new Date(mail.reminderDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ' Uhr' : 'Fällig'}
                        </span>
                      </div>

                      {mail.reminderNote && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] leading-5 text-slate-650 font-medium">
                          <span className="font-bold text-slate-800 block mb-0.5">Notiz:</span>
                          <em>„{mail.reminderNote}“</em>
                        </div>
                      )}

                      {/* Reminder Item Action Row */}
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 text-xs">
                        <button
                          id={`btn-alarm-retrieve-${mail.id}`}
                          onClick={() => {
                            // View email attachment directly
                            handleOpenEmailAttachment(mail.id);
                            // Remove from active trigger alerts
                            setTriggeredReminderIds(prev => prev.filter(id => id !== mail.id));
                          }}
                          className="px-3 py-1.5 bg-[#0078d4] hover:bg-[#005a9e] text-white font-extrabold rounded-lg text-[10.5px] transition-all flex items-center space-x-1 shadow-sm cursor-pointer active:scale-97"
                        >
                          <span>Mail abrufen</span>
                        </button>

                        <button
                          id={`btn-alarm-snooze-${mail.id}`}
                          onClick={() => {
                            // Snooze: relocate to current time + 5 minutes
                            const snoozedIso = new Date(Date.now() + 5 * 60 * 1000).toISOString();
                            setEmails(prev => prev.map(e => e.id === mail.id ? {
                              ...e,
                              reminderDate: snoozedIso,
                              reminderTriggered: false
                            } : e));

                            // Sync calendar item as well
                            const calId = `reminder-cal-${mail.id}`;
                            const endIso = new Date(Date.now() + 35 * 60 * 1000).toISOString();
                            setCalendarItems(prev => prev.map(c => c.id === calId ? {
                              ...c,
                              start: snoozedIso,
                              end: endIso,
                              title: `Wiedervorlage (Snoozed): ${mail.subject}`
                            } : c));

                            // Remove from alert popup list
                            setTriggeredReminderIds(prev => prev.filter(id => id !== mail.id));
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300/80 rounded-lg text-[10.5px] transition-colors cursor-pointer"
                        >
                          Snooze (5 Min)
                        </button>

                        <button
                          id={`btn-alarm-complete-${mail.id}`}
                          onClick={() => {
                            // Mark completed: unflag and clean reminder parameters
                            setEmails(prev => prev.map(e => e.id === mail.id ? {
                              ...e,
                              isFlagged: false,
                              reminderDate: undefined,
                              reminderNote: undefined,
                              reminderTriggered: false
                            } : e));

                            // Wipe out from calendar
                            const calId = `reminder-cal-${mail.id}`;
                            setCalendarItems(prev => prev.filter(c => c.id !== calId));

                            // Remove from alerts
                            setTriggeredReminderIds(prev => prev.filter(id => id !== mail.id));
                          }}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-extrabold rounded-lg text-[10.5px] transition-colors cursor-pointer ml-auto"
                        >
                          ✓ Erledigt
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reminders footer bar */}
              <div className="h-13 bg-slate-100 border-t border-slate-250 px-4 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-500 font-bold">
                  {triggeredReminderIds.length} fällige Termine vorliegend
                </span>
                
                <button
                  onClick={() => setTriggeredReminderIds([])}
                  className="px-4 py-1.8 bg-slate-800 hover:bg-slate-900 border border-slate-350 shadow-sm text-white font-bold rounded-xl text-xs transition-all cursor-pointer text-center text-xs"
                >
                  Alle ausblenden
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}













