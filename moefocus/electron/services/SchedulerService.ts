// ===== Phase 5: 定时任务调度 =====
// node-cron 驱动两个定时任务:
//   1. diary_job: 每日自动生成日记 + git commit/push
//   2. email_job: 定时发送 QQ 邮箱提醒 + 自动打开 Typora

import cron from 'node-cron'
import { DatabaseService } from './DatabaseService'
import { DiaryService } from './DiaryService'
import { git_service } from './GitService'
import { email_service } from './EmailService'
import { TyporaService } from './TyporaService'
import dayjs from 'dayjs'

export class SchedulerService
{
  private diary_job: cron.ScheduledTask | null = null
  private email_job: cron.ScheduledTask | null = null
  private blog_job: cron.ScheduledTask | null = null

  start(): void
  {
    this.schedule_diary()
    this.schedule_email()
    this.schedule_blog_reminder()
    console.log('Scheduler started.')
  }

  private schedule_diary(): void
  {
    const db = DatabaseService.instance
    const time_str = db.get('SELECT value FROM settings WHERE key = ?', ['diary.autoGenerateTime'])
    const time = (time_str as { value: string } | undefined)?.value || '23:00'
    const [hour, minute] = time.split(':').map(Number)

    const cron_expr = `${minute} ${hour} * * *`

    this.diary_job = cron.schedule(cron_expr, async () =>
    {
      const today = dayjs().format('YYYY-MM-DD')
      console.log('Auto-generating diary for:', today)

      // Generate diary
      const diary_result = DiaryService.generate(today)

      // Auto-open Typora for writing
      if (diary_result.file_path)
      {
        TyporaService.open(diary_result.file_path)
      }

      // Auto sync if enabled (fetch + merge + commit + push)
      const auto_commit = db.get('SELECT value FROM settings WHERE key = ?', ['diary.autoCommit'])

      if ((auto_commit as { value: string } | undefined)?.value === 'true')
      {
        await git_service.sync()
      }

      console.log('Diary auto-generation complete.')
    })

    console.log(`Diary cron scheduled at ${cron_expr}`)
  }

  private schedule_email(): void
  {
    const db = DatabaseService.instance
    const time_str = db.get('SELECT value FROM settings WHERE key = ?', ['email.reminderTime'])
    const time = (time_str as { value: string } | undefined)?.value || '22:30'
    const [hour, minute] = time.split(':').map(Number)

    const cron_expr = `${minute} ${hour} * * *`

    this.email_job = cron.schedule(cron_expr, async () =>
    {
      const enabled = db.get('SELECT value FROM settings WHERE key = ?', ['email.reminderEnabled'])
      if ((enabled as { value: string } | undefined)?.value !== 'true') return

      const today = dayjs().format('YYYY-MM-DD')
      console.log('Sending reminder email for:', today)

      const qq_user = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
      const qq_pass = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])

      if (!qq_user || !qq_pass) return

      const user = (qq_user as { value: string }).value
      const pass = (qq_pass as { value: string }).value

      // Get diary content
      const diary = db.get('SELECT summary_text FROM diary_entries WHERE date = ?', [today])

      await email_service.send_reminder(
        today,
        user,
        pass,
        user,
        (diary as { summary_text: string } | undefined)?.summary_text || '(日记尚未生成)'
      )

      // Auto-open Typora
      const diary_entry = db.get('SELECT file_path FROM diary_entries WHERE date = ?', [today])
      if (diary_entry)
      {
        TyporaService.open((diary_entry as { file_path: string }).file_path)
      }
    })

    console.log(`Email cron scheduled at ${cron_expr}`)
  }

  private schedule_blog_reminder(): void
  {
    const db = DatabaseService.instance
    const enabled_str = db.get('SELECT value FROM settings WHERE key = ?', ['email.blogReminderEnabled'])
    if ((enabled_str as { value: string } | undefined)?.value !== 'true') return

    const time_str = db.get('SELECT value FROM settings WHERE key = ?', ['email.blogReminderTime'])
    const time = (time_str as { value: string } | undefined)?.value || '10:00'
    const [hour, minute] = time.split(':').map(Number)

    const day_str = db.get('SELECT value FROM settings WHERE key = ?', ['email.blogReminderDay'])
    const day_of_week = (day_str as { value: string } | undefined)?.value || '0' // 0=Sunday

    const cron_expr = `${minute} ${hour} * * ${day_of_week}`

    this.blog_job = cron.schedule(cron_expr, async () =>
    {
      const enabled = db.get('SELECT value FROM settings WHERE key = ?', ['email.blogReminderEnabled'])
      if ((enabled as { value: string } | undefined)?.value !== 'true') return

      const qq_user = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
      const qq_pass = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])
      if (!qq_user || !qq_pass) return

      const user = (qq_user as { value: string }).value
      const pass = (qq_pass as { value: string }).value

      // Build weekly stats summary
      const week_end = dayjs().format('YYYY-MM-DD')
      const week_start = dayjs().subtract(7, 'day').format('YYYY-MM-DD')

      const sessions = db.all(
        `SELECT date, subject, SUM(actual_duration_sec) as total_sec
         FROM focus_sessions
         WHERE date >= ? AND date < ? AND status = 'completed'
         GROUP BY date, subject
         ORDER BY date, total_sec DESC`,
        [week_start, week_end]
      ) as Array<{ date: string; subject: string; total_sec: number }>

      let stats_summary = `📊 本周专注统计 (${week_start} ~ ${week_end})\n\n`
      if (sessions.length === 0)
      {
        stats_summary += '本周暂无专注记录。\n'
      }
      else
      {
        const by_date = new Map<string, Array<{ subject: string; total_sec: number }>>()
        for (const s of sessions)
        {
          if (!by_date.has(s.date)) by_date.set(s.date, [])
          by_date.get(s.date)!.push(s)
        }
        for (const [date, items] of by_date)
        {
          const daily_total = items.reduce((sum, i) => sum + i.total_sec, 0)
          stats_summary += `\n${date} (共 ${Math.round(daily_total / 60)} 分钟):\n`
          for (const item of items)
          {
            stats_summary += `  - ${item.subject}: ${Math.round(item.total_sec / 60)} 分钟\n`
          }
        }
      }

      console.log('Sending weekly blog reminder for:', week_start, '~', week_end)
      await email_service.send_blog_reminder(week_start, week_end, user, pass, user, stats_summary)
    })

    console.log(`Blog reminder cron scheduled at ${cron_expr}`)
  }

  stop(): void
  {
    if (this.diary_job) this.diary_job.stop()
    if (this.email_job) this.email_job.stop()
    if (this.blog_job) this.blog_job.stop()
    console.log('Scheduler stopped.')
  }
}

export const scheduler_service = new SchedulerService()
