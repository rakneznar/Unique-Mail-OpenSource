/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  StickyNote, Plus, Trash2, ChevronDown, ChevronRight, Edit3, 
  X, Save, Palette, Check, Search, Grid, List as ListIcon 
} from 'lucide-react';
import { Note } from '../types';

interface Account {
  email: string;
  imapServer: string;
  imapPort: number;
  smtpServer: string;
  smtpPort: number;
  provider: string;
  customFolders?: string[];
}

interface NotesViewProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  accounts: Account[];
  activeAccountEmail: string;
  isDense?: boolean;
}

const NOTE_COLORS = [
  { id: 'yellow', hex: '#fef08a', label: 'Gelb (Klassisch)', border: 'border-yellow-400', hover: 'hover:bg-yellow-200' },
  { id: 'green', hex: '#bbf7d0', label: 'Grün', border: 'border-green-400', hover: 'hover:bg-green-200' },
  { id: 'blue', hex: '#bfdbfe', label: 'Blau', border: 'border-blue-400', hover: 'hover:bg-blue-200' },
  { id: 'pink', hex: '#fbcfe8', label: 'Pink', border: 'border-pink-400', hover: 'hover:bg-pink-200' },
  { id: 'white', hex: '#f3f4f6', label: 'Weiß', border: 'border-gray-400', hover: 'hover:bg-gray-200' },
];

