import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NoInternetServicePage } from '@/pages/no-internet-service';
import { internetTabs, isTabPath, tabPaths } from '@/shared/config/routes';
import { useTranslation } from '@/shared/i18n';
import { writeLastTab } from '@/shared/lib';
import { ErrorState, SegmentedTabs, Skeleton } from '@/shared/ui';
import { ContractCard, ContractCardSkeleton } from '@/widgets/contract-card';
import { AppHeader } from './app-header';
import { useCloseMiniApp } from './use-close-mini-app';
import { useContractGate } from './use-contract-gate';
import { useTabScrollMemory } from './use-tab-scroll-memory';

/**
 * Internet screen: header, contract card, sticky pill tabs and the active tab (LLD P1-01/P1-02).
 * Also the contract gate of the 4 tabs: no contract → "Chưa có dịch vụ", several contracts and
 * none selected → card with the picker only, no tabs.
 */
export function InternetLayout() {
  const { t } = useTranslation('internet');
  const { pathname } = useLocation();
  const close = useCloseMiniApp();
  const { selected, retry } = useContractGate();

  useTabScrollMemory(pathname);
  useEffect(() => {
    if (isTabPath(pathname)) writeLastTab(pathname);
  }, [pathname]);

  if (selected.status === 'none') return <NoInternetServicePage />;

  const tabItems = internetTabs.map((tab) => ({ to: tabPaths[tab], label: t(`tabs.${tab}`) }));
  const activeTab = internetTabs.find((tab) => tabPaths[tab] === pathname);

  return (
    <>
      <AppHeader variant="root" title={t('title')} onClose={() => void close()} />
      <main className="internet-screen">
        {selected.status === 'loading' && (
          <div className="internet-screen__loading" role="status" aria-busy="true">
            <span className="sr-only">{t('loading')}</span>
            <ContractCardSkeleton />
            <Skeleton height={36} shape="pill" />
            <Skeleton height={120} />
          </div>
        )}

        {selected.status === 'error' && (
          <ErrorState error={selected.listQuery.error} onRetry={() => void retry()} />
        )}

        {(selected.status === 'ready' || selected.status === 'unselected') && (
          <ContractCard selected={selected} />
        )}

        {selected.status === 'ready' && (
          <>
            <div className="internet-screen__tabs">
              <SegmentedTabs items={tabItems} label={t('tabs.label')} />
            </div>
            <div
              className="internet-screen__panel"
              role="tabpanel"
              aria-label={activeTab ? t(`tabs.${activeTab}`) : undefined}
            >
              {/* Keyed: the incoming tab cross-fades in. */}
              <div className="internet-screen__panel-content" key={pathname}>
                <Outlet />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
