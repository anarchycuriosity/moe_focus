// ===== Phase 5: 定时任务调度 =====
// node-cron 驱动定时任务:
//   1. diary_job: 每日自动生成日记 + Typora 打开 + git sync
//   2. email_job: 定时发送 QQ 邮箱日记提醒 + 自动打开 Typora
//   3. blog_job: 每周发送博客写作提醒

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
    console.log('[Scheduler] started — diary:', this.get_time_setting('diary.autoGenerateTime', '23:00'),
                '| email:', this.get_time_setting('email.reminderTime', '22:30'),
                '| blog:', this.get_time_setting('email.blogReminderTime', '10:00'),
                'day', this.get_setting('email.blogReminderDay', '0'))
  }

  restart(): void
  {
    console.log('[Scheduler] restarting...')
    this.stop()
    this.start()
  }

  // 手动触发日记生成（供测试用）
  trigger_diary_now(): { success: boolean; file_path?: string; error?: string }
  {
    try
    {
      const today = dayjs().format('YYYY-MM-DD')
      console.log('[Scheduler] MANUAL TRIGGER: diary generation for', today)

      const diary_result = DiaryService.generate(today)
      console.log('[Scheduler] diary generated:', diary_result.file_path)

      if (diary_result.file_path)
      {
        TyporaService.open(diary_result.file_path)
        console.log('[Scheduler] Typora opened')
      }

      return { success: true, file_path: diary_result.file_path }
    }
    catch (e: any)
    {
      console.error('[Scheduler] diary trigger failed:', e)
      return { success: false, error: String(e) }
    }
  }

  // 手动触发日记提醒邮件（供测试用）
  async trigger_email_now(): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const db = DatabaseService.instance
      const qq_user = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
      const qq_pass = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])

      if (!qq_user || !qq_pass)
      {
        return { success: false, error: 'QQ邮箱未配置' }
      }

      const today = dayjs().format('YYYY-MM-DD')
      console.log('[Scheduler] MANUAL TRIGGER: email reminder for', today)

      const user = (qq_user as { value: string }).value
      const pass = (qq_pass as { value: string }).value
      const diary = db.get('SELECT summary_text FROM diary_entries WHERE date = ?', [today])
      const diary_content = (diary as { summary_text: string } | undefined)?.summary_text || '(今日日记尚未生成)'

      const result = await email_service.send_reminder(today, user, pass, user, diary_content)
      console.log('[Scheduler] email result:', result)

      if (result.success)
      {
        const entry = db.get('SELECT file_path FROM diary_entries WHERE date = ?', [today])
        if (entry)
        {
          TyporaService.open((entry as { file_path: string }).file_path)
        }
      }

      return result
    }
    catch (e: any)
    {
      console.error('[Scheduler] email trigger failed:', e)
      return { success: false, error: String(e) }
    }
  }

  // 手动触发博客提醒邮件（供测试用）
  async trigger_blog_now(): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const db = DatabaseService.instance
      const qq_user = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
      const qq_pass = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])

      if (!qq_user || !qq_pass)
      {
        return { success: false, error: 'QQ邮箱未配置' }
      }

      const user = (qq_user as { value: string }).value
      const pass = (qq_pass as { value: string }).value
      const week_end = dayjs().format('YYYY-MM-DD')
      const week_start = dayjs().subtract(7, 'day').format('YYYY-MM-DD')

      console.log('[Scheduler] MANUAL TRIGGER: blog reminder for', week_start, '~', week_end)

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

      const result = await email_service.send_blog_reminder(week_start, week_end, user, pass, user, stats_summary)
      console.log('[Scheduler] blog email result:', result)
      return result
    }
    catch (e: any)
    {
      console.error('[Scheduler] blog trigger failed:', e)
      return { success: false, error: String(e) }
    }
  }

  stop(): void
  {
    if (this.diary_job) { this.diary_job.stop(); this.diary_job = null }
    if (this.email_job) { this.email_job.stop(); this.email_job = null }
    if (this.blog_job) { this.blog_job.stop(); this.blog_job = null }
    console.log('[Scheduler] stopped.')
  }

  // ========== 内部方法 ==========

  private get_setting(key: string, default_val: string): string
  {
    const db = DatabaseService.instance
    const row = db.get('SELECT value FROM settings WHERE key = ?', [key])
    return (row as { value: string } | undefined)?.value || default_val
  }

  private get_time_setting(key: string, default_val: string): string
  {
    return this.get_setting(key, default_val)
  }

  private schedule_diary(): void
  {
    const time = this.get_time_setting('diary.autoGenerateTime', '23:00')
    const [hour, minute] = time.split(':').map(Number)
    const cron_expr = `${minute} ${hour} * * *`

    this.diary_job = cron.schedule(cron_expr, () =>
    {
      const today = dayjs().format('YYYY-MM-DD')
      console.log('[Scheduler] CRON FIRED: diary generation for', today)

      try
      {
        const diary_result = DiaryService.generate(today)
        console.log('[Scheduler] diary generated:', diary_result.file_path)

        if (diary_result.file_path)
        {
          TyporaService.open(diary_result.file_path)
          console.log('[Scheduler] Typora opened')
        }
      }
      catch (e: any)
      {
        console.error('[Scheduler] diary generation error:', e.message || e)
      }
    })

    console.log(`[Scheduler] diary cron scheduled: ${cron_expr}`)
  }

  private schedule_email(): void
  {
    const time = this.get_time_setting('email.reminderTime', '22:30')
    const [hour, minute] = time.split(':').map(Number)
    const cron_expr = `${minute} ${hour} * * *`

    this.email_job = cron.schedule(cron_expr, async () =>
    {
      console.log('[Scheduler] CRON FIRED: email reminder')

      try
      {
        const db = DatabaseService.instance
        const enabled = db.get('SELECT value FROM settings WHERE key = ?', ['email.reminderEnabled'])
        if ((enabled as { value: string } | undefined)?.value !== 'true')
        {
          console.log('[Scheduler] email reminder disabled, skipping')
          return
        }

        const today = dayjs().format('YYYY-MM-DD')
        const qq_user = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
        const qq_pass = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])

        if (!qq_user || !qq_pass)
        {
          console.log('[Scheduler] email not configured, skipping')
          return
        }

        const user = (qq_user as { value: string }).value
        const pass = (qq_pass as { value: string }).value
        const diary = db.get('SELECT summary_text FROM diary_entries WHERE date = ?', [today])
        const diary_content = (diary as { summary_text: string } | undefined)?.summary_text || '(日记尚未生成)'

        const result = await email_service.send_reminder(today, user, pass, user, diary_content)
        console.log('[Scheduler] email send result:', result)

        // Auto-open Typora
        const diary_entry = db.get('SELECT file_path FROM diary_entries WHERE date = ?', [today])
        if (diary_entry)
        {
          TyporaService.open((diary_entry as { file_path: string }).file_path)
        }
      }
      catch (e: any)
      {
        console.error('[Scheduler] email reminder error:', e.message || e)
      }
    })

    console.log(`[Scheduler] email cron scheduled: ${cron_expr}`)
  }

  private schedule_blog_reminder(): void
  {
    const enabled = this.get_setting('email.blogReminderEnabled', 'true')
    if (enabled !== 'true')
    {
      console.log('[Scheduler] blog reminder disabled, skipping')
      return
    }

    const time = this.get_time_setting('email.blogReminderTime', '10:00')
    const [hour, minute] = time.split(':').map(Number)
    const day_of_week = this.get_setting('email.blogReminderDay', '0')
    const cron_expr = `${minute} ${hour} * * ${day_of_week}`

    this.blog_job = cron.schedule(cron_expr, async () =>
    {
      console.log('[Scheduler] CRON FIRED: blog reminder')

      try
      {
        const db = DatabaseService.instance
        const blog_enabled = db.get('SELECT value FROM settings WHERE key = ?', ['email.blogReminderEnabled'])
        if ((blog_enabled as { value: string } | undefined)?.value !== 'true') return

        const qq_user = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqUser'])
        const qq_pass = db.get('SELECT value FROM settings WHERE key = ?', ['email.qqPass'])
        if (!qq_user || !qq_pass) return

        const user = (qq_user as { value: string }).value
        const pass = (qq_pass as { value: string }).value
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

        const result = await email_service.send_blog_reminder(week_start, week_end, user, pass, user, stats_summary)
        console.log('[Scheduler] blog email result:', result)
      }
      catch (e: any)
      {
        console.error('[Scheduler] blog reminder error:', e.message || e)
      }
    })

    console.log(`[Scheduler] blog cron scheduled: ${cron_expr}`)
  }
}

export const scheduler_service = new SchedulerService()
