import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pendingSpecNotes } from '@/shared/config/pending-spec-notes';
import { renderWithProviders } from '@/shared/test';
import { SpecNote } from './spec-note';

function renderNote() {
  renderWithProviders(
    <div>
      <SpecNote id="modemUptime" />
      <button type="button">outside</button>
    </div>,
  );
  return screen.getByRole('button', { name: 'Cần thống nhất' });
}

describe('SpecNote', () => {
  it('links the pending note text to the trigger and keeps it hidden until opened', () => {
    const trigger = renderNote();
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(tooltip).toHaveTextContent(pendingSpecNotes.modemUptime);
    expect(tooltip).not.toBeVisible();
  });

  it('toggles on tap and closes on a second tap', () => {
    const trigger = renderNote();

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toBeVisible();

    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
  });

  it('closes on Escape and on a pointer down outside', () => {
    const trigger = renderNote();

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();

    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
  });
});
