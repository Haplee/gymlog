// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  IconBook,
  IconBrain,
  IconCalendar,
  IconChart,
  IconCheckBadge,
  IconDumbbell,
  IconFemale,
  IconFlame,
  IconGear,
  IconHistory,
  IconHome,
  IconMale,
  IconMenu,
  IconPulse,
  IconRuler,
  IconSearch,
  IconShoe,
  IconStar,
  IconTimer,
  IconTrophy,
  IconUser,
  IconWatch,
} from '../GymIcons';

afterEach(cleanup);

const icons = [
  IconHome,
  IconDumbbell,
  IconShoe,
  IconHistory,
  IconGear,
  IconSearch,
  IconUser,
  IconTrophy,
  IconFlame,
  IconCalendar,
  IconChart,
  IconPulse,
  IconMenu,
  IconBook,
  IconRuler,
  IconWatch,
  IconCheckBadge,
  IconStar,
  IconBrain,
  IconMale,
  IconFemale,
  IconTimer,
] as const;

describe('GymIcons', () => {
  it.each(icons)('renderiza %p como SVG accesible y heredable', (Icon) => {
    const { container } = render(<Icon className="size-5" />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('class')).toBe('size-5');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });

  it('usa currentColor para los iconos rellenos', () => {
    const { container } = render(<IconTrophy />);
    expect(container.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
  });

  it('mantiene el pulso como trazo sin relleno', () => {
    const { container } = render(<IconPulse />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('fill')).toBe('none');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('stroke-width')).toBe('2.4');
  });
});
