// Type declarations for MoeFocus renderer process

interface TaskInput
{
  title: string
  category?: string
  icon?: string
  color?: string
  sort_order?: number
  is_active?: number
}

interface TodoInput
{
  task_id?: number
  custom_title?: string
  date: string
  status?: string
  sort_order?: number
}

interface FocusInput
{
  todo_id?: number
  subject: string
  planned_duration_min: number
  rest_duration_sec?: number
  date: string
}

interface LongTermGoalInput
{
  title: string
  deadline?: string | null
  status?: string
  sort_order?: number
}

interface Task
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

interface TodoItem
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

interface FocusSession
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

interface LongTermGoal
{
  id: number
  uuid: string
  title: string
  deadline: string | null
  status: 'active' | 'done'
  sort_order: number
  created_at: string
  updated_at: string
}

interface DiaryEntry
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

interface WeeklyStat
{
  date: string
  total_seconds: number
}

interface MonthlyStat
{
  date: string
  week_of_month: number
  day_of_week: string
  total_seconds: number
}

interface FocusItemStat
{
  label: string
  color: string
  total_seconds: number
}

interface BreakdownRow
{
  date: string
  subject: string
  color: string
  total_seconds: number
}

interface ElectronAPI
{
  tasks: {
    get_all: () => Promise<Task[]>
    create: (task: TaskInput) => Promise<Task>
    update: (id: number, data: Partial<TaskInput>) => Promise<Task>
    remove: (id: number) => Promise<{ success: boolean }>
  }
  todos: {
    get_by_date: (date: string) => Promise<TodoItem[]>
    add: (item: TodoInput) => Promise<TodoItem>
    update: (id: number, data: Partial<TodoInput>) => Promise<TodoItem>
    remove: (id: number) => Promise<{ success: boolean }>
    reorder: (ids: number[]) => Promise<{ success: boolean }>
  }
  focus: {
    start: (session: FocusInput) => Promise<FocusSession>
    pause: (id: number, actual_sec?: number) => Promise<{ success: boolean }>
    resume: (id: number) => Promise<{ success: boolean }>
    complete: (id: number, actual_sec: number) => Promise<{ success: boolean }>
    abandon: (id: number) => Promise<{ success: boolean }>
    get_current: () => Promise<FocusSession | null>
    get_by_date: (date: string) => Promise<FocusSession[]>
    on_tick: (cb: (remaining: number) => void) => () => void
    on_session_end: (cb: () => void) => () => void
  }
  long_term_goals: {
    list: () => Promise<LongTermGoal[]>
    create: (goal: LongTermGoalInput) => Promise<LongTermGoal>
    update: (uuid: string, data: Partial<LongTermGoalInput>) => Promise<LongTermGoal>
    remove: (uuid: string) => Promise<{ success: boolean }>
  }
  diary: {
    generate: (date: string) => Promise<{ success: boolean; date: string; file_path?: string; content?: string }>
    get_by_date: (date: string) => Promise<DiaryEntry | null>
    save_reflection: (date: string, text: string) => Promise<{ success: boolean }>
    list_all: () => Promise<Array<{ date: string; file_path: string | null; mood: string | null }>>
    delete_entry: (date: string) => Promise<{ success: boolean }>
    on_auto_generated: (cb: (date: string) => void) => () => void
  }
  stats: {
    get_weekly: (week_start: string) => Promise<WeeklyStat[]>
    get_monthly: (month: string) => Promise<MonthlyStat[]>
    get_focus_items: (start_date: string, end_date: string) => Promise<FocusItemStat[]>
    get_weekly_breakdown: (week_start: string) => Promise<BreakdownRow[]>
    get_monthly_breakdown: (month: string) => Promise<BreakdownRow[]>
    sync_cleanup: () => Promise<{ success: boolean; cleaned_sessions: number; skipped?: boolean; reason?: string }>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    get_all: () => Promise<Record<string, string>>
    set: (key: string, value: unknown) => Promise<{ success: boolean }>
    on_changed: (cb: (data: { key: string; value: unknown }) => void) => () => void
  }
  git: {
    get_status: () => Promise<Record<string, unknown>>
    check_sync_status: () => Promise<{
      is_repo: boolean
      has_remote: boolean
      remote_url: string
      branch: string
      uncommitted: number
      ahead: number
      behind: number
      last_commit: string
      error: string
    }>
    commit: (message: string) => Promise<{ success: boolean; message?: string }>
    push: () => Promise<{ success: boolean; error?: string }>
    pull: () => Promise<{ success: boolean; error?: string }>
    set_remote: (url: string) => Promise<{ success: boolean; url: string }>
    validate_remote: (url: string, branch: string) => Promise<{ success: boolean; error?: string; branch_exists?: boolean }>
    get_remote: () => Promise<{ url: string }>
    init_repo: () => Promise<{ success: boolean; error?: string }>
    sync: () => Promise<{
      success: boolean
      merged_files: string[]
      new_from_remote: string[]
      new_subjects: string[]
      total_added_minutes: number
      imported_sessions?: number
      remote_sums_count?: number
      remote_data_count?: number
      diary_entries_synced?: number
      imported_goals?: number
      error?: string
    }>
  }
  email: {
    send: (to: string, subject: string, body: string) => Promise<{ success: boolean; error?: string }>
    send_reminder: (date: string) => Promise<{ success: boolean; error?: string }>
    send_test_reminder: () => Promise<{ success: boolean; error?: string }>
    send_test_blog_reminder: () => Promise<{ success: boolean; error?: string }>
    test_connection: (user: string, pass: string) => Promise<{ success: boolean; error?: string }>
  }
  scheduler: {
    trigger_diary: () => Promise<{ success: boolean; file_path?: string; error?: string }>
  }
  file: {
    open_in_typora: (file_path: string) => Promise<{ success: boolean }>
    pick_image: () => Promise<string | null>
    set_wallpaper: (file_path: string) => Promise<string>
    open_wallpapers_folder: () => Promise<{ success: boolean }>
    on_file_drop: (cb: (file_path: string) => void) => () => void
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    is_maximized: () => Promise<boolean>
  }
}

interface Window
{
  electronAPI: ElectronAPI
}
