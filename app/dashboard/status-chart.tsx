"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ef4444']

export function StatusChart({ data }: { data: { name: string; value: number }[] }) {
    if (!data || data.length === 0) return <div className="text-sm text-gray-500">No data available</div>
    return (
      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: -10, right: 0, bottom: -10, left: 0 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="65%"
              cornerRadius="50%"
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={((value: number) => [`${value ?? 0} Reports`, 'Count']) as any}
              contentStyle={{ borderRadius: '8px', fontSize: '12px', padding: '4px 8px' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }