import { Routes, Route } from 'react-router-dom'
import { TodayPage } from './pages/TodayPage'
import { FocusPage } from './pages/FocusPage'
import { DiaryPage } from './pages/DiaryPage'
import { StatisticsPage } from './pages/StatisticsPage'
import { SettingsPage } from './pages/SettingsPage'

export function AppRoutes(): JSX.Element
{
  return (
    <Routes>
      <Route path="/" element={<TodayPage />} />
      <Route path="/focus" element={<FocusPage />} />
      <Route path="/diary" element={<DiaryPage />} />
      <Route path="/diary/:date" element={<DiaryPage />} />
      <Route path="/statistics" element={<StatisticsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/:section" element={<SettingsPage />} />
    </Routes>
  )
}
