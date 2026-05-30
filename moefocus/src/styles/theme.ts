export const moe_colors = {
  dark: {
    primary: '#FFB7C5',
    primary_dark: '#E892A3',
    secondary: '#C9A9DC',
    accent: '#B5EAD7',
    background: '#1A1A2E',
    surface: '#252540',
    text: '#E8E4F0',
    text_light: '#A09BB0',
    border: '#3A3A55',
    shadow: 'rgba(0, 0, 0, 0.4)',
    success: '#2BA08B',
    warning: '#F59E0B',
    danger: '#EF4444'
  },
  sakura: {
    primary: '#FFB7C5',
    primary_dark: '#E892A3',
    secondary: '#C9A9DC',
    accent: '#B5EAD7',
    background: '#FFF5EE',
    surface: '#FFFFFF',
    text: '#3A2E36',
    text_light: '#6B5B69',
    border: '#F0E0E8',
    shadow: 'rgba(255, 183, 197, 0.25)',
    success: '#B5EAD7',
    warning: '#FFE5B4',
    danger: '#FFB7C5'
  },
  lavender: {
    primary: '#C9A9DC',
    primary_dark: '#A98CC4',
    secondary: '#FFB7C5',
    accent: '#C7CEEA',
    background: '#F5F0FF',
    surface: '#FFFFFF',
    text: '#3A334D',
    text_light: '#6B6380',
    border: '#E8E0F0',
    shadow: 'rgba(201, 169, 220, 0.25)',
    success: '#B5EAD7',
    warning: '#FFE5B4',
    danger: '#FFB7C5'
  },
  mint: {
    primary: '#B5EAD7',
    primary_dark: '#8ECDB5',
    secondary: '#FFB7C5',
    accent: '#C7CEEA',
    background: '#F5FFFA',
    surface: '#FFFFFF',
    text: '#2E3D38',
    text_light: '#5B6B65',
    border: '#E0F0E8',
    shadow: 'rgba(181, 234, 215, 0.25)',
    success: '#B5EAD7',
    warning: '#FFE5B4',
    danger: '#FFB7C5'
  }
} as const

export type ThemeName = keyof typeof moe_colors

const dark_mode_attr = 'data-theme'

// Apply dark mode on/off. In dark mode we remove the data-theme attribute
// (so :root defaults apply). In light mode we set it to the chosen theme name.
export function apply_theme(dark_mode: boolean, light_theme?: string): void
{
  if (dark_mode)
  {
    document.documentElement.removeAttribute(dark_mode_attr)
  }
  else
  {
    document.documentElement.setAttribute(dark_mode_attr, light_theme || 'sakura')
  }
}

// Read settings from backend and apply theme. Call once on app mount.
export async function init_theme(): Promise<void>
{
  try
  {
    const dark = await window.electronAPI.settings.get('ui.darkMode')
    const theme = await window.electronAPI.settings.get('ui.theme')
    const is_dark = dark !== 'false' // default true (dark mode)
    apply_theme(is_dark, theme || 'sakura')
  }
  catch
  {
    // IPC not available (dev edge case), use dark defaults
    apply_theme(true)
  }
}
