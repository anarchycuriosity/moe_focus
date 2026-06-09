import { ReactNode, useEffect, useState } from 'react'
import { Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { DatabaseService } from '../services/DatabaseService'
import { moe_colors } from '../styles/theme'

interface ScreenBackgroundProps
{
  page_key: string
  children: ReactNode
  content_style?: StyleProp<ViewStyle>
}

export function ScreenBackground({ page_key, children, content_style }: ScreenBackgroundProps): JSX.Element
{
  const [image_url, set_image_url] = useState('')

  useEffect(() =>
  {
    let mounted = true
    DatabaseService.get_settings().then((settings) =>
    {
      if (!mounted) return
      set_image_url(settings[`ui.wallpaper.${page_key}`] || settings['ui.wallpaper.default'] || '')
    })

    return () =>
    {
      mounted = false
    }
  }, [page_key])

  const image_source = get_background_source(page_key, image_url)

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.image_layer}>
        <Image
          source={image_source}
          resizeMode="cover"
          style={styles.image}
        />
      </View>
      <View pointerEvents="none" style={styles.scrim} />
      <View style={[styles.content, content_style]}>{children}</View>
    </View>
  )
}

function get_background_source(page_key: string, image_url: string): ImageSourcePropType
{
  const trimmed_url = image_url.trim()
  if (trimmed_url)
  {
    return { uri: trimmed_url }
  }

  const defaults: Record<string, ImageSourcePropType> = {
    today: require('../../assets/wallpapers/today.png'),
    focus: require('../../assets/wallpapers/today.png'),
    statistics: require('../../assets/wallpapers/statistics.png'),
    goals: require('../../assets/wallpapers/goals.png'),
    diary: require('../../assets/wallpapers/diary.png'),
    settings: require('../../assets/wallpapers/settings.png')
  }

  return defaults[page_key] || defaults.today
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: moe_colors.cream },
  image_layer: { ...StyleSheet.absoluteFillObject },
  image: { width: '100%', height: '100%' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,245,238,0.72)'
  },
  content: { flex: 1 }
})
