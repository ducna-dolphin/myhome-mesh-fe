import { z } from 'zod';
import type { AcceptsContract, ApiSchemas } from './contract-check';

export const commandStateSchema = z.enum(['PENDING', 'SENT', 'UNKNOWN', 'CONFIRMED', 'FAILED']);
export const commandTypeSchema = z.enum(['WIFI_UPDATE', 'CLIENT_BLOCK', 'CLIENT_UNBLOCK', 'REBOOT']);

/** Write command sent to the modem (P0-04, CF §2.4). */
export const commandSchema = z.object({
  commandId: z.string().min(1),
  type: commandTypeSchema.optional(),
  state: commandStateSchema,
  retryAfterSec: z.number().int().nonnegative().nullable().optional(),
  // Open-ended: a FAILED command may carry a code newer than this build (CF §2.6).
  errorCode: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const commandListSchema = z.array(commandSchema);

void (true satisfies AcceptsContract<typeof commandSchema, ApiSchemas['Command']>);

export type Command = z.infer<typeof commandSchema>;
export type CommandState = z.infer<typeof commandStateSchema>;
export type CommandType = z.infer<typeof commandTypeSchema>;

/** Polling outcome; `TIMEOUT` means the poller gave up, not that the command failed. */
export type CommandPollStatus = 'idle' | 'polling' | 'confirmed' | 'failed' | 'timeout';

export const TERMINAL_COMMAND_STATES: ReadonlySet<CommandState> = new Set(['CONFIRMED', 'FAILED']);

export function isTerminalCommand(command: Pick<Command, 'state'>): boolean {
  return TERMINAL_COMMAND_STATES.has(command.state);
}

export const DEFAULT_COMMAND_POLL_SEC = 2;
/** Poll limits (LLD §11.1): 2 minutes, reboot 6 minutes. */
export const COMMAND_POLL_LIMIT_MS = 2 * 60_000;
export const REBOOT_POLL_LIMIT_MS = 6 * 60_000;

export function commandPollLimitMs(type: CommandType | undefined): number {
  return type === 'REBOOT' ? REBOOT_POLL_LIMIT_MS : COMMAND_POLL_LIMIT_MS;
}

export function commandPollIntervalMs(command: Pick<Command, 'retryAfterSec'> | undefined): number {
  const seconds = command?.retryAfterSec;
  return (seconds && seconds > 0 ? seconds : DEFAULT_COMMAND_POLL_SEC) * 1000;
}

/** Extracts the command id from a `Location: /mesh/v1/commands/{commandId}` header. */
export function commandIdFromLocation(location: string | null): string | null {
  const match = location?.match(/\/commands\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
