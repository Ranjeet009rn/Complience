import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PenaltyChart: React.FC = () => {
  const data = [
    { month: 'Jan', amount: 50000, count: 5 },
    { month: 'Feb', amount: 75000, count: 8 },
    { month: 'Mar', amount: 45000, count: 4 },
    { month: 'Apr', amount: 90000, count: 9 },
    { month: 'May', amount: 65000, count: 6 },
    { month: 'Jun', amount: 125000, count: 12 },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Penalty Trends</h3>
        <p className="text-sm text-gray-500">Monthly penalty amounts and frequency</p>
      </div>
      <div className="p-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'amount' ? `$${value.toLocaleString()}` : value,
                  name === 'amount' ? 'Amount' : 'Count'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#EF4444" 
                strokeWidth={2}
                dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#F59E0B" 
                strokeWidth={2}
                dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PenaltyChart;