/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mail, Calendar, Users, SquareCheck, Terminal, HelpCircle, StickyNote, Briefcase } from 'lucide-react';

interface NavigationRailProps {
  currentPage: 'mail' | 'calendar' | 'contacts' | 'crm' | 'tasks' | 'notes' | 'dev';
  setCurrentPage: (page: 'mail' | 'calendar' | 'contacts' | 'crm' | 'tasks' | 'notes' | 'dev') => void;
  language?: 'de' | 'en';
}

export default function NavigationRail({ currentPage, setCurrentPage, language = 'de' }: NavigationRailProps) {
  const isEnglish = language === 'en';
  const items = [
    { id: 'mail', label: isEnglish ? 'Mail' : 'E-Mail', icon: Mail, color: 'text-blue-600 hover:text-blue-800' },
    { id: 'calendar', label: isEnglish ? 'Calendar' : 'Kalender', icon: Calendar, color: 'text-green-600 hover:text-green-800' },
    { id: 'contacts', label: isEnglish ? 'Contacts' : 'Kontakte', icon: Users, color: 'text-teal-600 hover:text-teal-800' },
    { id: 'crm', label: 'CRM', icon: Briefcase, color: 'text-indigo-600 hover:text-indigo-800' },
    { id: 'tasks', label: isEnglish ? 'Tasks' : 'Aufgaben', icon: SquareCheck, color: 'text-amber-600 hover:text-amber-800' },
    { id: 'notes', label: isEnglish ? 'Notes' : 'Notizen', icon: StickyNote, color: 'text-yellow-600 hover:text-yellow-750' },
    { id: 'dev', label: 'WPF Suite', icon: Terminal, color: 'text-slate-700 hover:text-black font-extrabold' },
  ] as const;

  return (
    <div 
      id="navigation-rail" 
      className="w-16 bg-slate-50 border-r border-[#e2e8f0] flex flex-col items-center py-4 justify-between select-none shrink-0"
    >
      <div className="flex flex-col items-center space-y-4 w-full">
        {items.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              id={`nav-item-${item.id}`}
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`group flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 active:scale-90 relative ${
                isActive 
                  ? 'bg-white shadow-md border border-[#e2e8f0] text-[#0078d4] scale-102' 
                  : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
              }`}
            >
              <IconComponent className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              <span className="text-[9px] mt-1 font-bold tracking-tight">
                {item.label}
              </span>
              
              {/* Highlight bar typical of active statuses - now rounded and elegantly centered */}
              {isActive && (
                <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#0078d4] rounded-r-full animate-fade-in"></div>
              )}
              
              {/* Tooltip on Hover */}
              <div className="hidden group-hover:block absolute left-15 bg-slate-900 border border-slate-800 text-white text-[10.5px] py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap z-50 animate-fade-in font-medium">
                {item.label} {isEnglish ? 'open' : 'öffnen'} (WPF View)
              </div>
            </button>
          );
        })}
      </div>

      {/* Corporate Info Footer Icon */}
      <div className="flex flex-col items-center space-y-4">
        <div className="group relative font-sans">
          <button 
            onClick={() => setCurrentPage('dev')} 
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/80 transition-all duration-150 active:scale-90"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          
          <div className="hidden group-hover:block absolute bottom-full left-15 bg-slate-900 border border-slate-800 text-white text-[10.5px] py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap z-50 font-medium">
            {isEnglish ? 'C# & WPF documentation' : 'C# & WPF Dokumentation'}
          </div>
        </div>
      </div>
    </div>
  );
}
