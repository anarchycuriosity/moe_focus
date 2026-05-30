import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'
import dayjs from 'dayjs'

interface Props
{
  week_start: string
  chart_type: 'bar' | 'circle'
}

interface BreakdownRow
{
  date: string
  subject: string
  color: string
  total_seconds: number
}

const day_labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const fallback_colors = ['#FFB7C5', '#C9A9DC', '#B5EAD7', '#C7CEEA', '#FFE5B4', '#FFD1DC', '#D4C5E8', '#A8D8EA', '#FF9999', '#99CCFF']

export function WeeklyChart({ week_start, chart_type }: Props): JSX.Element
{
  const [raw_data, set_raw_data] = useState<BreakdownRow[]>([])

  useEffect(() =>
  {
    window.electronAPI.stats.get_weekly_breakdown(week_start).then((raw) =>
    {
      set_raw_data(raw as BreakdownRow[])
    })
  }, [week_start])

  // Build a set of all unique subjects and assign colors (skip default "专注")
  const subject_set = new Map<string, string>() // subject → color
  for (const row of raw_data)
  {
    if (row.subject === '专注') continue
    if (!subject_set.has(row.subject))
    {
      subject_set.set(row.subject, row.color || fallback_colors[subject_set.size % fallback_colors.length])
    }
  }
  const subjects = Array.from(subject_set.keys())

  // Build chart data: one entry per day, each subject as a key
  const chart_data = Array.from({ length: 7 }, (_, i) =>
  {
    const date = dayjs(week_start).add(i, 'day').format('YYYY-MM-DD')
    const entry: Record<string, string | number> = { name: day_labels[i] }
    for (const subj of subjects)
    {
      entry[subj] = 0
    }
    // Fill in actual data
    for (const row of raw_data)
    {
      if (row.date === date)
      {
        entry[row.subject] = Math.floor(row.total_seconds / 60)
      }
    }
    return entry
  })

  if (chart_type === 'circle')
  {
    // Simple breakdown for pie chart still works
    const pie_data = subjects.map((subj) =>
    {
      const total = raw_data
        .filter((r) => r.subject === subj)
        .reduce((sum, r) => sum + r.total_seconds, 0)
      return { name: subj, 分钟: Math.floor(total / 60) }
    }).filter((d) => d.分钟 > 0)

    if (pie_data.length === 0)
    {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--moe-text-light)' }}>
          本周暂无专注记录
        </div>
      )
    }

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
              <Cell key={i} fill={subject_set.get(pie_data[i].name) || fallback_colors[i % fallback_colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Bar chart: stacked bars
  const total_per_day = chart_data.map((d) =>
  {
    let sum = 0
    for (const subj of subjects)
    {
      sum += (d[subj] as number) || 0
    }
    return sum
  })
  const has_data = total_per_day.some((v) => v > 0)

  if (!has_data)
  {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--moe-text-light)' }}>
        本周暂无专注记录
      </div>
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
            stackId="week"
            fill={subject_set.get(subj)}
            radius={[0, 0, 0, 0]}
            maxBarSize={50}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
