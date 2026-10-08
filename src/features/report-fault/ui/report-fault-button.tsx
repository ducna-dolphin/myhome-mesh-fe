import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { useReportFault } from '../model/use-report-fault';

interface ReportFaultButtonProps {
  contractId: string;
  checkId: string | null;
}

/** Secondary "Báo hỏng" button of the DISCONNECTED line result (BR-68). */
export function ReportFaultButton({ contractId, checkId }: ReportFaultButtonProps) {
  const { t } = useTranslation('quality');
  const { report, isPending } = useReportFault(contractId);
  return (
    <Button variant="secondary" fullWidth loading={isPending} onClick={() => report(checkId)}>
      {t('action.REPORT_FAULT')}
    </Button>
  );
}
