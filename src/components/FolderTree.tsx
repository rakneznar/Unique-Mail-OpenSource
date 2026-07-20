/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Inbox, Send, Trash2, Archive, Folder, ChevronDown, ChevronRight, Star, 
  Search, ShieldAlert, FileText, Settings, AppWindow, Database, RefreshCw, X, GripVertical
} from 'lucide-react';
import { Email } from '../types';

interface Account {
  email: string;
  imapServer: string;
  imapPort: number;
  smtpServer: string;
  smtpPort: number;
  provider: string;
  displayName?: string;
  senderName?: string;
  customFolders?: string[];
  serverFolders?: Array<{
    id: string;
    path: string;
    pathAsListed?: string;
    label: string;
    delimiter?: string;
    parent?: string[];
    parentPath?: string;
    depth?: number;
    flags?: string[];
    specialUse?: string | null;
    listed?: boolean;
    subscribed?: boolean;
    status?: {
      messages?: number;
      unseen?: number;
      uidNext?: number;
      uidValidity?: number;
    } | null;
  }>;
}

interface FolderTreeProps {
  selectedFolder: string;
  setSelectedFolder: (folder: string) => void;
  emails: Email[];
  isOffline: boolean;
  accounts: Account[];
  activeAccountEmail: string;
  setActiveAccountEmail: (email: string) => void;
  onMoveEmailsToFolder?: (ids: string[], folderId: string) => void;
  onMoveFolder?: (request: {
    accountEmail: string;
    sourceFolder: string;
    destinationFolder: string;
    mode: 'nest' | 'merge';
  }) => Promise<void> | void;
}

