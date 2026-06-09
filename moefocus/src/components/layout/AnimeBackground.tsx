import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './AnimeBackground.module.css'

const route_to_page: Record<string, string> = {
  '/': 'today',
  '/diary': 'diary',
  '/statistics': 'statistics',
  '/settings': 'settings',
  '/long-term-tasks': 'goals',
  '/focus': 'today'
}

function path_to_url(path: string): string
{
  // encodeURI keeps / unchanged but encodes Chinese and special chars
  return `local:///${encodeURI(path.replace(/\\/g, '/'))}`
}

export function AnimeBackground(): JSX.Element
{
  const location = useLocation()
  const [wallpapers, set_wallpapers] = useState<Record<string, string>>({})
  const [current_url, set_current_url] = useState<string>('')
  const [prev_url, set_prev_url] = useState<string>('')
  const [fading, set_fading] = useState(false)

  const page_key = route_to_page[location.pathname] || 'today'

  // Load all wallpapers on mount
  useEffect(() =>
  {
    const pages = ['today', 'diary', 'statistics', 'settings', 'goals']
    async function load_all()
    {
      const result: Record<string, string> = {}
      for (const page of pages)
      {
        const path = await window.electronAPI.file.get_wallpaper_for_page(page)
        if (path)
        {
          result[page] = path_to_url(path)
        }
      }
      set_wallpapers(result)
    }
    load_all()
  }, [])

  // Switch wallpaper when page changes
  useEffect(() =>
  {
    const new_url = wallpapers[page_key] || ''
    if (new_url && new_url !== current_url)
    {
      set_prev_url(current_url)
      set_current_url(new_url)
      set_fading(true)
      const timer = setTimeout(() => set_fading(false), 400)
      return () => clearTimeout(timer)
    }
    else if (!current_url && new_url)
    {
      set_current_url(new_url)
    }
  }, [page_key, wallpapers])

  return (
    <div className={styles.background}>
      {/* Previous wallpaper — fades out */}
      {prev_url && (
        <div
          className={`${styles.bg_layer} ${fading ? styles.fade_out : ''}`}
          style={{ backgroundImage: `url(${prev_url})` }}
        />
      )}
      {/* Current wallpaper — fades in */}
      {current_url && (
        <div
          className={`${styles.bg_layer} ${fading ? styles.fade_in : styles.active}`}
          style={{ backgroundImage: `url(${current_url})` }}
        />
      )}
      {/* Default gradient when no wallpapers */}
      {!current_url && <div className={styles.default_gradient} />}
      <div className={styles.overlay} />
    </div>
  )
}
