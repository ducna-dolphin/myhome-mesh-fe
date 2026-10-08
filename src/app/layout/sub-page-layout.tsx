import { Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { NoInternetServicePage } from '@/pages/no-internet-service';
import { paths } from '@/shared/config/routes';
import { useTranslation } from '@/shared/i18n';
import { ErrorState, LoadingState, usePageTitleOverride } from '@/shared/ui';
import { AppHeader } from './app-header';
import { findSubPageHandle } from './route-handle';
import { useContractGate } from './use-contract-gate';

/** Detail screens below a tab: back button + title from the route `handle` (or a page override). */
export function SubPageLayout() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const handle = findSubPageHandle(useMatches());
  const overrideTitle = usePageTitleOverride();
  const { selected, retry } = useContractGate();
  const backTo = handle?.backTo ?? paths.wifi;

  // A deep link has no in-app history entry to pop: go to the owning tab instead. Popping an entry
  // pushed with `viewTransition` replays the transition (react-router), so back slides too.
  const goBack = () =>
    location.key === 'default' ? navigate(backTo, { replace: true, viewTransition: true }) : navigate(-1);

  if (selected.status === 'none') return <NoInternetServicePage />;
  if (selected.status === 'unselected') return <Navigate to={backTo} replace />;

  return (
    <>
      <AppHeader
        variant="sub"
        title={overrideTitle ?? (handle ? t(handle.titleKey) : t('route.internet'))}
        onBack={() => void goBack()}
      />
      <main className="sub-page">
        {selected.status === 'loading' && <LoadingState />}
        {selected.status === 'error' && (
          <ErrorState error={selected.listQuery.error} onRetry={() => void retry()} />
        )}
        {selected.status === 'ready' && <Outlet />}
      </main>
    </>
  );
}
