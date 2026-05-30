import { useState, useEffect } from 'react'
import styles from './AnimeBackground.module.css'

export function AnimeBackground(): JSX.Element
{
  const [wallpaper_url, set_wallpaper_url] = useState<string>('')

  useEffect(() =>
  {
    console.log('[BG] mounting, loading wallpaper...')
    window.electronAPI.settings.get('ui.active_wallpaper').then((path) =>
    {
      console.log('[BG] loaded wallpaper path from settings:', path)
      if (path)
      {
        const url = `local:///${String(path).replace(/\\/g, '/')}`
        console.log('[BG] setting url:', url)
        set_wallpaper_url(url)
      }
    })

    const cleanup = window.electronAPI.settings.on_changed((data) =>
    {
      console.log('[BG] settings changed:', data)
      if (data.key === 'ui.active_wallpaper' && data.value)
      {
        const url = `local:///${String(data.value).replace(/\\/g, '/')}`
        console.log('[BG] updating wallpaper url:', url)
        set_wallpaper_url(url)
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
