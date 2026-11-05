// @vitest-environment jsdom
/**
 * Ligne à cocher du module (`ChoiceRow`, reprise de co-kanban) : une case NATIVE dans un
 * `<label>`, l'anneau de focus porté par la ligne, et la ligne cochée teintée ET cochée.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ChoiceRow } from './ChoiceRow';

afterEach(cleanup);

test('le clic sur le libellé coche la case native ; l anneau est sur la ligne, la case perd le sien', () => {
  const onChange = vi.fn();
  render(
    <ChoiceRow checked={false} onChange={onChange} trailing="2 membres">
      Coordination
    </ChoiceRow>,
  );
  const box = screen.getByRole('checkbox', { name: /Coordination/ });
  fireEvent.click(screen.getByText('Coordination'));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(box.closest('label')?.className).toContain('has-[input:focus-visible]:outline-2');
  expect(box.className).toContain('focus-visible:outline-none');
  expect(screen.getByText('2 membres').className).toContain('tabular-nums');
});

test('cochée : la teinte ET la case, jamais la couleur seule', () => {
  render(
    <ChoiceRow checked onChange={() => undefined}>
      Dev
    </ChoiceRow>,
  );
  const box = screen.getByRole('checkbox', { name: 'Dev' });
  expect(box).toBeChecked();
  expect(box.closest('label')?.className).toContain('bg-primary/10');
});
