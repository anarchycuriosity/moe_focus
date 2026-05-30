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

  start(): void
  {
    this.schedule_diary()
    this.schedule_email()
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
      DiaryService.generate(today)

      // Auto commit and push if enabled
      const auto_commit = db.get('SELECT value FROM settings WHERE key = ?', ['diary.autoCommit'])
      const auto_push = db.get('SELECT value FROM settings WHERE key = ?', ['diary.autoPush'])

      if ((auto_commit as { value: string } | undefined)?.value === 'true')
      {
        await git_service.commit(`diary: auto-generate ${today}`)

        if ((auto_push as { value: string } | undefined)?.value === 'true')
        {
          await git_service.push()
        }
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

  stop(): void
  {
    if (this.diary_job) this.diary_job.stop()
    if (this.email_job) this.email_job.stop()
    console.log('Scheduler stopped.')
  }
}

export const scheduler_service = new SchedulerService()
