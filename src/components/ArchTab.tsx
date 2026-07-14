/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Layers, Milestone, Code, Terminal, Cpu, Copy, Check, Info, CheckCircle, Play, ChevronRight, FileCode, Search, RefreshCw, MapPin
} from 'lucide-react';
import { RoadmapPhase, CodeFile, ArchitectureComponent } from '../types';

interface ArchTabProps {
  activeDevSection: string;
  setActiveDevSection: (sec: string) => void;
  roadmapPhases: RoadmapPhase[];
  codeFiles: CodeFile[];
  userEmail: string;
  onAccountConfigured: (email: string, settings: any) => void;
  discoveredSettings: any;
}

export default function ArchTab({
  activeDevSection,
  setActiveDevSection,
  roadmapPhases,
  codeFiles,
  userEmail,
  onAccountConfigured,
  discoveredSettings
}: ArchTabProps) {
  const [selectedFileId, setSelectedFileId] = useState<string>('app-xaml-cs');
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  // Auto-Discovery States & Simulator Work
  const [testEmail, setTestEmail] = useState<string>('user@example.com');
  const [testPassword, setTestPassword] = useState<string>('');
  const [discoveryLogs, setDiscoveryLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0 idle, 1 DNS/MX, 2 Autodiscover XML, 3 Connection Test, 4 Complete
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveredResult, setDiscoveredResult] = useState<{
    imapServer: string;
    imapPort: number;
    smtpServer: string;
    smtpPort: number;
    provider: string;
    success: boolean;
  } | null>(null);

  const startAutoDiscoverySimulation = (email: string) => {
    if (!email || !email.includes('@')) {
      alert('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    setIsDiscovering(true);
    setDiscoveredResult(null);
    setCurrentStep(1);
    setDiscoveryLogs([`[${new Date().toLocaleTimeString()}] [INFO] Starte Auto-Discovery für ${email}...`]);

    const domain = email.split('@')[1].toLowerCase();

    // STEP 1: Domain Analysis & MX Lookup
    setTimeout(() => {
      setDiscoveryLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [INFO] Extrahiere Mail-Domain: "${domain}"`,
        `[${new Date().toLocaleTimeString()}] [DNS] Starte DNS MX-Record Lookup für Domain "${domain}"...`
      ]);
    }, 600);

    setTimeout(() => {
      let mxRecord = `mail.${domain}`;
      if (domain.includes('gmail.com') || domain.includes('googlemail.com')) {
        mxRecord = 'gmail-smtp-in.l.google.com';
      } else if (domain.includes('gmx.')) {
        mxRecord = 'mx01.gmx.net';
      } else if (domain.includes('web.de')) {
        mxRecord = 'mx-ha01.web.de';
      } else if (domain.includes('outlook.com') || domain.includes('hotmail.')) {
        mxRecord = 'mail.protection.outlook.com';
      }

      setDiscoveryLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [DNS] MX-Record gefunden: Priority 10 -> ${mxRecord}`,
        `[${new Date().toLocaleTimeString()}] [INFO] DNS-Schnittstelle bestätigt Mailserver-Zuweisung.`
      ]);
      setCurrentStep(2);
    }, 1500);

    // STEP 2: Autodiscover XML Protocol Probe
    setTimeout(() => {
      setDiscoveryLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [HTTPS] Frage Microsoft Autodiscover-Protokoll an...`,
        `[${new Date().toLocaleTimeString()}] [HTTPS] GET https://autodiscover.${domain}/autodiscover/autodiscover.xml (Timeout simulieren)`
      ]);
    }, 2400);

    setTimeout(() => {
      const isStaticProvider = ['gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'gmx.at', 'web.de', 'outlook.com', 'hotmail.com'].includes(domain);
      
      if (isStaticProvider) {
        setDiscoveryLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] [HTTPS] Autodiscover XML Endpoint nicht direkt erreichbar (kein Exchange Active-Directory).`,
          `[${new Date().toLocaleTimeString()}] [DB] Fallback: Bereichsdatenbank abgeglichen für ${domain}.`
        ]);
      } else {
        setDiscoveryLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] [HTTPS] Standard Exchange Autodiscover v1 XML hat nicht geantwortet.`,
          `[${new Date().toLocaleTimeString()}] [RFC 6186] Frage SRV-Records für _imaps._tcp.${domain} ab...`,
          `[${new Date().toLocaleTimeString()}] [DNS] Kein SRV-Record hinterlegt. Verwende heuristische Standard-Subdomains.`
        ]);
      }
      setCurrentStep(3);
    }, 3500);

    // STEP 3: Connection Verifier Sim (IMAP/SMTP)
    setTimeout(() => {
      let imapHost = `imap.${domain}`;
      let smtpHost = `smtp.${domain}`;
      let imapPort = 993;
      let smtpPort = 465;
      let providerName = `Generischer IMAP Server (${domain})`;

      if (domain === 'gmail.com' || domain === 'googlemail.com') {
        imapHost = 'imap.gmail.com';
        smtpHost = 'smtp.gmail.com';
        providerName = 'Google Workspace / Gmail';
      } else if (domain.includes('gmx.')) {
        imapHost = 'imap.gmx.net';
        smtpHost = 'mail.gmx.net';
        providerName = 'GMX Freemail';
      } else if (domain.includes('web.de')) {
        imapHost = 'imap.web.de';
        smtpHost = 'smtp.web.de';
        smtpPort = 587;
        providerName = 'WEB.DE Freemail';
      } else if (domain.includes('outlook.com') || domain.includes('hotmail.')) {
        imapHost = 'outlook.office365.com';
        smtpHost = 'smtp-mail.outlook.com';
        smtpPort = 587;
        providerName = 'Microsoft Live / Outlook.com';
      }

      setDiscoveryLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [CONNECT] Simuliere IMAP TCP/IP Verbindungsaufbau zu ${imapHost}:${imapPort}...`,
        `[${new Date().toLocaleTimeString()}] [SUCCESS] SSL/TLS-Handshake mit ${imapHost} erfolgreich abgeschlossen.`,
        `[${new Date().toLocaleTimeString()}] [CONNECT] Simuliere SMTP TCP/IP Verbindungsaufbau zu ${smtpHost}:${smtpPort}...`,
        `[${new Date().toLocaleTimeString()}] [SUCCESS] Verbindung bereit auf ${smtpHost}!`
      ]);

      setDiscoveredResult({
        imapServer: imapHost,
        imapPort: imapPort,
        smtpServer: smtpHost,
        smtpPort: smtpPort,
        provider: providerName,
        success: true
      });
      setCurrentStep(4);
    }, 4800);

    // STEP 4: Complete
    setTimeout(() => {
      setDiscoveryLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [COMPLETE] Die E-Mail-Einrichtungsparameter wurden erfolgreich ermittelt. Das C# AutoDiscoveryService Modell steht zur Speicherung bereit.`
      ]);
      setIsDiscovering(false);
    }, 5500);
  };

  const activeFile = codeFiles.find(f => f.id === selectedFileId) || codeFiles[0];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFileId(id);
    setTimeout(() => setCopiedFileId(null), 2000);
  };

  // Architecture components definition
  const archComponents: ArchitectureComponent[] = [
    {
      name: 'WPF View (Presentation Layer)',
      role: 'MainWindow.xaml, Styles.xaml, UserControls',
      description: 'Definiert das Aussehen im klassischen Outlook Office-Design. Verwendet reines Datenbinding (DataBinding) und deklariert Custom ControlTemplates anstelle von Standard-Steuerelementen.',
      responsibilities: [
        'Anzeige von E-Mail-, Kalender- und Kontaktdaten',
        'Zweidimensionale Layout-Trennung mit GridSplitters',
        'Ribbon-Leiste mit interaktiven Hover-Effekten',
        'Virtuelle Listen (VirtualizingStackPanel) für unbegrenzte Mail-Mengen'
      ],
      exampleClass: 'MainWindow.xaml'
    },
    {
      name: 'WPF ViewModels (MVVM Layer)',
      role: 'ViewModelBase.cs, MainWindowViewModel.cs',
      description: 'Zuständig für die Anwendungslogik und Zustandsübertragung. Reagiert auf Benutzerinteraktionen und synchronisiert geänderte Werte.',
      responsibilities: [
        'Kapselung des Anwendungszustands (ActiveMail, ActivePage)',
        'Bereitstellung von ICommand-Schnittstellen (RelayCommand) für Buttons',
        'Automatische Eventänderungen durch INotifyPropertyChanged',
        'Koordination des asynchronen Mail-Abrufs über Services'
      ],
      exampleClass: 'MainWindowViewModel.cs'
    },
    {
      name: 'Services (Infrastructure Layer)',
      role: 'IMailService, ISyncEngine, SQLiteDbContext',
      description: 'Das Gehirn hinter der App. Verwaltet die Netzwerk- und Datenbankinteraktionen im Hintergrund, um den UI STA-Thread niemals zu blockieren.',
      responsibilities: [
        'MailKit-Integration für IMAP/POP3/SMTP-Sitzungen',
        'Inkrementelle Hintergrund-Synchronisierung (Delta Sync)',
        'Erkennung des Offline-Verbindungsstatus',
        'Einleitung lokaler DB-Transaktionen'
      ],
      exampleClass: 'MailService.cs'
    },
    {
      name: 'Storage (Persistent Database)',
      role: 'Entity Framework Core, SQLite, raw (outlook.db)',
      description: 'Sichert lokale E-Mails, Ordnerdaten, Anhänge und geplante Synchronisierungsaufträge (Outbox Queue) dauerhaft auf der Festplatte.',
      responsibilities: [
        'Dauerhaftes Offline-Caching zur Offline-Arbeit',
        'Volltextsuchindexierung mit SQLite FTS5 extension',
        'Relationales Mapping von Ordner- und Task-Bäumen'
      ],
      exampleClass: 'MailItem.cs'
    }
  ];

  return (
    <div id="wpf-architecture-dashboard" className="flex-1 bg-white flex flex-col h-full font-sans overflow-hidden select-none">
      
      {/* 1. Header Banner */}
      <div className="bg-slate-900 text-white p-5 shrink-0 flex items-center justify-between border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <Terminal className="text-[#0078d4] w-5 h-5" />
            <h1 className="text-sm font-extrabold tracking-wide uppercase">C# & WPF Entwickler-Suite: Unique Mail</h1>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Architektur, Quellcode-Boilerplates, IMAP Auto-Discovery-Dienst und modularer Fahrplan für das .NET 8 System.
          </p>
        </div>
        
        {/* Navigation buttons inside Dev Hub */}
        <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 space-x-1.5 text-xs">
          <button
            onClick={() => setActiveDevSection('architecture')}
            className={`px-3.5 py-1.8 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeDevSection === 'architecture' ? 'bg-[#0078d4] text-white font-extrabold shadow-sm' : 'text-slate-350 hover:text-white'}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Architektur</span>
          </button>
          <button
            onClick={() => setActiveDevSection('roadmap')}
            className={`px-3.5 py-1.8 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeDevSection === 'roadmap' ? 'bg-[#0078d4] text-white font-extrabold shadow-sm' : 'text-slate-350 hover:text-white'}`}
          >
            <Milestone className="w-3.5 h-3.5" />
            <span>Roadmap</span>
          </button>
          <button
            onClick={() => setActiveDevSection('code')}
            className={`px-3.5 py-1.8 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeDevSection === 'code' ? 'bg-[#0078d4] text-white font-extrabold shadow-sm' : 'text-slate-350 hover:text-white'}`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Visual Studio Code</span>
          </button>
          <button
            onClick={() => setActiveDevSection('discovery')}
            className={`px-3.5 py-1.8 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${activeDevSection === 'discovery' ? 'bg-sky-600 text-white font-extrabold shadow-sm' : 'text-sky-300 hover:text-white hover:bg-slate-700'}`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Auto-Discovery Emulator</span>
          </button>
        </div>
      </div>

      {/* 2. Main Tab Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        
        {/* ================= ARCHITECTURE SECTION ================= */}
        {activeDevSection === 'architecture' && (
          <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
            {/* Visual Architecture Flowcharts Diagram */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
              <h2 className="text-xs font-extrabold text-slate-850 uppercase tracking-widest flex items-center border-b border-slate-100 pb-3">
                <Cpu className="w-4 h-4 mr-2 text-[#0078d4]" />
                <span>WPF MVVM & Sync Framework (Flussdiagramm)</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4 text-center">
                
                {/* View Tier */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3.5 space-y-2 relative">
                  <div className="absolute top-2 right-2 text-[8px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.2 rounded-full font-mono">WPF</div>
                  <strong className="text-xs text-blue-900 block font-bold">1. XAML GUI</strong>
                  <p className="text-[10.5px] text-blue-700 leading-4">MainWindow.xaml<br/>SubViews & Styles.xaml</p>
                  <div className="text-[9.5px] text-slate-400 bg-white border border-blue-100 py-0.5 px-2 rounded-full inline-block font-bold">DataBinding & Events</div>
                </div>

                {/* ViewModel Tier */}
                <div className="bg-slate-50 border border-slate-250 rounded-xl p-3.5 space-y-2 relative">
                  <div className="absolute top-2 right-2 text-[8px] bg-slate-200 text-slate-800 font-extrabold px-1.5 py-0.2 rounded-full font-mono">C#</div>
                  <strong className="text-xs text-slate-800 block font-bold">2. ViewModels</strong>
                  <p className="text-[10.5px] text-slate-600 leading-4">MainWindowViewModel.cs<br/>RelayCommands</p>
                  <div className="text-[9.5px] text-slate-400 bg-white border border-slate-200 py-0.5 px-2 rounded-full inline-block font-bold">Raise PropertyChange</div>
                </div>

                {/* Services Tier */}
                <div className="bg-[#f0f9ff] border border-sky-100 rounded-xl p-3.5 space-y-2 relative">
                  <div className="absolute top-2 right-2 text-[8px] bg-sky-100 text-sky-800 font-extrabold px-1.5 py-0.2 rounded-full font-mono">MailKit</div>
                  <strong className="text-xs text-sky-900 block font-bold">3. Services & Sync</strong>
                  <p className="text-[10.5px] text-sky-700 leading-4">MailService.cs (IMAP)<br/>SyncEngine Background</p>
                  <div className="text-[9.5px] text-slate-400 bg-white border border-sky-100 py-0.5 px-2 rounded-full inline-block font-bold">Asynchronous Worker</div>
                </div>

                {/* Database Tier */}
                <div className="bg-indigo-50/50 border border-indigo-200/60 rounded-xl p-3.5 space-y-2 relative">
                  <div className="absolute top-2 right-2 text-[8px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.2 rounded-full font-mono">DB</div>
                  <strong className="text-xs text-indigo-900 block font-bold">4. Lokaler Cache</strong>
                  <p className="text-[10.5px] text-indigo-700 leading-4">SQLite (outlook.db)<br/>Entity Framework Core</p>
                  <div className="text-[9.5px] text-slate-400 bg-white border border-indigo-150 py-0.5 px-2 rounded-full inline-block font-bold">Persistent Storage</div>
                </div>

              </div>

              <div className="bg-sky-50 border border-sky-100 text-xs text-slate-700 p-4 rounded-xl flex items-start space-x-3.5">
                <Info className="w-5 h-5 text-[#0078d4] mt-0.5 shrink-0" />
                <div className="leading-6 font-medium">
                  <strong className="text-slate-900 font-extrabold block mb-0.5">Exakte Outlook Classic Replikation:</strong> Die Windows Desktop-App ist offline-fähig. Alle Schreibaktionen (Verfassen einer E-Mail, Erledigung von Aufgaben) lagern zuerst in lokal angelegten SQLite-Transaktions-Datenbanken und spiegeln sich bei stabiler Exchange Server-Sitzung im Hintergrund über einen intelligenten Delta-Sync Worker zurück auf den IMAP-Server.
                </div>
              </div>
            </div>

            {/* In-depth descriptions of architectural layers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {archComponents.map((comp) => (
                <div key={comp.name} className="bg-white border border-slate-200/80 hover:border-blue-400 transition-all rounded-2xl p-5.5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-[10px] uppercase bg-[#c7e0f4]/60 text-[#0f5387] px-3 py-1 rounded-full font-bold border border-[#c7e0f4]">
                      {comp.name}
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">
                      {comp.exampleClass}
                    </span>
                  </div>

                  <div>
                    <div className="text-[10.5px] font-bold text-slate-450 font-mono bg-slate-50 px-2 py-1 rounded inline-block">{comp.role}</div>
                    <p className="text-xs text-slate-600 leading-5 mt-2.5 font-medium">{comp.description}</p>
                  </div>

                  <div className="border-t border-slate-100 pt-3.5 space-y-2">
                    <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest block">Verantwortlichkeiten:</span>
                    <ul className="space-y-1.5">
                      {comp.responsibilities.map((resp, i) => (
                        <li key={i} className="text-[11px] text-slate-650 flex items-start font-medium">
                          <span className="text-green-500 mr-2 font-bold">✔</span>
                          <span>{resp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= ROADMAP SECTION ================= */}
        {activeDevSection === 'roadmap' && (
          <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
            {/* Visual Roadmap Overview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5.5 space-y-4 shadow-xs">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center border-b border-slate-100 pb-3">
                <Milestone className="w-4 h-4 mr-2 text-[#0078d4]" />
                <span>Modulare 5-Phasen Implementation (Visual C# Timeline)</span>
              </h2>

              <p className="text-xs text-slate-400 font-medium">
                Recherchierter Phasen-Plan bis zur schlüsselfertigen Outlook-Wiederverwendungs-App:
              </p>

              {/* Step By Step Timeline representation */}
              <div className="space-y-4">
                {roadmapPhases.map((phase) => {
                  return (
                    <div 
                      key={phase.id} 
                      className={`border rounded-2xl p-5.5 transition-all flex flex-col md:flex-row md:items-start space-y-3.5 md:space-y-0 md:space-x-5 ${
                        phase.status === 'Completed' ? 'border-green-200 bg-green-50/10' :
                        phase.status === 'InProgress' ? 'border-[#0078d4] bg-blue-50/15 shadow-xs' :
                        'border-slate-200/80 bg-white'
                      }`}
                    >
                      {/* Left icon status badge */}
                      <div className="shrink-0 flex items-center space-x-2 md:block">
                        {phase.status === 'Completed' ? (
                          <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0 mx-auto border border-green-250">
                            ✔
                          </div>
                        ) : phase.status === 'InProgress' ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0078d4] flex items-center justify-center animate-pulse shrink-0 mx-auto border border-blue-250">
                            <Play className="w-3.5 h-3.5 fill-blue-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-455 border border-slate-250 flex items-center justify-center font-extrabold text-xs shrink-0 mx-auto font-mono">
                            {phase.id}
                          </div>
                        )}
                        <span className="text-[9.5px] font-bold text-slate-400 text-center block md:mt-2.5 font-mono">{phase.duration}</span>
                      </div>

                      {/* Right main details */}
                      <div className="flex-1 space-y-3">
                        <div>
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${
                            phase.status === 'Completed' ? 'text-green-700' :
                            phase.status === 'InProgress' ? 'text-[#0078d4]' :
                            'text-slate-400'
                          }`}>
                            {phase.status === 'Completed' && 'ABGESCHLOSSEN'}
                            {phase.status === 'InProgress' && 'AKTIVER SPRINT'}
                            {phase.status === 'Planned' && 'GEPLANT'}
                          </span>
                          <h3 className="text-xs font-extrabold text-slate-900 mt-0.5">{phase.title}</h3>
                          <div className="text-[11px] text-slate-450 italic font-medium mt-0.5">{phase.subtitle}</div>
                        </div>

                        <p className="text-xs text-slate-650 leading-relaxed font-sans p-3 bg-slate-50 border border-slate-150 rounded-xl leading-5 font-semibold">
                          <strong className="text-slate-800 font-extrabold block mb-0.5">WPF Fokus:</strong> {phase.wpfFocus}
                        </p>

                        {/* List of actions */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">Implementierungsschritte:</span>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
                            {phase.tasks.map((task, i) => (
                              <li key={i} className="flex items-start font-medium">
                                <span className="text-[#0078d4] mr-2">•</span>
                                <span>{task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Code attachments association */}
                        {phase.codeFiles.length > 0 && (
                          <div className="flex items-center space-x-1.5 pt-1.5">
                            <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-widest">Boilerplates:</span>
                            {phase.codeFiles.map((fn) => (
                              <button 
                                key={fn}
                                onClick={() => {
                                  const targetCode = codeFiles.find(f => f.name === fn);
                                  if (targetCode) {
                                    setSelectedFileId(targetCode.id);
                                    setActiveDevSection('code');
                                  }
                                }}
                                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold flex items-center transition-all shadow-xs cursor-pointer active:scale-95 animate-fade-in"
                              >
                                <Code className="w-2.5 h-2.5 mr-1 text-[#0078d4]" />
                                {fn}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= CODE SECTION ================= */}
        {activeDevSection === 'code' && (
          <div className="space-y-4 max-w-5xl mx-auto animate-fade-in flex flex-col h-[70vh] pb-12">
            
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center">
                  <Code className="w-4 h-4 mr-2 text-[#0078d4]" />
                  <span>WPF & C# Quellcode-Repository</span>
                </h2>
                <p className="text-[11px] text-slate-450 font-medium mt-0.5">
                  Wählen Sie ein C# bzw. XAML-Baukastenmodul aus, um den fertigen Visual Studio Code anzuzeigen, zu editieren oder zu kopieren.
                </p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start space-x-3 text-xs shrink-0 select-none">
              <Info className="w-4.5 h-4.5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="leading-5 font-semibold text-emerald-950">
                <strong className="text-emerald-900 font-extrabold block mb-0.5">💡 Schlüsselfertiges .NET 8 Compilation-Setup:</strong>
                Das heruntergeladene WinZip-Verzeichnis (238 KB) enthält den webbasierten React Live-Simulator. Um die vollwertige Windows-Wiederverwendungs-App (.EXE) zu bauen, nutzen Sie die nachfolgenden C# Boilerplates und führen Sie den Befehl <code className="font-mono text-emerald-800 bg-emerald-100/65 px-1 rounded-sm">dotnet publish -c Release -r win-x64 --self-contained true</code> aus. Eine vollständige, bebilderte Turnkey-Anleitung finden Sie jederzeit im Menü <span className="text-[#0078d4] font-extrabold">Optionen</span> (oben rechts) unter <span className="text-emerald-600 font-extrabold">Desktop-App (.exe)</span>!
              </div>
            </div>

            {/* Split code screen sidebars */}
            <div className="flex-1 flex border border-slate-200 rounded-2xl overflow-hidden bg-white min-h-0 shadow-sm">
              {/* Files sidebar */}
              <div className="w-56 border-r border-slate-200 bg-slate-50 overflow-y-auto shrink-0 py-3">
                <span className="text-[10px] font-extrabold text-slate-400 px-4 uppercase tracking-widest block mb-2.5">Projektdateien (.NET)</span>
                
                <div className="space-y-0.5 px-2">
                  {codeFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg transition-all cursor-pointer ${
                        selectedFileId === file.id
                          ? 'bg-white text-black font-extrabold border-slate-205 shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode className={`w-3.5 h-3.5 shrink-0 ${file.type === 'xaml' ? 'text-amber-500' : 'text-blue-500'}`} />
                        <span className="truncate font-mono font-bold text-[11px]">{file.name}</span>
                      </div>
                      
                      <span className="text-[8px] bg-slate-200/60 font-mono font-extrabold text-slate-500 tracking-wider rounded px-1 py-0.2 shrink-0 scale-90">
                        {file.type.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Core viewer editor box */}
              <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
                {/* File Header metadata */}
                <div className="bg-slate-900 px-4 py-2 flex items-center justify-between shrink-0 text-xs border-b border-slate-800">
                  <div className="flex items-center space-x-2 text-slate-350">
                    <span className="font-mono text-[11px] text-white font-extrabold">{activeFile.name}</span>
                    <span className="text-slate-650">|</span>
                    <span className="text-[10px] text-slate-400 font-sans italic font-medium">{activeFile.description}</span>
                  </div>

                  <button
                    onClick={() => handleCopy(activeFile.code, activeFile.id)}
                    className="bg-[#0078d4] hover:bg-[#005a9e] text-white px-3.5 py-1.8 rounded-lg font-bold text-[11px] transition-all flex items-center space-x-1.5 shadow active:scale-95 cursor-pointer"
                  >
                    {copiedFileId === activeFile.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-300" />
                        <span>Kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Code kopieren</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Code display inside pre-block */}
                <div className="flex-1 overflow-auto p-4 select-text">
                  <pre className="font-mono text-[11px] text-[#dadada] leading-5 select-text">
                    {activeFile.code}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= AUTO-DISCOVERY EMULATOR SECTION ================= */}
        {activeDevSection === 'discovery' && (
          <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
            {/* Header info */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-2">
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center">
                <Search className="w-4 h-4 mr-2 text-sky-600" />
                <span>IMAP / SMTP Auto-Discovery Sandbox</span>
              </h2>
              <p className="text-xs text-slate-450 leading-relaxed font-semibold">
                Testen Sie hier die automatische Einrichtung von E-Mail-Konten im typischen Outlook-Prozess. Der zugrunde liegende C#-Algorithmus führt vollautomatisch DNS MX-Record Abfragen, Microsoft Autodiscover XML Endpoint Scans sowie Standardport-Verbindungschecks im Hintergrund durch.
              </p>
            </div>

            {/* Split screen: left simulator tool, right C# source code */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left column: Input Form & Progress Terminal (6 cols) */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5.5 flex flex-col justify-between space-y-5 shadow-xs">
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest block">INTERAKTIVES SETUP-FORMULAR</span>
                    <h3 className="text-xs font-extrabold text-slate-700 mt-0.5">E-Mail-Account einlesen</h3>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[10.5px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">E-Mail-Adresse</label>
                      <input 
                        type="email"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="z.B. user@gmail.com, name@gmx.de, test@domain.de"
                        className="w-full px-3.5 py-2 text-xs border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 bg-white transition-all text-slate-800 font-mono"
                        disabled={isDiscovering}
                      />
                      <span className="text-[9.5px] text-slate-400 mt-1.5 block font-medium">Tipp: Verwenden Sie gmail.com, gmx.de, web.de oder outlook.com für spezifische Fast-Paths.</span>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">Passwort</label>
                      <input 
                        type="password"
                        value={testPassword}
                        onChange={(e) => setTestPassword(e.target.value)}
                        placeholder="Hinterlegtes Kennwort"
                        className="w-full px-3.5 py-2 text-xs border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500 bg-white transition-all text-slate-800"
                        disabled={isDiscovering}
                      />
                    </div>

                    <button
                      onClick={() => startAutoDiscoverySimulation(testEmail)}
                      disabled={isDiscovering}
                      className={`w-full py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-md active:scale-97 cursor-pointer ${
                        isDiscovering
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          : 'bg-sky-600 hover:bg-sky-700 text-white'
                      }`}
                    >
                      {isDiscovering ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                          <span>Suche Verbindungsparameter...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span>C# Auto-Discovery simulieren</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Visual Stepper Progress during discovery */}
                  {currentStep > 0 && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Verbindungsschritte:</span>
                      
                      <div className="space-y-2.5">
                        {/* Step 1 */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={`${currentStep >= 1 ? 'text-slate-850' : 'text-slate-400'}`}>1. DNS MX-Record Abfrage</span>
                          {currentStep > 1 ? (
                            <span className="text-green-600 font-mono text-[9px] font-extrabold bg-green-50 px-1.5 rounded-full">● OK</span>
                          ) : currentStep === 1 ? (
                            <span className="text-sky-600 font-mono text-[9px] animate-pulse">Analysiere...</span>
                          ) : (
                            <span className="text-slate-350 font-mono text-[9px]">Geplant</span>
                          )}
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={`${currentStep >= 2 ? 'text-slate-850' : 'text-slate-400'}`}>2. Autodiscover XML / API Probing</span>
                          {currentStep > 2 ? (
                            <span className="text-green-600 font-mono text-[9px] font-extrabold bg-green-50 px-1.5 rounded-full">● OK</span>
                          ) : currentStep === 2 ? (
                            <span className="text-sky-600 font-mono text-[9px] animate-pulse">Abfrage läuft...</span>
                          ) : (
                            <span className="text-slate-350 font-mono text-[9px]">Geplant</span>
                          )}
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={`${currentStep >= 3 ? 'text-slate-850' : 'text-slate-400'}`}>3. Port-Zustandstest & SSL/TLS Handshake</span>
                          {currentStep > 3 ? (
                            <span className="text-green-600 font-mono text-[9px] font-extrabold bg-green-50 px-1.5 rounded-full">● OK</span>
                          ) : currentStep === 3 ? (
                            <span className="text-sky-600 font-mono text-[9px] animate-pulse">Zertifikat-Prüfung...</span>
                          ) : (
                            <span className="text-slate-350 font-mono text-[9px]">Geplant</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Raw Debug Logger Terminal */}
                  {discoveryLogs.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">C# SERVICE CONSOLE LOGS</span>
                      <div className="bg-slate-900 border border-slate-950 rounded-xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-teal-400 space-y-1.5 select-text shadow-inner">
                        {discoveryLogs.map((log, i) => (
                          <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Detected Config Result Box */}
                {discoveredResult && discoveredResult.success && (
                  <div className="border border-green-200 bg-green-50/20 rounded-2xl p-4.5 space-y-4 mt-4 shadow-sm animate-fade-in">
                    <div className="flex items-center space-x-2 text-green-900 font-extrabold text-xs border-b border-green-100 pb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Einwahlparameter ermittelt: {discoveredResult.provider}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs">
                        <span className="text-[8.5px] text-slate-400 font-extrabold block uppercase tracking-wider">IMAP SERVER (EINGANG)</span>
                        <strong className="font-mono text-[11px] text-slate-850 mt-0.5 block">{discoveredResult.imapServer}:{discoveredResult.imapPort}</strong>
                        <span className="text-[9px] text-green-700 block mt-1 font-semibold">Verschlüsselung: SSL/TLS</span>
                      </div>
                      <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-xs">
                        <span className="text-[8.5px] text-slate-400 font-extrabold block uppercase tracking-wider">SMTP SERVER (AUSGANG)</span>
                        <strong className="font-mono text-[11px] text-slate-855 mt-0.5 block">{discoveredResult.smtpServer}:{discoveredResult.smtpPort}</strong>
                        <span className="text-[9px] text-green-700 block mt-1 font-semibold">Sicherheit: {discoveredResult.smtpPort === 465 ? 'SSL/TLS' : 'STARTTLS'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2.5">
                      <p className="text-[10.5px] text-slate-600 leading-relaxed font-semibold">
                        Die SQLite Konfigurationsdatenbank für Unique Mail in .NET 8 wird atomar aktualisiert. Klicken Sie unten, um das Konto direkt in die Web-App einzupflegen!
                      </p>
                      <button
                        onClick={() => onAccountConfigured(testEmail, discoveredResult)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95 cursor-pointer"
                      >
                        <span>Konto in Unique Mail einpflegen & aktivieren</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right column: C# auto-discovery code file (6 cols) */}
              <div className="lg:col-span-6 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col min-h-0 h-[670px] shadow-xl">
                {/* Code file header metadata */}
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0 text-xs">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <span className="font-mono text-[11px] text-sky-400 font-extrabold">AutoDiscoveryService.cs</span>
                    <span className="text-slate-650">|</span>
                    <span className="text-[10px] text-slate-450 font-sans italic font-medium">Hintergrundservice (.NET 8 C#)</span>
                  </div>

                  <button
                    onClick={() => {
                      const codeText = codeFiles.find(f => f.id === 'autodiscovery-cs')?.code || '';
                      handleCopy(codeText, 'autodiscovery-cs');
                    }}
                    className="bg-[#0078d4] hover:bg-[#005a9e] text-white px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center space-x-1.5 shadow active:scale-95 cursor-pointer"
                  >
                    {copiedFileId === 'autodiscovery-cs' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-300" />
                        <span>Kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>C# Code kopieren</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Code viewport pre-block */}
                <div className="flex-1 overflow-auto p-4 select-text">
                  <pre className="font-mono text-[10.5px] text-[#dadada] leading-4 select-text">
                    {codeFiles.find(f => f.id === 'autodiscovery-cs')?.code || '// Service nicht geladen'}
                  </pre>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
