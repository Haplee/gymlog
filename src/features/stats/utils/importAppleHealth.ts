/**
 * Importar el peso corporal desde un export de Apple Health.
 *
 * El export de Salud es un ZIP con un `export.xml` dentro que, en un iPhone con
 * unos años de uso, ronda los **cientos de megas**: es un volcado de todo —cada
 * paso, cada latido, cada vez que el móvil detectó que subías una escalera—. De
 * todo eso aquí solo interesan los registros de peso.
 *
 * Por eso esto **no construye un DOM ni lee el fichero entero en memoria**.
 * `DOMParser` sobre 400 MB revienta la pestaña, y `FileReader.readAsText`
 * tampoco sobrevive. Se lee por trozos con `Blob.slice()` y se buscan los
 * registros con una expresión regular, arrastrando el final de cada trozo al
 * siguiente para no partir un registro por la mitad.
 *
 * Es la excepción a «para leer XML, un parser de XML»: aquí el fichero es
 * demasiado grande para caber, y los registros son etiquetas planas y
 * autocontenidas (`<Record ... />`), no un árbol que haya que recorrer.
 */

/** Tipo de registro de Apple Health que guarda el peso corporal. */
const TIPO_PESO = 'HKQuantityTypeIdentifierBodyMass';

/** Tamaño de cada trozo leído del fichero: 4 MB. */
const TAMANO_TROZO = 4 * 1024 * 1024;

/**
 * Tope de lo que se arrastra al siguiente trozo cuando la cola no cierra.
 *
 * Un `<Record .../>` de peso ocupa unos 300 bytes, así que 64 KB es margen de
 * sobra incluso para un `sourceName` kilométrico. Está aquí para que un fichero
 * corrupto —una etiqueta que nunca cierra— no acabe acumulando el fichero
 * entero en memoria, que es justo lo que este lector existe para evitar.
 */
const MAX_ARRASTRE = 64 * 1024;

/** Una libra en kilos. */
const LB_TO_KG = 0.45359237;

/** Topes de cordura: fuera de esto no es un peso corporal humano. */
const MIN_KG = 20;
const MAX_KG = 500;

/**
 * Un registro de peso: `<Record type="..." unit="kg" startDate="..." value="75.5"/>`.
 *
 * Los atributos no vienen siempre en el mismo orden según la versión de iOS, así
 * que cada uno se busca por su nombre dentro de la etiqueta ya acotada, en vez
 * de intentar un único patrón posicional que se rompería con la próxima versión.
 */
const RECORD = /<Record\b[^>]*\/?>/g;
const ATRIBUTO = (nombre: string) => new RegExp(`\\b${nombre}="([^"]*)"`);

export interface PesoImportado {
  /** Fecha local `YYYY-MM-DD`. Es la clave: un peso por día. */
  date: string;
  /** Peso en kg, ya convertido. */
  weightKg: number;
}

export interface AppleHealthResult {
  /** Un peso por día, el más reciente de ese día, ordenados de antiguo a nuevo. */
  weights: PesoImportado[];
  /** Registros de peso leídos antes de quedarse uno por día. */
  registrosLeidos: number;
  /** Registros de peso descartados por fecha o valor fuera de rango. */
  descartados: number;
}

/** El fichero no parecía un export de Apple Health. */
export class AppleHealthFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleHealthFormatError';
  }
}

/**
 * Fecha local `YYYY-MM-DD` de un atributo de Apple Health.
 *
 * Vienen como `2026-08-25 07:31:02 +0200`. Se conserva **el día que era para
 * quien se pesó**, no el día en UTC: pesarse a las 00:30 en España y que quede
 * registrado como el día anterior es exactamente el fallo que ya se corrigió en
 * `upsertTodayWeight`, y sería absurdo reintroducirlo por la puerta de atrás.
 */
