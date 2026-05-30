export const moe_colors = {
  sakura: {
    primary: '#FFB7C5',
    primary_dark: '#E892A3',
    secondary: '#C9A9DC',
    accent: '#B5EAD7',
    background: '#FFF5EE',
    surface: '#FFFFFF',
    text: '#5B4B59',
    text_light: '#8B7B89',
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
    text: '#4A4160',
    text_light: '#7B7290',
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
    text: '#4A5B55',
    text_light: '#7B8B85',
    border: '#E0F0E8',
    shadow: 'rgba(181, 234, 215, 0.25)',
    success: '#B5EAD7',
    warning: '#FFE5B4',
    danger: '#FFB7C5'
  }
} as const

export type ThemeName = keyof typeof moe_colors
