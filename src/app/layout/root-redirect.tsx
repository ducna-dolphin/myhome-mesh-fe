import { Navigate } from 'react-router-dom';
import { paths } from '@/shared/config/routes';
import { readLastTab } from '@/shared/lib';

/** `/` opens the tab the user saw last (localStorage `lastTab`), else Wifi. */
export function RootRedirect() {
  return <Navigate to={readLastTab() ?? paths.wifi} replace />;
}
