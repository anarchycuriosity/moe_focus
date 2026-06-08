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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DatabaseService } from '../services/DatabaseService'
import { sync_with_github } from '../services/sync_service'
import { font_size, moe_colors, radius, spacing } from '../styles/theme'

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

      <TouchableOpacity style={[styles.sync_btn, syncing && styles.sync_btn_disabled]} onPress={run_sync} disabled={syncing}>
        <Text style={styles.sync_btn_text}>{syncing ? '同步中...' : '同步到 GitHub'}</Text>
      </TouchableOpacity>
      {sync_status ? <Text style={styles.sync_status}>{sync_status}</Text> : null}

      <Text style={styles.version_text}>MoeFocus Mobile v1.1.0</Text>
      <View style={{ height: 48 }} />
    </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: moe_colors.cream, paddingHorizontal: spacing.md },
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
  sync_btn: {
    backgroundColor: moe_colors.lavender, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md
  },
  sync_btn_disabled: { opacity: 0.6 },
  sync_btn_text: { color: moe_colors.white, fontSize: font_size.md, fontWeight: '800' },
  sync_status: { color: moe_colors.text_light, fontSize: font_size.xs, textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
  version_text: { color: moe_colors.text_light, fontSize: font_size.xs, textAlign: 'center', opacity: 0.62, marginTop: spacing.xl }
})
