import { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import dayjs from 'dayjs'
import { DatabaseService } from '../services/DatabaseService'
import { generate_diary, save_reflection } from '../services/diary_service'
import { font_size, moe_colors, radius, spacing } from '../styles/theme'
import type { DiaryEntry } from '../types/models'

export function DiaryScreen(): JSX.Element
{
  const insets = useSafeAreaInsets()
  const today = dayjs().format('YYYY-MM-DD')
  const [entries, set_entries] = useState<DiaryEntry[]>([])
  const [selected_date, set_selected_date] = useState(today)
  const [reflection_text, set_reflection_text] = useState('')
  const [preview_text, set_preview_text] = useState('')

  const load_entries = async () =>
  {
    const rows = await DatabaseService.get_all<DiaryEntry>(
      'SELECT * FROM diary_entries ORDER BY date DESC'
    )
    set_entries(rows)
    const current = rows.find((entry) => entry.date === selected_date)
    set_reflection_text(current?.reflection_text || '')
    set_preview_text(current?.summary_text || '')
  }

  useEffect(() =>
  {
    load_entries()
  }, [])

  const select_entry = (entry: DiaryEntry) =>
  {
    set_selected_date(entry.date)
    set_reflection_text(entry.reflection_text || '')
    set_preview_text(entry.summary_text || '')
  }

  const generate_selected_diary = async () =>
  {
    try
    {
      await save_reflection(selected_date, reflection_text)
      const entry = await generate_diary(selected_date)
      set_preview_text(entry.summary_text || '')
      await load_entries()
    }
    catch (error)
    {
      Alert.alert('生成失败', error instanceof Error ? error.message : String(error))
    }
  }

  const delete_entry = async (entry: DiaryEntry) =>
  {
    Alert.alert('删除日记', `确认删除 ${entry.date} 的日记和当天专注记录吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () =>
        {
          await DatabaseService.run('DELETE FROM focus_sessions WHERE date = ?', [entry.date])
          await DatabaseService.run('DELETE FROM diary_entries WHERE date = ?', [entry.date])
          if (selected_date === entry.date)
          {
            set_preview_text('')
            set_reflection_text('')
          }
          await load_entries()
        }
      }
    ])
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.editor_card}>
        <View style={styles.editor_header}>
          <Text style={styles.editor_title}>{selected_date}</Text>
          <TouchableOpacity style={styles.generate_btn} onPress={generate_selected_diary}>
            <Text style={styles.generate_text}>生成/更新</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.date_input}
          value={selected_date}
          onChangeText={set_selected_date}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={moe_colors.text_light}
        />
        <TextInput
          style={styles.reflection_input}
          value={reflection_text}
          onChangeText={set_reflection_text}
          multiline
          placeholder="写一点今天的反思。手机端会把它写入日记 Markdown。"
          placeholderTextColor={moe_colors.text_light}
        />
      </View>

      <View style={styles.preview_card}>
        <Text style={styles.preview_title}>日记预览</Text>
        <Text style={styles.preview_text}>
          {preview_text || '还没有生成日记。先完成一次专注，或者直接写反思后点击生成。'}
        </Text>
      </View>

      <Text style={styles.section_title}>归档</Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <View style={[styles.entry_row, item.date === selected_date && styles.entry_active]}>
            <TouchableOpacity style={styles.entry_main} onPress={() => select_entry(item)}>
              <Text style={styles.entry_date}>{item.date}</Text>
              <Text style={styles.entry_hint}>{item.summary_text ? '已生成 Markdown' : '只有反思草稿'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => delete_entry(item)}>
              <Text style={styles.delete_text}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty_text}>暂无日记</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: moe_colors.cream, paddingHorizontal: spacing.md },
  editor_card: {
    backgroundColor: moe_colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: moe_colors.border, padding: spacing.md
  },
  editor_header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  editor_title: { color: moe_colors.text, fontSize: font_size.lg, fontWeight: '800' },
  generate_btn: { backgroundColor: moe_colors.pink, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  generate_text: { color: moe_colors.white, fontWeight: '700', fontSize: font_size.sm },
  date_input: {
    color: moe_colors.text, fontSize: font_size.sm, borderBottomWidth: 1,
    borderBottomColor: moe_colors.border, paddingVertical: 8, marginBottom: spacing.sm
  },
  reflection_input: {
    color: moe_colors.text, fontSize: font_size.md, minHeight: 92,
    textAlignVertical: 'top', lineHeight: 22
  },
  preview_card: {
    backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: radius.md,
    borderWidth: 1, borderColor: moe_colors.border, padding: spacing.md,
    marginTop: spacing.md, maxHeight: 220
  },
  preview_title: { color: moe_colors.text, fontSize: font_size.md, fontWeight: '800', marginBottom: spacing.sm },
  preview_text: { color: moe_colors.text_light, fontSize: font_size.xs, lineHeight: 18 },
  section_title: { color: moe_colors.text_light, fontSize: font_size.sm, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  entry_row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: moe_colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: moe_colors.border, padding: spacing.md,
    marginBottom: spacing.sm
  },
  entry_active: { borderColor: moe_colors.pink, backgroundColor: 'rgba(255,183,197,0.12)' },
  entry_main: { flex: 1 },
  entry_date: { color: moe_colors.text, fontSize: font_size.md, fontWeight: '700' },
  entry_hint: { color: moe_colors.text_light, fontSize: font_size.xs, marginTop: 3 },
  delete_text: { color: moe_colors.danger, fontSize: font_size.xs, fontWeight: '700' },
  empty_text: { color: moe_colors.text_light, textAlign: 'center', marginTop: 24 }
})
