'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BarChartProps {
  data: any[];
  bars: Array<{
    dataKey: string;
    fill: string;
    name: string;
  }>;
  height?: number;
  xAxisDataKey?: string;
  format?: (value: any) => string;
  layout?: 'vertical' | 'horizontal';
}

export function BarChart({
  data,
  bars,
  height = 300,
  xAxisDataKey = 'name',
  format,
  layout = 'vertical',
}: BarChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout={layout === 'horizontal' ? 'horizontal' : 'vertical'}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey={layout === 'horizontal' ? 'value' : xAxisDataKey}
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            type={layout === 'horizontal' ? 'number' : 'category'}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            type={layout === 'horizontal' ? 'category' : 'number'}
            tickFormatter={format}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(17 24 39)',
              border: '1px solid rgb(55 65 81)',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#e5e7eb' }}
          />
          <Legend />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              fill={bar.fill}
              name={bar.name}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}