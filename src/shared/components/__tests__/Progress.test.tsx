// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Progress } from '../ui/Progress';

afterEach(cleanup);

describe('Progress', () => {
  it('usa el elemento progress nativo con nombre y rango accesibles', () => {
    render(<Progress value={62} label="Descanso de anoche" />);
    const bar = screen.getByRole('progressbar', { name: 'Descanso de anoche' });
    expect(bar.tagName).toBe('PROGRESS');
    expect(bar.getAttribute('value')).toBe('62');
    expect(bar.getAttribute('max')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('62');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('recorta valores fuera de rango en vez de desbordar la barra', () => {
    render(<Progress value={180} max={100} label="Score" />);
    const high = screen.getByRole('progressbar');
    expect(high.getAttribute('value')).toBe('100');
    expect(high.getAttribute('aria-valuenow')).toBe('100');

    cleanup();
    render(<Progress value={-20} max={100} label="Score" />);
    const low = screen.getByRole('progressbar');
    expect(low.getAttribute('value')).toBe('0');
    expect(low.getAttribute('aria-valuenow')).toBe('0');
  });

  it('acepta un texto de valor alternativo', () => {
    render(<Progress value={72} label="Deuda de sueño" valueText="1 h 12 min" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('1 h 12 min');
  });
});
