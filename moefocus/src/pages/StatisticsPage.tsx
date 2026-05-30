import { StatsDashboard } from '../components/stats/StatsDashboard'
import styles from './StatisticsPage.module.css'

export function StatisticsPage(): JSX.Element
{
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>统计</h2>
      <StatsDashboard />
    </div>
  )
}
