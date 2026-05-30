import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { WeeklyChart } from './WeeklyChart'
import { MonthlyChart } from './MonthlyChart'
import { FocusBreakdown } from './FocusBreakdown'
import { MoeCard } from '../common/MoeCard'
import { MoeButton } from '../common/MoeButton'
import styles from './StatsDashboard.module.css'

type ViewMode = 'weekly' | 'monthly'
type ChartType = 'bar' | 'circle'

export function StatsDashboard(): JSX.Element
{
  const [view, set_view] = useState<ViewMode>('weekly')
  const [chart_type, set_chart_type] = useState<ChartType>('bar')

  // Calculate current week start (Monday)
  const today = dayjs()
  const week_start = today.startOf('week').add(1, 'day').format('YYYY-MM-DD')
  const current_month = today.format('YYYY-MM')

  return (
    <div className={styles.dashboard}>
      <div className={styles.controls}>
        <div className={styles.view_toggle}>
          <MoeButton
            variant={view === 'weekly' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => set_view('weekly')}
          >
            周视图
          </MoeButton>
          <MoeButton
            variant={view === 'monthly' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => set_view('monthly')}
          >
            月视图
          </MoeButton>
        </div>

        <div className={styles.chart_toggle}>
          <MoeButton
            variant={chart_type === 'bar' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => set_chart_type('bar')}
          >
            📊 柱状图
          </MoeButton>
          <MoeButton
            variant={chart_type === 'circle' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => set_chart_type('circle')}
          >
            🍩 饼图
          </MoeButton>
        </div>
      </div>

      <MoeCard className={styles.chart_card}>
        {view === 'weekly' ? (
          <WeeklyChart week_start={week_start} chart_type={chart_type} />
        ) : (
          <MonthlyChart month={current_month} chart_type={chart_type} />
        )}
      </MoeCard>

      <MoeCard className={styles.chart_card}>
        <h3 className={styles.chart_title}>专注事项分布</h3>
        <FocusBreakdown week_start={week_start} />
      </MoeCard>
    </div>
  )
}
