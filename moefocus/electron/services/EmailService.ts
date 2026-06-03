// ===== Phase 5: QQ 邮箱服务 =====
// nodemailer + QQ SMTP (smtp.qq.com:465 SSL)
// send_reminder: 发送日记摘要 + 提醒完成自我反思

import nodemailer from 'nodemailer'

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

  async send_reminder(date: string, user: string, pass: string, to: string, diary_content: string): Promise<{ success: boolean; error?: string }>
  {
    const subject = `🌸 MoeFocus - 日记反思提醒 (${date})`

    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #E892A3;">🌸 MoeFocus 日记提醒</h2>
        <p>你今天的日记已自动生成。以下是专注数据摘要：</p>
        <hr style="border-color: #FFB7C5;" />
        <pre style="background: #FFF5EE; padding: 16px; border-radius: 8px; border-left: 3px solid #FFB7C5;">
${diary_content.slice(0, 1000)}${diary_content.length > 1000 ? '\n...(更多内容请在 Typora 中查看)' : ''}
        </pre>
        <hr style="border-color: #FFB7C5;" />
        <p>💭 <strong>别忘了完成今天的自我反思部分！</strong></p>
        <p style="color: #8B7B89; font-size: 12px;">
          此邮件由 MoeFocus 自动发送。如果不需要此提醒，可在设置中关闭。
        </p>
      </div>
    `

    return this.send(to, subject, body, user, pass)
  }

  async send_blog_reminder(week_start: string, week_end: string, user: string, pass: string, to: string, stats_summary: string): Promise<{ success: boolean; error?: string }>
  {
    const subject = `🌸 MoeFocus - 每周博客写作提醒 (${week_start} ~ ${week_end})`

    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #C9A9DC;">✍️ MoeFocus 每周博客提醒</h2>
        <p>又过了一周！以下是本周的专注数据摘要，是时候写一篇博客回顾了：</p>
        <hr style="border-color: #C9A9DC;" />
        <pre style="background: #F5F0FF; padding: 16px; border-radius: 8px; border-left: 3px solid #C9A9DC;">
${stats_summary.slice(0, 1500)}${stats_summary.length > 1500 ? '\n...(更多数据请在应用中查看)' : ''}
        </pre>
        <hr style="border-color: #C9A9DC;" />
        <p>📝 <strong>基于本周的专注数据，写一篇博客总结吧！</strong></p>
        <p>可以从以下角度入手：</p>
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
