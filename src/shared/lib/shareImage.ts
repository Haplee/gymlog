import { toPng } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { devError, devWarn } from '@shared/lib/devtools';

interface ShareCardParams {
  exerciseCount: number;
  totalSets: number;
  totalVolume: number;
  date?: string;
}

/** Construye una tarjeta de marca (estilos inline para captura fiable). */
function buildCard({ exerciseCount, totalSets, totalVolume, date }: ShareCardParams): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    'width:540px',
    'height:540px',
    'box-sizing:border-box',
    'padding:48px',
    'background:#080808',
    'color:#ffffff',
    "font-family:'DM Sans',sans-serif",
    'display:flex',
    'flex-direction:column',
    'justify-content:space-between',
  ].join(';');

  const volText =
    totalVolume >= 1000
      ? `${(totalVolume / 1000).toFixed(1)}t`
      : `${totalVolume.toLocaleString()}kg`;

  const stat = (value: string, label: string) =>
    `<div style="display:flex;flex-direction:column;gap:4px">
       <span style="font-family:'Geist Mono',monospace;font-size:40px;font-weight:700;color:#c8ff00;line-height:1">${value}</span>
       <span style="font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#a0a0a0">${label}</span>
     </div>`;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:36px;height:36px;border-radius:10px;background:#c8ff00;display:flex;align-items:center;justify-content:center;color:#000;font-weight:800;font-size:20px">G</div>
      <span style="font-size:22px;font-weight:800">Gym<span style="color:#c8ff00">Log</span></span>
    </div>
    <div>
      <div style="font-size:16px;color:#a0a0a0;margin-bottom:28px">${date ?? 'Entrenamiento'}</div>
      <div style="display:flex;justify-content:space-between;gap:16px">
        ${stat(String(exerciseCount), 'Ejercicios')}
        ${stat(String(totalSets), 'Series')}
        ${stat(volText, 'Volumen')}
      </div>
    </div>
    <div style="font-size:14px;color:#5e636b">Registrado con GymLog</div>
  `;
  return el;
}

/**
 * Genera una imagen del entreno y la comparte. Nativo: Filesystem + Share.
 * Web: Web Share API con ficheros, o descarga como fallback.
 */
export async function shareWorkoutImage(params: ShareCardParams): Promise<boolean> {
  const node = buildCard(params);
  document.body.appendChild(node);
  try {
    const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });

    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = dataUrl.split(',')[1];
      const fileName = `gymlog_${Date.now()}.png`;
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
      await Share.share({ title: 'GymLog', url: uri });
      return true;
    }

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'gymlog.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'GymLog' });
      return true;
    }
    // Fallback: descarga
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'gymlog.png';
    a.click();
    return true;
  } catch (err) {
    if ((err as Error).name !== 'AbortError') devWarn('[ShareImage] Error:', err);
    else return true; // usuario canceló el diálogo de compartir
    devError('[ShareImage] No se pudo generar/compartir la imagen');
    return false;
  } finally {
    node.remove();
  }
}
