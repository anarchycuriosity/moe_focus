import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'
import dayjs from 'dayjs'

interface Props
{
  month: string  // 'YYYY-MM'
  chart_type: 'bar' | 'circle'
}

interface BreakdownRow
{
  date: string
  subject: string
  color: string
  total_seconds: number
}

const fallback_colors = ['#FFB7C5', '#C9A9DC', '#B5EAD7', '#C7CEEA', '#FFE5B4', '#FFD1DC', '#D4C5E8', '#A8D8EA', '#FF9999', '#99CCFF']

export function MonthlyChart({ month, chart_type }: Props): JSX.Element
{
  const [raw_data, set_raw_data] = useState<BreakdownRow[]>([])

  useEffect(() =>
  {
    window.electronAPI.stats.get_monthly_breakdown(month).then((raw) =>
    {
      set_raw_data(raw as BreakdownRow[])
    })
  }, [month])

  // Group data by week of month, merge same subject names
  const weeks: Record<number, Record<string, number>> = {}
  const subject_colors = new Map<string, string>()

  for (const row of raw_data)
  {
    if (row.subject === '专注') continue
    const d = dayjs(row.date)
    // Calculate week of month (1-based)
    const dom = d.date()
    const week = Math.ceil(dom / 7)

    if (!weeks[week])
    {
      weeks[week] = {}
    }
    // Merge same subject names (key requirement)
    weeks[week][row.subject] = (weeks[week][row.subject] || 0) + row.total_seconds

    if (!subject_colors.has(row.subject))
    {
      subject_colors.set(row.subject, row.color || fallback_colors[subject_colors.size % fallback_colors.length])
    }
  }

  const subjects = Array.from(subject_colors.keys())

  // Build chart data for weeks 1-5
  const chart_data = [1, 2, 3, 4, 5].map((w) =>
  {
    const entry: Record<string, string | number> = { name: `第${w}周` }
    for (const subj of subjects)
    {
      entry[subj] = Math.floor(((weeks[w] && weeks[w][subj]) || 0) / 60)
    }
    return entry
  })

  const has_data = raw_data.length > 0

  if (!has_data)
  {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--moe-text-light)' }}>
        本月暂无专注记录
      </div>
    )
  }

  if (chart_type === 'circle')
  {
    // Aggregate all subjects across the month for summary view
    const agg: Record<string, number> = {}
    for (const row of raw_data)
    {
      agg[row.subject] = (agg[row.subject] || 0) + row.total_seconds
    }
    const pie_data = Object.entries(agg)
      .map(([name, sec]) => ({ name, 分钟: Math.floor(sec / 60) }))
      .sort((a, b) => b.分钟 - a.分钟)

    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={pie_data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#F0E0E8" />
          <XAxis type="number" tick={{ fill: '#8B7B89', fontSize: 12 }} unit="分钟" />
          <YAxis type="category" dataKey="name" tick={{ fill: '#8B7B89', fontSize: 13 }} width={100} />
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #F0E0E8',
              background: 'rgba(255,255,255,0.95)'
            }}
          />
          <Bar dataKey="分钟" radius={[0, 8, 8, 0]} maxBarSize={30}>
            {pie_data.map((_, i) => (
              <Cell key={i} fill={subject_colors.get(pie_data[i].name) || fallback_colors[i % fallback_colors.length]} />
            ))}
          </Bar>
        </BarChart>
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
        <Legend />
        {subjects.map((subj) => (
          <Bar
            key={subj}
            dataKey={subj}
            stackId="month"
            fill={subject_colors.get(subj)}
            maxBarSize={50}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
