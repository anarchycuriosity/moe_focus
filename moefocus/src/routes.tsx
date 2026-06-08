import { Routes, Route } from 'react-router-dom'
import { TodayPage } from './pages/TodayPage'
import { DiaryPage } from './pages/DiaryPage'
import { LongTermTasksPage } from './pages/LongTermTasksPage'
import { StatisticsPage } from './pages/StatisticsPage'
import { SettingsPage } from './pages/SettingsPage'

export function AppRoutes(): JSX.Element
{
  return (
    <Routes>
      <Route path="/" element={<TodayPage />} />
      <Route path="/diary" element={<DiaryPage />} />
      <Route path="/diary/:date" element={<DiaryPage />} />
      <Route path="/long-term-tasks" element={<LongTermTasksPage />} />
      <Route path="/statistics" element={<StatisticsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/:section" element={<SettingsPage />} />
    </Routes>
  )
}
