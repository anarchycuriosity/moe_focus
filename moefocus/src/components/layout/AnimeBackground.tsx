import { useState, useEffect } from 'react'
import styles from './AnimeBackground.module.css'

function path_to_url(path: string): string
{
  const normalized = path.replace(/\\/g, '/')
  // Windows absolute path like C:/Users/... needs three slashes
  return `local:///${normalized}`
}

export function AnimeBackground(): JSX.Element
{
  const [wallpaper_url, set_wallpaper_url] = useState<string>('')

  useEffect(() =>
  {
    async function load_wallpaper()
    {
      // Try wallpapers table first (direct DB query for active wallpaper)
      const db_path = await window.electronAPI.file.get_active_wallpaper()
      if (db_path)
      {
        set_wallpaper_url(path_to_url(db_path))
        return
      }

      // Fallback to settings key
      const settings_path = await window.electronAPI.settings.get('ui.active_wallpaper')
      if (settings_path)
      {
        set_wallpaper_url(path_to_url(settings_path))
      }
    }

    load_wallpaper()

    const cleanup = window.electronAPI.settings.on_changed((data) =>
    {
      if (data.key === 'ui.active_wallpaper' && data.value)
      {
        set_wallpaper_url(path_to_url(String(data.value)))
      }
    })

    return cleanup
  }, [])

  return (
    <div
      className={styles.background}
      style={wallpaper_url ? { backgroundImage: `url(${wallpaper_url})` } : undefined}
    >
      <div className={styles.overlay} />
    </div>
  )
}
