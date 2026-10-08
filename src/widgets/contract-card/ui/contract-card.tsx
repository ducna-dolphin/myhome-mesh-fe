import { useState } from 'react';
import { CONTRACT_PAYMENT_TARGETS, type SelectedContract } from '@/entities/contract';
import { hasPartialError } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { formatDate } from '@/shared/lib';
import { useSuperApp } from '@/shared/super-app';
import { Accordion, Button, SectionError, Skeleton, SpecNote, StaleNotice, useToast } from '@/shared/ui';
import { contractCardMemory } from '../model/contract-card-memory';
import { ContractSelect } from './contract-select';
import './contract-card.css';

export interface ContractCardProps {
  /** Result of `useSelectedContract()` (status `ready` or `unselected`). */
  selected: SelectedContract;
}

function DetailSkeleton() {
  return (
    <div className="contract-card__rows" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div className="contract-card__row" key={row}>
          <Skeleton width="40%" shape="text" />
          <Skeleton width="30%" shape="text" />
        </div>
      ))}
    </div>
  );
}

/**
 * "Thông tin hợp đồng" accordion shared by the 4 tabs (LLD P1-02): contract picker when the user
 * has several contracts, contract dates, last payment and the pay/renew shortcut to the host.
 */
export function ContractCard({ selected }: ContractCardProps) {
  const { t } = useTranslation('internet');
  const { t: tCommon } = useTranslation('common');
  const superApp = useSuperApp();
  const toast = useToast();
  const { contracts, contract, detailQuery } = selected;
  const result = detailQuery.data;
  const detail = result?.data ?? null;
  const notAvailable = tCommon('state.notAvailable');
  const paymentFailed =
    result !== undefined && CONTRACT_PAYMENT_TARGETS.some((target) => hasPartialError(result, target));
  const canPay = superApp.supports('openPayment');
  const [expanded, setExpanded] = useState(contractCardMemory.isExpanded);
  const onOpenChange = (next: boolean) => {
    contractCardMemory.setExpanded(next);
    setExpanded(next);
  };

  async function pay(contractCode: string) {
    try {
      await superApp.openPayment({ contractCode });
    } catch {
      toast.show(t('contract.paymentFailed'), { tone: 'danger' });
    }
  }

  const rows = detail
    ? [
        { label: t('contract.code'), value: detail.contractCode },
        { label: t('contract.registrationDate'), value: formatDate(detail.registrationDate) },
        { label: t('contract.expiryDate'), value: formatDate(detail.expiryDate) },
        {
          label: t('contract.lastPaymentDate'),
          value: paymentFailed ? null : formatDate(detail.lastPaymentDate),
        },
      ]
    : [];

  return (
    <Accordion
      title={t('contract.title')}
      open={expanded}
      onOpenChange={onOpenChange}
      className="contract-card"
    >
      <div className="contract-card__body">
        {contracts.length > 1 && (
          <ContractSelect contracts={contracts} selectedId={contract?.contractId ?? null} />
        )}

        {!contract ? (
          <p className="contract-card__hint">{t('contract.selectHint')}</p>
        ) : detailQuery.isPending ? (
          <DetailSkeleton />
        ) : detailQuery.isError || !detail ? (
          <SectionError onRetry={() => void detailQuery.refetch()} />
        ) : (
          <>
            <dl className="contract-card__rows">
              {rows.map((row) => (
                <div className="contract-card__row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value ?? notAvailable}</dd>
                </div>
              ))}
            </dl>
            <StaleNotice meta={result?.meta} />
            {canPay ? (
              <Button fullWidth onClick={() => void pay(detail.contractCode)}>
                {t('contract.pay')}
              </Button>
            ) : (
              <SpecNote id="contractPayment" />
            )}
          </>
        )}
      </div>
    </Accordion>
  );
}

/** Loading placeholder with the card's footprint (expanded or collapsed, as it will render). */
export function ContractCardSkeleton() {
  const expanded = contractCardMemory.isExpanded();
  return (
    <div className="contract-card contract-card--skeleton" aria-hidden="true">
      <div className="contract-card__skeleton-head">
        <Skeleton width="45%" height={20} shape="text" />
      </div>
      {expanded && (
        <div className="contract-card__skeleton-body">
          <DetailSkeleton />
          <Skeleton height={48} className="contract-card__skeleton-button" />
        </div>
      )}
    </div>
  );
}
