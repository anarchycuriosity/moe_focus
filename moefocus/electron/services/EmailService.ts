// ===== Phase 5: QQ 邮箱服务 =====
// nodemailer + QQ SMTP (smtp.qq.com:465 SSL)
// send_reminder: 发送日记摘要 + 提醒完成自我反思

import nodemailer from 'nodemailer'
import { ReminderTone, select_random_reminder } from './reminder_text_library'

export interface DailyFocusProgress
{
  total_minutes: number
  goal_minutes: number
  ratio: number
}

function escape_html(value: string): string
{
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function get_reminder_tone(progress?: DailyFocusProgress): ReminderTone
{
  if (!progress || !Number.isFinite(progress.ratio)) return 'neutral'
  if (progress.ratio >= 0.8) return 'praise'
  if (progress.ratio >= 0.6) return 'neutral'
  return 'blame'
}

function format_progress_line(progress?: DailyFocusProgress): string
{
  if (!progress) return '今日完成度：暂时无法计算，先按普通提醒处理。'

  const percent = Math.round(progress.ratio * 100)
  return `今日完成度：${progress.total_minutes} / ${progress.goal_minutes} 分钟（${percent}%）`
}

export class EmailService
{
  async send(to: string, subject: string, body: string, user: string, pass: string): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const transporter = nodemailer.createTransport({
        host: 'smtp.qq.com',
        port: 465,
        secure: true,
        auth: { user, pass }
      })

      await transporter.sendMail({
        from: user,
        to,
        subject,
        html: body
      })

      return { success: true }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
    }
  }

  async send_reminder(date: string, user: string, pass: string, to: string, diary_content: string, progress?: DailyFocusProgress): Promise<{ success: boolean; error?: string }>
  {
    const reminder = select_random_reminder('diary', get_reminder_tone(progress))
    const subject = `${reminder.tone} from ${reminder.signature_name}`
    const preview_text = `${diary_content.slice(0, 1000)}${diary_content.length > 1000 ? '\n...(更多内容请在 Typora 中查看)' : ''}`
    const progress_line = format_progress_line(progress)

    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: ${reminder.accent_color}; margin-bottom: 8px;">${escape_html(reminder.title)}</h2>
        <p style="color: #8B7B89; margin-top: 0;">${escape_html(date)} · ${escape_html(progress_line)}</p>
        <p style="line-height: 1.8; color: #3F3640; font-size: 15px;">${escape_html(reminder.message)}</p>
        <p style="text-align: right; color: ${reminder.accent_color}; font-weight: 700; margin-top: 18px;">from ${escape_html(reminder.signature_name)}</p>
        <hr style="border: none; border-top: 1px solid #FFB7C5; margin: 22px 0;" />
        <p style="color: #5B4D58;">今天的日记摘要如下，写反思时可以从这里接着展开：</p>
        <pre style="white-space: pre-wrap; background: #FFF5EE; padding: 16px; border-radius: 8px; border-left: 3px solid ${reminder.accent_color}; color: #3F3640;">
${escape_html(preview_text)}
        </pre>
        <hr style="border: none; border-top: 1px solid #FFB7C5; margin: 22px 0;" />
        <p><strong>收尾建议：</strong>写下一个今天有效的做法、一个需要修正的问题，以及明天开始时的第一步。</p>
        <p style="color: #8B7B89; font-size: 12px;">
          此邮件由 MoeFocus 自动发送。如果不需要此提醒，可在设置中关闭。
        </p>
      </div>
    `

    return this.send(to, subject, body, user, pass)
  }

  async send_diary_test(date: string, user: string, pass: string, to: string, diary_content: string, progress?: DailyFocusProgress): Promise<{ success: boolean; error?: string }>
  {
    const reminder = select_random_reminder('diary', get_reminder_tone(progress))
    const subject = `${reminder.tone} from ${reminder.signature_name}`

    const body = `
      <div style="font-family: sans-serif; max-width: 760px; margin: 0 auto; padding: 20px;">
        <h2 style="color: ${reminder.accent_color}; margin-bottom: 8px;">${escape_html(reminder.title)}</h2>
        <p style="color: #5B4D58; line-height: 1.7;">
          以下内容直接来自当天日记 Markdown 文件，没有重新生成。
        </p>
        <pre style="white-space: pre-wrap; background: #FFF5EE; padding: 16px; border-radius: 8px; border-left: 3px solid #E892A3; color: #3F3640;">
${escape_html(diary_content)}
        </pre>
        <p style="color: #8B7B89; font-size: 12px;">
          此邮件由 MoeFocus 测试发送，用于确认邮箱配置和日记文件读取是否正常。
        </p>
      </div>
    `

    return this.send(to, subject, body, user, pass)
  }

  async send_blog_reminder(week_start: string, week_end: string, user: string, pass: string, to: string, stats_summary: string): Promise<{ success: boolean; error?: string }>
  {
    const reminder = select_random_reminder('blog')
    const subject = `MoeFocus - ${reminder.title} (${week_start} ~ ${week_end})`
    const preview_text = `${stats_summary.slice(0, 1500)}${stats_summary.length > 1500 ? '\n...(更多数据请在应用中查看)' : ''}`

    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: ${reminder.accent_color}; margin-bottom: 8px;">${escape_html(reminder.title)}</h2>
        <p style="line-height: 1.8; color: #3F3640; font-size: 15px;">${escape_html(reminder.message)}</p>
        <p style="text-align: right; color: ${reminder.accent_color}; font-weight: 700; margin-top: 18px;">from ${escape_html(reminder.signature_name)}</p>
        <hr style="border: none; border-top: 1px solid #C9A9DC; margin: 22px 0;" />
        <p style="color: #5B4D58;">本周专注数据如下，可以直接作为博客复盘的证据材料：</p>
        <pre style="white-space: pre-wrap; background: #F5F0FF; padding: 16px; border-radius: 8px; border-left: 3px solid ${reminder.accent_color}; color: #3F3640;">
${escape_html(preview_text)}
        </pre>
        <hr style="border: none; border-top: 1px solid #C9A9DC; margin: 22px 0;" />
        <p><strong>可以从以下角度入手：</strong></p>
        <ul>
          <li>本周在哪些任务上投入最多？有什么收获？</li>
          <li>遇到了什么困难？是如何解决的？</li>
          <li>下周的计划和目标是什么？</li>
        </ul>
        <p style="color: #8B7B89; font-size: 12px;">
          此邮件由 MoeFocus 自动发送。如果不需要此提醒，可在设置中关闭。
        </p>
      </div>
    `

    return this.send(to, subject, body, user, pass)
  }

  async test_connection(user: string, pass: string): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const transporter = nodemailer.createTransport({
        host: 'smtp.qq.com',
        port: 465,
        secure: true,
        auth: { user, pass }
      })

      await transporter.verify()
      return { success: true }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
    }
  }
}

export const email_service = new EmailService()
