import type { ReactNode } from 'react';
import { useSelectedContract, type ContractLink, type ContractLinkDetail } from '@/entities/contract';
import { useTranslation } from '@/shared/i18n';
import { EmptyState, SectionError, Skeleton } from '@/shared/ui';
import './require-serial-number.css';

/** Data scope handed to tab/sub-page content once the selected contract has an ONT. */
export interface ContractScope {
  serialNumber: string;
  contract: ContractLink;
  detail: ContractLinkDetail;
}

export interface RequireSerialNumberProps {
  children: (scope: ContractScope) => ReactNode;
}

/**
 * Renders `children` with a non-null `serialNumber` of the selected contract (LLD §11.5).
 * Shows a skeleton while the contract detail loads, an inline error with retry when it fails, and
 * "Chưa xác định được modem của hợp đồng" when OneBSS returned no ONT.
 * Assumes the Internet layout gate already handled loading / no-service / unselected states.
 */
export function RequireSerialNumber({ children }: RequireSerialNumberProps) {
  const { t } = useTranslation('internet');
  const { contract, detail, detailQuery, serialNumber } = useSelectedContract();

  if (!contract) return null;
  if (detailQuery.isPending) {
    return (
      <div className="require-serial__loading" aria-busy="true">
        <Skeleton height={72} />
        <Skeleton height={72} />
      </div>
    );
  }
  if (detailQuery.isError || !detail) return <SectionError onRetry={() => void detailQuery.refetch()} />;
  if (!serialNumber) return <EmptyState>{t('noModem')}</EmptyState>;

  return <>{children({ serialNumber, contract, detail })}</>;
}
