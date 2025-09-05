import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  CheckSquare,
  Users,
  Shield,
  ClipboardList,
  Settings,
  Wrench,
  FileText,
  Archive,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/maker-checker', label: 'Maker / Checker', icon: UserCheck },
  { path: '/my-task', label: 'My Task', icon: CheckSquare },
  { path: '/manager', label: 'Manager', icon: Users },
  { path: '/admin', label: 'Admin', icon: Shield },
  { path: '/task', label: 'Task', icon: ClipboardList },
  { path: '/setup', label: 'Bank Setup', icon: Settings },
  { path: '/key-tools', label: 'Key Tools', icon: Wrench },
  { path: '/report', label: 'Report', icon: FileText },
  { path: '/circular-archive', label: 'Circular Archive', icon: Archive },
  { path: '/penalty-archive', label: 'Penalty Archive', icon: AlertTriangle },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shadow-sm h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">ComplianceHub</h2>
            <p className="text-sm text-gray-500">Regulatory Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'text-blue-600 rotate-90' : 'text-gray-300 group-hover:text-gray-500'}`} />
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">
              {user?.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;