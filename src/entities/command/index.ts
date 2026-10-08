// Command schema/types are CF-level (CF §2.4) and live in `@/shared/api`; re-exported for convenience.
export {
  commandIdFromLocation,
  commandSchema,
  isTerminalCommand,
  type Command,
  type CommandPollStatus,
  type CommandState,
  type CommandType,
} from '@/shared/api';
export { commandApi } from './api/command-api';
export { commandKeys } from './api/command-keys';
export { useActiveCommands, useCommandPoller } from './api/command-queries';
export type { CommandPollerResult, UseCommandPollerOptions } from './api/command-queries';
