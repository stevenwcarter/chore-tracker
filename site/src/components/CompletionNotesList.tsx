import React from 'react';
import { ChoreCompletionNote, AuthorType } from '../types/chore';

interface CompletionNotesListProps {
  notes: ChoreCompletionNote[];
  isAdmin?: boolean;
}

export const CompletionNotesList: React.FC<CompletionNotesListProps> = ({
  notes,
  isAdmin = false,
}) => {
  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-sm text-gray-400 mb-2">Notes:</p>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {notes
          .filter((note) => isAdmin || note.visibleToUser)
          .map((note) => (
            <div key={note.id} className="bg-gray-700 p-2 rounded text-sm">
              <div className="flex justify-between items-start mb-1">
                <p className="text-white">{note.noteText}</p>
                {isAdmin && !note.visibleToUser && (
                  <span className="text-xs bg-red-600 text-white px-1 rounded">Admin Only</span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {note.authorType === AuthorType.Admin ? 'Admin' : 'User'} •{' '}
                {new Date(note.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
};

export default CompletionNotesList;
