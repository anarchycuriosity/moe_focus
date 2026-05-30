// Shared chart color palette — high contrast, distinguishable hues
// for stacked bar charts where each subject needs a distinct color

const chart_colors = [
  '#E75A7C',  // rose
  '#7B4FBF',  // purple
  '#2BA08B',  // teal
  '#3B82F6',  // blue
  '#F59E0B',  // amber
  '#EF4444',  // red
  '#8B5CF6',  // violet
  '#10B981',  // emerald
  '#EC4899',  // pink
  '#06B6D4',  // cyan
  '#F97316',  // orange
  '#6366F1',  // indigo
  '#14B8A6',  // teal-light
  '#A855F7',  // purple-light
  '#E11D48',  // rose-dark
  '#0EA5E9',  // sky
]

const default_task_color = '#FFB7C5'

function hash_str(s: string): number
{
  let hash = 0
  for (let i = 0; i < s.length; i++)
  {
    hash = ((hash << 5) - hash) + s.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Assign a consistent color to each subject. Uses the user's custom
// task color only when it differs from the schema default (#FFB7C5).
export function get_subject_color(subject: string, db_color?: string): string
{
  if (db_color && db_color !== default_task_color)
  {
    return db_color
  }
  return chart_colors[hash_str(subject) % chart_colors.length]
}
