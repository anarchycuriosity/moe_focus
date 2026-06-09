// ===== 统计页面 =====
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DatabaseService } from '../services/DatabaseService'
import { moe_colors, spacing, radius, font_size } from '../styles/theme'
import dayjs from 'dayjs'
import { ScreenBackground } from '../components/screen_background'

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const MOE_COLORS = [moe_colors.pink, moe_colors.lavender, moe_colors.mint, moe_colors.sky, '#FFE5B4', '#FFD1DC', '#D4C5E8']

interface DayStat { date: string; total_seconds: number }

export function StatsScreen(): JSX.Element
{
  const insets = useSafeAreaInsets()
  const [week_data, set_week_data] = useState<DayStat[]>([])
  const [focus_items, set_focus_items] = useState<Array<{ label: string; total_seconds: number }>>([])
  const [view, set_view] = useState<'weekly' | 'items'>('weekly')

  const week_start = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD')
  const week_end = dayjs(week_start).add(7, 'day').format('YYYY-MM-DD')

  useEffect(() =>
  {
    DatabaseService.get_all(
      `SELECT date, SUM(actual_duration_sec) as total_seconds
       FROM focus_sessions
       WHERE date >= ? AND date < ? AND status = 'completed'
       GROUP BY date ORDER BY date`,
      [week_start, week_end]
    ).then((rows) => set_week_data(rows as unknown as DayStat[]))

    DatabaseService.get_all(
      `SELECT COALESCE(fs.subject, '未命名') as label,
              SUM(fs.actual_duration_sec) as total_seconds
       FROM focus_sessions fs
       WHERE fs.date BETWEEN ? AND ? AND fs.status = 'completed'
       GROUP BY label ORDER BY total_seconds DESC`,
      [week_start, week_end]
    ).then((rows) => set_focus_items(rows as unknown as Array<{ label: string; total_seconds: number }>))
  }, [])

  const daily_data = DAY_LABELS.map((label, i) =>
  {
    const date = dayjs(week_start).add(i, 'day').format('YYYY-MM-DD')
    const found = week_data.find((d) => d.date === date)
    return { label, minutes: found ? Math.floor(found.total_seconds / 60) : 0 }
  })

  const max_min = Math.max(...daily_data.map((d) => d.minutes), 1)

  return (
    <ScreenBackground page_key="statistics">
      <ScrollView style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* View toggle */}
      <View style={styles.toggle_row}>
        <TouchableOpacity
          style={[styles.toggle_btn, view === 'weekly' && styles.toggle_active]}
          onPress={() => set_view('weekly')}
          activeOpacity={0.75}
        >
          <Text style={[styles.toggle_text, view === 'weekly' && styles.toggle_text_active]}>
            周视图
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle_btn, view === 'items' && styles.toggle_active]}
          onPress={() => set_view('items')}
          activeOpacity={0.75}
        >
          <Text style={[styles.toggle_text, view === 'items' && styles.toggle_text_active]}>
            专注分布
          </Text>
        </TouchableOpacity>
      </View>

      {view === 'weekly' ? (
        <View style={styles.chart_area}>
          <Text style={styles.chart_title}>本周专注时间（分钟）</Text>
          {/* Simple bar chart */}
          <View style={styles.bar_chart}>
            {daily_data.map((d, i) => (
              <View key={i} style={styles.bar_col}>
                <Text style={styles.bar_value}>{d.minutes}</Text>
                <View style={styles.bar_bg}>
                  <View style={[styles.bar_fill, {
                    height: `${(d.minutes / max_min) * 100}%` as unknown as number,
                    backgroundColor: MOE_COLORS[i]
                  }]} />
                </View>
                <Text style={styles.bar_label}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.chart_area}>
          <Text style={styles.chart_title}>专注事项分布</Text>
          {focus_items.length === 0 ? (
            <Text style={styles.empty_text}>本周暂无专注记录</Text>
          ) : (
            focus_items.map((item, i) =>
            {
              const total = focus_items.reduce((s, x) => s + x.total_seconds, 1)
              const pct = Math.round((item.total_seconds / total) * 100)
              return (
                <View key={i} style={styles.item_row}>
                  <View style={[styles.item_dot, { backgroundColor: MOE_COLORS[i % MOE_COLORS.length] }]} />
                  <Text style={styles.item_label}>{item.label}</Text>
                  <Text style={styles.item_min}>{Math.floor(item.total_seconds / 60)}分钟</Text>
                  <View style={styles.item_bar_bg}>
                    <View style={[styles.item_bar_fill, {
                      width: `${pct}%` as unknown as number,
                      backgroundColor: MOE_COLORS[i % MOE_COLORS.length]
                    }]} />
                  </View>
                </View>
              )
            })
          )}
        </View>
      )}
      </ScrollView>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md },
  toggle_row: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  toggle_btn: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: moe_colors.white, borderWidth: 1, borderColor: moe_colors.border
  },
  toggle_active: { backgroundColor: moe_colors.pink, borderColor: moe_colors.pink },
  toggle_text: { fontSize: font_size.sm, color: moe_colors.text_light },
  toggle_text_active: { color: moe_colors.white, fontWeight: '600' },
  chart_area: {
    backgroundColor: moe_colors.white, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: moe_colors.border, marginBottom: spacing.lg
  },
  chart_title: { fontSize: font_size.md, fontWeight: '600', color: moe_colors.text, marginBottom: spacing.lg },
  bar_chart: { flexDirection: 'row', justifyContent: 'space-around', height: 200, alignItems: 'flex-end' },
  bar_col: { alignItems: 'center', flex: 1 },
  bar_value: { fontSize: 11, color: moe_colors.text_light, marginBottom: 4 },
  bar_bg: {
    width: 28, height: 160, backgroundColor: 'rgba(255,183,197,0.08)',
    borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden'
  },
  bar_fill: { width: '100%', borderRadius: 6 },
  bar_label: { fontSize: 12, color: moe_colors.text, marginTop: 6, fontWeight: '500' },
  empty_text: { textAlign: 'center', color: moe_colors.text_light, padding: 30, fontSize: font_size.sm },
  item_row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  item_dot: { width: 10, height: 10, borderRadius: 5 },
  item_label: { fontSize: font_size.sm, color: moe_colors.text, width: 80 },
  item_min: { fontSize: font_size.xs, color: moe_colors.text_light, width: 50, textAlign: 'right' },
  item_bar_bg: {
    flex: 1, height: 8, backgroundColor: 'rgba(255,183,197,0.1)',
    borderRadius: 4, overflow: 'hidden'
  },
  item_bar_fill: { height: '100%', borderRadius: 4 }
})