export function fechaLocalDe(valor: string): string | null {
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Convierte a kg según la unidad que declara el propio registro. */
function aKilos(valor: number, unidad: string): number {
  const u = unidad.trim().toLowerCase();
  if (u === 'lb' || u === 'lbs') return valor * LB_TO_KG;
  if (u === 'st') return valor * 6.35029318; // stones, que el Reino Unido sigue usando
  return valor;
}

/**
 * Extrae los pesos de un fragmento de XML.
 *
 * Se exporta para poder probarla sin fabricar un fichero de cientos de megas.
 */
export function extraerPesosDeFragmento(xml: string): {
  pesos: PesoImportado[];
  descartados: number;
} {
  const pesos: PesoImportado[] = [];
  let descartados = 0;

  for (const [etiqueta] of xml.matchAll(RECORD)) {
    if (!etiqueta.includes(TIPO_PESO)) continue;

    const tipo = etiqueta.match(ATRIBUTO('type'))?.[1];
    if (tipo !== TIPO_PESO) continue;

    // `startDate` es cuándo se tomó la medida; `creationDate` es cuándo la
    // guardó la app. Para una báscula que sincroniza días después no son lo
    // mismo, y la que describe al usuario es la primera.
    const fechaBruta =
      etiqueta.match(ATRIBUTO('startDate'))?.[1] ?? etiqueta.match(ATRIBUTO('creationDate'))?.[1];
    const date = fechaBruta ? fechaLocalDe(fechaBruta) : null;

    const valorBruto = etiqueta.match(ATRIBUTO('value'))?.[1];
    const unidad = etiqueta.match(ATRIBUTO('unit'))?.[1] ?? 'kg';
    const valor = valorBruto != null ? Number(valorBruto.replace(',', '.')) : NaN;

    if (!date || !Number.isFinite(valor)) {
      descartados++;
      continue;
    }

    const weightKg = aKilos(valor, unidad);
    if (weightKg < MIN_KG || weightKg > MAX_KG) {
      descartados++;
      continue;
    }

    pesos.push({ date, weightKg: Math.round(weightKg * 100) / 100 });
  }

  return { pesos, descartados };
}

/**
 * Lee un export de Apple Health y devuelve un peso por día.
 *
 * `onProgress` recibe la fracción leída (0..1) para poder mover una barra: con
 * ficheros así de grandes, sin señal de avance parece que la app se ha colgado.
 */
export async function parseAppleHealthExport(
  file: Blob,
  onProgress?: (fraccion: number) => void,
): Promise<AppleHealthResult> {
  /** El último peso visto de cada día gana: es el que refleja el día completo. */
  const porDia = new Map<string, PesoImportado>();
  let registrosLeidos = 0;
  let descartados = 0;
  let vioAlgoDeSalud = false;

  /** Cola del trozo anterior, para los registros que caen en la frontera. */
  let arrastre = '';
  let leido = 0;

  while (leido < file.size) {
    const trozo = file.slice(leido, Math.min(leido + TAMANO_TROZO, file.size));
    // Cortar por bytes puede partir un carácter multibyte en la frontera y
    // dejarlo como carácter de reemplazo. No afecta: de cada registro solo se
    // leen tipo, fecha, valor y unidad, que son ASCII. Lo que puede quedar feo
    // es el nombre del dispositivo, y ese ni se lee.
    const texto = arrastre + (await trozo.text());
    leido += TAMANO_TROZO;

    if (!vioAlgoDeSalud && /<(HealthData|Record)\b/.test(texto)) vioAlgoDeSalud = true;

    // Se corta por el último `>`: hasta ahí son etiquetas completas, y lo que
    // sobra es un registro partido por la mitad que se completará con el trozo
    // siguiente. Cortar por un número fijo de bytes también funcionaría, pero
    // releería los registros que cayesen dentro del solape y falsearía los
    // recuentos que luego se le enseñan al usuario.
    const ultimoCierre = texto.lastIndexOf('>');
    const completo = ultimoCierre === -1 ? '' : texto.slice(0, ultimoCierre + 1);
    const cola = ultimoCierre === -1 ? texto : texto.slice(ultimoCierre + 1);

    const { pesos, descartados: fuera } = extraerPesosDeFragmento(completo);
    descartados += fuera;
    for (const p of pesos) {
      registrosLeidos++;
      porDia.set(p.date, p);
    }

    // Una cola desmedida solo puede venir de un fichero corrupto; se suelta para
    // no crecer sin límite.
    arrastre = cola.length > MAX_ARRASTRE ? '' : cola;

    onProgress?.(Math.min(1, leido / file.size));
  }

  // Si el fichero está truncado y no termina en `>`, la última cola no llegó a
  // procesarse en el bucle. Se intenta aquí para no perder el registro final.
  if (arrastre.trim() !== '') {
    const { pesos, descartados: fuera } = extraerPesosDeFragmento(arrastre);
    descartados += fuera;
    for (const p of pesos) {
      registrosLeidos++;
      porDia.set(p.date, p);
    }
  }

  if (!vioAlgoDeSalud) {
    throw new AppleHealthFormatError('El fichero no parece un export de Apple Health.');
  }

  const weights = [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { weights, registrosLeidos, descartados };
}