export default function FolderTree({
  selectedFolder,
  setSelectedFolder,
  emails,
  isOffline,
  accounts,
  activeAccountEmail,
  setActiveAccountEmail,
  onMoveEmailsToFolder,
  onMoveFolder
}: FolderTreeProps) {
  type FavoriteFolderEntry = { accountEmail: string; id: string; label: string };
  type PendingFolderDrop = {
    accountEmail: string;
    sourceFolder: string;
    sourceLabel: string;
    destinationFolder: string;
    destinationLabel: string;
  };
  type PointerFolderDrag = {
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    accountEmail: string;
    folderId: string;
    label: string;
    delimiter: string;
  };

  const normalizeFavoriteFolders = (value: unknown): FavoriteFolderEntry[] => {
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    return value.reduce<FavoriteFolderEntry[]>((entries, item) => {
      if (!item || typeof item !== 'object') return entries;
      const candidate = item as Partial<FavoriteFolderEntry>;
      const accountEmail = String(candidate.accountEmail || '').trim();
      const id = String(candidate.id || '').trim();
      const label = String(candidate.label || '').trim();

      // Older versions created global Inbox/Sent/Deleted favorites automatically.
      // Real user favorites are always tied to a concrete account.
      if (!accountEmail || !id || !label) return entries;

      const key = `${accountEmail.toLowerCase()}::${id.toLowerCase()}`;
      if (seen.has(key)) return entries;
      seen.add(key);
      entries.push({ accountEmail, id, label });
      return entries;
    }, []);
  };
  
  // Track collapsed state for accounts
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [draggedFolderKey, setDraggedFolderKey] = useState<string | null>(null);
  const [folderDropTargetKey, setFolderDropTargetKey] = useState<string | null>(null);
  const [pendingFolderDrop, setPendingFolderDrop] = useState<PendingFolderDrop | null>(null);
  const [folderMoveError, setFolderMoveError] = useState('');
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const pointerFolderDragRef = useRef<PointerFolderDrag | null>(null);
  const suppressFolderClickRef = useRef(false);
  const [favoriteFolderEntries, setFavoriteFolderEntries] = useState<FavoriteFolderEntry[]>(() => {
    try {
      const saved = localStorage.getItem('uniquemail_folder_favorites');
      return saved ? normalizeFavoriteFolders(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });
  
  // Local Sync and Offline caching simulation triggers
  const [isHardSyncing, setIsHardSyncing] = useState<boolean>(false);
  const [syncPercentage, setSyncPercentage] = useState<number>(100);
  const [lastSyncText, setLastSyncText] = useState<string>('Lokale DB aktuell');

  useEffect(() => {
    localStorage.setItem('uniquemail_folder_favorites', JSON.stringify(favoriteFolderEntries));
  }, [favoriteFolderEntries]);

  useEffect(() => {
    const reloadFavoriteFolders = () => {
      try {
        const saved = localStorage.getItem('uniquemail_folder_favorites');
        setFavoriteFolderEntries(saved ? normalizeFavoriteFolders(JSON.parse(saved)) : []);
      } catch {
        setFavoriteFolderEntries([]);
      }
    };
    window.addEventListener('uniquemail-folder-favorites-updated', reloadFavoriteFolders);
    window.addEventListener('storage', reloadFavoriteFolders);
    return () => {
      window.removeEventListener('uniquemail-folder-favorites-updated', reloadFavoriteFolders);
      window.removeEventListener('storage', reloadFavoriteFolders);
    };
  }, []);

  const startLocalArchiveSync = () => {
    if (isHardSyncing) return;
    setIsHardSyncing(true);
    setSyncPercentage(10);
    setLastSyncText('Verbinde mit Server...');
    
    // Increment percent
    const interval = setInterval(() => {
      setSyncPercentage(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        if (p === 40) {
          setLastSyncText('Prüfe geänderte IMAP-Headers...');
        } else if (p === 70) {
          setLastSyncText('Lade neue Inhalte & Anhänge...');
        } else if (p === 90) {
          setLastSyncText('Schreibe in sqlite.db...');
        }
        return p + 15;
      });
    }, 250);

    setTimeout(() => {
      setIsHardSyncing(false);
      setLastSyncText('Lokaler Cache aktuell');
      alert('Lokaler Download abgeschlossen! Alle Nachrichten und Ordner wurden in der lokalen SQLite-Datenbank ("outlook.db") abgelegt. Offline-Zugriff ist aktiv, Ladezeit reduziert auf < 2ms!');
    }, 2000);
  };

  const toggleAccount = (email: string) => {
    setCollapsedAccounts(prev => ({
      ...prev,
      [email]: !prev[email]
    }));
  };

  const normalizeFolderKey = (value?: string) => (value || 'inbox').trim().replace(/\\/g, '/').toLowerCase();

  const folderMatches = (mailFolderRaw: string | undefined, folderIdRaw: string) => {
    const mailFolder = normalizeFolderKey(mailFolderRaw);
    const folderId = normalizeFolderKey(folderIdRaw);
    if (mailFolder === folderId) return true;
    if (folderId === 'inbox') return mailFolder === 'inbox' || mailFolder.endsWith('/inbox') || mailFolder.includes('posteingang');
    if (folderId === 'sent') return mailFolder.includes('sent') || mailFolder.includes('gesendet');
    if (folderId === 'outbox') return mailFolder.includes('outbox') || mailFolder.includes('postausgang');
    if (folderId === 'deleted') return mailFolder.includes('trash') || mailFolder.includes('deleted') || mailFolder.includes('papierkorb');
    if (folderId === 'drafts') return mailFolder.includes('draft') || mailFolder.includes('entwurf');
    if (folderId === 'junk') return mailFolder.includes('junk') || mailFolder.includes('spam');
    if (folderId === 'archive') return mailFolder.includes('archive') || mailFolder.includes('archiv');
    return false;
  };

  const inferFolderIcon = (path: string, specialUse?: string | null) => {
    const special = (specialUse || '').toLowerCase();
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('outbox') || lowerPath.includes('postausgang')) return Send;
    if (special.includes('sent') || lowerPath.includes('sent') || lowerPath.includes('gesendet')) return Send;
    if (special.includes('trash') || lowerPath.includes('trash') || lowerPath.includes('papierkorb') || lowerPath.includes('deleted')) return Trash2;
    if (special.includes('junk') || lowerPath.includes('spam') || lowerPath.includes('junk')) return ShieldAlert;
    if (special.includes('draft') || lowerPath.includes('draft') || lowerPath.includes('entwurf')) return FileText;
    if (lowerPath.includes('archive') || lowerPath.includes('archiv')) return Archive;
    if (lowerPath === 'inbox' || special.includes('inbox')) return Inbox;
    return Folder;
  };

  const knownFolderRoles = ['inbox', 'sent', 'outbox', 'deleted', 'drafts', 'junk', 'archive'];

  // Precompute folder metadata once per mail/account change. This keeps folder clicks snappy even with large mailboxes.
  const folderStats = useMemo(() => {
    const unreadCounts = new Map<string, number>();
    const folderIdsByAccount = new Map<string, Set<string>>();
    const addUnread = (accountKey: string, folderKey: string) => {
      const key = accountKey + '::' + folderKey;
      unreadCounts.set(key, (unreadCounts.get(key) || 0) + 1);
    };

    for (const mail of emails) {
      const accountKey = (mail.accountEmail || accounts[0]?.email || '').toLowerCase();
      if (!accountKey) continue;
      const folderId = mail.imapFolder || mail.folder || 'inbox';
      const normalizedFolder = normalizeFolderKey(folderId);
      if (!folderIdsByAccount.has(accountKey)) folderIdsByAccount.set(accountKey, new Set<string>());
      folderIdsByAccount.get(accountKey)?.add(folderId);

      if (!mail.isRead) {
        addUnread(accountKey, normalizedFolder);
        for (const role of knownFolderRoles) {
          if (folderMatches(folderId, role)) addUnread(accountKey, role);
        }
      }
    }

    return { unreadCounts, folderIdsByAccount };
  }, [emails, accounts]);

  // Compute unread mail counts per account/folder dynamically, including real IMAP paths like "Sent Items" or "[Gmail]/Alle Nachrichten".
  const getFolderUnreadCount = (accountEmail: string, folderId: string) => {
    const accountKey = accountEmail.toLowerCase();
    const normalizedFolder = normalizeFolderKey(folderId);
    return folderStats.unreadCounts.get(accountKey + '::' + normalizedFolder) || 0;
  };
  const favoriteFolders = favoriteFolderEntries.map(entry => ({
    ...entry,
    icon: inferFolderIcon(entry.id),
    count: getFolderUnreadCount(entry.accountEmail, entry.id)
  }));

  const toggleFavoriteFolder = (accountEmail: string, id: string, label: string) => {
    const normalizedAccount = accountEmail.trim();
    const normalizedId = id.trim();
    if (!normalizedAccount || !normalizedId) return;
    const key = `${normalizedAccount.toLowerCase()}::${normalizedId.toLowerCase()}`;
    setFavoriteFolderEntries(prev => {
      if (prev.some(item => `${item.accountEmail.toLowerCase()}::${item.id.toLowerCase()}` === key)) {
        return prev.filter(item => `${item.accountEmail.toLowerCase()}::${item.id.toLowerCase()}` !== key);
      }
      return [...prev, { accountEmail: normalizedAccount, id: normalizedId, label: label.trim() || normalizedId }];
    });
  };

  const getAccountFolders = (account: Account) => {
    const cachedFolderIds = Array.from(folderStats.folderIdsByAccount.get(account.email.toLowerCase()) || new Set<string>()) as string[];

    const byPath = new Map<string, any>();
    (account.serverFolders || []).forEach(folder => {
      const path = folder.path || folder.id;
      if (!path) return;
      byPath.set(path.toLowerCase(), folder);
    });

    cachedFolderIds.forEach(path => {
      if (!byPath.has(path.toLowerCase())) {
        byPath.set(path.toLowerCase(), {
          id: path,
          path,
          label: path.split(/[\\/]/).pop() || path,
          depth: path.split(/[\\/]/).length - 1,
          specialUse: null,
          status: null,
          fromCache: true
        });
      }
    });

    if (byPath.size > 0) {
      return Array.from(byPath.values())
        .sort((a, b) => {
          const aPath = (a.path || a.id || '').toLowerCase();
          const bPath = (b.path || b.id || '').toLowerCase();
          if (aPath === 'inbox') return -1;
          if (bPath === 'inbox') return 1;
          return aPath.localeCompare(bPath, 'de', { sensitivity: 'base' });
        })
        .map(folder => {
          const path = folder.path || folder.id;
          const id = path;
          const countFromServer = typeof folder.status?.unseen === 'number' ? folder.status.unseen : null;
          const inferredDepth = typeof folder.depth === 'number'
            ? folder.depth
            : Math.max(0, path.split(/[\\/]/).length - 1);

          return {
            id,
            label: folder.label || path.split(/[\\/]/).pop() || path,
            title: path,
            icon: inferFolderIcon(path, folder.specialUse),
            count: countFromServer ?? getFolderUnreadCount(account.email, id),
            depth: inferredDepth,
            delimiter: folder.delimiter || '/',
            specialUse: folder.specialUse || null,
            isSelectable: !(folder.flags || []).some((flag: string) => flag.toLowerCase() === '\\noselect')
          };
        });
    }

    const base = [
      { id: 'inbox', label: 'Posteingang', title: 'Posteingang', icon: Inbox, count: getFolderUnreadCount(account.email, 'inbox'), depth: 0, delimiter: '/', specialUse: '\\Inbox', isSelectable: true },
      { id: 'drafts', label: 'Entwürfe', title: 'Entwürfe', icon: FileText, count: getFolderUnreadCount(account.email, 'drafts'), depth: 0, delimiter: '/', specialUse: '\\Drafts', isSelectable: true },
      { id: 'sent', label: 'Gesendete Elemente', title: 'Gesendete Elemente', icon: Send, count: getFolderUnreadCount(account.email, 'sent'), depth: 0, delimiter: '/', specialUse: '\\Sent', isSelectable: true },
      { id: 'deleted', label: 'Gelöschte Elemente', title: 'Gelöschte Elemente', icon: Trash2, count: getFolderUnreadCount(account.email, 'deleted'), depth: 0, delimiter: '/', specialUse: '\\Trash', isSelectable: true },
      { id: 'junk', label: 'Junk-E-Mail', title: 'Junk-E-Mail', icon: ShieldAlert, count: getFolderUnreadCount(account.email, 'junk'), depth: 0, delimiter: '/', specialUse: '\\Junk', isSelectable: true },
      { id: 'archive', label: 'Archiv', title: 'Archiv', icon: Archive, count: getFolderUnreadCount(account.email, 'archive'), depth: 0, delimiter: '/', specialUse: '\\Archive', isSelectable: true },
    ];

    if (account.customFolders) {
      account.customFolders.forEach(cf => {
        base.push({
          id: cf,
          label: cf,
          title: cf,
          icon: Folder,
          count: getFolderUnreadCount(account.email, cf),
          depth: Math.max(0, cf.split(/[\\/]/).length - 1),
          delimiter: '/',
          specialUse: null,
          isSelectable: true
        });
      });
    }

    return base;
  };
  const folderNodeKey = (accountEmail: string, folderId: string) => accountEmail + '::' + normalizeFolderKey(folderId);

  const hasFolderChildren = (folders: Array<{ id: string }>, folder: { id: string; delimiter?: string }) => {
    const delimiter = folder.delimiter || '/';
    const base = folder.id.toLowerCase();
    return folders.some(candidate => candidate.id.toLowerCase().startsWith(base + delimiter.toLowerCase()));
  };

  const isHiddenByCollapsedParent = (accountEmail: string, folders: Array<{ id: string; delimiter?: string }>, folder: { id: string; delimiter?: string }) => {
    const current = folder.id.toLowerCase();
    return folders.some(folder => {
      const parent = folder.id.toLowerCase();
      const delimiter = folder.delimiter || '/';
      if (parent === current || !current.startsWith(parent + delimiter.toLowerCase())) return false;
      return !!collapsedFolders[folderNodeKey(accountEmail, folder.id)];
    });
  };

  const toggleFolderCollapse = (accountEmail: string, folderId: string) => {
    const key = folderNodeKey(accountEmail, folderId);
    setCollapsedFolders(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const protectedFolderPattern = /^(?:inbox|posteingang|sent|gesendet(?:e elemente)?|drafts?|entw(?:u|ü)rfe|trash|deleted|papierkorb|junk|spam|archive|archiv|outbox|postausgang)$/i;
  const canMoveFolder = (folder: { id: string; label: string; specialUse?: string | null; isSelectable?: boolean }) => {
    const leaf = folder.id.split(/[\\/.]/).pop() || folder.label;
    return folder.isSelectable !== false && !folder.specialUse && !protectedFolderPattern.test(leaf.trim());
  };

  const openFolderDropChoice = (
    source: { accountEmail: string; folderId: string; label: string; delimiter: string },
    destination: { accountEmail: string; folderId: string; label: string }
  ) => {
    if (source.accountEmail.toLowerCase() !== destination.accountEmail.toLowerCase()) {
      window.alert('Ordner können nur innerhalb desselben E-Mail-Kontos verschoben werden.');
      return;
    }
    const sourceKey = source.folderId.toLowerCase();
    const destinationKey = destination.folderId.toLowerCase();
    const delimiter = source.delimiter || '/';
    if (sourceKey === destinationKey || destinationKey.startsWith(sourceKey + delimiter.toLowerCase())) {
      window.alert('Ein Ordner kann nicht in sich selbst oder einen eigenen Unterordner verschoben werden.');
      return;
    }
    setFolderMoveError('');
    setPendingFolderDrop({
      accountEmail: source.accountEmail,
      sourceFolder: source.folderId,
      sourceLabel: source.label,
      destinationFolder: destination.folderId,
      destinationLabel: destination.label
    });
  };

  const pointerDropTargetAt = (clientX: number, clientY: number) => (
    document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-folder-path]') || null
  );

  const resetPointerFolderDrag = () => {
    pointerFolderDragRef.current = null;
    setDraggedFolderKey(null);
    setFolderDropTargetKey(null);
  };

  const handleFolderPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    accountEmail: string,
    folder: { id: string; label: string; delimiter?: string; specialUse?: string | null; isSelectable?: boolean }
  ) => {
    if (event.button !== 0 || !canMoveFolder(folder) || (event.target as HTMLElement).closest('[data-folder-control]')) return;
    pointerFolderDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      accountEmail,
      folderId: folder.id,
      label: folder.label,
      delimiter: folder.delimiter || '/'
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFolderPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pointerFolderDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 6) {
      drag.active = true;
      suppressFolderClickRef.current = true;
      setDraggedFolderKey(folderNodeKey(drag.accountEmail, drag.folderId));
    }
    if (!drag.active) return;
    event.preventDefault();
    const target = pointerDropTargetAt(event.clientX, event.clientY);
    const targetAccount = target?.dataset.folderAccount || '';
    const targetPath = target?.dataset.folderPath || '';
    const invalidTreeTarget = !targetPath
      || targetAccount.toLowerCase() !== drag.accountEmail.toLowerCase()
      || targetPath.toLowerCase() === drag.folderId.toLowerCase()
      || targetPath.toLowerCase().startsWith(drag.folderId.toLowerCase() + drag.delimiter.toLowerCase());
    setFolderDropTargetKey(invalidTreeTarget ? null : folderNodeKey(targetAccount, targetPath));
  };

  const handleFolderPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = pointerFolderDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.active) {
      event.preventDefault();
      event.stopPropagation();
      const target = pointerDropTargetAt(event.clientX, event.clientY);
      const targetAccount = target?.dataset.folderAccount || '';
      const targetPath = target?.dataset.folderPath || '';
      const targetLabel = target?.dataset.folderLabel || targetPath;
      if (targetAccount && targetPath) {
        openFolderDropChoice(
          { accountEmail: drag.accountEmail, folderId: drag.folderId, label: drag.label, delimiter: drag.delimiter },
          { accountEmail: targetAccount, folderId: targetPath, label: targetLabel }
        );
      }
      window.setTimeout(() => { suppressFolderClickRef.current = false; }, 0);
    }
    resetPointerFolderDrag();
  };

  const handleFolderPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressFolderClickRef.current = false;
    resetPointerFolderDrag();
  };

  const handleFolderDrop = (
    event: React.DragEvent,
    accountEmail: string,
    folder: { id: string; label: string; isSelectable?: boolean }
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggedFolderKey(null);
    const rawFolderPayload = event.dataTransfer.getData('application/x-unique-mail-folder');
    if (rawFolderPayload) {
      try {
        const source = JSON.parse(rawFolderPayload) as { accountEmail?: string; folderId?: string; label?: string; delimiter?: string };
        const sourceAccount = String(source.accountEmail || '').trim();
        const sourceFolder = String(source.folderId || '').trim();
        const delimiter = String(source.delimiter || '/');
        if (!sourceAccount || !sourceFolder) return;
        if (sourceAccount.toLowerCase() !== accountEmail.toLowerCase()) {
          window.alert('Ordner können nur innerhalb desselben E-Mail-Kontos verschoben werden.');
          return;
        }
        const sourceKey = sourceFolder.toLowerCase();
        const destinationKey = folder.id.toLowerCase();
        if (sourceKey === destinationKey || destinationKey.startsWith(sourceKey + delimiter.toLowerCase())) {
          window.alert('Ein Ordner kann nicht in sich selbst oder einen eigenen Unterordner verschoben werden.');
          return;
        }
        setFolderMoveError('');
        setPendingFolderDrop({
          accountEmail,
          sourceFolder,
          sourceLabel: String(source.label || sourceFolder),
          destinationFolder: folder.id,
          destinationLabel: folder.label
        });
        return;
      } catch {
        window.alert('Die Ordner-Verschiebedaten konnten nicht gelesen werden.');
        return;
      }
    }
    if (folder.isSelectable === false) return;
    const payload = event.dataTransfer.getData('application/x-unique-mail-ids') || event.dataTransfer.getData('text/plain');
    try {
      const ids = payload.trim().startsWith('[')
        ? JSON.parse(payload)
        : payload.split(',').map(item => item.trim()).filter(Boolean);
      if (Array.isArray(ids) && ids.length > 0) {
        setActiveAccountEmail(accountEmail);
        onMoveEmailsToFolder?.(ids, folder.id);
      }
    } catch {
      // Ignore drag payloads that do not belong to Unique Mail messages.
    }
  };

  const executeFolderDrop = async (mode: 'nest' | 'merge') => {
    if (!pendingFolderDrop || !onMoveFolder || isMovingFolder) return;
    setIsMovingFolder(true);
    setFolderMoveError('');
    try {
      await onMoveFolder({
        accountEmail: pendingFolderDrop.accountEmail,
        sourceFolder: pendingFolderDrop.sourceFolder,
        destinationFolder: pendingFolderDrop.destinationFolder,
        mode
      });
      setPendingFolderDrop(null);
    } catch (error: any) {
      setFolderMoveError(error?.message || 'Der Ordner konnte nicht verschoben werden.');
    } finally {
      setIsMovingFolder(false);
    }
  };
  const handleFolderClick = (accountEmail: string, folderId: string) => {
    setActiveAccountEmail(accountEmail);
    setSelectedFolder(folderId);
  };

  return (
    <>
    <div 
      id="folder-tree-sidebar" 
      className="w-64 bg-slate-50 border-r border-[#e2e8f0] flex flex-col h-full font-sans select-none shrink-0"
    >
      {/* 1. Header: Folder Title */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#e2e8f0]">
        <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Ordnerbereich</span>
        <Star className="w-3.5 h-3.5 text-slate-400 hover:text-yellow-500 transition-colors cursor-pointer" />
      </div>

      {/* 2. Scrollable folder tree */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        
        {/* UNIFIED POSTEINGANG (Gemeinsamer Posteingang) */}
        <div className="px-1 pb-1">
          <button
            id="unified-inbox-btn"
            data-unified-inbox
            onClick={() => {
              // Select unified-inbox folder
              setSelectedFolder('unified-inbox');
            }}
            className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 text-xs rounded-xl transition-colors duration-75 cursor-pointer border ${
              selectedFolder === 'unified-inbox'
                ? 'bg-amber-500/10 text-amber-800 border-amber-500/25 font-extrabold shadow-sm'
                : 'bg-white hover:bg-slate-200/50 border-[#e2e8f0] text-slate-700 hover:text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <div className="relative">
                <Inbox className={`w-4 h-4 ${selectedFolder === 'unified-inbox' ? 'text-amber-600' : 'text-[#0078d4]'}`} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-white animate-ping"></span>
              </div>
              <span className="min-w-0 truncate font-bold text-[11.5px]">Gemeinsamer Posteingang</span>
            </div>
            {(() => {
              const count = emails.filter(m => folderMatches(m.imapFolder || m.folder, 'inbox') && !m.isRead).length;
              if (count > 0) {
                return (
                  <span className="bg-amber-500 text-white font-extrabold text-[9.5px] px-2 py-0.5 rounded-full font-mono shadow-xs">
                    {count}
                  </span>
                );
              }
              return null;
            })()}
          </button>
        </div>

        {/* FAVORITES GROUP */}
        <div>
          <div className="flex items-center px-2 py-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            <ChevronDown className="w-3 h-3 mr-1 text-slate-400" />
            <span>Favoriten</span>
          </div>
          
          <div className="mt-1.5 space-y-1 animate-fade-in">
            {favoriteFolders.map((folder) => {
               const FolderIcon = folder.icon;
               const isSelected = selectedFolder === folder.id && (!folder.accountEmail || activeAccountEmail.toLowerCase() === folder.accountEmail.toLowerCase());
               return (
                 <button
                   id={`favorite-folder-${folder.id}`}
                   key={`fav-${folder.accountEmail || 'global'}-${folder.id}`}
                   onClick={() => {
                     if (folder.accountEmail) {
                       setActiveAccountEmail(folder.accountEmail);
                     }
                     setSelectedFolder(folder.id);
                   }}
                   className={`w-full text-left flex items-center justify-between px-3.5 py-2 text-xs rounded-lg transition-colors duration-75 cursor-pointer ${
                     isSelected
                       ? 'bg-[#0078d4]/10 text-[#005a9e] font-semibold border-l-3 border-[#0078d4]'
                       : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                   }`}
                 >
                   <div className="flex items-center space-x-2.5">
                     <FolderIcon className={`w-4 h-4 ${isSelected ? 'text-[#0078d4]' : 'text-slate-500'}`} />
                     <span className="font-medium">{folder.label}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                     {folder.count > 0 && (
                       <span className="bg-[#0078d4] text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full font-mono">
                         {folder.count}
                       </span>
                     )}
                     <span
                       role="button"
                       tabIndex={0}
                       onClick={(e) => {
                         e.stopPropagation();
                         toggleFavoriteFolder(folder.accountEmail || '', folder.id, folder.label);
                       }}
                       className="text-slate-400 hover:text-red-500 px-1 font-bold"
                       title="Aus Favoriten entfernen"
                     >
 <X className="w-3 h-3" />
                     </span>
                   </div>
                 </button>
               );
            })}
          </div>
        </div>

        {/* ACCOUNTS GROUP */}
        {accounts.map((account) => {
          const folders = getAccountFolders(account);
          const isCurrentActive = activeAccountEmail.toLowerCase() === account.email.toLowerCase();
          const isCollapsed = !!collapsedAccounts[account.email];
          const configuredAccountName = String(account.displayName || account.senderName || '').trim();
          const hasConfiguredAccountName = !!configuredAccountName
            && configuredAccountName.toLowerCase() !== account.email.toLowerCase();
          const accountHeading = hasConfiguredAccountName ? configuredAccountName : account.email;

          return (
            <div key={account.email} className={`pb-2 border-b border-[#e2e8f0]/80 last:border-b-0 ${isCurrentActive ? 'bg-[#0078d4]/3 rounded-xl p-1 border border-[#0078d4]/8 shadow-xs' : ''}`}>
              <div 
                onClick={() => toggleAccount(account.email)}
                className="flex items-center px-2.5 py-2 text-[10px] font-extrabold text-slate-500 uppercase overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer hover:bg-slate-200/50 rounded-lg transition-colors duration-75 select-none"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 mr-1 text-slate-400 text-left shrink-0 transition-transform" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 mr-1 text-slate-400 text-left shrink-0 transition-transform" />
                )}
                <span
                  data-account-heading={account.email}
                  title={hasConfiguredAccountName ? account.email : undefined}
                  className={`truncate text-xs tracking-tight normal-case ${hasConfiguredAccountName ? 'text-[#0078d4] font-bold' : 'font-mono text-[10px] text-slate-500 font-semibold'}`}
                >
                  {accountHeading}
                </span>
              </div>

              {!isCollapsed && (
                <div className="mt-1 space-y-1 animate-fade-in">
                  {folders.map((folder) => {
                    const FolderIcon = folder.icon;
                    const isSelected = selectedFolder === folder.id && activeAccountEmail.toLowerCase() === account.email.toLowerCase();
                    const isFavorite = favoriteFolderEntries.some(item => item.accountEmail === account.email && item.id === folder.id);
                    const hasChildren = hasFolderChildren(folders, folder);
                    const folderCollapsed = !!collapsedFolders[folderNodeKey(account.email, folder.id)];
                    if (isHiddenByCollapsedParent(account.email, folders, folder)) return null;
                    return (
                      <button
                        id={`account-folder-${account.email}-${folder.id}`}
                        data-folder-path={folder.id}
                        data-folder-account={account.email}
                        data-folder-label={folder.label}
                        data-folder-delimiter={folder.delimiter || '/'}
                        data-folder-movable={canMoveFolder(folder) ? 'true' : 'false'}
                        key={`${account.email}-${folder.id}`}
                        onClick={(event) => {
                          if (suppressFolderClickRef.current) {
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                          }
                          if (folder.isSelectable !== false) handleFolderClick(account.email, folder.id);
                        }}
                        onDragOver={(e) => { if (folder.isSelectable !== false) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                        onDrop={(e) => handleFolderDrop(e, account.email, folder)}
                        draggable={false}
                        onPointerDown={(event) => handleFolderPointerDown(event, account.email, folder)}
                        onPointerMove={handleFolderPointerMove}
                        onPointerUp={handleFolderPointerUp}
                        onPointerCancel={handleFolderPointerCancel}
                        className={`w-full text-left flex items-center justify-between px-3.5 py-1.5 text-xs rounded-lg transition-colors duration-75 ${canMoveFolder(folder) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                          draggedFolderKey === folderNodeKey(account.email, folder.id)
                            ? 'opacity-45 border border-dashed border-[#0078d4] '
                            : folderDropTargetKey === folderNodeKey(account.email, folder.id)
                              ? 'bg-[#0078d4]/15 text-[#005a9e] ring-2 ring-[#0078d4]/60 ring-inset '
                            : ''
                        }${
                          isSelected
                            ? 'bg-[#0078d4]/10 text-[#005a9e] font-semibold border-l-3 border-[#0078d4]'
                            : folder.isSelectable === false
                              ? 'text-slate-400 cursor-default'
                              : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                        }`}
                        style={{ paddingLeft: `${14 + (folder.depth || 0) * 12}px` }}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          {canMoveFolder(folder) && (
                            <GripVertical className="w-3 h-3 -ml-2 shrink-0 text-slate-300 cursor-grab active:cursor-grabbing" aria-label="Ordner ziehen" />
                          )}
                          {hasChildren ? (
                            <span
                              data-folder-control
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderCollapse(account.email, folder.id);
                              }}
                              className="-ml-1 mr-0.5 text-slate-400 hover:text-slate-700"
                              title={folderCollapsed ? 'Unterordner aufklappen' : 'Unterordner zuklappen'}
                            >
                              {folderCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          ) : (
                            <span className="w-3.5 h-3.5 -ml-1 mr-0.5" />
                          )}
                          <FolderIcon className={`w-4 h-4 shrink-0 transition-transform duration-150 ${isSelected ? 'text-[#0078d4] scale-105' : 'text-slate-500'}`} />
                          <span className="truncate font-medium" title={folder.title || folder.label}>{folder.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {folder.count > 0 && (
                            <span className="bg-[#0078d4] text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full font-mono">
                              {folder.count}
                            </span>
                          )}
                          <span
                            data-folder-control
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteFolder(account.email, folder.id, folder.label);
                            }}
                            className={`px-1 ${isFavorite ? 'text-yellow-500' : 'text-slate-350 hover:text-yellow-500'}`}
                            title={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                          >
<Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* SEARCH FOLDERS GROUP (Search folders like classic unread mail etc.) */}
        <div>
          <div className="flex items-center px-2 py-1 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            <ChevronRight className="w-3 h-3 mr-1 text-slate-400" />
            <span>Suchordner</span>
          </div>
        </div>

      </div>

      {/* 3. Footer branding info mimicking Outlook Classic desktop client */}
      {isHardSyncing && (
        <div className="p-3.5 bg-white border-t border-[#e2e8f0] text-[10.5px] select-none rounded-b-xl space-y-1 animate-fade-in">
          <div className="flex justify-between items-center text-[9px] text-[#0078d4] font-bold font-mono">
            <span className="truncate max-w-[120.px]">{lastSyncText}</span>
            <span>{syncPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-[#0078d4] h-full transition-all duration-300"
              style={{ width: `${syncPercentage}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
    {pendingFolderDrop && createPortal(
      <div
        id="folder-drop-choice-modal"
        className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-drop-choice-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isMovingFolder) setPendingFolderDrop(null);
        }}
      >
        <div className="w-[520px] max-w-full border border-slate-300 bg-white shadow-2xl text-slate-800">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 id="folder-drop-choice-title" className="text-sm font-extrabold">Ordner verschieben</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              „{pendingFolderDrop.sourceLabel}“ wurde auf „{pendingFolderDrop.destinationLabel}“ gezogen.
            </p>
          </div>
          <div className="space-y-3 p-5">
            <button
              id="folder-drop-nest-button"
              type="button"
              disabled={isMovingFolder}
              onClick={() => executeFolderDrop('nest')}
              className="w-full border border-[#0078d4] bg-[#0078d4] px-4 py-3 text-left text-white hover:bg-[#005a9e] disabled:opacity-60"
            >
              <span className="block text-xs font-extrabold">Als Unterordner verschieben</span>
              <span className="mt-1 block text-[10.5px] text-blue-100">Der Ordner und seine Unterordner bleiben erhalten und werden unter dem Ziel eingeordnet.</span>
            </button>
            <button
              id="folder-drop-merge-button"
              type="button"
              disabled={isMovingFolder}
              onClick={() => executeFolderDrop('merge')}
              className="w-full border border-slate-300 bg-white px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="block text-xs font-extrabold text-slate-800">Inhalt in Zielordner migrieren</span>
              <span className="mt-1 block text-[10.5px] text-slate-500">Alle Nachrichten aus diesem Ordner und seinen Unterordnern werden in den Zielordner verschoben; der Quellordner wird danach entfernt.</span>
            </button>
            {folderMoveError && (
              <p className="border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{folderMoveError}</p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-[10px] text-slate-500">{isMovingFolder ? 'Serveränderung wird ausgeführt...' : 'Die Änderung wird direkt mit dem IMAP-Server synchronisiert.'}</span>
            <button
              type="button"
              disabled={isMovingFolder}
              onClick={() => setPendingFolderDrop(null)}
              className="border border-slate-300 bg-white px-4 py-1.5 text-[11px] font-bold hover:bg-slate-100 disabled:opacity-60"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}


