import { useCallback } from 'react';
import { useCreateFaultReportMutation } from '@/entities/health-check';
import { useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useToast } from '@/shared/ui';

export interface ReportFaultController {
  report: (checkId: string | null) => void;
  isPending: boolean;
}

/**
 * "Báo hỏng" when the line is DISCONNECTED (P6-01, proposed B-09): `POST …/fault-reports` with the
 * check id → toast with the OneBSS ticket code. Any failure (503 UPSTREAM_UNAVAILABLE included)
 * shows one error toast; the same action retries with the same idempotency key.
 */
export function useReportFault(contractId: string): ReportFaultController {
  const { t } = useTranslation('quality');
  const toast = useToast();
  const keys = useIdempotencyKey();
  const mutation = useCreateFaultReportMutation(contractId);
  const mutate = mutation.mutate;

  const report = useCallback(
    (checkId: string | null) => {
      mutate(
        { checkId, idempotencyKey: keys.forAction({ checkId }) },
        {
          onSuccess: ({ ticketCode }) => {
            keys.renew();
            toast.show(t('reportFault.success', { ticketCode }), { duration: 6_000 });
          },
          onError: () => toast.show(t('reportFault.error'), { tone: 'danger' }),
        },
      );
    },
    [keys, mutate, t, toast],
  );

  return { report, isPending: mutation.isPending };
}
