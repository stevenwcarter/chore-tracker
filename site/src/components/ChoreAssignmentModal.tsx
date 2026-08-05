import React from 'react';
import { Chore, User } from '../types/chore';
import Modal from './Modal';

interface ChoreAssignmentModalProps {
  chore: Chore | null;
  users: User[];
  onAssign: (choreId: number, userId: number) => void;
  onUnassign: (choreId: number, userId: number) => void;
  onClose: () => void;
}

export const ChoreAssignmentModal: React.FC<ChoreAssignmentModalProps> = ({
  chore,
  users,
  onAssign,
  onUnassign,
  onClose,
}) => {
  return (
    <Modal isOpen={!!chore} onClose={onClose} title={`Assign Users: ${chore?.name}`} maxWidth="sm">
      {chore && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">Assign to Users:</p>
            <div className="space-y-3">
              {users.map((user) => {
                const isAssigned = chore.assignedUsers?.some((au) => au.id === user.id);
                return (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-700 rounded-lg"
                  >
                    <span className="text-sm text-gray-300 font-medium">{user.name}</span>
                    <button
                      onClick={() =>
                        !isAssigned ? onAssign(chore.id, user.id) : onUnassign(chore.id, user.id)
                      }
                      className={`w-full sm:w-auto px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                        isAssigned
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isAssigned ? 'Unassign' : 'Assign'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ChoreAssignmentModal;
