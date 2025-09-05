nimport React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo';
  format?: 'number' | 'currency';
}

const colorClasses = {
  blue: 'bg-blue-500 text-blue-700 bg-blue-50 border-blue-200',
  green: 'bg-green-500 text-green-700 bg-green-50 border-green-200',
  red: 'bg-red-500 text-red-700 bg-red-50 border-red-200',
  yellow: 'bg-amber-500 text-amber-700 bg-amber-50 border-amber-200',
  purple: 'bg-purple-500 text-purple-700 bg-purple-50 border-purple-200',
  indigo: 'bg-indigo-500 text-indigo-700 bg-indigo-50 border-indigo-200',
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  color,
  format = 'number',
}) => {
  const colorClass = colorClasses[color].split(' ');
  const iconBg = colorClass[0];
  const cardBg = colorClass[2];
  const borderColor = colorClass[3];

  const formatValue = (val: number | string) => {
    if (format === 'currency' && typeof val === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(val);
    }
    return val.toLocaleString();
  };

  return (
    <div className={`${cardBg} border ${borderColor} rounded-xl p-6 transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">
            {formatValue(value)}
          </p>
          {change && (
            <div className="flex items-center space-x-1">
              <span
                className={`text-xs font-medium ${
                  change.type === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {change.type === 'increase' ? '+' : '-'}{Math.abs(change.value)}%
              </span>
              <span className="text-xs text-gray-500">from last month</span>
            </div>
          )}
        </div>
        <div className={`${iconBg} w-12 h-12 rounded-lg flex items-center justify-center ml-4`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default MetricCard;