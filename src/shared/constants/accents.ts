/**
 * Colores de acento que el usuario puede elegir en Ajustes.
 *
 * Cada uno trae su pareja para tema oscuro y para tema claro en vez de
 * derivarse de un solo valor: el acento se usa a la vez como relleno (con
 * `fg` encima) y como color de texto, así que en claro tiene que ser oscuro
 * para cumplir el AA sobre blanco. Un amarillo puro como texto sobre blanco
 * es ilegible, y con cualquier otro tono vivo pasaría lo mismo.
 */
export interface AccentPreset {
  id: string;
  /** Clave i18n del nombre: settings.accent_<id> */
  dark: { primary: string; dim: string; fg: string; rgb: string };
  light: { primary: string; dim: string; fg: string; rgb: string };
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'yellow',
    dark: { primary: '#ffd93d', dim: '#e6c02f', fg: '#241c00', rgb: '255 217 61' },
    light: { primary: '#6b5200', dim: '#57420a', fg: '#ffffff', rgb: '107 82 0' },
  },
  {
    id: 'lime',
    dark: { primary: '#cbf24c', dim: '#b2d833', fg: '#17200a', rgb: '203 242 76' },
    light: { primary: '#4f5f00', dim: '#3e4a00', fg: '#ffffff', rgb: '79 95 0' },
  },
  {
    id: 'mint',
    dark: { primary: '#60eca8', dim: '#3ecf8e', fg: '#003822', rgb: '96 236 168' },
    light: { primary: '#006c45', dim: '#005537', fg: '#ffffff', rgb: '0 108 69' },
  },
  {
    id: 'cyan',
    dark: { primary: '#38bdf8', dim: '#1fa5e0', fg: '#04202e', rgb: '56 189 248' },
    light: { primary: '#05628a', dim: '#044e6e', fg: '#ffffff', rgb: '5 98 138' },
  },
  {
    id: 'blue',
    dark: { primary: '#7aa2ff', dim: '#5f8ae8', fg: '#0a1330', rgb: '122 162 255' },
    light: { primary: '#2a4bd7', dim: '#213cad', fg: '#ffffff', rgb: '42 75 215' },
  },
  {
    id: 'violet',
    dark: { primary: '#c4a3ff', dim: '#a988e8', fg: '#1b0e33', rgb: '196 163 255' },
    light: { primary: '#6b3fd4', dim: '#5632aa', fg: '#ffffff', rgb: '107 63 212' },
  },
  {
    id: 'pink',
    dark: { primary: '#ff9ec4', dim: '#e884ab', fg: '#33101f', rgb: '255 158 196' },
    light: { primary: '#b32a63', dim: '#8f214f', fg: '#ffffff', rgb: '179 42 99' },
  },
  {
    id: 'orange',
    dark: { primary: '#ffab5c', dim: '#e89344', fg: '#2b1600', rgb: '255 171 92' },
    light: { primary: '#9a4a00', dim: '#7b3b00', fg: '#ffffff', rgb: '154 74 0' },
  },
  {
    id: 'red',
    dark: { primary: '#ff8f7a', dim: '#e87562', fg: '#2e0d06', rgb: '255 143 122' },
    light: { primary: '#b3301a', dim: '#8f2615', fg: '#ffffff', rgb: '179 48 26' },
  },
];

export type AccentId = (typeof ACCENT_PRESETS)[number]['id'];

export const DEFAULT_ACCENT: AccentId = 'yellow';

export const getAccentPreset = (id: string): AccentPreset =>
  ACCENT_PRESETS.find((a) => a.id === id) ?? ACCENT_PRESETS[0];
