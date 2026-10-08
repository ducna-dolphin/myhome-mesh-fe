import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SegmentedTabs } from './segmented-tabs';

const items = [
  { to: '/internet/wifi', label: 'Wifi' },
  { to: '/internet/devices', label: 'Devices' },
  { to: '/internet/modem', label: 'Modem' },
];

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderTabs(initial = '/internet/devices') {
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SegmentedTabs label="Internet sections" items={items} />
              <CurrentPath />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SegmentedTabs', () => {
  it('renders route tabs with the current one selected and in the tab order', () => {
    renderTabs();

    expect(screen.getByRole('tablist', { name: 'Internet sections' })).toBeInTheDocument();
    const selected = screen.getByRole('tab', { name: 'Devices' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Wifi' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus and navigates with the arrow keys, wrapping at the ends', () => {
    renderTabs();
    screen.getByRole('tab', { name: 'Devices' }).focus();

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Modem' })).toHaveFocus();
    expect(screen.getByTestId('path')).toHaveTextContent('/internet/modem');
    expect(screen.getByRole('tab', { name: 'Modem' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Wifi' })).toHaveFocus();
    expect(screen.getByTestId('path')).toHaveTextContent('/internet/wifi');

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Modem' })).toHaveFocus();
  });

  it('jumps with Home and End', () => {
    renderTabs();
    screen.getByRole('tab', { name: 'Devices' }).focus();

    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Modem' })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Wifi' })).toHaveFocus();
    expect(screen.getByTestId('path')).toHaveTextContent('/internet/wifi');
  });

  it('keeps the first tab focusable when no route matches', () => {
    renderTabs('/elsewhere');

    expect(screen.getByRole('tab', { name: 'Wifi' })).toHaveAttribute('tabindex', '0');
    expect(screen.queryAllByRole('tab', { selected: true })).toHaveLength(0);
  });
});
