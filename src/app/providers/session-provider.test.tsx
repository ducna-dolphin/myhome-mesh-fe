import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/providers/session-provider';
import { i18n, useTranslation } from '@/shared/i18n';
import { useSession } from '@/shared/session';
import type { SuperAppSession } from '@/shared/super-app';

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }));

vi.mock('@/shared/super-app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/super-app')>();
  return { ...actual, getSession: getSessionMock };
});

function renderSession(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>,
  );
}

function LocaleProbe() {
  const { t } = useTranslation('common');
  return <div>{t('action.retry')}</div>;
}

function SessionProbe() {
  return <div>{useSession().locale}</div>;
}

beforeEach(async () => {
  getSessionMock.mockReset();
  await i18n.changeLanguage('vi');
});

describe('SessionProvider', () => {
  it('renders the app in vi-VN when the host session fails (no error screen, no retry loop)', async () => {
    getSessionMock.mockRejectedValue(new Error('session unavailable'));

    renderSession(<SessionProbe />);

    expect(await screen.findByText('vi-VN')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(i18n.resolvedLanguage).toBe('vi');
  });

  it('applies the locale from the resolved session before rendering children', async () => {
    getSessionMock.mockResolvedValue({
      locale: 'vi_VN',
    } satisfies SuperAppSession);
    renderSession(<LocaleProbe />);

    expect(await screen.findByText('Thử lại')).toBeInTheDocument();
    expect(i18n.resolvedLanguage).toBe('vi');
  });
});
