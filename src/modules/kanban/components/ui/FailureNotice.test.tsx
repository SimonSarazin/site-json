// @vitest-environment jsdom
/**
 * Bandeau d'échec du module : la RÈGLE de traduction est celle de `kanbanErrorText` (raison fine
 * du serveur, nombres interpolés, repli du transport), et la région vivante reste montée.
 */
import '@/modules/kanban/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { KanbanApiError } from '@/modules/kanban/lib/kanbanErrors';
import { DangerNotice, FailureNotice } from './FailureNotice';

afterEach(cleanup);

describe('FailureNotice', () => {
  test('sans échec : la région vivante reste montée, vide — elle annoncera le premier échec', () => {
    const { container } = render(<FailureNotice error={null} />);
    const region = container.querySelector('[aria-live="assertive"]');
    expect(region).not.toBeNull();
    expect(region?.textContent).toBe('');
  });

  test('un refus se dit par sa RAISON quand le serveur en donne une', () => {
    render(<FailureNotice error={new KanbanApiError('forbidden', { status: 403, code: 'forbidden', detail: { reason: 'roleManagementNotAllowed' } })} />);
    expect(screen.getByText(/administrat/i)).toBeTruthy();
  });

  test('un code que le catalogue ignore retombe sur le message du transport, jamais sur une clé brute', () => {
    render(<FailureNotice error={new KanbanApiError('codeInconnu', { status: 422, code: 'codeInconnu' })} />);
    expect(screen.queryByText(/errors\./)).toBeNull();
    expect(screen.getByText('codeInconnu')).toBeTruthy();
  });

  test('annonce « alert » pour un échec rendu avec son écran', () => {
    render(<FailureNotice announce="alert" error={new KanbanApiError('x', { status: 500, code: 'serverError' })} />);
    expect(screen.getByRole('alert').textContent).not.toBe('');
  });
});

describe('DangerNotice', () => {
  test('le triangle est décoratif, le texte porte le message ; la commande de reprise se place au bout', () => {
    render(<DangerNotice action={<button type="button">Réessayer</button>}>Échec</DangerNotice>);
    const triangle = screen.getByText('Échec').parentElement?.querySelector('svg');
    expect(triangle?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
