import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatTime } from '@/shared/lib';
import { SectionError } from '../section-error/section-error';
import { StaleNotice } from './stale-notice';

describe('StaleNotice', () => {
  it('renders the update time only for stale meta', () => {
    const updatedAt = '2026-10-08T02:30:00Z';
    const { rerender, container } = render(<StaleNotice meta={{ stale: false, updatedAt }} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<StaleNotice meta={{ stale: true, updatedAt }} />);
    expect(screen.getByText(`Cập nhật lúc ${formatTime(updatedAt)}`)).toBeInTheDocument();

    rerender(<StaleNotice meta={{ stale: true, updatedAt: null }} />);
    expect(screen.getByText('Dữ liệu có thể chưa được cập nhật')).toBeInTheDocument();
  });
});

describe('SectionError', () => {
  it('shows the default message and retries', () => {
    const onRetry = vi.fn();
    render(<SectionError onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa tải được phần này.');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
