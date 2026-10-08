import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignalBars } from '../signal-bars/signal-bars';
import { Accordion } from './accordion';

describe('Accordion', () => {
  it('toggles the panel and aria-expanded', () => {
    render(
      <Accordion title="Contract">
        <p>Contract code</p>
      </Accordion>,
    );
    const trigger = screen.getByRole('button', { name: 'Contract' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Contract code')).not.toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Contract code')).toBeVisible();
  });
});

describe('SignalBars', () => {
  it.each([
    ['GOOD', 3],
    ['FAIR', 2],
    ['WEAK', 1],
    [null, 0],
  ] as const)('fills bars for level %s', (level, filled) => {
    const { container } = render(<SignalBars level={level} label="Signal" />);
    expect(screen.getByRole('img', { name: 'Signal' })).toBeInTheDocument();
    expect(container.querySelectorAll('.is-filled')).toHaveLength(filled);
  });
});
