/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Paperclip, Flag, Mail, MailOpen, AlertCircle, Search, UserCheck, 
  Clock, CheckSquare, Square, CalendarDays, SignalHigh, Check, FileCode,
  Pin, Star, Trash2, Plus, X
} from 'lucide-react';
import { Email, Contact, Task, CalendarItem, Category } from '../types';

interface ItemListProps {
  currentPage: 'mail' | 'calendar' | 'contacts' | 'crm' | 'tasks' | 'notes' | 'dev';
  emails: Email[];
  selectedEmailId: string | null;
  setSelectedEmailId: (id: string | null) => void;
  contacts: Contact[];
  selectedContactId: string | null;
  setSelectedContactId: (id: string | null) => void;
  tasks: Task[];
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  calendarItems: CalendarItem[];
  selectedCalendarId: string | null;
  setSelectedCalendarId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterUnreadOnly: boolean;
  setFilterUnreadOnly: (unreadOnly: boolean) => void;
  isDense?: boolean;
  language?: 'de' | 'en';
  dateDisplayFormat?: string;
  
  // Account/Folder integration
  activeAccountEmail: string;
  selectedFolder: string;

  // Interaction integration
  onReplyMail?: () => void;
  onReplyAll?: () => void;
  onForwardMail?: () => void;
  onDeleteMail?: () => void;
  onArchiveMail?: () => void;
  onReportPhishing?: () => void;
  onToggleFlag?: () => void;
  onToggleFlagCompleted?: (id: string) => void;
  onToggleReadUnread?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDeleteEmails?: (ids: string[]) => void;
  onSetEmailsReadState?: (ids: string[], isRead: boolean) => void;
  categoriesList?: Category[];
  onSetReminder?: (emailId: string) => void;
  contactSortLabels?: string[];
  onContactSortLabelsChange?: (labels: string[]) => void;
  onNewContact?: () => void;
}

