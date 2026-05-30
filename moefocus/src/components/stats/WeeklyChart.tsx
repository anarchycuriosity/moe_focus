import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts'
import dayjs from 'dayjs'

interface Props
{
  week_start: string
  chart_type: 'bar' | 'circle'
}

const day_labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const moe_colors = ['#FFB7C5', '#C9A9DC', '#B5EAD7', '#C7CEEA', '#FFE5B4', '#FFD1DC', '#D4C5E8']

export function WeeklyChart({ week_start, chart_type }: Props): JSX.Element
{
  const [data, set_data] = useState<Array<{ date: string; total_seconds: number }>>([])

  useEffect(() =>
  {
    window.electronAPI.stats.get_weekly(week_start).then((raw) =>
    {
      // Create 7-day array
      const start = dayjs(week_start)
      const result = Array.from({ length: 7 }, (_, i) =>
      {
        const date = start.add(i, 'day').format('YYYY-MM-DD')
        const found = (raw as Array<{ date: string; total_seconds: number }>).find((r) => r.date === date)
        return {
          date,
          total_seconds: found ? found.total_seconds : 0
        }
      })
      set_data(result)
    })
  }, [week_start])

  const chart_data = data.map((d, i) => ({
    name: day_labels[i],
    分钟: Math.floor(d.total_seconds / 60)
  }))

  if (chart_type === 'circle')
  {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie
            data={chart_data.filter((d) => d.分钟 > 0)}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={120}
            dataKey="分钟"
            nameKey="name"
            label={({ name, 分钟 }) => `${name}: ${分钟}分钟`}
          >
            {chart_data.filter((d) => d.分钟 > 0).map((_, i) => (
              <Cell key={i} fill={moe_colors[i % moe_colors.length]} />
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
      <BarChart data={chart_data}>
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
          {chart_data.map((_, i) => (
            <Cell key={i} fill={moe_colors[i % moe_colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
