import { useCallback } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useSuperApp } from '@/shared/super-app';
import { useToast } from '@/shared/ui';

/** X button of the Internet header: hands control back to the host (bridge `closeMiniApp`). */
export function useCloseMiniApp() {
  const superApp = useSuperApp();
  const toast = useToast();
  const { t } = useTranslation('common');

  return useCallback(async () => {
    try {
      await superApp.closeMiniApp();
    } catch {
      toast.show(t('bridge.failed'), { tone: 'danger' });
    }
  }, [superApp, t, toast]);
}
