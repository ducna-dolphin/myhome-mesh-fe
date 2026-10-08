import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '../switch/switch';
import { ListRow } from './list-row';

describe('ListRow', () => {
  it('renders a link row named by its title and subtitle', () => {
    render(
      <MemoryRouter>
        <ListRow to="/devices/1" title="iPad" subtitle="A4:56:02:3C:22:11" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'iPad A4:56:02:3C:22:11' })).toHaveAttribute(
      'href',
      '/devices/1',
    );
  });

  it('keeps a trailing control independent from the row button', () => {
    const onRowClick = vi.fn();
    const onToggle = vi.fn();
    render(
      <ListRow
        title="Wi-Fi 5G"
        onClick={onRowClick}
        chevron={false}
        trailing={<Switch label="Enable" checked={false} onCheckedChange={onToggle} />}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Enable' }));
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(onRowClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Wi-Fi 5G' }));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('renders static content without an interactive element', () => {
    render(<ListRow title="Model01" subtitle="ONT" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('forwards data-* and aria-* attributes to the row root', () => {
    const { container } = render(<ListRow title="TV" data-focused aria-describedby="tv-hint" />);
    const root = container.querySelector('.ui-list-row');
    expect(root).toHaveAttribute('data-focused', 'true');
    expect(root).toHaveAttribute('aria-describedby', 'tv-hint');
  });
});
