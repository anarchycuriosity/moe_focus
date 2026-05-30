// ===== 设置页面 — GitHub 同步 + 计时默认值 =====
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DatabaseService } from '../services/DatabaseService'
import { moe_colors, spacing, radius, font_size } from '../styles/theme'

export function SettingsScreen(): JSX.Element
{
  const insets = useSafeAreaInsets()
  const [settings, set_settings] = useState<Record<string, string>>({})
  const [sync_status, set_sync_status] = useState('')

  useEffect(() =>
  {
    load_settings()
  }, [])

  const load_settings = async () =>
  {
    const rows = await DatabaseService.get_all('SELECT key, value FROM settings')
    const map: Record<string, string> = {}
    for (const row of rows) map[row.key as string] = row.value as string
    set_settings(map)
  }

  const update_setting = async (key: string, value: string) =>
  {
    await DatabaseService.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
      [key, value, value]
    )
    set_settings((prev) => ({ ...prev, [key]: value }))
  }

  const handle_export_data = async () =>
  {
    const tasks = await DatabaseService.get_all('SELECT * FROM tasks')
    const todos = await DatabaseService.get_all('SELECT * FROM todo_items')
    const sessions = await DatabaseService.get_all('SELECT * FROM focus_sessions')

    const export_data = {
      exported_at: new Date().toISOString(),
      device: 'moefocus-mobile',
      tasks, todo_items: todos, focus_sessions: sessions
    }

    set_sync_status(
      `数据已准备好导出\n${tasks.length} 任务, ${todos.length} TODO项, ${sessions.length} 会话`
    )
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Timer defaults */}
      <Text style={styles.section_title}>计时默认值</Text>
      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>专注时长 (分钟)</Text>
          <TextInput
            style={styles.field_input}
            keyboardType="numeric"
            value={settings['focus.defaultDuration'] || '25'}
            onChangeText={(v) => update_setting('focus.defaultDuration', v)}
          />
        </View>
        <View style={[styles.field, { borderBottomWidth: 0 }]}>
          <Text style={styles.label}>休息时长 (分钟)</Text>
          <TextInput
            style={styles.field_input}
            keyboardType="numeric"
            value={settings['focus.defaultRestDuration'] || '5'}
            onChangeText={(v) => update_setting('focus.defaultRestDuration', v)}
          />
        </View>
      </View>

      {/* GitHub sync */}
      <Text style={styles.section_title}>GitHub 数据同步</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          配置 GitHub 私有仓库地址用于双设备间数据同步。数据以 JSON 格式导出，桌面端和移动端共享同一仓库。
        </Text>
        <View style={styles.field}>
          <Text style={styles.label}>仓库地址</Text>
          <TextInput
            style={styles.field_input}
            placeholder="https://github.com/user/repo.git"
            placeholderTextColor={moe_colors.text_light}
            value={settings['github.remoteUrl'] || ''}
            onChangeText={(v) => update_setting('github.remoteUrl', v)}
          />
        </View>
        <View style={[styles.field, { borderBottomWidth: 0 }]}>
          <Text style={styles.label}>分支</Text>
          <TextInput
            style={styles.field_input}
            value={settings['github.branch'] || 'main'}
            onChangeText={(v) => update_setting('github.branch', v)}
          />
        </View>
      </View>

      {/* Sync actions */}
      <TouchableOpacity style={styles.sync_btn} onPress={handle_export_data}>
        <Text style={styles.sync_btn_text}>📤 导出同步数据</Text>
      </TouchableOpacity>
      {sync_status ? <Text style={styles.sync_status}>{sync_status}</Text> : null}

      {/* App info */}
      <Text style={styles.version_text}>MoeFocus Mobile v1.0.0</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: moe_colors.cream, paddingHorizontal: spacing.md },
  section_title: {
    fontSize: font_size.sm, fontWeight: '600', color: moe_colors.text_light,
    marginBottom: spacing.sm, marginTop: spacing.lg, textTransform: 'uppercase', letterSpacing: 0.5
  },
  card: {
    backgroundColor: moe_colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: moe_colors.border, padding: spacing.md
  },
  field: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: moe_colors.border
  },
  label: { fontSize: font_size.md, color: moe_colors.text },
  field_input: {
    fontSize: font_size.md, color: moe_colors.text, textAlign: 'right', width: 120,
    backgroundColor: 'rgba(255,183,197,0.06)', borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 6
  },
  hint: {
    fontSize: font_size.xs, color: moe_colors.text_light, lineHeight: 18,
    marginBottom: spacing.md
  },
  sync_btn: {
    backgroundColor: moe_colors.lavender, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md
  },
  sync_btn_text: { fontSize: font_size.md, color: moe_colors.white, fontWeight: '600' },
  sync_status: {
    fontSize: font_size.xs, color: moe_colors.text_light, textAlign: 'center',
    marginTop: spacing.sm, lineHeight: 18
  },
  version_text: {
    fontSize: font_size.xs, color: moe_colors.text_light, textAlign: 'center',
    marginTop: spacing.xl, opacity: 0.5
  }
})
