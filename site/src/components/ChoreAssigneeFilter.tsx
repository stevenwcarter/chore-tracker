import React from 'react';
import { User } from 'types/chore';
import UserImage from './UserImage';

/** Which chores the Chore Management grid is showing: everything, the chores
 *  assigned to one user (by id), or the chores nobody is assigned to. */
export type AssigneeFilterValue = 'all' | 'unassigned' | number;

interface ChoreAssigneeFilterProps {
  users: User[];
  value: AssigneeFilterValue;
  onChange: (value: AssigneeFilterValue) => void;
}

const chipClasses = (selected: boolean) =>
  [
    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all',
    selected ? 'bg-gray-700 ring-4 ring-blue-500' : 'bg-gray-800 hover:bg-gray-700',
  ].join(' ');

export const ChoreAssigneeFilter: React.FC<ChoreAssigneeFilterProps> = ({
  users,
  value,
  onChange,
}) => (
  <div className="flex flex-wrap items-start gap-3" role="group" aria-label="Filter by assignee">
    <span className="self-center text-sm font-medium text-gray-300">Assignee:</span>

    <button
      type="button"
      onClick={() => onChange('all')}
      aria-pressed={value === 'all'}
      aria-label="All"
      className={chipClasses(value === 'all')}
    >
      <span
        aria-hidden="true"
        className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold"
      >
        ALL
      </span>
      <span className="text-xs text-gray-300">All</span>
    </button>

    {users.map((user) => (
      <button
        key={user.id}
        type="button"
        onClick={() => onChange(user.id)}
        aria-pressed={value === user.id}
        aria-label={user.name}
        className={chipClasses(value === user.id)}
      >
        <UserImage user={user} size="sm" />
        <span className="text-xs text-gray-300">{user.name}</span>
      </button>
    ))}

    <button
      type="button"
      onClick={() => onChange('unassigned')}
      aria-pressed={value === 'unassigned'}
      aria-label="Unassigned"
      className={chipClasses(value === 'unassigned')}
    >
      <span
        aria-hidden="true"
        className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xl"
      >
        —
      </span>
      <span className="text-xs text-gray-300">Unassigned</span>
    </button>
  </div>
);

export default ChoreAssigneeFilter;
