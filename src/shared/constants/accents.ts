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
  {
    id: 'amber',
    dark: { primary: '#fbbf24', dim: '#e0a81a', fg: '#2b1c00', rgb: '251 191 36' },
    light: { primary: '#7a5300', dim: '#614200', fg: '#ffffff', rgb: '122 83 0' },
  },
  {
    id: 'green',
    dark: { primary: '#4ade80', dim: '#37c46a', fg: '#052e14', rgb: '74 222 128' },
    light: { primary: '#146c2e', dim: '#0f5624', fg: '#ffffff', rgb: '20 108 46' },
  },
  {
    id: 'teal',
    dark: { primary: '#2dd4bf', dim: '#1fb8a5', fg: '#00302b', rgb: '45 212 191' },
    light: { primary: '#00695f', dim: '#00534b', fg: '#ffffff', rgb: '0 105 95' },
  },
  {
    id: 'indigo',
    dark: { primary: '#a5b4fc', dim: '#8b9be8', fg: '#111436', rgb: '165 180 252' },
    light: { primary: '#3730a3', dim: '#2c2782', fg: '#ffffff', rgb: '55 48 163' },
  },
  {
    id: 'magenta',
    dark: { primary: '#f0abfc', dim: '#d992e5', fg: '#2e0a33', rgb: '240 171 252' },
    light: { primary: '#8b1a96', dim: '#6f1478', fg: '#ffffff', rgb: '139 26 150' },
  },
  {
    id: 'rose',
    dark: { primary: '#fda4af', dim: '#e68b97', fg: '#330a12', rgb: '253 164 175' },
    light: { primary: '#a8123a', dim: '#860e2e', fg: '#ffffff', rgb: '168 18 58' },
  },
  {
    id: 'sand',
    dark: { primary: '#e7d3a1', dim: '#cfba88', fg: '#2a2110', rgb: '231 211 161' },
    light: { primary: '#645031', dim: '#504027', fg: '#ffffff', rgb: '100 80 49' },
  },
  {
    id: 'slate',
    dark: { primary: '#cbd5e1', dim: '#aeb9c7', fg: '#161b22', rgb: '203 213 225' },
    light: { primary: '#334155', dim: '#283443', fg: '#ffffff', rgb: '51 65 85' },
  },
  {
    id: 'emerald',
    dark: { primary: '#34d399', dim: '#22b884', fg: '#00291c', rgb: '52 211 153' },
    light: { primary: '#046c4e', dim: '#03563e', fg: '#ffffff', rgb: '4 108 78' },
  },
  {
    id: 'azure',
    dark: { primary: '#60a5fa', dim: '#4a8ee0', fg: '#06152e', rgb: '96 165 250' },
    light: { primary: '#1d4ed8', dim: '#173eab', fg: '#ffffff', rgb: '29 78 216' },
  },
  {
    id: 'lavender',
    dark: { primary: '#ddd6fe', dim: '#c3bae8', fg: '#1e1338', rgb: '221 214 254' },
    light: { primary: '#5b21b6', dim: '#491a92', fg: '#ffffff', rgb: '91 33 182' },
  },
  {
    id: 'plum',
    dark: { primary: '#e0a3d4', dim: '#c78abb', fg: '#2e0d28', rgb: '224 163 212' },
    light: { primary: '#7a2f6b', dim: '#622555', fg: '#ffffff', rgb: '122 47 107' },
  },
  {
    id: 'terracotta',
    dark: { primary: '#e08a63', dim: '#c7734e', fg: '#2b1108', rgb: '224 138 99' },
    light: { primary: '#8f3f1e', dim: '#723218', fg: '#ffffff', rgb: '143 63 30' },
  },
  {
    id: 'sage',
    dark: { primary: '#b4d3a0', dim: '#9cba88', fg: '#182310', rgb: '180 211 160' },
    light: { primary: '#4a6b38', dim: '#3b562c', fg: '#ffffff', rgb: '74 107 56' },
  },
  {
    id: 'steel',
    dark: { primary: '#94a3b8', dim: '#7c8a9e', fg: '#0f1720', rgb: '148 163 184' },
    light: { primary: '#3f4d5c', dim: '#323d49', fg: '#ffffff', rgb: '63 77 92' },
  },
];

export type AccentId = (typeof ACCENT_PRESETS)[number]['id'];

export const DEFAULT_ACCENT: AccentId = 'yellow';

export const getAccentPreset = (id: string): AccentPreset =>
  ACCENT_PRESETS.find((a) => a.id === id) ?? ACCENT_PRESETS[0];
