import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'
import dayjs from 'dayjs'
import { get_subject_color } from '../../styles/chartColors'

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
      subject_colors.set(row.subject, get_subject_color(row.subject, row.color))
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--moe-border)" />
          <XAxis type="number" tick={{ fill: 'var(--moe-text-light)', fontSize: 12 }} unit="分钟" />
          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--moe-text-light)', fontSize: 13 }} width={100} />
          <Tooltip
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid var(--moe-border)',
              background: 'var(--moe-glass-hover)'
            }}
          />
          <Bar dataKey="分钟" radius={[0, 8, 8, 0]} maxBarSize={30}>
            {pie_data.map((_, i) => (
              <Cell key={i} fill={subject_colors.get(pie_data[i].name) || get_subject_color(pie_data[i].name)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chart_data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--moe-border)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--moe-text-light)', fontSize: 13 }} />
        <YAxis tick={{ fill: 'var(--moe-text-light)', fontSize: 12 }} unit="分钟" />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid var(--moe-border)',
            background: 'var(--moe-glass-hover)'
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
