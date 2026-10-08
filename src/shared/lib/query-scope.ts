/** Query-key roots for the LLD data scope: selected contract → its ONT serial number. */
export const contractScopeRoot = ['contract'] as const;
export const deviceScopeRoot = ['device'] as const;
export const contractScope = (contractId: string) => [...contractScopeRoot, contractId] as const;
export const deviceScope = (serialNumber: string) => [...deviceScopeRoot, serialNumber] as const;
