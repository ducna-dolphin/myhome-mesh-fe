import { deviceScope } from '@/shared/lib';

export const commandKeys = {
  all: ['command'] as const,
  detail: (commandId: string) => ['command', commandId] as const,
  active: (serialNumber: string) => [...deviceScope(serialNumber), 'commands', 'active'] as const,
};
