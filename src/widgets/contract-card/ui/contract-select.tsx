import { useQueryClient } from '@tanstack/react-query';
import { useId, type ChangeEvent } from 'react';
import { useSelectContractMutation, type ContractLink } from '@/entities/contract';
import { useIdempotencyKey } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { contractScopeRoot, deviceScopeRoot } from '@/shared/lib';
import { SpecNote, useToast } from '@/shared/ui';

interface ContractSelectProps {
  contracts: ContractLink[];
  selectedId: string | null;
}

/** Native `<select>` of the caller's contracts (P1-02); choosing one selects it server-side. */
export function ContractSelect({ contracts, selectedId }: ContractSelectProps) {
  const { t } = useTranslation('internet');
  const id = useId();
  const queryClient = useQueryClient();
  const toast = useToast();
  const keys = useIdempotencyKey();
  const mutation = useSelectContractMutation();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const contractId = event.target.value;
    if (!contractId || contractId === selectedId) return;
    mutation.mutate(
      { contractId, idempotencyKey: keys.forAction({ contractId }) },
      {
        onSuccess: () => {
          keys.renew();
          // Everything scoped to the previous contract / its modem must be reloaded.
          void queryClient.invalidateQueries({ queryKey: contractScopeRoot });
          void queryClient.invalidateQueries({ queryKey: deviceScopeRoot });
        },
        onError: () => toast.show(t('contract.selectFailed'), { tone: 'danger' }),
      },
    );
  }

  return (
    <div className="contract-card__select">
      <label className="contract-card__select-label" htmlFor={id}>
        {t('contract.select')}
        <SpecNote id="contractSelection" />
      </label>
      <select
        id={id}
        className="contract-card__select-input"
        value={selectedId ?? ''}
        onChange={handleChange}
        disabled={mutation.isPending}
        aria-busy={mutation.isPending || undefined}
      >
        {selectedId === null && (
          <option value="" disabled>
            {t('contract.selectPlaceholder')}
          </option>
        )}
        {contracts.map((contract) => (
          <option key={contract.contractId} value={contract.contractId}>
            {contract.address
              ? t('contract.option', { code: contract.contractCode, address: contract.address })
              : contract.contractCode}
          </option>
        ))}
      </select>
    </div>
  );
}
