// ===== 今日页面 — TODO 管理 =====
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTaskStore } from '../store/useTaskStore'
import { useTodoStore } from '../store/useTodoStore'
import { moe_colors, spacing, radius, font_size } from '../styles/theme'

export function TodayScreen(): JSX.Element
{
  const insets = useSafeAreaInsets()
  const { tasks, load_tasks, add_task } = useTaskStore()
  const { items, load_todos, add_todo, toggle_done, remove_todo } = useTodoStore()
  const [new_task_text, set_new_task_text] = useState('')

  useEffect(() =>
  {
    load_tasks()
    load_todos()
  }, [])

  const handle_add_task = () =>
  {
    const t = new_task_text.trim()
    if (t)
    {
      add_task(t)
      set_new_task_text('')
    }
  }

  const handle_add_todo = (task_id: number, title: string) =>
  {
    add_todo(task_id, title)
  }

  const handle_long_press_task = (task: Task) =>
  {
    Alert.alert('添加到今日', `将「${task.title}」加入今日计划？`, [
      { text: '取消', style: 'cancel' },
      { text: '添加', onPress: () => handle_add_todo(task.id, task.title) }
    ])
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Add task input */}
      <View style={styles.input_row}>
        <TextInput
          style={styles.input}
          placeholder="添加新任务..."
          placeholderTextColor={moe_colors.text_light}
          value={new_task_text}
          onChangeText={set_new_task_text}
          onSubmitEditing={handle_add_task}
        />
        <TouchableOpacity style={styles.add_btn} onPress={handle_add_task}>
          <Text style={styles.add_btn_text}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Task library */}
      <Text style={styles.section_title}>任务库（长按加入今日）</Text>
      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.task_list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.task_chip, { borderLeftColor: item.color || moe_colors.pink }]}
            onLongPress={() => handle_long_press_task(item)}
          >
            <Text style={styles.task_chip_icon}>{item.icon || '⭐'}</Text>
            <Text style={styles.task_chip_text}>{item.title}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Today's TODO list */}
      <Text style={styles.section_title}>
        今日计划 ({items.filter((i) => i.status === 'done').length}/{items.length})
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        style={styles.todo_list}
        renderItem={({ item }) =>
        {
          const done = item.status === 'done'
          return (
            <View style={[styles.todo_item, done && styles.todo_done]}>
              <TouchableOpacity
                style={[styles.checkbox, done && styles.checkbox_done]}
                onPress={() => toggle_done(item.id)}
              >
                {done && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <Text style={[styles.todo_text, done && styles.todo_text_done]}>
                {item.custom_title || item.task_title || '未命名'}
              </Text>
              <TouchableOpacity onPress={() => remove_todo(item.id)}>
                <Text style={styles.delete_btn}>✕</Text>
              </TouchableOpacity>
            </View>
          )
        }}
        ListEmptyComponent={
          <Text style={styles.empty_text}>长按任务库中的任务加入今日计划</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: moe_colors.cream, paddingHorizontal: spacing.md },
  input_row: {
    flexDirection: 'row', gap: 8, marginBottom: spacing.md
  },
  input: {
    flex: 1, backgroundColor: moe_colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.md, fontSize: font_size.md, fontFamily: 'System',
    borderWidth: 1, borderColor: moe_colors.border, color: moe_colors.text
  },
  add_btn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: moe_colors.pink, justifyContent: 'center', alignItems: 'center'
  },
  add_btn_text: { fontSize: 24, color: moe_colors.white, fontWeight: '300' },
  section_title: {
    fontSize: font_size.sm, fontWeight: '600', color: moe_colors.text_light,
    marginBottom: spacing.sm, marginTop: spacing.md
  },
  task_list: { maxHeight: 80, marginBottom: spacing.sm },
  task_chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: moe_colors.white, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 8,
    borderLeftWidth: 3, borderWidth: 1, borderColor: moe_colors.border
  },
  task_chip_icon: { fontSize: 14 },
  task_chip_text: { fontSize: font_size.sm, color: moe_colors.text, fontWeight: '500' },
  todo_list: { flex: 1 },
  todo_item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: moe_colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12, marginBottom: 8,
    borderWidth: 1, borderColor: moe_colors.border
  },
  todo_done: { opacity: 0.5, backgroundColor: 'rgba(181,234,215,0.15)' },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: moe_colors.pink, justifyContent: 'center', alignItems: 'center'
  },
  checkbox_done: { backgroundColor: moe_colors.mint, borderColor: moe_colors.mint },
  checkmark: { fontSize: 12, color: moe_colors.white, fontWeight: '700' },
  todo_text: { flex: 1, fontSize: font_size.md, color: moe_colors.text },
  todo_text_done: { textDecorationLine: 'line-through', color: moe_colors.text_light },
  delete_btn: { fontSize: 14, color: moe_colors.text_light, padding: 4 },
  empty_text: { textAlign: 'center', color: moe_colors.text_light, marginTop: 40, fontSize: font_size.sm }
})
