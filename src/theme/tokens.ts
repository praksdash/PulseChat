import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const LightColors = {
  primary: '#1677FF',
  primaryPressed: '#0E63DB',
  primarySoft: '#EAF3FF',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EEF2F6',
  text: '#17212B',
  textSecondary: '#687784',
  textTertiary: '#96A1AA',
  border: '#E3E8ED',
  divider: '#EDF0F3',
  success: '#22A06B',
  warning: '#E58A00',
  danger: '#E5484D',
  online: '#20B26B',
  incomingBubble: '#FFFFFF',
  outgoingBubble: '#DDEEFF',
  composer: '#FFFFFF',
  overlay: 'rgba(11, 20, 31, 0.45)',
} as const;

export const DarkColors = {
  primary: '#58A6FF',
  primaryPressed: '#7AB8FF',
  primarySoft: '#142C47',
  background: '#0F141A',
  surface: '#171D24',
  surfaceRaised: '#1C232C',
  surfaceMuted: '#222B35',
  text: '#F4F7FA',
  textSecondary: '#A7B2BC',
  textTertiary: '#74818C',
  border: '#2B3540',
  divider: '#232D37',
  success: '#45C98B',
  warning: '#FFB547',
  danger: '#FF6B70',
  online: '#45C98B',
  incomingBubble: '#1C242D',
  outgoingBubble: '#173A5F',
  composer: '#171D24',
  overlay: 'rgba(0, 0, 0, 0.62)',
} as const;

export type AppColors = typeof LightColors;

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const Typography = {
  hero: { fontSize: 34, lineHeight: 40, fontWeight: '800' } satisfies TextStyle,
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800' } satisfies TextStyle,
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' } satisfies TextStyle,
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '700' } satisfies TextStyle,
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' } satisfies TextStyle,
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' } satisfies TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' } satisfies TextStyle,
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' } satisfies TextStyle,
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '500' } satisfies TextStyle,
} as const;

export const Shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: {},
  }) ?? {},
  floating: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    default: {},
  }) ?? {},
} as const;
