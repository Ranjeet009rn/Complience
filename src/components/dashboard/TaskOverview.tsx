import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

type Slice = { name: string; value: number; color: string };

interface Props {
  data?: Slice[];
}

const TaskOverview: React.FC<Props> = ({ data }) => {
  const fallback: Slice[] = [
    { name: 'Completed', value: 45, color: '#10B981' },
    { name: 'In Progress', value: 30, color: '#3B82F6' },
    { name: 'Pending', value: 20, color: '#F59E0B' },
    { name: 'Overdue', value: 5, color: '#EF4444' },
  ];
  const chartData = Array.isArray(data) && data.length ? data : fallback;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Task Overview</h3>
      </div>
      <div className="p-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {chartData.map((item) => (
            <div key={item.name} className="text-center">
              <div
                className="w-3 h-3 rounded-full mx-auto mb-1"
                style={{ backgroundColor: item.color }}
              />
              <p className="text-sm font-medium text-gray-900">{item.value}%</p>
              <p className="text-xs text-gray-500">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskOverview;