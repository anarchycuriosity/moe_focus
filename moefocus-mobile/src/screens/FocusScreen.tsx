// ===== 专注计时页面 =====
import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFocusStore, create_focus_session,
  save_focus_complete, save_focus_abandon
} from '../store/useFocusStore'
import { moe_colors, spacing, radius, font_size } from '../styles/theme'
import { ScreenBackground } from '../components/screen_background'

export function FocusScreen(): JSX.Element
{
  const insets = useSafeAreaInsets()
  const {
    phase, remaining_seconds, total_seconds, focus_duration_min,
    rest_duration_min, subject, session_id,
    set_config, set_subject, start_session,
    pause_session, resume_session, tick,
    switch_to_rest, end_session
  } = useFocusStore()

  const [focus_input, set_focus_input] = useState(String(focus_duration_min))
  const [rest_input, set_rest_input] = useState(String(rest_duration_min))
  const interval_ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear_timer = () =>
  {
    if (interval_ref.current)
    {
      clearInterval(interval_ref.current)
      interval_ref.current = null
    }
  }

  const start_interval = () =>
  {
    clear_timer()
    interval_ref.current = setInterval(() =>
    {
      const state = useFocusStore.getState()
      if (state.remaining_seconds > 1)
      {
        state.tick(state.remaining_seconds - 1)
        return
      }

      state.tick(0)
      if (state.phase === 'focus')
      {
        if (state.session_id)
        {
          save_focus_complete(state.session_id, state.focus_duration_min * 60)
        }

        if (state.rest_duration_min > 0)
        {
          state.switch_to_rest()
        }
        else
        {
          clear_timer()
          state.end_session()
        }
      }
      else
      {
        clear_timer()
        state.end_session()
      }
    }, 1000)
  }

  const start = async () =>
  {
    try
    {
      const fid = await create_focus_session(subject || '专注', focus_duration_min, rest_duration_min * 60)
      start_session(fid)
    }
    catch (error)
    {
      Alert.alert('开始专注失败', error instanceof Error ? error.message : String(error))
    }
  }

  const pause = async () =>
  {
    clear_timer()
    pause_session()
  }

  const resume = () =>
  {
    resume_session()
  }

  const stop = async () =>
  {
    clear_timer()
    if (session_id) await save_focus_abandon(session_id)
    end_session()
  }

  useEffect(() =>
  {
    if (phase === 'focus' || phase === 'rest')
    {
      start_interval()
    }
    else
    {
      clear_timer()
    }

    return () => clear_timer()
  }, [phase])

  const minutes = Math.floor(remaining_seconds / 60)
  const seconds = remaining_seconds % 60
  const time_str = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const progress = total_seconds > 0 ? remaining_seconds / total_seconds : 1
  const is_running = phase === 'focus' || phase === 'rest'

  return (
    <ScreenBackground page_key="focus" content_style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Timer circle */}
      <View style={styles.circle}>
        <View style={[styles.progress_bar, {
          width: `${progress * 100}%` as unknown as number,
          backgroundColor: phase === 'rest' ? moe_colors.mint : moe_colors.pink
        }]} />
        <Text style={styles.time}>{time_str}</Text>
        <Text style={styles.phase_label}>
          {phase === 'focus' ? '专注中' : phase === 'rest' ? '休息中' :
           phase === 'paused' ? '已暂停' : '准备开始'}
        </Text>
      </View>

      {/* Subject */}
      {phase === 'idle' ? (
        <View style={styles.config_area}>
          <TextInput
            style={styles.subject_input}
            placeholder="专注事项（如：学习日语）"
            placeholderTextColor={moe_colors.text_light}
            value={subject}
            onChangeText={set_subject}
          />
          <View style={styles.config_row}>
            <View style={styles.config_field}>
              <Text style={styles.config_label}>专注(分)</Text>
              <TextInput
                style={styles.config_input}
                keyboardType="numeric"
                value={focus_input}
                onChangeText={(v) =>
                {
                  set_focus_input(v)
                  const n = Number(v)
                  if (n > 0) set_config(n, rest_duration_min)
                }}
              />
            </View>
            <View style={styles.config_field}>
              <Text style={styles.config_label}>休息(分)</Text>
              <TextInput
                style={styles.config_input}
                keyboardType="numeric"
                value={rest_input}
                onChangeText={(v) =>
                {
                  set_rest_input(v)
                  const n = Number(v)
                  if (n >= 0) set_config(focus_duration_min, n)
                }}
              />
            </View>
          </View>
        </View>
      ) : (
        subject ? <Text style={styles.subject_text}>📌 {subject}</Text> : null
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {phase === 'idle' && (
          <TouchableOpacity style={styles.primary_btn} onPress={start} activeOpacity={0.75}>
            <Text style={styles.primary_btn_text}>开始专注</Text>
          </TouchableOpacity>
        )}
        {(phase === 'focus' || phase === 'rest') && (
          <>
            <TouchableOpacity style={styles.control_btn} onPress={pause} activeOpacity={0.75}>
              <Text style={styles.control_btn_text}>暂停</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.control_btn, styles.danger_btn]} onPress={stop} activeOpacity={0.75}>
              <Text style={[styles.control_btn_text, { color: moe_colors.danger }]}>结束</Text>
            </TouchableOpacity>
          </>
        )}
        {phase === 'paused' && (
          <>
            <TouchableOpacity style={styles.primary_btn} onPress={resume} activeOpacity={0.75}>
              <Text style={styles.primary_btn_text}>继续</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.control_btn} onPress={stop} activeOpacity={0.75}>
              <Text style={styles.control_btn_text}>结束</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.md, alignItems: 'center' },
  circle: {
    width: 220, height: 220, borderRadius: 110, borderWidth: 4,
    borderColor: moe_colors.pink, justifyContent: 'center', alignItems: 'center',
    backgroundColor: moe_colors.white, marginBottom: spacing.lg, overflow: 'hidden'
  },
  progress_bar: {
    position: 'absolute', bottom: 0, left: 0, height: '100%' as unknown as number, opacity: 0.2
  },
  time: { fontSize: 44, fontWeight: '700', color: moe_colors.text, letterSpacing: 1 },
  phase_label: { fontSize: font_size.sm, color: moe_colors.text_light, marginTop: 4 },
  config_area: { width: '100%', marginBottom: spacing.lg },
  subject_input: {
    backgroundColor: moe_colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: 12, fontSize: font_size.md, marginBottom: spacing.md, color: moe_colors.text,
    borderWidth: 1, borderColor: moe_colors.border
  },
  config_row: { flexDirection: 'row', gap: spacing.md },
  config_field: { flex: 1 },
  config_label: { fontSize: font_size.xs, color: moe_colors.text_light, marginBottom: 4 },
  config_input: {
    backgroundColor: moe_colors.white, borderRadius: radius.sm, paddingHorizontal: spacing.md,
    paddingVertical: 10, fontSize: font_size.md, textAlign: 'center', color: moe_colors.text,
    borderWidth: 1, borderColor: moe_colors.border
  },
  subject_text: { fontSize: font_size.md, color: moe_colors.text, marginBottom: spacing.lg, fontWeight: '500' },
  controls: { flexDirection: 'row', gap: 12 },
  primary_btn: {
    backgroundColor: moe_colors.pink, borderRadius: radius.md,
    paddingHorizontal: 28, paddingVertical: 14
  },
  primary_btn_text: { fontSize: font_size.md, color: moe_colors.white, fontWeight: '600' },
  control_btn: {
    backgroundColor: 'rgba(255,183,197,0.15)', borderRadius: radius.md,
    paddingHorizontal: 24, paddingVertical: 14, borderWidth: 1, borderColor: moe_colors.pink
  },
  control_btn_text: { fontSize: font_size.md, color: moe_colors.pink_dark, fontWeight: '500' },
  danger_btn: { borderColor: moe_colors.danger, backgroundColor: 'rgba(255,107,107,0.08)' }
})
