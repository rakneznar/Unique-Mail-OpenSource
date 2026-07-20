/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React from 'react';
import AppLogo from './AppLogo';
import { Category } from '../types';
import { 
  Mail, MailOpen, Trash2, Archive, Reply, ReplyAll, Forward, Search, 
  RefreshCw, Wifi, WifiOff, FolderPlus, FolderOpen, 
  Plus, Settings, Layers, Milestone, Code, Cpu, ShieldAlert, Tag, Flag, Users, Undo2, Globe,
  Sun, Moon, Zap, Pin, Star
} from 'lucide-react';

interface RibbonProps {
  activeTab: string;
  setActiveTab: (tab: 'start' | 'sync' | 'folder' | 'view' | 'dev' | 'options') => void;
  onNewEmail: () => void;
  onTriggerSync: () => void;
  isOffline: boolean;
  toggleOffline: () => void;
  currentPage: 'mail' | 'calendar' | 'contacts' | 'crm' | 'tasks' | 'notes' | 'dev';
  setCurrentPage: (page: 'mail' | 'calendar' | 'contacts' | 'crm' | 'tasks' | 'notes' | 'dev') => void;
  selectedEmailId: string | null;
  onReply: () => void;
  onDeleteMail: () => void;
  onToggleSelectedPin?: () => void;
  onToggleSelectedReadUnread?: () => void;
  onToggleSelectedFavorite?: () => void;
  onBlockSelectedSender?: () => void;
  selectedEmailIsRead?: boolean;
  selectedEmailIsPinned?: boolean;
  selectedEmailIsFavorite?: boolean;
  activeDevSection: string;
  setActiveDevSection: (sec: string) => void;
  userEmail: string;
  isDense: boolean;
  setIsDense: (dense: boolean) => void;
  onOpenOptions: () => void;
  isSyncing?: boolean;
  isDarkMode?: boolean;
  language?: 'de' | 'en';
  onToggleDarkMode?: () => void;
  
  onArchiveMail?: () => void;
  onReportPhishing?: () => void;
  onMarkAllAsRead?: () => void;
  onAddFolder?: () => void;
  onToggleFlag?: () => void;
  onCategorySelect?: (cat: string) => void;
  quickSteps?: { id: string; name: string; color: string; action: string; targetCategory?: string; targetFolder?: string }[];
  onApplyQuickStep?: (qs: any) => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onNewCalendarItem?: () => void;
  onNewContact?: () => void;
  categoriesList?: Category[];
  onManageCategories?: () => void;
  onDeleteCategoryGlobal?: (name: string) => void;
  onManageQuickSteps?: () => void;
}

