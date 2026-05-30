import { useState, useEffect } from 'react'
import styles from './AnimeBackground.module.css'

export function AnimeBackground(): JSX.Element
{
  const [wallpaper_path, set_wallpaper_path] = useState<string>('')

  useEffect(() =>
  {
    // Load active wallpaper from settings
    window.electronAPI.settings.get('ui.active_wallpaper').then((path) =>
    {
      if (path)
      {
        // Convert to file:// URL for CSS background
        const file_url = `file:///${path.replace(/\\/g, '/')}`
        set_wallpaper_path(file_url)
      }
    })

    // Listen for file drops to change background
    const cleanup = window.electronAPI.file.on_file_drop((file_path) =>
    {
      handle_new_wallpaper(file_path)
    })

    // Listen for settings changes (e.g. from Settings page)
    const cleanup2 = window.electronAPI.settings.on_changed((data) =>
    {
      if (data.key === 'ui.active_wallpaper' && data.value)
      {
        const file_url = `file:///${String(data.value).replace(/\\/g, '/')}`
        set_wallpaper_path(file_url)
      }
    })

    return () => { cleanup(); cleanup2() }
  }, [])

  async function handle_new_wallpaper(file_path: string)
  {
    const dest_path = await window.electronAPI.file.set_wallpaper(file_path)
    await window.electronAPI.settings.set('ui.active_wallpaper', dest_path)
    const file_url = `file:///${dest_path.replace(/\\/g, '/')}`
    set_wallpaper_path(file_url)
  }

  return (
    <div
      className={styles.background}
      style={wallpaper_path ? { backgroundImage: `url(${wallpaper_path})` } : undefined}
    >
      <div className={styles.overlay} />
    </div>
  )
}
