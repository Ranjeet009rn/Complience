import React from 'react';
import { Clock, User, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { mockAuditLogs } from '../../data/mockData';

const RecentActivity: React.FC = () => {
  const getActivityIcon = (action: string) => {
    if (action.includes('circular')) return FileText;
    if (action.includes('penalty')) return AlertTriangle;
    if (action.includes('Approved')) return CheckCircle;
    return User;
  };

  const getActivityColor = (action: string) => {
    if (action.includes('Created')) return 'text-green-600 bg-green-100';
    if (action.includes('Updated')) return 'text-blue-600 bg-blue-100';
    if (action.includes('Approved')) return 'text-purple-600 bg-purple-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {mockAuditLogs.slice(0, 6).map((log) => {
            const Icon = getActivityIcon(log.action);
            const colorClass = getActivityColor(log.action);
            
            return (
              <div key={log.id} className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {log.action}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {log.details}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;