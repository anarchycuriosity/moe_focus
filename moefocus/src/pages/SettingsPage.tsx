// ===== Phase 8: 完整设置页面 =====
// 四个标签页: 通用(主题/壁纸/Typora/日记) | 计时默认值
//             邮箱(QQ SMTP/测试连接) | GitHub(远程仓库/状态检查)

import { useState, useEffect } from 'react'
import { MoeCard } from '../components/common/MoeCard'
import { MoeInput } from '../components/common/MoeInput'
import { MoeButton } from '../components/common/MoeButton'
import styles from './SettingsPage.module.css'

interface SettingsState
{
  'focus.defaultDuration': string
  'focus.defaultRestDuration': string
  'diary.autoGenerateTime': string
  'diary.autoCommit': string
  'diary.autoPush': string
  'email.qqUser': string
  'email.qqPass': string
  'email.reminderTime': string
  'email.reminderEnabled': string
  'github.remoteUrl': string
  'github.branch': string
  'ui.theme': string
  'ui.chartType': string
  'ui.photoFrameEnabled': string
  'typora.path': string
  [key: string]: string
}

type TabKey = 'general' | 'github' | 'email' | 'timer'

export function SettingsPage(): JSX.Element
{
  const [active_tab, set_active_tab] = useState<TabKey>('general')
  const [settings, set_settings] = useState<SettingsState>({} as SettingsState)
  const [loading, set_loading] = useState(true)
  const [save_msg, set_save_msg] = useState('')
  const [email_test_msg, set_email_test_msg] = useState('')
  const [git_status, set_git_status] = useState('')

  useEffect(() =>
  {
    window.electronAPI.settings.get_all().then((all) =>
    {
      set_settings(all as unknown as SettingsState)
      set_loading(false)
    })
  }, [])

  const update = async (key: string, value: string) =>
  {
    const new_settings = { ...settings, [key]: value }
    set_settings(new_settings)
    await window.electronAPI.settings.set(key, value)
    set_save_msg('已保存')
    setTimeout(() => set_save_msg(''), 2000)
  }

  const handle_test_email = async () =>
  {
    if (!settings['email.qqUser'] || !settings['email.qqPass'])
    {
      set_email_test_msg('请先填写QQ邮箱和授权码')
      return
    }
    set_email_test_msg('测试中...')
    const result = await window.electronAPI.email.test_connection(
      settings['email.qqUser'],
      settings['email.qqPass']
    )
    set_email_test_msg(result.success ? '连接成功!' : `连接失败: ${result.error}`)
  }

  const handle_test_git = async () =>
  {
    const result = await window.electronAPI.git.get_status()
    set_git_status(JSON.stringify(result, null, 2))
  }

  const handle_pick_typora = async () =>
  {
    const path = await window.electronAPI.file.pick_image()
    // Note: pick_image is for images, but we can reuse the dialog pattern
    // For Typora, user types the path manually
  }

  const handle_pick_wallpaper = async () =>
  {
    const path = await window.electronAPI.file.pick_image()
    if (path)
    {
      const dest_path = await window.electronAPI.file.set_wallpaper(path)
      await update('ui.active_wallpaper', dest_path)
      set_save_msg('壁纸已更新!')
    }
  }

  if (loading) return <div className={styles.page}><p>加载中...</p></div>

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'general', label: '通用', icon: '⚙️' },
    { key: 'timer', label: '计时', icon: '⏱️' },
    { key: 'email', label: '邮箱', icon: '📧' },
    { key: 'github', label: 'GitHub', icon: '🔗' }
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>设置</h2>
        {save_msg && <span className={styles.save_msg}>{save_msg}</span>}
      </div>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${active_tab === tab.key ? styles.active_tab : ''}`}
            onClick={() => set_active_tab(tab.key)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <MoeCard className={styles.content}>
        {/* General Settings */}
        {active_tab === 'general' && (
          <div className={styles.section}>
            <h3>外观与界面</h3>
            <div className={styles.field}>
              <label>主题</label>
              <select
                value={settings['ui.theme'] || 'sakura'}
                onChange={(e) => update('ui.theme', e.target.value)}
                className={styles.select}
              >
                <option value="sakura">🌸 樱花粉</option>
                <option value="lavender">💜 薰衣草紫</option>
                <option value="mint">💚 薄荷绿</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>默认图表类型</label>
              <select
                value={settings['ui.chartType'] || 'bar'}
                onChange={(e) => update('ui.chartType', e.target.value)}
                className={styles.select}
              >
                <option value="bar">📊 柱状图</option>
                <option value="circle">🍩 饼图</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>相框显示</label>
              <select
                value={settings['ui.photoFrameEnabled'] || 'true'}
                onChange={(e) => update('ui.photoFrameEnabled', e.target.value)}
                className={styles.select}
              >
                <option value="true">显示</option>
                <option value="false">隐藏</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>自定义壁纸</label>
              <MoeButton variant="secondary" size="sm" onClick={handle_pick_wallpaper}>
                选择图片...
              </MoeButton>
            </div>

            <h3 style={{ marginTop: '24px' }}>Typora 路径</h3>
            <MoeInput
              label="Typora 可执行文件路径"
              placeholder="C:\Program Files\Typora\Typora.exe"
              value={settings['typora.path'] || ''}
              onChange={(e) => update('typora.path', e.target.value)}
            />

            <h3 style={{ marginTop: '24px' }}>日记设置</h3>
            <div className={styles.field}>
              <label>自动生成时间</label>
              <input
                type="time"
                value={settings['diary.autoGenerateTime'] || '23:00'}
                onChange={(e) => update('diary.autoGenerateTime', e.target.value)}
                className={styles.time_input}
              />
            </div>
            <div className={styles.field}>
              <label>自动 Git Commit</label>
              <select
                value={settings['diary.autoCommit'] || 'true'}
                onChange={(e) => update('diary.autoCommit', e.target.value)}
                className={styles.select}
              >
                <option value="true">启用</option>
                <option value="false">禁用</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>自动 Git Push</label>
              <select
                value={settings['diary.autoPush'] || 'true'}
                onChange={(e) => update('diary.autoPush', e.target.value)}
                className={styles.select}
              >
                <option value="true">启用</option>
                <option value="false">禁用</option>
              </select>
            </div>
          </div>
        )}

        {/* Timer Settings */}
        {active_tab === 'timer' && (
          <div className={styles.section}>
            <h3>计时默认值</h3>
            <MoeInput
              label="默认专注时长 (分钟)"
              type="number"
              value={settings['focus.defaultDuration'] || '25'}
              onChange={(e) => update('focus.defaultDuration', e.target.value)}
            />
            <div style={{ height: '16px' }} />
            <MoeInput
              label="默认休息时长 (分钟)"
              type="number"
              value={settings['focus.defaultRestDuration'] || '5'}
              onChange={(e) => update('focus.defaultRestDuration', e.target.value)}
            />
          </div>
        )}

        {/* Email Settings */}
        {active_tab === 'email' && (
          <div className={styles.section}>
            <h3>QQ 邮箱配置</h3>
            <p className={styles.note}>
              需要先在 QQ 邮箱 设置 → 账户 → 开启 SMTP 服务，获取 16 位授权码。
            </p>
            <MoeInput
              label="QQ 邮箱地址"
              type="email"
              placeholder="example@qq.com"
              value={settings['email.qqUser'] || ''}
              onChange={(e) => update('email.qqUser', e.target.value)}
            />
            <div style={{ height: '16px' }} />
            <MoeInput
              label="SMTP 授权码 (非QQ密码)"
              type="password"
              placeholder="16位授权码"
              value={settings['email.qqPass'] || ''}
              onChange={(e) => update('email.qqPass', e.target.value)}
            />
            <div style={{ height: '16px' }} />
            <div className={styles.field}>
              <label>提醒时间</label>
              <input
                type="time"
                value={settings['email.reminderTime'] || '22:30'}
                onChange={(e) => update('email.reminderTime', e.target.value)}
                className={styles.time_input}
              />
            </div>
            <div className={styles.field}>
              <label>启用提醒</label>
              <select
                value={settings['email.reminderEnabled'] || 'true'}
                onChange={(e) => update('email.reminderEnabled', e.target.value)}
                className={styles.select}
              >
                <option value="true">启用</option>
                <option value="false">禁用</option>
              </select>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MoeButton variant="secondary" size="sm" onClick={handle_test_email}>
                测试连接
              </MoeButton>
              {email_test_msg && (
                <span className={email_test_msg.includes('成功') ? styles.success_msg : styles.error_msg}>
                  {email_test_msg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* GitHub Settings */}
        {active_tab === 'github' && (
          <div className={styles.section}>
            <h3>GitHub 同步配置</h3>
            <p className={styles.note}>
              配置一个 GitHub 私有仓库用于双 PC 数据同步。确保系统已配置 Git 凭证管理器。
            </p>
            <MoeInput
              label="远程仓库地址"
              placeholder="https://github.com/username/moefocus-data.git"
              value={settings['github.remoteUrl'] || ''}
              onChange={(e) => update('github.remoteUrl', e.target.value)}
            />
            <div style={{ height: '16px' }} />
            <MoeInput
              label="分支名称"
              placeholder="main"
              value={settings['github.branch'] || 'main'}
              onChange={(e) => update('github.branch', e.target.value)}
            />
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <MoeButton variant="secondary" size="sm" onClick={async () =>
              {
                await window.electronAPI.git.set_remote(settings['github.remoteUrl'] || '')
                set_git_status('远程仓库已设置')
              }}>
                应用远程地址
              </MoeButton>
              <MoeButton variant="ghost" size="sm" onClick={handle_test_git}>
                检查状态
              </MoeButton>
            </div>
            {git_status && (
              <pre className={styles.git_status}>{git_status}</pre>
            )}
          </div>
        )}
      </MoeCard>
    </div>
  )
}
