/**
 * Enlaces externos estables.
 *
 * La descarga apunta a la ruta del VPS, no a la URL de un release concreto de
 * GitHub: esos enlaces llevaban la versión dentro y se quedaban atrás en cada
 * publicación (se encontraron apuntando a v5.0.0 y a v0.5.0, este último roto
 * desde hacía media docena de versiones). Es la misma ruta que usa el CTA del
 * landing, y el APK que se sube a mano en cada release la sobreescribe.
 */
export const APK_DOWNLOAD_URL = 'https://gymlog.dpdns.org/download/gymlog.apk';
