export interface Task
{
  id: number
  title: string
  category: string
  icon: string
  color: string
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
}

export interface TodoItem
{
  id: number
  task_id: number | null
  custom_title: string | null
  date: string
  status: 'pending' | 'done' | 'cancelled'
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
  task_title?: string
  task_color?: string
  task_icon?: string
}

export interface FocusSession
{
  id: number
  todo_id: number | null
  subject: string
  planned_duration_min: number
  actual_duration_sec: number
  rest_duration_sec: number
  status: 'running' | 'paused' | 'completed' | 'abandoned'
  started_at: string
  ended_at: string | null
  date: string
  task_title?: string
  custom_title?: string
}

export interface DiaryEntry
{
  id: number
  date: string
  file_path: string | null
  summary_text: string | null
  reflection_text: string | null
  mood: string | null
  git_committed: number
  git_pushed: number
  created_at: string
  updated_at: string
}

export interface Wallpaper
{
  id: number
  file_name: string
  file_path: string
  is_default: number
  is_active: number
  added_at: string
}

export interface WeeklyStat
{
  date: string
  total_seconds: number
}

export interface MonthlyStat
{
  date: string
  week_of_month: number
  day_of_week: string
  total_seconds: number
}

export interface FocusItemStat
{
  label: string
  color: string
  total_seconds: number
}

export type ChartType = 'bar' | 'circle'
export type ThemeMode = 'sakura' | 'lavender' | 'mint'