export default function ItemList({
  currentPage,
  emails,
  selectedEmailId,
  setSelectedEmailId,
  contacts,
  selectedContactId,
  setSelectedContactId,
  tasks,
  selectedTaskId,
  setSelectedTaskId,
  calendarItems,
  selectedCalendarId,
  setSelectedCalendarId,
  searchQuery,
  setSearchQuery,
  filterUnreadOnly,
  setFilterUnreadOnly,
  isDense = false,
  language = 'de',
  dateDisplayFormat = 'dd.MM.yyyy',
  activeAccountEmail,
  selectedFolder,

  onReplyMail,
  onReplyAll,
  onForwardMail,
  onDeleteMail,
  onArchiveMail,
  onReportPhishing,
  onToggleFlag,
  onToggleFlagCompleted,
  onToggleReadUnread,
  onTogglePin,
  onToggleFavorite,
  onDeleteEmails,
  onSetEmailsReadState,
  categoriesList,
  onSetReminder,
  contactSortLabels = ['Newsletter', 'Privat', 'Beruflich'],
  onContactSortLabelsChange,
  onNewContact
}: ItemListProps) {
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; emailId: string } | null>(null);
  const [newContactGroupLabel, setNewContactGroupLabel] = React.useState('');
  const [activeFilterTab, setActiveFilterTab] = React.useState<'all' | 'unread' | 'favorites'>('all');
  const [selectedEmailIds, setSelectedEmailIds] = React.useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = React.useState<string | null>(null);
  const [mailListMetrics, setMailListMetrics] = React.useState({ scrollTop: 0, viewportHeight: 600 });
  const mailScrollRef = React.useRef<HTMLDivElement>(null);
  const listKeyboardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (filterUnreadOnly) {
      setActiveFilterTab('unread');
    } else if (activeFilterTab === 'unread') {
      setActiveFilterTab('all');
    }
  }, [filterUnreadOnly]);

  React.useEffect(() => {
    setMailListMetrics(prev => ({ ...prev, scrollTop: 0 }));
    if (mailScrollRef.current) {
      mailScrollRef.current.scrollTop = 0;
    }
  }, [currentPage, activeAccountEmail, selectedFolder, searchQuery, activeFilterTab, filterUnreadOnly]);

  React.useEffect(() => {
    const target = mailScrollRef.current;
    if (!target || currentPage !== 'mail') return;
    const updateMetrics = () => {
      setMailListMetrics({ scrollTop: target.scrollTop, viewportHeight: target.clientHeight || 600 });
    };
    updateMetrics();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMetrics) : null;
    resizeObserver?.observe(target);
    window.addEventListener('resize', updateMetrics);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, [currentPage]);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (currentPage !== 'mail') return;
    const target = event.currentTarget;
    setMailListMetrics({ scrollTop: target.scrollTop, viewportHeight: target.clientHeight || 600 });
  };

  React.useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleRightClick = (e: React.MouseEvent, emailId: string) => {
    e.preventDefault();
    setSelectedEmailId(emailId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      emailId
    });
  };

  React.useEffect(() => {
    if (selectedEmailId) {
      setSelectedEmailIds(prev => prev.includes(selectedEmailId) ? prev : [selectedEmailId]);
      setSelectionAnchorId(prev => prev || selectedEmailId);
    } else {
      setSelectedEmailIds([]);
      setSelectionAnchorId(null);
    }
  }, [selectedEmailId]);
  
  // Format dates for display according to the user setting. Always includes the year.
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const locale = language === 'en' ? 'en-US' : 'de-DE';
    const pad = (value: number) => String(value).padStart(2, '0');
    const replacements: Record<string, string> = {
      yyyy: String(d.getFullYear()),
      yy: String(d.getFullYear()).slice(-2),
      MMMM: new Intl.DateTimeFormat(locale, { month: 'long' }).format(d),
      MMM: new Intl.DateTimeFormat(locale, { month: 'short' }).format(d),
      MM: pad(d.getMonth() + 1),
      dd: pad(d.getDate()),
      HH: pad(d.getHours()),
      mm: pad(d.getMinutes())
    };
    const pattern = dateDisplayFormat && dateDisplayFormat.includes('yyyy') ? dateDisplayFormat : 'dd.MM.yyyy';
    return pattern.replace(/yyyy|MMMM|MMM|yy|MM|dd|HH|mm/g, token => replacements[token] || token);
  };

  const uiText = {
    searchMail: language === 'en' ? 'Search e-mails...' : 'E-Mails suchen...',
    searchCalendar: language === 'en' ? 'Search appointments...' : 'Termine suchen...',
    searchContacts: language === 'en' ? 'Search contacts...' : 'Kontakte suchen...',
    searchTasks: language === 'en' ? 'Search tasks...' : 'Aufgaben suchen...',
    searchGeneric: language === 'en' ? 'Search...' : 'Suchen...',
    all: language === 'en' ? 'All' : 'Alle',
    active: language === 'en' ? 'Active' : 'Aktiv',
    unread: language === 'en' ? 'Unread' : 'Ungelesen',
    favorites: language === 'en' ? 'Favorites' : 'Favoriten'
  };

  // Helper function for Outlook-Classic equivalent multi-field full-text token indexing
  const matchesFullText = (textFields: (string | undefined)[], query: string) => {
    if (!query) return true;
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return tokens.every(token => 
      textFields.some(field => field && field.toLowerCase().includes(token))
    );
  };

  return (
    <div 
      id="item-list-container" 
      className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col h-full font-sans select-none shrink-0 min-w-[320px]"
    >
      {/* 1. Universal Search Box */}
      <div className="h-12 px-3 flex items-center border-b border-slate-200 bg-white">
        <div className="relative w-full">
          <input
            id="outlook-universal-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              currentPage === 'mail' ? uiText.searchMail :
              currentPage === 'calendar' ? uiText.searchCalendar :
              (currentPage === 'contacts' || currentPage === 'crm') ? uiText.searchContacts :
              currentPage === 'tasks' ? uiText.searchTasks : uiText.searchGeneric
            }
            className="w-full text-xs pl-8 pr-7 py-2 border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-[#0078d4] text-slate-800 bg-slate-50/60 placeholder-slate-400 transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 font-mono text-xs scale-90 px-1 bg-slate-200/50 rounded-md transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Tab Controls */}
      <div className="h-10 bg-slate-50 dark:bg-[#0d1321] flex items-center justify-between px-3 border-b border-slate-200 dark:border-slate-800 text-[10.5px] select-none">
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              setActiveFilterTab('all');
              setFilterUnreadOnly(false);
            }}
            className={`cursor-pointer font-bold tracking-wide uppercase text-[10px] transition-all select-none whitespace-nowrap px-2.5 py-1 rounded-md outline-none focus:outline-none ${
              activeFilterTab === 'all'
                ? 'text-[#0078d4] bg-[#0078d4]/10 dark:bg-[#0078d4]/20 font-extrabold shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            {currentPage === 'mail' ? uiText.all : uiText.active}
          </button>
          
          {currentPage === 'mail' && (
            <button
              onClick={() => {
                setActiveFilterTab('unread');
                setFilterUnreadOnly(true);
              }}
              className={`cursor-pointer font-bold tracking-wide uppercase text-[10px] transition-all select-none whitespace-nowrap px-2.5 py-1 rounded-md outline-none focus:outline-none ${
                activeFilterTab === 'unread'
                  ? 'text-[#0078d4] bg-[#0078d4]/10 dark:bg-[#0078d4]/20 font-extrabold shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              {uiText.unread}
            </button>
          )}

          {currentPage === 'mail' && (
            <button
              onClick={() => {
                setActiveFilterTab('favorites');
                setFilterUnreadOnly(false);
              }}
              className={`cursor-pointer font-bold tracking-wide uppercase text-[10px] transition-all flex items-center space-x-1 select-none whitespace-nowrap px-2.5 py-1 rounded-md outline-none focus:outline-none ${
                activeFilterTab === 'favorites'
                  ? 'text-amber-600 bg-amber-500/10 dark:bg-amber-500/20 font-extrabold shadow-sm'
                  : 'text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>⭐ {uiText.favorites}</span>
            </button>
          )}
        </div>
        
        <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-400 text-[8.5px] font-mono tracking-wider font-extrabold shrink-0 uppercase select-none">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          <span>Aktiv</span>
        </div>
      </div>

      {/* 3. Items List Render */}
      <div ref={mailScrollRef} className="flex-1 overflow-y-auto py-2 px-2.5 space-y-1.5 bg-slate-50/50" onScroll={handleListScroll}>
        
        {/* === EMAILS LIST === */}
        {currentPage === 'mail' && (() => {
          // Helper for Outlook Classic attachment full text scanning
          const getAttachmentSearchContent = (email: Email) => {
            if (!email.hasAttachment) return "";
            return "wpf_layout_concept.pdf Dieser Anhang spezifiziert das WPF MVVM Design-System und das SQLite Repository Schema für Unique Mail. .NET 8 MailKit und Entity Framework Core Synchronisations-Engine. Autor: Dr. Andreas Müller. Thread-Sicherheit MailKit-Instanzen";
          };

          const normalizeFolderKey = (value?: string) => (value || 'inbox').trim().replace(/\\/g, '/').toLowerCase();
          const folderMatches = (mailFolderRaw: string | undefined, selectedFolderRaw: string) => {
            const mailFolder = normalizeFolderKey(mailFolderRaw);
            const selected = normalizeFolderKey(selectedFolderRaw);
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

          const filteredEmails = emails
            .filter(e => {
              const mailFolder = normalizeFolderKey(e.imapFolder || e.folder);
              
              // SUPPORT UNIFIED INBOX: Bypasses account specific filters for 'inbox' messages
              if (selectedFolder === 'unified-inbox') {
                return mailFolder === 'inbox';
              }
              
              const emailAccount = (e.accountEmail || activeAccountEmail).toLowerCase();
              const activeAccount = activeAccountEmail.toLowerCase();
              return (!activeAccount || emailAccount === activeAccount) && folderMatches(e.imapFolder || e.folder, selectedFolder);
            })
            // Support 3-state filter selection (All, Unread, Favorites)
            .filter(e => {
              if (activeFilterTab === 'unread') return !e.isRead;
              if (activeFilterTab === 'favorites') return !!e.isFavorite;
              return true;
            })
            // Outlook Classic high fidelity full text lookup including categories and attachments
            .filter(e => 
              matchesFullText([
                e.sender, 
                e.senderEmail, 
                e.subject, 
                e.body, 
                e.preview, 
                e.category, 
                getAttachmentSearchContent(e)
              ], searchQuery)
            );

          if (filteredEmails.length === 0) {
            return (
              <div className="p-8 text-center text-xs text-slate-400 font-medium bg-white rounded-xl border border-slate-200/60 shadow-xs dark:bg-[#141a29] dark:border-slate-800">
                Suchen ergab keine Mails
              </div>
            );
          }

          // Sort: Pinned stay strictly at the top, then chronological date orders
          const sortedEmails = [...filteredEmails].sort((a, b) => {
            const pinA = a.isPinned ? 1 : 0;
            const pinB = b.isPinned ? 1 : 0;
            if (pinA !== pinB) {
              return pinB - pinA;
            }
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });

          const selectByIndex = (index: number, extend: boolean) => {
            const clamped = Math.max(0, Math.min(sortedEmails.length - 1, index));
            const target = sortedEmails[clamped];
            if (!target) return;
            if (extend) {
              const anchorId = selectionAnchorId || selectedEmailId || target.id;
              const anchorIndex = Math.max(0, sortedEmails.findIndex(item => item.id === anchorId));
              const start = Math.min(anchorIndex, clamped);
              const end = Math.max(anchorIndex, clamped);
              setSelectedEmailIds(sortedEmails.slice(start, end + 1).map(item => item.id));
            } else {
              setSelectedEmailIds([target.id]);
              setSelectionAnchorId(target.id);
            }
            setSelectedEmailId(target.id);
          };

          const currentIndex = Math.max(0, sortedEmails.findIndex(item => item.id === selectedEmailId));
          const virtualRowHeight = isDense ? 82 : 88;
          const virtualOverscan = 10;
          const virtualViewportHeight = Math.max(mailListMetrics.viewportHeight || 600, 320);
          const virtualStartIndex = Math.max(0, Math.floor(mailListMetrics.scrollTop / virtualRowHeight) - virtualOverscan);
          const virtualEndIndex = Math.min(
            sortedEmails.length,
            Math.ceil((mailListMetrics.scrollTop + virtualViewportHeight) / virtualRowHeight) + virtualOverscan
          );
          const virtualEmails = sortedEmails.slice(virtualStartIndex, virtualEndIndex);
          const virtualTopSpacer = virtualStartIndex * virtualRowHeight;
          const virtualBottomSpacer = Math.max(0, (sortedEmails.length - virtualEndIndex) * virtualRowHeight);

          return (
            <div
              ref={listKeyboardRef}
              tabIndex={0}
              className="outline-none"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                  e.preventDefault();
                  const ids = sortedEmails.map(item => item.id);
                  setSelectedEmailIds(ids);
                  setSelectionAnchorId(ids[0] || null);
                  if (ids[0]) setSelectedEmailId(ids[0]);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  selectByIndex(currentIndex + 1, e.shiftKey);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  selectByIndex(currentIndex - 1, e.shiftKey);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  selectByIndex(0, e.shiftKey);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  selectByIndex(sortedEmails.length - 1, e.shiftKey);
                } else if (e.key === 'Delete') {
                  e.preventDefault();
                  const ids = selectedEmailIds.length ? selectedEmailIds : selectedEmailId ? [selectedEmailId] : [];
                  if (ids.length && onDeleteEmails) onDeleteEmails(ids);
                } else if (e.key.toLowerCase() === 'u') {
                  e.preventDefault();
                  const ids = selectedEmailIds.length ? selectedEmailIds : selectedEmailId ? [selectedEmailId] : [];
                  if (ids.length && onSetEmailsReadState) onSetEmailsReadState(ids, false);
                } else if (e.key.toLowerCase() === 'r' || e.key === 'Enter') {
                  e.preventDefault();
                  const ids = selectedEmailIds.length ? selectedEmailIds : selectedEmailId ? [selectedEmailId] : [];
                  if (ids.length && onSetEmailsReadState) onSetEmailsReadState(ids, true);
                }
              }}
            >
              {virtualTopSpacer > 0 && <div aria-hidden="true" style={{ height: virtualTopSpacer }} />}
          {virtualEmails.map((email) => {
            const isSelected = selectedEmailId === email.id;
            const isMultiSelected = selectedEmailIds.includes(email.id);
            return (
              <div
                id={`email-item-${email.id}`}
                key={email.id}
                draggable
                onDragStart={(e) => {
                  const ids = selectedEmailIds.includes(email.id) ? selectedEmailIds : [email.id];
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/x-unique-mail-ids', JSON.stringify(ids));
                  e.dataTransfer.setData('text/plain', ids.join(','));
                }}
                onClick={(e) => {
                  listKeyboardRef.current?.focus();
                  const clickedIndex = sortedEmails.findIndex(item => item.id === email.id);
                  if (e.shiftKey) {
                    selectByIndex(clickedIndex, true);
                  } else if (e.ctrlKey) {
                    setSelectedEmailIds(prev => prev.includes(email.id) ? prev.filter(id => id !== email.id) : [...prev, email.id]);
                    setSelectedEmailId(email.id);
                    setSelectionAnchorId(prev => prev || email.id);
                  } else {
                    setSelectedEmailIds([email.id]);
                    setSelectionAnchorId(email.id);
                    setSelectedEmailId(email.id);
                  }
                }}
                onContextMenu={(e) => handleRightClick(e, email.id)}
                className={`group text-left relative cursor-pointer rounded-lg border transition-all duration-150 overflow-hidden min-h-[74px] mb-1.5 ${
                  isDense ? 'px-2.5 py-2 pr-2.5 pb-2' : 'px-3 py-2.5 pr-3 pb-2'
                } ${
                  email.isPinned
                    ? isSelected
                      ? 'bg-amber-500/10 border-amber-500 shadow-sm dark:bg-amber-950/30'
                      : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/50 hover:border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/40 hover:shadow-xs'
                    : isSelected || isMultiSelected
                      ? 'bg-white border-[#0078d4] shadow-sm dark:bg-[#141a29]' 
                      : 'bg-white border-slate-200/80 hover:border-slate-300 dark:bg-[#141a29] dark:border-slate-800 hover:shadow-xs'
                }`}
              >
                {/* Visual indicator for unread Emails */}
                {!email.isRead && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#0078d4] rounded-r-lg"></div>
                )}

                {/* Account Label tag if in Unified inbox */}
                {selectedFolder === 'unified-inbox' && email.accountEmail && (
                  <div className="text-[8.5px] font-extrabold uppercase text-[#0078d4] bg-[#0078d4]/10 px-1.5 py-0.5 rounded-md inline-block mb-1.5 max-w-full truncate">
                    Konto: {email.accountEmail.split('@')[0]}
                  </div>
                )}

                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[11.5px] truncate max-w-[190px] ${!email.isRead ? 'font-extrabold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300 font-medium'}`}>
                    {email.sender}
                  </span>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {email.hasAttachment && (
                      <Paperclip className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300 shrink-0" title="Anhang enthalten" />
                    )}
                    <span className="text-[9px] text-slate-400 font-mono font-semibold text-right min-w-[74px]">
                      {formatDate(email.date)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-xs truncate max-w-[190px] ${!email.isRead ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                    {email.subject}
                  </span>
                  
                  {/* Category badge */}
                  {email.category && (() => {
                    const foundCat = categoriesList?.find(c => c.name.toLowerCase() === email.category?.toLowerCase());
                    const badgeColor = foundCat ? foundCat.color : '#0078d4';
                    return (
                      <span 
                        className="text-[9.5px] px-2 py-0.5 rounded-full border shrink-0 font-extrabold max-w-[100px] truncate"
                        style={{ 
                          backgroundColor: `${badgeColor}12`, 
                          color: badgeColor, 
                          borderColor: `${badgeColor}25` 
                        }}
                      >
                        {email.category}
                      </span>
                    );
                  })()}
                </div>

                <p className="text-[11px] text-slate-450 dark:text-slate-400 line-clamp-1 leading-4 pr-1">
                  {email.preview}
                </p>

                {/* Instant Action Row: left = pin/read, right = favorite/delete */}
                <div className="absolute left-2 right-2 bottom-1.5 flex items-center justify-between rounded-md border border-slate-100/80 bg-white/95 px-1 py-0.5 shadow-sm opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto dark:bg-[#141a29]/95 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5">
                    <button
                      title={email.isPinned ? "Nachricht lösen" : "Nachricht anpinnen"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onTogglePin) onTogglePin(email.id);
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors group cursor-pointer"
                    >
                      <Pin 
                        className={`w-3.5 h-3.5 transition-all ${
                          email.isPinned 
                            ? 'text-amber-600 fill-amber-500 rotate-45 scale-110' 
                            : 'text-slate-350 dark:text-slate-500 group-hover:text-amber-500'
                        }`} 
                      />
                    </button>

                    <button
                      title={email.isRead ? "Als ungelesen markieren" : "Als gelesen markieren"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleReadUnread) onToggleReadUnread(email.id);
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors group cursor-pointer"
                    >
                      {email.isRead ? (
                        <MailOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0078d4]" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-[#0078d4]" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center space-x-1.5 text-slate-400">
                    {email.importance === 'high' && (
                      <AlertCircle className="w-3.5 h-3.5 text-[#a80000]" title="Wichtig" />
                    )}

                    <button
                      title={email.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleFavorite) onToggleFavorite(email.id);
                      }}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors group cursor-pointer"
                    >
                      <Star 
                        className={`w-3.5 h-3.5 transition-all ${
                          email.isFavorite 
                            ? 'text-yellow-500 fill-yellow-400 scale-110' 
                            : 'text-slate-350 dark:text-slate-500 group-hover:text-yellow-500'
                        }`} 
                      />
                    </button>

                    <button
                      title="Mail löschen"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteEmails) onDeleteEmails([email.id]);
                      }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors group cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-350 dark:text-slate-500 group-hover:text-red-600" />
                    </button>

                    {email.isFlagged && (
                      <button
                        title={email.isFlagCompleted ? "Als unvollständig markieren" : "Als erledigt markieren"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleFlagCompleted) onToggleFlagCompleted(email.id);
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors group cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {email.isFlagCompleted ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" title="Nachverfolgung abgeschlossen" />
                        ) : (
                          <Flag className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse hover:scale-110 transition-transform" title="Zur Nachverfolgung markiert (Klick markiert als erledigt)" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
              {virtualBottomSpacer > 0 && <div aria-hidden="true" style={{ height: virtualBottomSpacer }} />}

            </div>
          );
        })()}

        {/* === CALENDAR EVENTS IN LIST FORMAT === */}
        {currentPage === 'calendar' && (() => {
          const filteredCal = calendarItems.filter(item => 
            matchesFullText([item.title, item.description, item.location], searchQuery)
          );

          if (filteredCal.length === 0) {
            return (
              <div className="p-8 text-center text-xs text-slate-400 font-medium bg-white rounded-xl border border-slate-200/60 shadow-xs">
                Keine Termine gefunden
              </div>
            );
          }

          return filteredCal.map((item) => {
            const isSelected = selectedCalendarId === item.id;
            return (
              <div
                id={`calendar-item-${item.id}`}
                key={item.id}
                onClick={() => setSelectedCalendarId(item.id)}
                className={`relative cursor-pointer rounded-xl border transition-all duration-200 ${
                  isDense ? 'p-2.5' : 'p-3.5'
                } ${
                  isSelected 
                    ? 'bg-white border-[#107c41] shadow-sm' 
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Accent calendar left-stripe depending on category */}
                <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#107c41] rounded-r-lg"></div>

                <div className="pl-1.5Packed">
                  <div className="flex justify-between items-start mb-15">
                    <span className="text-xs font-bold text-slate-800 truncate pr-2">
                      {item.title}
                    </span>
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>

                  <div className="text-[10px] text-slate-500 font-medium font-mono mb-2">
                    {new Date(item.start).toLocaleDateString()} | {new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr
                  </div>

                  {item.location && (
                    <p className="text-[10.5px] text-[#0078d4] font-medium truncate">
                      Ort: {item.location}
                    </p>
                  )}
                </div>
              </div>
            );
          });
        })()}

        {/* === CONTACTS / CRM LIST === */}
        {(currentPage === 'contacts' || currentPage === 'crm') && (() => {
          const labels = Array.from(new Set(contactSortLabels.map(label => String(label || '').trim()).filter(Boolean)));
          const activeLabels = labels.length > 0 ? labels : ['Newsletter', 'Privat', 'Beruflich'];
          const findLabel = (needle: string) => activeLabels.find(label => label.toLowerCase() === needle.toLowerCase());
          const privateDomains = ['gmail.com', 'googlemail.com', 'web.de', 'gmx.de', 'gmx.net', 'outlook.com', 'hotmail.com', 'live.de', 'icloud.com', 'me.com', 'yahoo.com', 'freenet.de', 'mail.de', 'inbox.lv'];
          const inferContactGroup = (contact: Contact) => {
            const savedGroup = String((contact as any).group || '').trim();
            const matchedSaved = activeLabels.find(label => label.toLowerCase() === savedGroup.toLowerCase());
            if (matchedSaved) return matchedSaved;

            const haystack = [contact.firstName, contact.lastName, contact.email, contact.company, contact.role, contact.notes].join(' ').toLowerCase();
            const newsletterLabel = findLabel('Newsletter');
            if (newsletterLabel && /(newsletter|no-reply|noreply|marketing|kampagne|mailchimp|notification|benachrichtigung|updates|news|unsubscribe)/.test(haystack)) return newsletterLabel;

            const beruflichLabel = findLabel('Beruflich');
            const domain = (contact.email.split('@')[1] || '').toLowerCase();
            const looksBusiness = !!contact.company && !/verbindung|gesendete verbindung|e-mail verbindung/i.test(contact.company);
            const uncommonDomain = !!domain && !privateDomains.some(privateDomain => domain === privateDomain || domain.endsWith(`.${privateDomain}`));
            if (beruflichLabel && (looksBusiness || uncommonDomain)) return beruflichLabel;

            return findLabel('Privat') || activeLabels[0] || 'Sonstige';
          };

          const filteredContacts = contacts.filter(c => 
            matchesFullText([c.firstName, c.lastName, `${c.firstName} ${c.lastName}`, c.email, c.company, c.notes, (c as any).group], searchQuery)
          );

          const addContactGroupLabel = (event: React.FormEvent) => {
            event.preventDefault();
            const next = newContactGroupLabel.trim();
            if (!next || activeLabels.some(label => label.toLowerCase() === next.toLowerCase())) return;
            onContactSortLabelsChange?.([...activeLabels, next]);
            setNewContactGroupLabel('');
          };

          const removeContactGroupLabel = (labelToRemove: string) => {
            const next = activeLabels.filter(label => label !== labelToRemove);
            onContactSortLabelsChange?.(next.length > 0 ? next : ['Newsletter', 'Privat', 'Beruflich']);
          };

          const renderContact = (contact: Contact) => {
            const isSelected = selectedContactId === contact.id;
            const isSuggested = contact.id.startsWith('suggested-');
            const initials = `${contact.firstName ? contact.firstName[0] || '' : ''}${contact.lastName ? contact.lastName[0] || '' : ''}` || '?';
            return (
              <div
                id={`contact-item-${contact.id}`}
                key={contact.id}
                onClick={() => setSelectedContactId(contact.id)}
                className={`flex items-center space-x-3 cursor-pointer rounded-xl border transition-all duration-200 ${
                  isDense ? 'p-2.5' : 'p-3'
                } ${
                  isSelected 
                    ? isSuggested
                      ? 'bg-purple-50/50 border-purple-500 shadow-sm'
                      : 'bg-white border-[#0078d4] shadow-sm' 
                    : isSuggested
                      ? 'bg-purple-50/10 border-purple-150/80 hover:border-purple-300 hover:shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className={`rounded-full border font-extrabold text-xs flex items-center justify-center shrink-0 ${
                  isSuggested
                    ? 'bg-purple-100 border-purple-250 text-purple-700'
                    : 'bg-[#0078d4]/10 border-[#0078d4]/15 text-[#0078d4]'
                } ${
                  isDense ? 'w-8 h-8' : 'w-10 h-10'
                }`}>
                  {initials}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {contact.lastName}, {contact.firstName}
                    </p>
                    {isSuggested && (
                      <span className="bg-purple-100 text-purple-800 text-[8.5px] px-1 py-0.5 rounded-md font-extrabold uppercase tracking-wide inline-block shrink-0">
                        KI
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate font-mono">
                    {contact.email}
                  </p>
                  {contact.company && (
                    <p className="text-[10.5px] text-sky-800 font-semibold truncate mt-0.5">
                      {isSuggested ? 'KI ' : 'Firma '} {contact.company}
                    </p>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div className="space-y-3">
              <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur border border-slate-200 rounded-xl p-2.5 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{currentPage === 'crm' ? 'CRM Kontakte' : 'Kontaktvorschlaege'}</p>
                    <p className="text-[9.5px] text-slate-400 font-semibold">KI-Vorsortierung: Newsletter, Privat, Beruflich und eigene Gruppen</p>
                  </div>
                  {onNewContact && (
                    <button type="button" onClick={onNewContact} className="h-8 px-2.5 rounded-lg bg-[#0078d4] hover:bg-[#106ebe] text-white text-[10px] font-extrabold flex items-center gap-1.5 shadow-xs active:scale-95">
                      <Plus className="w-3.5 h-3.5" />
                      Kontakt
                    </button>
                  )}
                </div>
                <form onSubmit={addContactGroupLabel} className="flex items-center gap-1.5">
                  <input
                    value={newContactGroupLabel}
                    onChange={(event) => setNewContactGroupLabel(event.target.value)}
                    placeholder="Eigene Sortierung hinzufuegen"
                    className="min-w-0 flex-1 h-7 px-2 text-[10.5px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0078d4]"
                  />
                  <button type="submit" className="h-7 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-600">Hinzufuegen</button>
                </form>
                <div className="flex flex-wrap gap-1.5">
                  {activeLabels.map(label => (
                    <span key={label} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9.5px] font-bold text-slate-600">
                      {label}
                      <button type="button" onClick={() => removeContactGroupLabel(label)} className="text-slate-400 hover:text-red-500" title="Sortierung entfernen">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {activeLabels.map(label => {
                const groupContacts = filteredContacts.filter(contact => inferContactGroup(contact) === label);
                return (
                  <section key={label} className="space-y-2">
                    <div className="flex items-center justify-between h-7 px-2 rounded-lg bg-slate-100 border border-slate-200">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">{label}</span>
                      <span className="text-[10px] font-bold text-slate-400">{groupContacts.length}</span>
                    </div>
                    {groupContacts.length > 0 ? groupContacts.map(renderContact) : (
                      <div className="p-3 text-[10.5px] text-slate-400 font-semibold bg-white border border-dashed border-slate-200 rounded-xl">
                        Keine Kontakte in dieser Sortierung
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          );
        })()}
        {/* === TASKS LIST === */}
        {currentPage === 'tasks' && (() => {
          const filteredTasks = tasks.filter(t => 
            matchesFullText([t.title, t.notes], searchQuery)
          );

          if (filteredTasks.length === 0) {
            return (
              <div className="p-8 text-center text-xs text-slate-400 font-medium bg-white rounded-xl border border-slate-200/60 shadow-xs">
                Keine Aufgaben gefunden
              </div>
            );
          }

          return filteredTasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            return (
              <div
                id={`task-item-${task.id}`}
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`relative cursor-pointer rounded-xl border transition-all duration-200 ${
                  isDense ? 'p-2.5' : 'p-3.5'
                } ${
                  isSelected 
                    ? 'bg-white border-amber-500 shadow-sm' 
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Priority visual border indicator */}
                <div className={`absolute left-0 top-3 bottom-3 w-1 ${
                  task.priority === 'High' ? 'bg-red-500' : 
                  task.priority === 'Normal' ? 'bg-[#0078d4]' : 'bg-slate-400'
                } rounded-r-lg`}></div>

                <div className="pl-1.5">
                  <div className="flex items-start justify-between">
                    <span className={`text-xs pr-2 truncate ${task.isCompleted ? 'line-through text-slate-400' : 'font-extrabold text-slate-800'}`}>
                      {task.title}
                    </span>
                    <div className="shrink-0 flex items-center">
                      <Clock className="w-3 h-3 text-slate-400 mr-1" />
                      <span className="text-[10px] text-slate-400 font-mono font-bold">
                        {task.dueDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-1">
                      {task.isCompleted ? (
                        <span className="bg-green-50 text-green-700 text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center border border-green-100">
                          <Check className="w-2.5 h-2.5 mr-0.5" /> Erledigt
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-800 text-[9px] px-2 py-0.5 rounded-full font-extrabold border border-amber-100">
                          {task.percentComplete}% aktiv
                        </span>
                      )}

                      {task.priority === 'High' && (
                        <span className="bg-red-50 text-red-700 text-[9px] px-2 py-0.5 rounded-full font-extrabold border border-red-100">
                          Hoch
                        </span>
                      )}
                    </div>
                    
                    <span className="text-[9px] font-mono font-bold text-slate-400">
                      WPF CONTROLS
                    </span>
                  </div>
                </div>
              </div>
            );
          });
        })()}

      </div>

      {contextMenu && (
        <div 
          id="email-context-menu"
          className="fixed z-100 bg-white border border-slate-200/90 rounded-xl p-1 w-52 shadow-2xl animate-fade-in select-none font-sans"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[9px] text-slate-400 font-extrabold uppercase tracking-widest border-b border-slate-100 mb-1">
            Interaktionen
          </div>
          <button 
            id="ctx-reply"
            onClick={() => { onReplyMail?.(); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-blue-500">↩</span>
            <span>Antworten</span>
          </button>
          <button 
            id="ctx-reply-all"
            onClick={() => { onReplyAll?.(); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-indigo-500">↪</span>
            <span>Allen antworten</span>
          </button>
          <button 
            id="ctx-forward"
            onClick={() => { onForwardMail?.(); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-teal-500">→</span>
            <span>Weiterleiten</span>
          </button>
          
          <div className="h-px bg-slate-100 my-1"></div>

          <button 
            id="ctx-read-unread"
            onClick={() => { onToggleReadUnread?.(contextMenu.emailId); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-amber-500">✉</span>
            <span>Als gelesen / ungelesen</span>
          </button>
          <button 
            id="ctx-flag"
            onClick={() => { onToggleFlag?.(); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-red-500">⚑</span>
            <span>Verfolgung (Flag)</span>
          </button>
          
          <button 
            id="ctx-set-reminder"
            onClick={() => { onSetReminder?.(contextMenu.emailId); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-amber-500">⌚</span>
            <span>Wiedervorlage (Termin)</span>
          </button>
          
          <button 
            id="ctx-pin"
            onClick={() => { onTogglePin?.(contextMenu.emailId); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-amber-600">📌</span>
            <span>Anheften / Lösen</span>
          </button>
          <button 
            id="ctx-star"
            onClick={() => { onToggleFavorite?.(contextMenu.emailId); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-yellow-500">★</span>
            <span>Favorit (Stern)</span>
          </button>

          <div className="h-px bg-slate-100 my-1"></div>

          <button 
            id="ctx-archive"
            onClick={() => { onArchiveMail?.(); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-emerald-500">▣</span>
            <span>Archivieren</span>
          </button>
          <button 
            id="ctx-phishing"
            onClick={() => { onReportPhishing?.(); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-orange-500">!</span>
            <span>Phishing melden</span>
          </button>
          <button 
            id="ctx-delete"
            onClick={() => { onDeleteMail?.(); setContextMenu(null); }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-700 font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-[11px]"
          >
            <span className="text-red-600">×</span>
            <span>Löschen</span>
          </button>
        </div>
      )}

    </div>
  );
}

