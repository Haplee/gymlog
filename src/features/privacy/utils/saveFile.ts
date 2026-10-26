import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Guarda un fichero de texto y se lo ofrece al usuario.
 *
 * En nativo no hay carpeta de descargas accesible sin permisos: se escribe en
 * la caché de la app y se abre la hoja de compartir, que es la forma en la que
 * el usuario elige dónde guardarlo (Archivos, Drive, correo…). En web, una
 * descarga normal.
 */
export async function saveTextFile(
  fileName: string,
  contents: string,
  mime: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
    await Share.share({ title: fileName, url: uri, dialogTitle: fileName });
    return;
  }

  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Sin revocar, el blob queda vivo hasta recargar la página.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