export default function Ribbon({
  activeTab,
  setActiveTab,
  onNewEmail,
  onTriggerSync,
  isOffline,
  toggleOffline,
  currentPage,
  setCurrentPage,
  selectedEmailId,
  onReply,
  onDeleteMail,
  onToggleSelectedPin,
  onToggleSelectedReadUnread,
  onToggleSelectedFavorite,
  onBlockSelectedSender,
  selectedEmailIsRead = true,
  selectedEmailIsPinned = false,
  selectedEmailIsFavorite = false,
  activeDevSection,
  setActiveDevSection,
  userEmail,
  isDense,
  setIsDense,
  onOpenOptions,
  isSyncing = false,
  isDarkMode = false,
  language = 'de',
  onToggleDarkMode,
  onArchiveMail,
  onReportPhishing,
  onMarkAllAsRead,
  onAddFolder,
  onToggleFlag,
  onCategorySelect,
  quickSteps,
  onApplyQuickStep,
  onReplyAll,
  onForward,
  onNewCalendarItem,
  onNewContact,
  categoriesList,
  onManageCategories,
  onDeleteCategoryGlobal,
  onManageQuickSteps
}: RibbonProps) {
  const [showCategoryDropdown, setShowCategoryDropdown] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0 });
  const ribbonText = {
    inbox: language === 'en' ? 'Inbox' : 'Posteingang',
    calendar: language === 'en' ? 'Calendar' : 'Kalender',
    contacts: language === 'en' ? 'Contacts' : 'Kontakte',
    tasks: language === 'en' ? 'Tasks' : 'Aufgabenliste',
    notes: language === 'en' ? 'Notes' : 'Notizen',
    developer: language === 'en' ? 'Developer module' : 'Entwicklermodul',
    start: language === 'en' ? 'Home' : 'Start',
    sendReceive: language === 'en' ? 'Send / Receive' : 'Senden / Empfangen',
    folders: language === 'en' ? 'Folders' : 'Ordner',
    view: language === 'en' ? 'View' : 'Ansicht',
    newEmail: language === 'en' ? 'New E-Mail' : 'Neue E-Mail',
    newAppointment: language === 'en' ? 'New appointment' : 'Termin anlegen',
    newContact: language === 'en' ? 'New contact' : 'Neuer Kontakt',
    newGroup: language === 'en' ? 'New' : 'Neu',
    pin: language === 'en' ? 'Pin' : 'Anpinnen',
    readUnread: language === 'en' ? 'Read/Unread' : 'Gelesen/Ungelesen',
    favorite: language === 'en' ? 'Favorite' : 'Favorit',
    delete: language === 'en' ? 'Delete' : 'Löschen',
    blockSender: language === 'en' ? 'Block sender' : 'Absender sperren',
    message: language === 'en' ? 'Message' : 'Nachricht',
    archive: language === 'en' ? 'Archive' : 'Archivieren',
    report: language === 'en' ? 'Report' : 'Melden',
    cleanup: language === 'en' ? 'Clean up' : 'Aufräumen',
    reply: language === 'en' ? 'Reply' : 'Antworten',
    replyAll: language === 'en' ? 'Reply all' : 'Allen antworten',
    forward: language === 'en' ? 'Forward' : 'Weiterleiten',
    replies: language === 'en' ? 'Replies' : 'Antworten',
    quickSteps: language === 'en' ? 'QuickSteps' : 'QuickSteps',
    categories: language === 'en' ? 'Categories' : 'Kategorien',
    followUp: language === 'en' ? 'Follow up' : 'Verfolgung',
    tags: language === 'en' ? 'Tags' : 'Tags',
    search: language === 'en' ? 'Search' : 'Suchen',
    addressBook: language === 'en' ? 'Address book' : 'Adressbuch',
    manage: language === 'en' ? 'Manage...' : 'Verwalten...'
  };
  const quickIconButtonClass = "group relative p-2 rounded-lg text-[#4f4f4f] transition-all duration-150 ease-out cursor-pointer hover:-translate-y-0.5 hover:bg-white hover:text-[#0078d4] hover:shadow-sm active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4]/30";
  const quickIconClass = "w-3.5 h-3.5 transition-transform duration-150 ease-out group-hover:scale-110 group-hover:-rotate-6";

  React.useEffect(() => {
    if (showCategoryDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left
      });
    }
  }, [showCategoryDropdown]);
  
  return (
    <div id="outlook-ribbon" className="w-full min-w-0 max-w-full overflow-hidden bg-slate-50 text-slate-800 flex flex-col select-none border-b border-slate-205 shrink-0 font-sans">
      
      {/* 1. Quick Access Toolbar & App Bar Title */}
      <div data-window-drag-region className="h-[48px] min-h-[48px] bg-slate-55 flex items-center justify-between pl-4 pr-44 border-b border-slate-200 text-xs shadow-xs">
        <div data-window-no-drag className="flex items-center space-x-3.5">
          {/* Small Icon Brand with rounded-xl corners (Enlarged) */}
          <div className="flex items-center space-x-2.5 cursor-pointer hover:opacity-90 transition-opacity">
            <AppLogo size={36} className="rounded-xl shadow-md shrink-0" />
            <span className="font-extrabold text-[#0078d4] tracking-widest text-[14px] uppercase select-none">Unique Mail</span>
          </div>
          <span className="text-slate-300 font-light">|</span>
          {/* Quick Icons */}
          <button 
            onClick={onTriggerSync} 
            className={quickIconButtonClass} 
            title="Senden/Empfangen für alle Ordner ausführen"
          >
            <RefreshCw className={`${quickIconClass} ${isSyncing ? 'animate-spin text-[#0078d4]' : ''}`} />
          </button>
          <button 
            onClick={onNewEmail} 
            className={quickIconButtonClass} 
            title="Neue E-Mail verfassen"
          >
            <Mail className={quickIconClass} />
          </button>
          <button 
            onClick={onOpenOptions}
            className={quickIconButtonClass}
            title="Konteneinstellungen öffnen"
          >
            <Settings className={quickIconClass} />
          </button>
          
          <button 
            onClick={onToggleDarkMode}
            className={`${quickIconButtonClass} flex items-center justify-center`}
            title={isDarkMode ? "Lichtmodus einschalten" : "Dunkelmodus einschalten"}
          >
            {isDarkMode ? (
              <Sun className={`${quickIconClass} text-amber-500 animate-pulse`} />
            ) : (
              <Moon className={`${quickIconClass} text-slate-600`} />
            )}
          </button>
        </div>
        
        {/* Current Active Window Caption */}
        <div className="font-bold text-slate-550 text-[11.5px] absolute left-1/2 transform -translate-x-1/2 hidden xl:block tracking-wide uppercase">
          {currentPage === 'mail' && `Posteingang`}
          {currentPage === 'calendar' && `Kalender`}
          {currentPage === 'contacts' && `Kontakte`}
          {currentPage === 'crm' && `CRM`}
          {currentPage === 'tasks' && `Aufgabenliste`}
          {currentPage === 'notes' && `Notizen`}
          {currentPage === 'dev' && `Entwicklermodul`}
        </div>

        <div data-window-no-drag className="w-8" />
      </div>

      {/* 2. Ribbon Tabs Layout */}
      <div className="flex bg-slate-50 h-8 min-h-8 items-center justify-between border-b border-slate-200 px-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full items-center space-x-0.5">
          <button 
            onClick={() => { setCurrentPage('mail'); setActiveTab('start'); }}
            className={`px-4 text-[11px] uppercase tracking-wide font-extrabold cursor-pointer transition-all flex items-center h-full rounded-t-lg ${
              currentPage === 'mail' && activeTab === 'start'
                ? 'bg-white text-slate-900 border-t-2 border-[#0078d4] shadow-xs font-black'
                : 'hover:bg-slate-200/50 text-slate-500 hover:text-slate-900'
            }`}
          >
            Start
          </button>
          
          <button 
            onClick={() => { setCurrentPage('mail'); setActiveTab('sync'); }}
            className={`px-4 text-[11px] uppercase tracking-wide font-extrabold cursor-pointer transition-all flex items-center h-full rounded-t-lg ${
              activeTab === 'sync'
                ? 'bg-white text-slate-900 border-t-2 border-[#0078d4] shadow-xs font-black'
                : 'hover:bg-slate-200/50 text-slate-500 hover:text-slate-900'
            }`}
          >
            Senden / Empfangen
          </button>
          
          <button 
            onClick={() => { setCurrentPage('mail'); setActiveTab('folder'); }}
            className={`px-4 text-[11px] uppercase tracking-wide font-extrabold cursor-pointer transition-all flex items-center h-full rounded-t-lg ${
              activeTab === 'folder'
                ? 'bg-white text-slate-900 border-t-2 border-[#0078d4] shadow-xs font-black'
                : 'hover:bg-slate-200/50 text-slate-500 hover:text-slate-900'
            }`}
          >
            Ordner
          </button>
          
          <button 
            onClick={() => { setCurrentPage('mail'); setActiveTab('view'); }}
            className={`px-4 text-[11px] uppercase tracking-wide font-extrabold cursor-pointer transition-all flex items-center h-full rounded-t-lg ${
              activeTab === 'view'
                ? 'bg-white text-slate-900 border-t-2 border-[#0078d4] shadow-xs font-black'
                : 'hover:bg-slate-200/50 text-slate-500 hover:text-slate-900'
            }`}
          >
            Ansicht
          </button>
        </div>
      </div>

      {/* 3. Ribbon Controls Panel */}
      <div className="h-24 min-h-24 min-w-0 max-w-full bg-white border-b border-slate-200 flex items-center justify-start gap-0 px-4 overflow-x-auto overflow-y-hidden select-none shadow-xs">
        
        {/* --- DYNAMIC DEV TAB CONTROLS --- */}
        {currentPage === 'dev' && (
          <div className="flex h-full items-stretch py-1.5 shrink-0">
            {/* Dev Center Navigation */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setActiveDevSection('architecture')}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl hover:bg-slate-100 transition-all w-20 h-14 cursor-pointer ${activeDevSection === 'architecture' ? 'bg-[#c7e0f4]/55 text-[#0f5387] font-bold border border-[#c7e0f4]' : ''}`}
                >
                  <Layers className="w-4 h-4 mb-0.5 text-blue-500" />
                  <span className="text-[10px] text-center font-bold">Architektur</span>
                </button>
                <button 
                  onClick={() => setActiveDevSection('roadmap')}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl hover:bg-slate-100 transition-all w-20 h-14 cursor-pointer ${activeDevSection === 'roadmap' ? 'bg-[#c7e0f4]/55 text-[#0f5387] font-bold border border-[#c7e0f4]' : ''}`}
                >
                  <Milestone className="w-4 h-4 mb-0.5 text-orange-500" />
                  <span className="text-[10px] text-center font-bold">Roadmap</span>
                </button>
                <button 
                  onClick={() => setActiveDevSection('code')}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl hover:bg-slate-100 transition-all w-20 h-14 cursor-pointer ${activeDevSection === 'code' ? 'bg-[#c7e0f4]/55 text-[#0f5387] font-bold border border-[#c7e0f4]' : ''}`}
                >
                  <Code className="w-4 h-4 mb-0.5 text-purple-500" />
                  <span className="text-[10px] text-center font-bold">Quellcode</span>
                </button>
                <button 
                  onClick={() => setActiveDevSection('discovery')}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl hover:bg-sky-100/50 transition-all w-24 h-14 border cursor-pointer ${activeDevSection === 'discovery' ? 'bg-sky-100 border-sky-300 text-sky-950 font-black' : 'border-sky-100 bg-sky-50/55 text-sky-850'}`}
                >
                  <Search className="w-4 h-4 mb-0.5 text-sky-500 animate-pulse" />
                  <span className="text-[10px] text-center font-extrabold">Discovery Sandbox</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest block">Projekt-Navigator</div>
            </div>
          </div>
        )}

        {/* --- START TAB CONTROLS --- */}
        {currentPage !== 'dev' && activeTab === 'start' && (
          <div className="flex h-full items-stretch py-1.5 shrink-0">
            {/* Group: Neu with rounded-xl buttons */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex items-center space-x-2.5">
                <button 
                  onClick={onNewEmail}
                  className="flex flex-col items-center justify-center p-1 hover:bg-slate-150 rounded-xl text-left transition-all h-14 w-18 cursor-pointer active:scale-95 border border-transparent hover:border-slate-200 hover:shadow-xs"
                  title="Neue E-Mail verfassen"
                >
                  <Plus className="w-5.5 h-5.5 text-[#0078d4] self-center mb-0.5" />
                  <span className="text-[11px] leading-none text-center text-slate-900 font-extrabold">{ribbonText.newEmail}</span>
                </button>
                <div className="flex flex-col space-y-1">
                  <button 
                    onClick={() => { setCurrentPage('calendar'); }}
                    className="flex items-center hover:bg-slate-100 px-2 py-1 rounded-lg text-left text-[11px] text-slate-700 font-semibold cursor-pointer border border-transparent hover:border-slate-100"
                    title="Neuen Kalendereintrag hinzufügen"
                  >
                    <span className="w-1.5 h-1.5 bg-[#107c41] rounded-full mr-1.5"></span>
                    Termin anlegen
                  </button>
                  <button 
                    onClick={() => { setCurrentPage('crm'); }}
                    className="flex items-center hover:bg-slate-100 px-2 py-1 rounded-lg text-left text-[11px] text-slate-700 font-semibold cursor-pointer border border-transparent hover:border-slate-100"
                    title="Neuen Kontakt speichern"
                  >
                    <span className="w-1.5 h-1.5 bg-[#0078d4] rounded-full mr-1.5"></span>
                    Neuer Kontakt
                  </button>
                </div>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">{ribbonText.newGroup}</div>
            </div>

            {/* Group: Nachricht */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex items-center justify-between gap-3 min-w-[250px]">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={onToggleSelectedPin}
                    disabled={!selectedEmailId || currentPage !== 'mail'}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-16 h-14 border border-transparent ${
                      selectedEmailId && currentPage === 'mail'
                        ? 'hover:bg-slate-100 text-amber-800 hover:border-amber-100 hover:shadow-xs cursor-pointer active:scale-95'
                        : 'opacity-35 text-gray-400 cursor-not-allowed'
                    }`}
                    title={selectedEmailIsPinned ? 'Anpinnen aufheben' : 'Nachricht anpinnen'}
                  >
                    <Pin className={`w-4.5 h-4.5 mb-0.5 ${selectedEmailIsPinned ? 'text-amber-600 fill-amber-500 rotate-45' : 'text-amber-600'}`} />
                    <span className="text-[10px] text-center font-bold">{ribbonText.pin}</span>
                  </button>
                  <button
                    onClick={onToggleSelectedReadUnread}
                    disabled={!selectedEmailId || currentPage !== 'mail'}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-20 h-14 border border-transparent ${
                      selectedEmailId && currentPage === 'mail'
                        ? 'hover:bg-slate-100 text-blue-900 hover:border-blue-100 hover:shadow-xs cursor-pointer active:scale-95'
                        : 'opacity-35 text-gray-400 cursor-not-allowed'
                    }`}
                    title={selectedEmailIsRead ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                  >
                    {selectedEmailIsRead ? <MailOpen className="w-4.5 h-4.5 mb-0.5 text-[#0078d4]" /> : <Mail className="w-4.5 h-4.5 mb-0.5 text-[#0078d4]" />}
                    <span className="text-[10px] text-center font-bold leading-3">{ribbonText.readUnread}</span>
                  </button>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={onToggleSelectedFavorite}
                    disabled={!selectedEmailId || currentPage !== 'mail'}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-16 h-14 border border-transparent ${
                      selectedEmailId && currentPage === 'mail'
                        ? 'hover:bg-slate-100 text-yellow-800 hover:border-yellow-100 hover:shadow-xs cursor-pointer active:scale-95'
                        : 'opacity-35 text-gray-400 cursor-not-allowed'
                    }`}
                    title={selectedEmailIsFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                  >
                    <Star className={`w-4.5 h-4.5 mb-0.5 ${selectedEmailIsFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-yellow-500'}`} />
                    <span className="text-[10px] text-center font-bold">{ribbonText.favorite}</span>
                  </button>
                  <button
                    onClick={onDeleteMail}
                    disabled={!selectedEmailId || currentPage !== 'mail'}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-16 h-14 border border-transparent ${
                      selectedEmailId && currentPage === 'mail'
                        ? 'hover:bg-red-50 text-red-650 hover:border-red-100 hover:shadow-xs cursor-pointer active:scale-95'
                        : 'opacity-35 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Element löschen"
                  >
                    <Trash2 className="w-4.5 h-4.5 mb-0.5" />
                    <span className="text-[10px] text-center font-bold">{ribbonText.delete}</span>
                  </button>
                </div>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">{ribbonText.message}</div>
            </div>

            {/* Group: Aufräumen */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex items-center space-x-1">
                <button
                  onClick={onBlockSelectedSender}
                  disabled={!selectedEmailId || currentPage !== 'mail'}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-20 h-14 border border-transparent ${
                    selectedEmailId && currentPage === 'mail'
                      ? 'hover:bg-red-50 text-red-800 hover:border-red-100 hover:shadow-xs cursor-pointer active:scale-95'
                      : 'opacity-35 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Absender sperren und Nachrichten nach Spam verschieben"
                >
                  <ShieldAlert className="w-4.5 h-4.5 mb-0.5 text-red-600" />
                  <span className="text-[10px] text-center font-bold leading-3">{ribbonText.blockSender}</span>
                </button>
                <button 
                  onClick={onArchiveMail}
                  disabled={!selectedEmailId || currentPage !== 'mail'}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-16 h-14 border border-transparent ${
                    selectedEmailId && currentPage === 'mail' 
                      ? 'hover:bg-slate-100 text-teal-800 hover:border-teal-100 hover:shadow-xs cursor-pointer active:scale-95' 
                      : 'opacity-35 text-gray-400 cursor-not-allowed'
                  }`}
                  title="E-Mail verschieben ins Archiv"
                >
                  <Archive className="w-4.5 h-4.5 mb-0.5 text-teal-600" />
                  <span className="text-[10px] text-center font-bold">{ribbonText.archive}</span>
                </button>
                <button 
                  onClick={onReportPhishing}
                  disabled={!selectedEmailId || currentPage !== 'mail'}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-16 h-14 border border-transparent ${
                    selectedEmailId && currentPage === 'mail' 
                      ? 'hover:bg-slate-100 text-amber-800 hover:border-amber-100 hover:shadow-xs cursor-pointer active:scale-95' 
                      : 'opacity-35 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Nachricht melden"
                >
                  <ShieldAlert className="w-4.5 h-4.5 mb-0.5 text-amber-600" />
                  <span className="text-[10px] text-center font-bold">{ribbonText.report}</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">{ribbonText.cleanup}</div>
            </div>

            {/* Group: Antworten */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex items-center space-x-1">
                <button 
                  onClick={onReply}
                  disabled={!selectedEmailId || currentPage !== 'mail'}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-16 h-14 border border-transparent ${
                    selectedEmailId && currentPage === 'mail' 
                      ? 'hover:bg-slate-100 text-purple-900 hover:border-purple-100 hover:shadow-xs cursor-pointer active:scale-95' 
                      : 'opacity-35 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Direkt antworten"
                >
                  <Reply className="w-4.5 h-4.5 mb-0.5 text-purple-600" />
                  <span className="text-[10px] text-center font-bold">{ribbonText.reply}</span>
                </button>
                <button 
                  onClick={onReplyAll}
                  disabled={!selectedEmailId || currentPage !== 'mail'}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-18 h-14 border border-transparent ${
                    selectedEmailId && currentPage === 'mail' 
                      ? 'hover:bg-slate-100 text-purple-950 hover:border-purple-200 hover:shadow-xs cursor-pointer active:scale-95' 
                      : 'opacity-35 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Allen antworten"
                >
                  <ReplyAll className="w-4.5 h-4.5 mb-0.5 text-purple-700" />
                  <span className="text-[10px] text-center font-bold leading-3">{ribbonText.replyAll}</span>
                </button>
                <button 
                  onClick={onForward}
                  disabled={!selectedEmailId || currentPage !== 'mail'}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-18 h-14 border border-transparent ${
                    selectedEmailId && currentPage === 'mail' 
                      ? 'hover:bg-slate-100 text-blue-900 hover:border-blue-100 hover:shadow-xs cursor-pointer active:scale-95' 
                      : 'opacity-35 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Nachricht weiterleiten"
                >
                  <Forward className="w-4.5 h-4.5 mb-0.5 text-blue-600" />
                  <span className="text-[10px] text-center font-bold leading-3">{ribbonText.forward}</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">{ribbonText.reply}</div>
            </div>

            {/* Group: QuickSteps (User Customizable) */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100 hidden md:flex min-w-[150px] max-w-[240px]">
              <div className="flex-1 flex flex-col justify-center w-full">
                {quickSteps && quickSteps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[9px] w-full">
                    {quickSteps.slice(0, 4).map((qs) => (
                      <button 
                        key={qs.id}
                        onClick={() => onApplyQuickStep?.(qs)}
                        title={`QuickStep '${qs.name}' anwenden`}
                        className="quickstep-btn border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center px-1 py-0.5 cursor-pointer text-left overflow-hidden select-none active:scale-97 hover:shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 mr-1" style={{ backgroundColor: qs.color }} />
                        <span className="truncate text-[9.5px] font-bold text-slate-700 dark:text-slate-300">{qs.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[9px] text-slate-400 italic text-center font-bold leading-tight py-1 select-none">
                    Keine QuickSteps.
                  </div>
                )}
                
                <button
                  onClick={onManageQuickSteps}
                  className="mt-1 flex items-center justify-center space-x-1 py-0.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md border border-slate-205 dark:border-slate-800 text-[9px] font-bold text-[#0078d4] dark:text-[#3ca5fc] cursor-pointer transition-colors active:scale-97 w-full shadow-xs"
                  title="Eigene QuickSteps erstellen und verwalten"
                >
                  <Zap className="w-2.5 h-2.5" />
                  <span>{ribbonText.manage}</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">{ribbonText.quickSteps}</div>
            </div>

            {/* Group: Tags / Kategorisieren */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-[#eae8e6]">
              <div className="flex items-center space-x-1.5">
                <div>
                  <button 
                    ref={buttonRef}
                    id="btn-ribbon-categories-dropdown-trigger"
                    disabled={!selectedEmailId || currentPage !== 'mail'}
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 w-16 h-14 border border-transparent ${
                      !selectedEmailId || currentPage !== 'mail' ? 'opacity-35 cursor-not-allowed' : 'hover:border-slate-200 hover:shadow-xs active:scale-97 cursor-pointer'
                    }`}
                    title="Kategorie zuweisen oder löschen"
                  >
                    <Tag className="w-4.5 h-4.5 mb-0.5 text-amber-500" />
                    <span className="text-[10px] text-center font-bold">{ribbonText.categories}</span>
                  </button>

                  {/* High Quality Category Dropdown Menu */}
                  {showCategoryDropdown && (
                    <div 
                      id="ribbon-categories-dropdown-menu"
                      style={{ 
                        position: 'fixed', 
                        top: `${dropdownPosition.top + 4}px`, 
                        left: `${dropdownPosition.left}px`,
                        zIndex: 99999
                      }}
                      className="w-64 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl shadow-2xl py-2 animate-fade-in text-slate-705 dark:text-slate-205"
                    >
                      <div className="px-3.5 py-1 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                        Kategorie zuweisen
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto my-1.5 space-y-0.5">
                        {categoriesList?.map((cat) => (
                          <div 
                            key={cat.name} 
                            className="flex items-center justify-between px-3.5 py-1.8 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                            onClick={() => {
                              onCategorySelect?.(cat.name);
                              setShowCategoryDropdown(false);
                            }}
                          >
                            <div className="flex items-center space-x-2.5 truncate">
                              <span 
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" 
                                style={{ backgroundColor: cat.color }} 
                              />
                              <span className="font-extrabold text-xs truncate text-slate-800 dark:text-slate-100">{cat.name}</span>
                            </div>
                            
                            <button
                              title={`Kategorie "${cat.name}" global löschen`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDeleteCategoryGlobal) {
                                  onDeleteCategoryGlobal(cat.name);
                                }
                              }}
                              className="p-1 text-slate-450 hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                      <button
                        onClick={() => {
                          onCategorySelect?.("");
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold transition-colors cursor-pointer flex items-center space-x-2"
                      >
                        <span>X</span>
                        <span>Kategorie von E-Mail entfernen</span>
                      </button>

                      <button
                        onClick={() => {
                          onManageCategories?.();
                          setShowCategoryDropdown(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 font-bold transition-colors cursor-pointer flex items-center space-x-2"
                      >
                        <span>Einstellungen</span>
                        <span>Register verwalten...</span>
                      </button>
                    </div>
                  )}
                </div>
                
                <button 
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-16 h-14 border border-transparent ${
                    selectedEmailId && currentPage === 'mail' 
                      ? 'hover:bg-slate-100 text-red-800 hover:border-red-100 hover:shadow-xs cursor-pointer active:scale-95' 
                      : 'opacity-35 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={onToggleFlag}
                  disabled={!selectedEmailId || currentPage !== 'mail'}
                  title="Zur Nachverfolgung markieren (Flag)"
                >
                  <Flag className="w-4.5 h-4.5 mb-0.5 text-red-500" />
                  <span className="text-[10px] text-center font-bold leading-3">{ribbonText.followUp}</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">{ribbonText.tags}</div>
            </div>

            {/* Group: Suchen & Adressbuch */}
            <div className="flex flex-col items-center justify-between">
              <div className="flex items-center space-x-2 h-[34px]">
                <button 
                  onClick={() => { setCurrentPage('crm'); }}
                  className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg h-7 px-2.5 font-bold text-[11px] text-slate-700 transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="Adressbuch öffnen"
                >
                  <Users className="w-3.5 h-3.5 text-[#0078d4]" />
                  <span>{ribbonText.addressBook}</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">{ribbonText.search}</div>
            </div>
          </div>
        )}

        {/* --- SEND / RECEIVE TAB CONTROLS --- */}
        {currentPage !== 'dev' && activeTab === 'sync' && (
          <div className="flex h-full items-stretch py-1.5 shrink-0">
            {/* Senden & Empfangen */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex space-x-2.5">
                <button 
                  onClick={onTriggerSync}
                  className="flex flex-col items-center justify-center p-1 hover:bg-slate-100 rounded-xl transition-all w-24 h-14 cursor-pointer active:scale-95 border border-transparent hover:border-slate-250 hover:shadow-xs"
                  title="Synchronisieren mit Exchange Service"
                >
                  <RefreshCw className={`w-5 h-5 mb-1 text-[#0078d4] ${isSyncing ? 'animate-spin' : 'hover:rotate-180 transition-all duration-500'}`} />
                  <span className="text-[10px] text-center font-bold text-slate-900 leading-none">Ordner synchronisieren</span>
                </button>
                <button 
                  id="btn-test-verbindung"
                  onClick={() => {
                    const domain = userEmail.split('@')[1] || 'unique-mail.de';
                    alert(`[WPF Core Sync]\nIMAP: imap.${domain} Port 993 (SSL)\nSMTP: smtp.${domain} Port 465 (TLS/SSL)\nStatus: Bereit. Synchronisations-Queue läuft.`);
                  }}
                  className="flex flex-col items-center justify-center p-1 rounded-xl hover:bg-slate-100 transition-all w-24 h-14 border border-slate-205 bg-slate-50 text-slate-800 cursor-pointer active:scale-95 shadow-xs"
                  title="Verbindung prüfen"
                >
                  <Globe className="w-5 h-5 mb-1 text-slate-600" />
                  <span className="text-[10px] text-center font-bold leading-none">Verbindung testen</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">Senden und Empfangen</div>
            </div>

            {/* Offline-Modus key toggle */}
            <div className="flex flex-col items-center justify-between">
              <div className="flex items-center">
                <button 
                  onClick={toggleOffline}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-22 h-14 border ${
                    isOffline 
                      ? 'bg-red-50 border-red-200 text-red-900 font-extrabold shadow-sm active:scale-95' 
                      : 'hover:bg-slate-105 border-transparent text-slate-700 hover:border-slate-200 hover:shadow-xs'
                  }`}
                  title="Offline Arbeit"
                >
                  {isOffline ? <WifiOff className="w-4.5 h-4.5 mb-1 text-red-600 animate-pulse" /> : <Wifi className="w-4.5 h-4.5 mb-1 text-[#0078d4]" />}
                  <span className="text-[10px] text-center font-bold leading-none">Offline arbeiten</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">Schnittstellenstatus</div>
            </div>
          </div>
        )}

        {/* --- FOLDER TAB CONTROLS --- */}
        {currentPage !== 'dev' && activeTab === 'folder' && (
          <div className="flex h-full items-stretch py-1.5 shrink-0">
            {/* Neu group */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex items-center space-x-2">
                <button 
                  className="flex flex-col items-center justify-center p-1 rounded-xl hover:bg-slate-100 text-slate-700 w-20 h-14 border border-transparent hover:border-slate-200 hover:shadow-xs cursor-pointer active:scale-95"
                  onClick={onAddFolder}
                >
                  <FolderPlus className="w-5 h-5 mb-1 text-blue-600" />
                  <span className="text-[10px] text-center font-bold leading-none">Neuer Ordner</span>
                </button>
                <button className="flex flex-col items-center justify-center p-1 rounded-xl text-slate-700 w-20 h-14 opacity-35 cursor-not-allowed">
                  <FolderOpen className="w-5 h-5 mb-1 text-slate-400" />
                  <span className="text-[10px] text-center font-bold leading-none">Ordner verschieben</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">Aktionen</div>
            </div>
            
            {/* Aufräumen group */}
            <div className="flex flex-col items-center justify-between">
              <div className="flex items-center h-full">
                <button 
                  className="flex items-center h-8 px-3.5 hover:bg-slate-150 rounded-xl text-[11px] space-x-1.5 text-slate-700 font-bold cursor-pointer border border-slate-205 transition-all shadow-xs active:scale-95"
                  onClick={onMarkAllAsRead}
                >
                  <MailOpen className="w-4 h-4 text-[#0078d4]" />
                  <span>Alles als gelesen markieren</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">{ribbonText.cleanup}</div>
            </div>
          </div>
        )}

        {/* --- VIEW TAB CONTROLS --- */}
        {currentPage !== 'dev' && activeTab === 'view' && (
          <div className="flex h-full items-stretch py-1.5 shrink-0">
            {/* Group: Layout / Density */}
            <div className="flex flex-col items-center justify-between pr-4 mr-4 border-r border-slate-100">
              <div className="flex items-center space-x-4">
                {/* Compact Density Toggle Button */}
                <button 
                  onClick={() => setIsDense(!isDense)}
                  className={`flex flex-col items-center justify-center p-1 rounded-xl transition-all w-24 h-14 border ${
                    isDense 
                      ? 'bg-[#c7e0f4]/60 border-[#0078d4] text-[#004e8c] font-extrabold shadow-sm active:scale-95' 
                      : 'hover:bg-slate-100 border-transparent text-slate-650 hover:border-slate-200 hover:shadow-xs'
                  }`}
                  title="Layout Abstände anpassen"
                >
                  <Plus className="w-4 h-4 mb-1 text-[#0078d4]" />
                  <span className="text-[10px] text-center font-bold">Engere Abstände</span>
                </button>
                <div className="flex flex-col justify-center text-[11px] text-slate-500 space-y-1 font-semibold">
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-1.5 ${isDense ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                    <span>Modus: <strong>{isDense ? 'Kompakt' : 'Standard'}</strong></span>
                  </div>
                  <div>Inhaltshöhe regeln</div>
                </div>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">Layout-Einstellungen</div>
            </div>

            {/* Group: Aktuelle Ansicht */}
            <div className="flex flex-col items-center justify-between pl-4 ml-4 border-l border-slate-100">
              <div className="flex items-center h-full">
                <button 
                  className="flex items-center space-x-1.5 hover:bg-slate-100 px-3 py-1.8 border border-slate-250 rounded-xl text-[11px] text-slate-700 font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  onClick={() => setIsDense(false)}
                >
                  <Undo2 className="w-3.5 h-3.5 text-[#0078d4]" />
                  <span>Ansicht zurücksetzen</span>
                </button>
              </div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest">Ausrichtung</div>
            </div>
          </div>
        )}

        {/* Clean right margin */}
        <div className="w-4"></div>

      </div>
    </div>
  );
}



