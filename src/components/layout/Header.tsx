import React from 'react';
import { Bell, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationsContext';
import SearchTool from '../search/SearchTool';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <SearchTool />
        </div>

        <div className="flex items-center space-x-4 relative">
          <button
            className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setOpen((v) => !v)}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[10px] bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-md shadow-lg z-50">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-800">Notifications</span>
                <div className="flex items-center gap-2">
                  <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">Mark all read</button>
                  <button onClick={clearAll} className="text-xs text-gray-500 hover:underline">Clear</button>
                </div>
              </div>
              <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {notifications.length === 0 && (
                  <li className="p-3 text-sm text-gray-500">No notifications</li>
                )}
                {notifications.map((n) => (
                  <li key={n.id} className={`p-3 ${n.read ? 'bg-white' : 'bg-indigo-50'}`}>
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <Link to="/settings" className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Settings">
            <Settings className="w-5 h-5" />
          </Link>

          <div className="h-6 w-px bg-gray-300"></div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;