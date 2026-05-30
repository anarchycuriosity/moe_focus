import { type ReactNode } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import styles from './MainLayout.module.css'

interface Props
{
  children: ReactNode
}

export function MainLayout({ children }: Props): JSX.Element
{
  return (
    <div className={styles.layout}>
      <TitleBar />
      <Sidebar />
      <main className={styles.content}>
        {children}
      </main>
    </div>
  )
}
