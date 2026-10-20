// @vitest-environment jsdom
//
// Cubre lo único de la app que depende del *estado* del router y no de la URL:
// la sugerencia que viaja en `location.state` al pulsar «Aplicar». Los e2e no
// llegan aquí porque las pantallas están tras el login, y el paso a
// react-router 8 es justo el tipo de cambio que rompe esto sin que el
// compilador diga nada.
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router';
import { CoachSuggestionBanner } from '../CoachSuggestionBanner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const suggestion = {
  id: 's1',
  kind: 'load' as const,
  exercise_name: 'Press banca',
  action: 'Sube a 82,5 kg en la primera serie',
  rationale: 'RIR 3 en las dos últimas sesiones',
  confidence: 'medium' as const,
};

const renderAt = (state: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/', state }]}>
      <Routes>
        <Route path="/" element={<CoachSuggestionBanner />} />
      </Routes>
    </MemoryRouter>,
  );

describe('CoachSuggestionBanner', () => {
  afterEach(cleanup);

  it('no dibuja nada en una visita normal', () => {
    const { container } = renderAt(undefined);
    expect(container.innerHTML).toBe('');
  });

  it('muestra la sugerencia que llega en el estado del router', () => {
    renderAt({ coachSuggestion: suggestion });
    expect(screen.getByText('Sube a 82,5 kg en la primera serie')).toBeDefined();
    expect(screen.getByText('Press banca')).toBeDefined();
  });

  it('ignora un estado que no lleva sugerencia', () => {
    const { container } = renderAt({ otraCosa: 42 });
    expect(container.innerHTML).toBe('');
  });

  it('al descartar desaparece y no vuelve', async () => {
    renderAt({ coachSuggestion: suggestion });
    await userEvent.click(screen.getByRole('button', { name: 'coach.banner_dismiss' }));
    expect(screen.queryByText('Sube a 82,5 kg en la primera serie')).toBeNull();
  });
});
