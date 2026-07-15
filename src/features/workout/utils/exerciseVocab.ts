/**
 * Diccionario local (ES) para el vocabulario finito de ExerciseDB: partes del
 * cuerpo, músculos y equipamiento. La API gratuita devuelve estos valores en
 * inglés; aquí los traducimos sin depender de red ni de un servicio externo.
 *
 * Los nombres de ejercicio y las instrucciones son texto libre y NO se traducen
 * (requeriría una API de traducción). Cualquier término no listado se muestra
 * tal cual como fallback.
 */

const BODY_PARTS: Record<string, string> = {
  neck: 'cuello',
  'lower arms': 'antebrazos',
  shoulders: 'hombros',
  cardio: 'cardio',
  'upper arms': 'brazos',
  chest: 'pecho',
  'lower legs': 'gemelos',
  back: 'espalda',
  'upper legs': 'piernas',
  waist: 'abdomen',
};

const EQUIPMENT: Record<string, string> = {
  'stepmill machine': 'escaladora',
  'elliptical machine': 'elíptica',
  'trap bar': 'barra hexagonal',
  tire: 'neumático',
  'stationary bike': 'bici estática',
  'wheel roller': 'rueda abdominal',
  'smith machine': 'máquina Smith',
  hammer: 'martillo',
  'skierg machine': 'máquina SkiErg',
  roller: 'rodillo',
  'resistance band': 'banda de resistencia',
  'bosu ball': 'bosu',
  weighted: 'con peso',
  'olympic barbell': 'barra olímpica',
  kettlebell: 'pesa rusa',
  'upper body ergometer': 'ergómetro de brazos',
  'sled machine': 'trineo',
  'ez barbell': 'barra Z',
  dumbbell: 'mancuerna',
  rope: 'cuerda',
  barbell: 'barra',
  band: 'banda',
  'stability ball': 'fitball',
  'medicine ball': 'balón medicinal',
  assisted: 'asistido',
  'leverage machine': 'máquina de palanca',
  cable: 'polea',
  'body weight': 'peso corporal',
};

const MUSCLES: Record<string, string> = {
  shins: 'espinillas',
  hands: 'manos',
  sternocleidomastoid: 'esternocleidomastoideo',
  soleus: 'sóleo',
  'inner thighs': 'cara interna del muslo',
  'lower abs': 'abdomen inferior',
  'grip muscles': 'músculos de agarre',
  abdominals: 'abdominales',
  'wrist extensors': 'extensores de muñeca',
  'wrist flexors': 'flexores de muñeca',
  'latissimus dorsi': 'dorsal ancho',
  'upper chest': 'pecho superior',
  'rotator cuff': 'manguito rotador',
  wrists: 'muñecas',
  groin: 'ingle',
  brachialis: 'braquial',
  deltoids: 'deltoides',
  feet: 'pies',
  ankles: 'tobillos',
  trapezius: 'trapecio',
  'rear deltoids': 'deltoides posterior',
  chest: 'pecho',
  quadriceps: 'cuádriceps',
  back: 'espalda',
  core: 'core',
  shoulders: 'hombros',
  'ankle stabilizers': 'estabilizadores del tobillo',
  rhomboids: 'romboides',
  obliques: 'oblicuos',
  'lower back': 'lumbar',
  'hip flexors': 'flexores de cadera',
  'levator scapulae': 'elevador de la escápula',
  abductors: 'abductores',
  'serratus anterior': 'serrato anterior',
  traps: 'trapecios',
  forearms: 'antebrazos',
  delts: 'deltoides',
  biceps: 'bíceps',
  'upper back': 'espalda alta',
  spine: 'columna',
  'cardiovascular system': 'sistema cardiovascular',
  triceps: 'tríceps',
  adductors: 'aductores',
  hamstrings: 'isquiotibiales',
  glutes: 'glúteos',
  pectorals: 'pectorales',
  calves: 'gemelos',
  lats: 'dorsales',
  quads: 'cuádriceps',
  abs: 'abdominales',
};

function lookup(map: Record<string, string>, value: string): string {
  const key = value.trim().toLowerCase();
  return map[key] ?? value;
}

export const translateBodyPart = (v: string) => lookup(BODY_PARTS, v);
export const translateEquipment = (v: string) => lookup(EQUIPMENT, v);
export const translateMuscle = (v: string) => lookup(MUSCLES, v);

/**
 * Mapea una parte del cuerpo de ExerciseDB (en inglés crudo) al enum de grupos
 * musculares de GymLog. Lo no reconocido cae a 'Otro'.
 */
const BODYPART_TO_GROUP: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombro',
  'upper legs': 'Pierna',
  'lower legs': 'Pierna',
  'upper arms': 'Brazos',
  'lower arms': 'Antebrazo',
  waist: 'Core',
  cardio: 'Cardio',
  neck: 'Otro',
};

export function muscleGroupFromBodyPart(bodyPart: string): string {
  return BODYPART_TO_GROUP[bodyPart.trim().toLowerCase()] ?? 'Otro';
}
