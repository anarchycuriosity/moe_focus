import { NavLink, useLocation } from 'react-router-dom'
import styles from './Sidebar.module.css'

interface NavItem
{
  path: string
  icon: string
  label: string
}

const nav_items: NavItem[] = [
  { path: '/', icon: '📋', label: '今日' },
  { path: '/diary', icon: '📔', label: '日记' },
  { path: '/statistics', icon: '📊', label: '统计' },
  { path: '/settings', icon: '⚙️', label: '设置' }
]

export function Sidebar(): JSX.Element
{
  const location = useLocation()

  return (
    <nav className={styles.sidebar}>
      <div className={styles.nav_items}>
        {nav_items.map((item) =>
        {
          const is_active = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`${styles.nav_item} ${is_active ? styles.active : ''}`}
            >
              <span className={styles.nav_icon}>{item.icon}</span>
              <span className={styles.nav_label}>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
      {/* No meaningless footer */}
    </nav>
  )
}
