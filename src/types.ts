/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Category {
  name: string;
  color: string;
}

export interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  date: string;
  body: string;
  preview: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachment: boolean;
  importance: 'normal' | 'high' | 'low';
  category?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  isFlagCompleted?: boolean;
  
  // Account/Folder integration
  folder?: string;
  accountEmail?: string;
  recipientEmail?: string;
  recipientName?: string;
  ccEmail?: string;
  bccEmail?: string;
  sendStatus?: 'sent' | 'queued' | 'failed';
  sendError?: string;
  attachments?: Array<{ filename: string; contentType?: string; size?: number; contentBase64?: string }>;
  draftAttachments?: Array<{ filename: string; contentType?: string; contentBase64: string }>;
  imapUid?: number;
  imapFolder?: string;
  imapUidValidity?: string;

  // Follow-up Wiedervorlage inputs
  reminderDate?: string;      // ISO format or empty
  reminderNote?: string;      // custom extra reminder description
  reminderTriggered?: boolean; // triggered state tracker
}

export interface CalendarItemDraft {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface CalendarItem {
  id: string;
  title: string;
  start: string; // ISO string or simple time representation
  end: string;
  location?: string;
  description?: string;
  isAllDay?: boolean;
  category?: string;
  
  // Back-reference to email attachment
  emailAttachmentId?: string;
  emailAttachmentSubject?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  group?: string;
  address?: string;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  isCompleted: boolean;
  priority: 'High' | 'Normal' | 'Low';
  notes?: string;
  percentComplete: number;
  accountEmail?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  color: string; // e.g., '#fef08a' (yellow) or '#bbf7d0' (green) etc. Classic yellow is default.
  accountEmail?: string;
}

export interface CodeFile {
  id: string;
  name: string;
  type: 'xaml' | 'cs' | 'xml' | 'config' | 'json';
  description: string;
  code: string;
}

export interface RoadmapPhase {
  id: number;
  title: string;
  subtitle: string;
  duration: string;
  status: 'Completed' | 'InProgress' | 'Planned';
  tasks: string[];
  wpfFocus: string;
  codeFiles: string[]; // Related CodeFile names
}

export interface ArchitectureComponent {
  name: string;
  role: string;
  description: string;
  responsibilities: string[];
  exampleClass: string;
}

