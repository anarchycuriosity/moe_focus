import { useEffect, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import * as FileSystem from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DatabaseService } from '../services/DatabaseService'
import { sync_with_github } from '../services/sync_service'
import { font_size, moe_colors, radius, spacing } from '../styles/theme'
import { ScreenBackground } from '../components/screen_background'

export function SettingsScreen(): JSX.Element
{
  const insets = useSafeAreaInsets()
  const [settings, set_settings] = useState<Record<string, string>>({})
  const [syncing, set_syncing] = useState(false)
  const [sync_status, set_sync_status] = useState('')

  const load_settings = async () =>
  {
    set_settings(await DatabaseService.get_settings())
  }

  useEffect(() =>
  {
    load_settings()
  }, [])

  const update_setting = async (key: string, value: string) =>
  {
    await DatabaseService.set_setting(key, value)
    set_settings((prev) => ({ ...prev, [key]: value }))
  }

  const pick_local_image = async (key: string) =>
  {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted)
    {
      Alert.alert('需要相册权限', '请允许 MoeFocus 访问相册，否则无法选择本地壁纸。')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.92
    })

    if (result.canceled || result.assets.length === 0)
    {
      return
    }

    const image_uri = result.assets[0].uri
    const image_dir = `${FileSystem.documentDirectory}wallpapers`
    await FileSystem.makeDirectoryAsync(image_dir, { intermediates: true })

    const ext_match = image_uri.match(/\.(png|jpg|jpeg|webp)$/i)
    const ext = ext_match ? ext_match[1].toLowerCase() : 'jpg'
    const file_path = `${image_dir}/${key.replace(/\./g, '_')}_${Date.now()}.${ext}`
    await FileSystem.copyAsync({ from: image_uri, to: file_path })
    await update_setting(key, file_path)
  }

  const run_sync = async () =>
  {
    set_syncing(true)
    set_sync_status('正在同步...')
    const result = await sync_with_github()
    set_syncing(false)

    if (!result.success)
    {
      set_sync_status(`同步失败：${result.error || '未知错误'}`)
      Alert.alert('同步失败', result.error || '未知错误')
      return
    }

    set_sync_status(
      `同步完成：上传 ${result.uploaded_files.length} 个文件，导入 ${result.imported_sessions} 条会话，导入 ${result.imported_goals} 个长期任务，更新 ${result.synced_diaries} 篇日记。`
    )
  }

  return (
    <ScreenBackground page_key="settings">
      <ScrollView style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.section_title}>计时默认值</Text>
      <View style={styles.card}>
        <SettingInput
          label="专注时长（分钟）"
          value={settings['focus.defaultDuration'] || '25'}
          keyboardType="numeric"
          onChangeText={(value) => update_setting('focus.defaultDuration', value)}
        />
        <SettingInput
          label="休息时长（分钟）"
          value={settings['focus.defaultRestDuration'] || '5'}
          keyboardType="numeric"
          onChangeText={(value) => update_setting('focus.defaultRestDuration', value)}
        />
        <SettingInput
          label="每日目标（分钟）"
          value={settings['focus.dailyGoal'] || '120'}
          keyboardType="numeric"
          onChangeText={(value) => update_setting('focus.dailyGoal', value)}
        />
      </View>

      <Text style={styles.section_title}>GitHub 数据同步</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          手机端使用 GitHub API 同步桌面端同一数据仓库。Token 建议只授予目标私有仓库 contents 读写权限。
        </Text>
        <SettingInput
          label="仓库地址"
          value={settings['github.remoteUrl'] || ''}
          placeholder="https://github.com/user/repo.git"
          onChangeText={(value) => update_setting('github.remoteUrl', value)}
        />
        <SettingInput
          label="Owner"
          value={settings['github.owner'] || ''}
          placeholder="可从仓库地址自动解析，也可手填"
          onChangeText={(value) => update_setting('github.owner', value)}
        />
        <SettingInput
          label="Repo"
          value={settings['github.repo'] || ''}
          placeholder="可从仓库地址自动解析，也可手填"
          onChangeText={(value) => update_setting('github.repo', value)}
        />
        <SettingInput
          label="分支"
          value={settings['github.branch'] || 'main'}
          onChangeText={(value) => update_setting('github.branch', value)}
        />
        <SettingInput
          label="Token"
          value={settings['github.token'] || ''}
          placeholder="GitHub fine-grained token"
          secureTextEntry
          onChangeText={(value) => update_setting('github.token', value)}
        />
      </View>

      <Text style={styles.section_title}>壁纸与相框</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          手机端 release 使用图片 URL 保存自定义外观。可以填写私有仓库 raw 文件地址、对象存储地址，或其他手机能访问的 HTTPS 图片地址。
        </Text>
        <SettingInput
          label="默认壁纸 URL"
          value={settings['ui.wallpaper.default'] || ''}
          placeholder="https://example.com/wallpaper.png"
          onChangeText={(value) => update_setting('ui.wallpaper.default', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.wallpaper.default')}
          onClear={() => update_setting('ui.wallpaper.default', '')}
        />
        <SettingInput
          label="今日页壁纸 URL"
          value={settings['ui.wallpaper.today'] || ''}
          onChangeText={(value) => update_setting('ui.wallpaper.today', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.wallpaper.today')}
          onClear={() => update_setting('ui.wallpaper.today', '')}
        />
        <SettingInput
          label="专注页壁纸 URL"
          value={settings['ui.wallpaper.focus'] || ''}
          onChangeText={(value) => update_setting('ui.wallpaper.focus', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.wallpaper.focus')}
          onClear={() => update_setting('ui.wallpaper.focus', '')}
        />
        <SettingInput
          label="统计页壁纸 URL"
          value={settings['ui.wallpaper.statistics'] || ''}
          onChangeText={(value) => update_setting('ui.wallpaper.statistics', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.wallpaper.statistics')}
          onClear={() => update_setting('ui.wallpaper.statistics', '')}
        />
        <SettingInput
          label="长期任务页壁纸 URL"
          value={settings['ui.wallpaper.goals'] || ''}
          onChangeText={(value) => update_setting('ui.wallpaper.goals', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.wallpaper.goals')}
          onClear={() => update_setting('ui.wallpaper.goals', '')}
        />
        <SettingInput
          label="日记页壁纸 URL"
          value={settings['ui.wallpaper.diary'] || ''}
          onChangeText={(value) => update_setting('ui.wallpaper.diary', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.wallpaper.diary')}
          onClear={() => update_setting('ui.wallpaper.diary', '')}
        />
        <SettingInput
          label="设置页壁纸 URL"
          value={settings['ui.wallpaper.settings'] || ''}
          onChangeText={(value) => update_setting('ui.wallpaper.settings', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.wallpaper.settings')}
          onClear={() => update_setting('ui.wallpaper.settings', '')}
        />
        <SettingInput
          label="日记相框图片 URL"
          value={settings['ui.photoFrame.url'] || ''}
          placeholder="https://example.com/photo-frame.jpg"
          onChangeText={(value) => update_setting('ui.photoFrame.url', value)}
        />
        <ImageActions
          onPick={() => pick_local_image('ui.photoFrame.url')}
          onClear={() => update_setting('ui.photoFrame.url', '')}
        />
      </View>

      <TouchableOpacity
        style={[styles.sync_btn, syncing && styles.sync_btn_disabled]}
        onPress={run_sync}
        disabled={syncing}
        activeOpacity={0.75}
      >
        <Text style={styles.sync_btn_text}>{syncing ? '同步中...' : '同步到 GitHub'}</Text>
      </TouchableOpacity>
      {sync_status ? <Text style={styles.sync_status}>{sync_status}</Text> : null}

      <Text style={styles.version_text}>MoeFocus Mobile v1.1.0</Text>
      <View style={{ height: 48 }} />
      </ScrollView>
    </ScreenBackground>
  )
}

function SettingInput({
  label,
  value,
  placeholder,
  keyboardType,
  secureTextEntry,
  onChangeText
}: {
  label: string
  value: string
  placeholder?: string
  keyboardType?: 'default' | 'numeric'
  secureTextEntry?: boolean
  onChangeText: (value: string) => void
}): JSX.Element
{
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.field_input}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={moe_colors.text_light}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        onChangeText={onChangeText}
      />
    </View>
  )
}

function ImageActions({
  onPick,
  onClear
}: {
  onPick: () => void
  onClear: () => void
}): JSX.Element
{
  return (
    <View style={styles.image_actions}>
      <TouchableOpacity style={styles.image_action_btn} onPress={onPick} activeOpacity={0.75}>
        <Text style={styles.image_action_text}>从相册选择</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.image_action_btn, styles.clear_btn]} onPress={onClear} activeOpacity={0.75}>
        <Text style={[styles.image_action_text, styles.clear_text]}>恢复默认</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md },
  section_title: {
    fontSize: font_size.sm, fontWeight: '700', color: moe_colors.text_light,
    marginBottom: spacing.sm, marginTop: spacing.lg
  },
  card: {
    backgroundColor: moe_colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: moe_colors.border, padding: spacing.md
  },
  hint: { color: moe_colors.text_light, fontSize: font_size.xs, lineHeight: 18, marginBottom: spacing.sm },
  field: { marginBottom: spacing.md },
  label: { color: moe_colors.text, fontSize: font_size.sm, fontWeight: '700', marginBottom: 6 },
  field_input: {
    color: moe_colors.text, fontSize: font_size.md, backgroundColor: 'rgba(255,183,197,0.08)',
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 9
  },
  image_actions: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
  image_action_btn: {
    flex: 1, backgroundColor: 'rgba(201,169,220,0.18)', borderRadius: radius.sm,
    borderWidth: 1, borderColor: moe_colors.lavender, paddingVertical: 10, alignItems: 'center'
  },
  clear_btn: { backgroundColor: 'rgba(255,255,255,0.72)', borderColor: moe_colors.border },
  image_action_text: { color: moe_colors.lavender_dark, fontSize: font_size.sm, fontWeight: '800' },
  clear_text: { color: moe_colors.text_light },
  sync_btn: {
    backgroundColor: moe_colors.lavender, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md
  },
  sync_btn_disabled: { opacity: 0.6 },
  sync_btn_text: { color: moe_colors.white, fontSize: font_size.md, fontWeight: '800' },
  sync_status: { color: moe_colors.text_light, fontSize: font_size.xs, textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
  version_text: { color: moe_colors.text_light, fontSize: font_size.xs, textAlign: 'center', opacity: 0.62, marginTop: spacing.xl }
})
