import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FilterChip } from './chip';

function Filters() {
  const [filter, setFilter] = useState<'all' | 'blocked'>('all');
  return (
    <>
      <FilterChip label="All" count={10} pressed={filter === 'all'} onClick={() => setFilter('all')} />
      <FilterChip
        label="Blocked"
        count={1}
        pressed={filter === 'blocked'}
        onClick={() => setFilter('blocked')}
      />
    </>
  );
}

describe('FilterChip', () => {
  it('exposes the pressed state and count, and switches on click', () => {
    render(<Filters />);
    const all = screen.getByRole('button', { name: 'All 10' });
    const blocked = screen.getByRole('button', { name: 'Blocked 1' });

    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(blocked).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(blocked);

    expect(all).toHaveAttribute('aria-pressed', 'false');
    expect(blocked).toHaveAttribute('aria-pressed', 'true');
  });

  it('omits the badge without a count', () => {
    render(<FilterChip label="Online" pressed={false} />);
    expect(screen.getByRole('button', { name: 'Online' })).toBeInTheDocument();
  });
});
