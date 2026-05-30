import { useState, useEffect } from 'react'
import styles from './TitleBar.module.css'

export function TitleBar(): JSX.Element
{
  const [is_maximized, set_is_maximized] = useState(false)

  useEffect(() =>
  {
    window.electronAPI.window.is_maximized().then(set_is_maximized)
  }, [])

  return (
    <div className={`${styles.title_bar} drag-region`}>
      <div className={styles.title_left}>
        <span className={styles.logo}>🌸 MoeFocus</span>
      </div>
      <div className={styles.title_center} />
      <div className={`${styles.title_right} no-drag`}>
        <button
          className={styles.window_btn}
          onClick={() => window.electronAPI.window.minimize()}
          title="最小化"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5.5" width="10" height="1" rx="0.5" fill="currentColor" />
          </svg>
        </button>
        <button
          className={styles.window_btn}
          onClick={() => window.electronAPI.window.maximize()}
          title={is_maximized ? '还原' : '最大化'}
        >
          {is_maximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2.5" y="0.5" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0.5" y="3" width="8" height="8" rx="1" fill="var(--moe-cream)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>
        <button
          className={`${styles.window_btn} ${styles.close_btn}`}
          onClick={() => window.electronAPI.window.close()}
          title="关闭"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
