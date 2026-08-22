export interface AdminNavItem {
  path: string;
  label: string;
}

interface AdminNavProps {
  items: AdminNavItem[];
  pathname: string;
  onNavigate: (path: string) => void;
}

export const AdminNav = ({ items, pathname, onNavigate }: AdminNavProps) => (
  <nav className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
    {items.map(({ path, label }) => (
      <button
        key={path}
        onClick={() => onNavigate(path)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
          pathname === path
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 hover:text-white hover:bg-gray-700'
        }`}
      >
        {label}
      </button>
    ))}
  </nav>
);

export default AdminNav;
