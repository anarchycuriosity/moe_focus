import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import dayjs from 'dayjs'

interface Props
{
  week_start: string
  refresh_trigger?: number
}

const moe_colors = ['#FFB7C5', '#C9A9DC', '#B5EAD7', '#C7CEEA', '#FFE5B4', '#FFD1DC', '#D4C5E8', '#A8D8EA']

export function FocusBreakdown({ week_start, refresh_trigger }: Props): JSX.Element
{
  const [data, set_data] = useState<Array<{ label: string; color: string; total_seconds: number }>>([])

  useEffect(() =>
  {
    const end_date = dayjs(week_start).add(7, 'day').format('YYYY-MM-DD')
    window.electronAPI.stats.get_focus_items(week_start, end_date).then((raw) =>
    {
      set_data(raw as Array<{ label: string; color: string; total_seconds: number }>)
    })
  }, [week_start, refresh_trigger])

  if (data.length === 0)
  {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--moe-text-light)' }}>
        本周暂无专注记录
      </div>
    )
  }

  const chart_data = data.map((d) => ({
    name: d.label,
    分钟: Math.floor(d.total_seconds / 60)
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chart_data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={100}
          dataKey="分钟"
          nameKey="name"
          label={({ name, 分钟 }) => `${name}: ${分钟}分钟`}
        >
          {chart_data.map((_, i) => (
            <Cell key={i} fill={moe_colors[i % moe_colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid #F0E0E8',
            background: 'rgba(255,255,255,0.95)'
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
