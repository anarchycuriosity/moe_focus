import { useEffect, useMemo, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import dayjs from 'dayjs'
import { DatabaseService } from '../services/DatabaseService'
import { create_uuid } from '../services/id_service'
import { font_size, moe_colors, radius, spacing } from '../styles/theme'
import type { LongTermGoal } from '../types/models'
import { ScreenBackground } from '../components/screen_background'

type GoalFilter = 'active' | 'all' | 'done'

export function LongTermGoalsScreen(): JSX.Element
{
  const insets = useSafeAreaInsets()
  const [goals, set_goals] = useState<LongTermGoal[]>([])
  const [title, set_title] = useState('')
  const [deadline, set_deadline] = useState('')
  const [filter, set_filter] = useState<GoalFilter>('active')

  const load_goals = async () =>
  {
    const rows = await DatabaseService.get_all<LongTermGoal>(
      `SELECT *
       FROM long_term_goals
       WHERE is_deleted = 0
       ORDER BY status = 'done', COALESCE(deadline, '9999-12-31'), sort_order, created_at`
    )
    set_goals(rows)
  }

  useEffect(() =>
  {
    load_goals()
  }, [])

  const filtered_goals = useMemo(() =>
  {
    if (filter === 'active') return goals.filter((goal) => goal.status !== 'done')
    if (filter === 'done') return goals.filter((goal) => goal.status === 'done')
    return goals
  }, [filter, goals])

  const add_goal = async () =>
  {
    const trimmed = title.trim()
    if (!trimmed) return

    const max_row = await DatabaseService.get_one<{ max_ord: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_ord FROM long_term_goals WHERE is_deleted = 0'
    )
    await DatabaseService.run(
      'INSERT INTO long_term_goals (uuid, title, deadline, sort_order) VALUES (?, ?, ?, ?)',
      [create_uuid(), trimmed, deadline.trim() || null, (max_row?.max_ord ?? -1) + 1]
    )
    set_title('')
    set_deadline('')
    await load_goals()
  }

  const toggle_goal = async (goal: LongTermGoal) =>
  {
    await DatabaseService.run(
      "UPDATE long_term_goals SET status = ?, updated_at = datetime('now') WHERE uuid = ?",
      [goal.status === 'done' ? 'active' : 'done', goal.uuid]
    )
    await load_goals()
  }

  const delete_goal = async (goal: LongTermGoal) =>
  {
    Alert.alert('删除长期任务', `确认删除「${goal.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () =>
        {
          await DatabaseService.run(
            "UPDATE long_term_goals SET is_deleted = 1, updated_at = datetime('now') WHERE uuid = ?",
            [goal.uuid]
          )
          await load_goals()
        }
      }
    ])
  }

  const active_count = goals.filter((goal) => goal.status !== 'done').length
  const done_count = goals.filter((goal) => goal.status === 'done').length
  const overdue_count = goals.filter((goal) => goal.status !== 'done' && get_deadline_days(goal.deadline) < 0).length

  return (
    <ScreenBackground page_key="goals" content_style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.summary_row}>
        <SummaryItem label="进行中" value={active_count} />
        <SummaryItem label="已逾期" value={overdue_count} />
        <SummaryItem label="已完成" value={done_count} />
      </View>

      <View style={styles.form_card}>
        <TextInput
          style={styles.title_input}
          placeholder="长期任务，例如：完成 CS61A 第一轮"
          placeholderTextColor={moe_colors.text_light}
          value={title}
          onChangeText={set_title}
        />
        <TextInput
          style={styles.deadline_input}
          placeholder="截止日期 YYYY-MM-DD，可留空"
          placeholderTextColor={moe_colors.text_light}
          value={deadline}
          onChangeText={set_deadline}
        />
        <TouchableOpacity style={styles.add_btn} onPress={add_goal} activeOpacity={0.75}>
          <Text style={styles.add_btn_text}>添加任务</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filter_row}>
        {(['active', 'all', 'done'] as GoalFilter[]).map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filter_btn, filter === item && styles.filter_active]}
            onPress={() => set_filter(item)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filter_text, filter === item && styles.filter_text_active]}>
              {item === 'active' ? '进行中' : item === 'all' ? '全部' : '已完成'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered_goals}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) =>
        {
          const days = get_deadline_days(item.deadline)
          const state = get_deadline_state(days, item.status)
          return (
            <View style={[styles.goal_row, item.status === 'done' && styles.goal_done]}>
              <TouchableOpacity
                style={[styles.check_btn, item.status === 'done' && styles.check_done]}
                onPress={() => toggle_goal(item)}
                activeOpacity={0.75}
              >
                <Text style={styles.check_text}>{item.status === 'done' ? '✓' : ''}</Text>
              </TouchableOpacity>
              <View style={styles.goal_main}>
                <Text style={styles.goal_title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.goal_deadline}>{format_deadline(item.deadline, days)}</Text>
              </View>
              <Text style={[styles.badge, styles[state]]}>
                {get_deadline_label(item.deadline, days, item.status)}
              </Text>
              <TouchableOpacity onPress={() => delete_goal(item)} activeOpacity={0.75}>
                <Text style={styles.delete_text}>删除</Text>
              </TouchableOpacity>
            </View>
          )
        }}
        ListEmptyComponent={<Text style={styles.empty_text}>暂无长期任务</Text>}
      />
    </ScreenBackground>
  )
}

function SummaryItem({ label, value }: { label: string; value: number }): JSX.Element
{
  return (
    <View style={styles.summary_card}>
      <Text style={styles.summary_label}>{label}</Text>
      <Text style={styles.summary_value}>{value}</Text>
    </View>
  )
}

function get_deadline_days(deadline: string | null): number
{
  if (!deadline) return Number.POSITIVE_INFINITY
  return dayjs(deadline).startOf('day').diff(dayjs().startOf('day'), 'day')
}

function format_deadline(deadline: string | null, days: number): string
{
  if (!deadline) return '未设置截止日期'
  if (days < 0) return `${deadline} 截止，已逾期 ${Math.abs(days)} 天`
  if (days === 0) return `${deadline} 截止，就是今天`
  return `${deadline} 截止，剩余 ${days} 天`
}

function get_deadline_label(deadline: string | null, days: number, status: string): string
{
  if (status === 'done') return '已完成'
  if (!deadline) return '无截止'
  if (days < 0) return '逾期'
  if (days <= 3) return '临近'
  return '正常'
}

function get_deadline_state(days: number, status: string): 'state_done' | 'state_overdue' | 'state_soon' | 'state_normal'
{
  if (status === 'done') return 'state_done'
  if (days < 0) return 'state_overdue'
  if (days <= 3) return 'state_soon'
  return 'state_normal'
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md },
  summary_row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summary_card: {
    flex: 1, backgroundColor: moe_colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: moe_colors.border, padding: spacing.md
  },
  summary_label: { color: moe_colors.text_light, fontSize: font_size.xs, fontWeight: '600' },
  summary_value: { color: moe_colors.text, fontSize: font_size.xl, fontWeight: '800', marginTop: 4 },
  form_card: {
    backgroundColor: moe_colors.white, borderRadius: radius.md, borderWidth: 1,
    borderColor: moe_colors.border, padding: spacing.md, gap: spacing.sm
  },
  title_input: { color: moe_colors.text, fontSize: font_size.md, borderBottomWidth: 1, borderBottomColor: moe_colors.border, paddingVertical: 8 },
  deadline_input: { color: moe_colors.text, fontSize: font_size.sm, borderBottomWidth: 1, borderBottomColor: moe_colors.border, paddingVertical: 8 },
  add_btn: { backgroundColor: moe_colors.pink, borderRadius: radius.sm, paddingVertical: 11, alignItems: 'center' },
  add_btn_text: { color: moe_colors.white, fontWeight: '700', fontSize: font_size.md },
  filter_row: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  filter_btn: {
    flex: 1, backgroundColor: moe_colors.white, borderWidth: 1,
    borderColor: moe_colors.border, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center'
  },
  filter_active: { backgroundColor: moe_colors.pink, borderColor: moe_colors.pink },
  filter_text: { color: moe_colors.text_light, fontSize: font_size.sm, fontWeight: '600' },
  filter_text_active: { color: moe_colors.white },
  goal_row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: moe_colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: moe_colors.border, padding: spacing.sm,
    marginBottom: spacing.sm
  },
  goal_done: { opacity: 0.62 },
  check_btn: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    borderColor: moe_colors.pink, alignItems: 'center', justifyContent: 'center'
  },
  check_done: { backgroundColor: moe_colors.mint, borderColor: moe_colors.mint },
  check_text: { color: moe_colors.white, fontWeight: '800' },
  goal_main: { flex: 1, minWidth: 0 },
  goal_title: { color: moe_colors.text, fontSize: font_size.md, fontWeight: '700' },
  goal_deadline: { color: moe_colors.text_light, fontSize: font_size.xs, marginTop: 3 },
  badge: { minWidth: 48, textAlign: 'center', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, fontSize: font_size.xs, fontWeight: '700' },
  state_normal: { color: '#376D55', backgroundColor: 'rgba(58,181,126,0.14)' },
  state_soon: { color: '#89621B', backgroundColor: 'rgba(244,187,68,0.18)' },
  state_overdue: { color: '#9F3645', backgroundColor: 'rgba(238,95,112,0.16)' },
  state_done: { color: moe_colors.text_light, backgroundColor: 'rgba(120,120,120,0.12)' },
  delete_text: { color: moe_colors.danger, fontSize: font_size.xs, fontWeight: '700' },
  empty_text: { color: moe_colors.text_light, textAlign: 'center', marginTop: 40 }
})
