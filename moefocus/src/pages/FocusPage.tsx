import { FocusTimer } from '../components/timer/FocusTimer'
import { SessionConfig } from '../components/timer/SessionConfig'
import styles from './FocusPage.module.css'

export function FocusPage(): JSX.Element
{
  return (
    <div className={styles.page}>
      <h2 className={styles.title}>专注模式</h2>
      <div className={styles.content}>
        <div className={styles.timer_area}>
          <FocusTimer expanded />
        </div>
        <div className={styles.config_area}>
          <SessionConfig />
        </div>
      </div>
    </div>
  )
}