export default function NotesView({
  notes,
  setNotes,
  accounts,
  activeAccountEmail,
  isDense = false
}: NotesViewProps) {
  
  // Selection of active folder in left pane
  const [selectedNotesAccount, setSelectedNotesAccount] = useState<string>(activeAccountEmail);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Toggle sidebar list of "Meine Notizen"
  const [isNotesGroupExpanded, setIsNotesGroupExpanded] = useState<boolean>(true);
  
  // Editor modal states
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorTitle, setEditorTitle] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');
  const [editorColor, setEditorColor] = useState<string>('#fef08a');
  
  // Grid vs. lists view toggle
  const [isListView, setIsListView] = useState<boolean>(false);

  // Sync selected notes account if active main mailbox shifts
  useEffect(() => {
    setSelectedNotesAccount(activeAccountEmail);
  }, [activeAccountEmail]);

  // Handle open editor for new note
  const handleCreateNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Neue Notiz',
      content: '',
      date: new Date().toLocaleDateString('de-DE'),
      color: '#fef08a' // default classic yellow
    };
    
    const noteWithAccount = { ...newNote, accountEmail: selectedNotesAccount };
    
    setNotes(prev => [...prev, noteWithAccount as any]);
    handleOpenNote(noteWithAccount as any);
  };

  const handleOpenNote = (note: Note) => {
    setEditingNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorColor(note.color);
  };

  const handleSaveNote = () => {
    if (!editingNote) return;
    
    setNotes(prev => prev.map(n => {
      if (n.id === editingNote.id) {
        return {
          ...n,
          title: editorTitle.trim() || 'Unbenannt',
          content: editorContent,
          color: editorColor,
          date: new Date().toLocaleDateString('de-DE')
        };
      }
      return n;
    }));
    
    setEditingNote(null);
  };

  const handleDeleteNote = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Möchten Sie diese Notiz unwiderruflich löschen?')) {
      setNotes(prev => prev.filter(n => n.id !== id));
      if (editingNote?.id === id) {
        setEditingNote(null);
      }
    }
  };

  // Filter notes by selected notes account database
  const filteredNotes = notes.filter(note => {
    const noteAcc = ((note as any).accountEmail || (accounts[0]?.email || '')).toLowerCase();
    const activeAcc = selectedNotesAccount.toLowerCase();
    
    // Match account
    if (noteAcc !== activeAcc) return false;
    
    // Match query
    if (!searchQuery) return true;
    const tokens = searchQuery.toLowerCase().split(/\s+/);
    return tokens.every(t => 
      note.title.toLowerCase().includes(t) || 
      note.content.toLowerCase().includes(t)
    );
  });

  return (
    <div id="notes-view-root" className="flex-1 flex overflow-hidden min-h-0 bg-slate-50 font-sans select-none">
      
      {/* COLUMN 1: LEFT FOLDOUT BAR - "Meine Notizen" */}
      <div 
        id="notes-sidebar-tree" 
        className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0"
      >
        <div className="h-11 px-4 flex items-center justify-between border-b border-slate-200">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Notizbereiche</span>
          <StickyNote className="w-4 h-4 text-slate-400" />
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <div className="px-2">
            <button 
              onClick={() => setIsNotesGroupExpanded(!isNotesGroupExpanded)}
              className="w-full flex items-center px-3 py-2 text-[11px] font-extrabold text-slate-500 uppercase hover:bg-slate-200/50 rounded-lg cursor-pointer select-none transition-all outline-none"
            >
              {isNotesGroupExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1.5 text-slate-400" />
              )}
              <span>Meine Notizen</span>
            </button>

            {isNotesGroupExpanded && (
              <div className="mt-1 pl-1.5 space-y-1">
                {accounts.map(acc => {
                  const isActive = selectedNotesAccount.toLowerCase() === acc.email.toLowerCase();
                  const noteCount = notes.filter(n => ((n as any).accountEmail || (accounts[0]?.email || '')).toLowerCase() === acc.email.toLowerCase()).length;
                  
                  return (
                    <button
                      key={acc.email}
                      onClick={() => setSelectedNotesAccount(acc.email)}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all cursor-pointer border border-transparent active:scale-95 ${
                        isActive
                          ? 'bg-white border-slate-200 text-slate-900 font-extrabold shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <StickyNote className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-[#0078d4]' : 'text-slate-400'
                        }`} />
                        <span className="truncate" title={`Notizen - ${acc.email}`}>Notizen - {acc.email}</span>
                      </div>
                      <span className="bg-slate-200/60 text-slate-600 font-extrabold text-[9px] px-2 py-0.5 rounded-full font-mono shrink-0 ml-1">
                        {noteCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer info showing summary details */}
        <div className="p-4 bg-white border-t border-slate-200 text-[10.5px] text-slate-500 rounded-b-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-600 font-bold mb-1.5">
            <span>Status:</span>
            <span className="font-sans bg-emerald-55/70 text-[10px] px-2 py-0.5 text-emerald-800 rounded-full font-bold border border-emerald-100">Synchronisiert</span>
          </div>
          <p className="leading-4 text-[9.5px] text-slate-450 font-medium">Ihre Notizen sind lokal auf dem neuesten Stand.</p>
        </div>
      </div>

      {/* COLUMN 2: LARGE CANVAS FOR MEMO NOTEPADS */}
      <div 
        id="notes-canvas-area" 
        className="flex-1 flex flex-col min-w-0 bg-slate-100"
      >
        {/* Action Header for Notes control */}
        <div className="h-12 border-b border-slate-200 bg-white flex items-center justify-between px-4 select-none shrink-0">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleCreateNote}
              className="px-4.5 py-1.8 bg-[#107c41] text-white hover:bg-[#0b592e] rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neue Notiz</span>
            </button>

            <button
              onClick={() => {
                if (filteredNotes.length === 0) return;
                handleDeleteNote(filteredNotes[0].id);
              }}
              disabled={filteredNotes.length === 0}
              className="px-3 py-1.8 text-slate-650 hover:text-red-700 hover:bg-slate-50 rounded-lg text-xs flex items-center space-x-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Löschen</span>
            </button>
          </div>

          {/* Quick search and Grid / List toggle */}
          <div className="flex items-center space-x-3.5">
            {/* Search Input */}
            <div className="relative w-56">
              <input
                type="text"
                placeholder="Notizen durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs py-1.5 pl-8 pr-3.5 bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] placeholder-slate-400 transition-all text-slate-800"
              />
              <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Toggle Grid vs List */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                onClick={() => setIsListView(false)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  !isListView ? 'bg-white text-[#0078d4] shadow-xs' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Rasteransicht"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsListView(true)}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  isListView ? 'bg-white text-[#0078d4] shadow-xs' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Listenansicht"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* The interactive main drawing canvas board */}
        <div 
          id="notes-rendering-grid" 
          className="flex-1 overflow-y-auto p-6 bg-[#1a1c1e]" // Pitch charcoal slate background
          style={{ backgroundImage: 'radial-gradient(#262a2e 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }}
        >
          {filteredNotes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 select-none">
              <div className="w-16 h-16 rounded-full bg-[#2a2d31] flex items-center justify-center mb-4 border border-slate-700/30">
                <StickyNote className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-xs font-bold text-slate-300">Keine Notizbucheinträge vorhanden.</p>
              <p className="text-[10px] text-slate-500 mt-1.5">Klicken Sie oben auf "Neue Notiz", um ein gelbes Notepad herbeizurufen.</p>
            </div>
          ) : isListView ? (
            
            /* LIST LAYOUT (ALTERNATIVE OUTLOOK STYLE) */
            <div className="bg-[#242628]/95 backdrop-blur-xs rounded-xl border border-slate-700/50 overflow-hidden max-w-4xl mx-auto divide-y divide-slate-800/65 shadow-xl">
              {filteredNotes.map(n => (
                <div 
                  key={n.id}
                  onClick={() => handleOpenNote(n)}
                  className="p-3.5 hover:bg-slate-800/50 transition-colors flex items-center justify-between cursor-pointer text-slate-300"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0 border border-black/25 shadow-xs" 
                      style={{ backgroundColor: n.color }}
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-100 truncate">{n.title}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{n.content || 'Kein weiterer Text...'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-[10px] font-mono whitespace-nowrap shrink-0 ml-4">
                    <span className="text-slate-500 font-bold">{n.date}</span>
                    <button
                      onClick={(e) => handleDeleteNote(n.id, e)}
                      className="p-1.5 hover:bg-red-950 hover:text-red-400 rounded-lg text-slate-400 transition-all active:scale-95"
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          ) : (

            /* GRID CANVAS LAYOUT WITH BEAUTIFUL ROUNDED Memo MOCKUPS */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 items-start">
              <AnimatePresence>
                {filteredNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    onClick={() => handleOpenNote(note)}
                    style={{ backgroundColor: note.color }}
                    className="aspect-square h-40 rounded-2xl shadow-xl hover:shadow-2xl flex flex-col justify-between p-4 border-t-[7px] border-t-black/10 relative cursor-pointer select-none overflow-hidden hover:brightness-105 transition-all text-[#323130] font-sans group border border-black/5 active:scale-95"
                  >
                    {/* Ribbon header details of sticky note card */}
                    <div className="absolute top-2.5 right-3 opacity-0 group-hover:opacity-60 flex items-center space-x-1.5 transition-opacity">
                      <Edit3 className="w-3" />
                      <button 
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="hover:text-red-700 p-0.5 hover:bg-black/5 rounded transition-transform"
                        title="Sofort löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 mt-1 text-xs overflow-hidden leading-4 font-bold break-words">
                      <p className="font-extrabold underline text-[11px] tracking-tight pb-1 truncate text-black">{note.title}</p>
                      <p className="text-[10px] text-[#4d4b49] line-clamp-4 select-none font-medium mt-0.5 leading-4">{note.content || 'Doppelklick zum Bearbeiten...'}</p>
                    </div>

                    {/* Note Date Footer info */}
                    <div className="border-t border-black/5 pt-1.5 mt-2 flex items-center justify-between text-[8.5px] font-bold text-[#8a8886] font-mono shrink-0 select-none">
                      <span>{note.date}</span>
                      <div 
                        className="w-2 h-2 rounded-full border border-black/10" 
                        style={{ backgroundColor: note.color }}
                      />
                    </div>

                    {/* Sticky Note leaf fold decoration bottom right */}
                    <div className="absolute bottom-0 right-0 w-3 relative">
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-black/10 rounded-tl-md skew-x-3 border-l border-t border-black/15 pointer-events-none"></div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* 4. CLASSIC FLOATING OUTLOOK STICKY NOTE CARD EDITOR MODAL */}
      <AnimatePresence>
        {editingNote && (
          <div 
            id="notes-editor-overlay" 
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs z-55 p-4"
            onClick={handleSaveNote}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: editorColor }}
              className="w-[350px] aspect-square rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#323130] font-sans border-t-[8px] border-t-black/15 border border-black/5 relative"
            >
              {/* Sticky Note Command Toolbar Header */}
              <div className="h-9 px-3 bg-black/5 flex items-center justify-between font-bold text-[10px] select-none text-[#5e5c5a]">
                
                <div className="flex items-center space-x-2">
                  <StickyNote className="w-3.5 h-3.5 text-slate-700" />
                  <span className="font-sans text-[9px] uppercase font-bold tracking-widest text-slate-700">Notiz bearbeiten</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {/* Select Color picker */}
                  <div className="relative group/color-palette">
                    <button className="p-1 hover:bg-black/10 rounded-lg transition-all active:scale-95 text-slate-700" title="Farbe ändern">
                      <Palette className="w-3.5 h-3.5" />
                    </button>
                    
                    {/* Hover Dropdown panel for colors */}
                    <div className="absolute right-0 top-full bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-0.5 min-w-[140px] hidden group-hover/color-palette:block z-50 text-xs text-[#323130]">
                      {NOTE_COLORS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setEditorColor(c.hex)}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-100 flex items-center justify-between font-bold text-[10px]"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block" style={{ backgroundColor: c.hex }} />
                            <span>{c.label}</span>
                          </div>
                          {editorColor === c.hex && <Check className="w-3 h-3 text-[#0078d4]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delete this note inside editor */}
                  <button 
                    onClick={() => handleDeleteNote(editingNote.id)}
                    className="p-1 hover:bg-black/10 text-red-650 hover:text-red-800 rounded-lg transition-all active:scale-95 cursor-pointer"
                    title="Diese Notiz löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-1.5" />

                  {/* Close and save button */}
                  <button 
                    onClick={handleSaveNote}
                    className="p-1 hover:bg-red-650 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note Content Input Block */}
              <div className="flex-1 p-4 flex flex-col space-y-3 bg-transparent">
                {/* Editable Title Header input */}
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="Notizüberschrift..."
                  className="w-full bg-transparent border-b border-black/5 focus:border-black/15 pb-1 outline-none font-extrabold text-[#111] placeholder-slate-500 text-xs leading-5"
                />

                {/* Editable Content block */}
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="Schreiben Sie hier Ihre Gedanken auf..."
                  className="w-full flex-1 bg-transparent resize-none outline-none text-[11.5px] leading-5 text-slate-800 placeholder-slate-600 font-medium select-text"
                />
              </div>

              {/* Statusbar showing date and OK confirmation button */}
              <div className="h-10 border-t border-black/5 px-2 bg-black/2.5 flex items-center justify-between text-[8px] text-[#797775] font-extrabold select-none font-mono">
                <span>BEARBEITET: {editingNote.date}</span>
                <button
                  onClick={handleSaveNote}
                  className="px-3 py-1.5 bg-black/10 hover:bg-black/20 text-[#323130] rounded-lg font-bold flex items-center space-x-1 border border-black/5 active:scale-95 transition-all text-[9.5px] cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>Sichern</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
