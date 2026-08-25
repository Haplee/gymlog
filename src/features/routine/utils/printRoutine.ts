/**
 * La rutina en una hoja: para imprimirla o guardarla como PDF.
 *
 * Se genera un documento HTML **independiente** en vez de reaprovechar la
 * pantalla con `@media print`. Dos razones: la app es oscura y a sangre, y lo
 * que sale de la impresora tiene que ser negro sobre blanco y con márgenes; y la
 * hoja tiene columnas que en pantalla no existen —una casilla por serie para ir
 * apuntando a boli— porque en papel no hay dónde tocar.
 *
 * El PDF lo hace el propio diálogo de impresión con «Guardar como PDF». No entra
 * ninguna librería nueva por esto: una dependencia de generación de PDF pesa más
 * que toda la funcionalidad que aporta aquí.
 */

import { DAY_LABEL, type SharedRoutine } from './shareRoutine';

/**
 * Casillas que se dibujan por ejercicio cuando no dice cuántas series lleva.
 * Cuatro es lo que cabe cómodo en la fila sin apretar la letra.
 */
const SERIES_POR_DEFECTO = 4;
/** Más casillas que esto no caben en el ancho de una hoja A4. */
const MAX_CASILLAS = 8;

/** Escapa el texto que va al HTML. Los nombres los escribe el usuario. */
function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Añade «reps» solo cuando el objetivo es un número o un rango pelado.
 *
 * El campo es texto libre y la gente escribe cosas como «12 por lado», «AMRAP» o
 * «5 sobre cabeza + 5 por lado». Pegarle «reps» a ciegas produce «12 por lado
 * reps», que en una hoja impresa —donde no hay nada que tocar para aclararlo—
 * queda como una errata.
 */
export function formatearReps(reps: string): string {
  const limpio = reps.trim();
  // Números, rangos y listas: «8», «6-8», «8/10», «10, 8, 6».
  return /^[\d\s\-–/,x×]+$/.test(limpio) ? `${limpio} reps` : limpio;
}

/** Fecha larga en español para el pie de la hoja. */
function fechaLarga(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Documento HTML completo y autocontenido con la rutina.
 *
 * Sin `fetch`, sin fuentes externas y sin imágenes: se abre en una pestaña que
 * puede no tener red, y una fuente que no carga desplaza toda la maquetación
 * justo cuando el diálogo de impresión ya ha medido la página.
 */
export function buildRoutinePrintHtml(routine: SharedRoutine, now: Date = new Date()): string {
  const dias = routine.days
    .map((dia) => {
      const filas = dia.exercises
        .map((ex) => {
          const casillas = Math.min(MAX_CASILLAS, Math.max(1, ex.sets ?? SERIES_POR_DEFECTO));
          const objetivo = [
            ex.sets != null ? `${ex.sets} series` : null,
            ex.reps ? escapar(formatearReps(ex.reps)) : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return `
            <tr>
              <td class="ex">
                <span class="ex-nombre">${escapar(ex.name)}</span>
                ${ex.notes ? `<span class="ex-nota">${escapar(ex.notes)}</span>` : ''}
              </td>
              <td class="objetivo">${objetivo || '—'}</td>
              <td class="casillas">${'<span class="casilla"></span>'.repeat(casillas)}</td>
            </tr>`;
        })
        .join('');

      return `
        <section class="dia">
          <h2>
            <span class="dia-nombre">${escapar(DAY_LABEL[dia.day])}</span>
            ${dia.name ? `<span class="dia-titulo">${escapar(dia.name)}</span>` : ''}
          </h2>
          <table>
            <thead>
              <tr><th>Ejercicio</th><th>Objetivo</th><th>Series</th></tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapar(routine.name)}</title>
<style>
  /* Márgenes del papel, no del documento: sin esto la primera fila sale pegada
     al borde en la mayoría de impresoras. */
  @page { size: A4; margin: 15mm; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #111;
    background: #fff;
    font-size: 11pt;
    line-height: 1.4;
  }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 18pt; margin: 0 0 2px; }
  .descripcion { margin: 0; color: #444; font-size: 10pt; }

  /* Un día no se parte entre dos hojas si cabe entero: media tabla al final de
     una página y el resto en la siguiente es justo lo que hace inservible una
     rutina impresa. */
  .dia { margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
  .dia h2 {
    font-size: 12pt;
    margin: 0 0 6px;
    display: flex;
    align-items: baseline;
    gap: 8px;
    border-bottom: 1px solid #bbb;
    padding-bottom: 3px;
  }
  .dia-nombre { text-transform: uppercase; letter-spacing: 0.06em; }
  .dia-titulo { font-weight: 400; color: #555; font-size: 10pt; }

  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    font-weight: 600;
    padding: 2px 6px 4px 0;
    /* La cabecera nunca parte: la columna de casillas es estrecha a propósito
       (width 1%) y sin esto «Series» salía recortada a «Seri». */
    white-space: nowrap;
  }
  td { padding: 5px 6px 5px 0; border-bottom: 1px solid #e4e4e4; vertical-align: top; }
  th:last-child, td:last-child { text-align: right; padding-right: 0; }

  .ex-nombre { display: block; font-weight: 600; }
  .ex-nota { display: block; font-size: 9pt; color: #666; }
  /* Sin nowrap: el objetivo es texto libre y uno largo («5 sobre cabeza + 5
     por lado») estiraba la tabla hasta sacar la última casilla fuera del papel.
     Que parta en dos líneas es preferible a perder una casilla. */
  .objetivo { color: #333; font-size: 10pt; width: 22%; }
  /* Aquí sí: las casillas de una fila tienen que quedar en la misma línea. */
  .casillas { white-space: nowrap; width: 1%; }
  /* La casilla es para apuntar el peso a boli entre serie y serie. */
  .casilla {
    display: inline-block;
    width: 34px;
    height: 17px;
    border: 1px solid #999;
    border-radius: 2px;
    margin-left: 4px;
  }

  footer { margin-top: 20px; font-size: 8pt; color: #777; text-align: right; }

  /* Que la impresora no descarte los bordes de las casillas por "ahorrar
     tinta": sin casillas, la hoja no sirve para lo que se imprimió. */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <header>
    <h1>${escapar(routine.name)}</h1>
    ${routine.description ? `<p class="descripcion">${escapar(routine.description)}</p>` : ''}
  </header>
  ${dias}
  <footer>GymLog · ${escapar(fechaLarga(now))}</footer>
</body>
</html>`;
}

/**
 * Abre la hoja en una ventana nueva y lanza el diálogo de impresión.
 *
 * Devuelve `false` si el navegador bloqueó la ventana emergente, para que quien
 * llama pueda decirlo en vez de dejar al usuario mirando una pantalla en la que
 * no ha pasado nada.
 */
export function openRoutinePrintWindow(html: string): boolean {
  const ventana = window.open('', '_blank');
  if (!ventana) return false;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();

  // El diálogo se lanza cuando la hoja ya está maquetada; pedirlo antes imprime
  // una página en blanco en algunos navegadores.
  const imprimir = () => {
    ventana.focus();
    ventana.print();
  };
  if (ventana.document.readyState === 'complete') imprimir();
  else ventana.addEventListener('load', imprimir, { once: true });

  return true;
}
