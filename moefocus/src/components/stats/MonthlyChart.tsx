import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts'
import dayjs from 'dayjs'

interface Props
{
  month: string  // 'YYYY-MM'
  chart_type: 'bar' | 'circle'
}

const week_colors = ['#FFB7C5', '#C9A9DC', '#B5EAD7', '#C7CEEA', '#FFE5B4']

export function MonthlyChart({ month, chart_type }: Props): JSX.Element
{
  const [data, set_data] = useState<Array<{ date: string; week_of_month: number; total_seconds: number }>>([])

  useEffect(() =>
  {
    window.electronAPI.stats.get_monthly(month).then((raw) =>
    {
      set_data(raw as Array<{ date: string; week_of_month: number; total_seconds: number }>)
    })
  }, [month])

  // Group by week_of_month
  const weeks = [1, 2, 3, 4, 5]
  const grouped = weeks.map((w) =>
  {
    const week_data = data.filter((d) => d.week_of_month === w)
    const total = week_data.reduce((sum, d) => sum + d.total_seconds, 0)
    return {
      name: `第${w}周`,
      分钟: Math.floor(total / 60)
    }
  })

  if (chart_type === 'circle')
  {
    const filtered = grouped.filter((d) => d.分钟 > 0)
    return (
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={120}
            dataKey="分钟"
            nameKey="name"
            label={({ name, 分钟 }) => `${name}: ${分钟}分钟`}
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={week_colors[i % week_colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={grouped}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0E0E8" />
        <XAxis dataKey="name" tick={{ fill: '#8B7B89', fontSize: 13 }} />
        <YAxis tick={{ fill: '#8B7B89', fontSize: 12 }} unit="分钟" />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid #F0E0E8',
            background: 'rgba(255,255,255,0.95)'
          }}
        />
        <Bar dataKey="分钟" radius={[8, 8, 0, 0]} maxBarSize={50}>
          {grouped.map((_, i) => (
            <Cell key={i} fill={week_colors[i % week_colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
