import { useEffect, useState } from 'react';
import { translateTexts } from '@features/workout/utils/translate';

/**
 * Traduce un conjunto de textos (EN→idioma actual) y devuelve un mapa
 * original→traducción. Con idioma inglés devuelve mapa vacío (los llamadores
 * usan el texto original). Reacciona a cambios de la lista y del idioma.
 */
export function useTranslatedTexts(texts: string[], lang: string): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const target = lang.split('-')[0];
  const active = target !== 'en' && texts.length > 0;
  const joined = texts.join('');

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let cancelled = false;
    translateTexts(texts, target, controller.signal).then((res) => {
      if (!cancelled) setMap(res);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // joined y target cubren los cambios de contenido/idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, target, active]);

  // En inglés (o sin textos) devolvemos identidad para que se use el original.
  return active ? map : {};
}
