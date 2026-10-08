import { createUuid } from '@/shared/lib/create-uuid';
import type { Schemas } from './mock-http';

type Command = Schemas['Command'];
type CommandType = NonNullable<Command['type']>;
/**
 * Final state once `settleAfterMs` elapsed. `UNKNOWN` (sent but the verifier could not read the
 * device back) is never terminal: the command stays UNKNOWN until the poller gives up.
 */
export type MockCommandOutcome = 'CONFIRMED' | 'FAILED' | 'UNKNOWN';

interface StoredCommand {
  commandId: string;
  type: CommandType;
  serialNumber: string;
  createdAt: number;
  /** Time until the background verifier confirms (P0-04). */
  settleAfterMs: number;
  outcome: MockCommandOutcome;
  errorCode: Schemas['ErrorCode'] | null;
  /** Side effect applied to the mock DB once the command is confirmed. */
  apply?: () => void;
  applied: boolean;
  /** Already in the desired state: answered `200 CONFIRMED`, no device call. */
  immediate: boolean;
}

/** Default confirmation delays: ~2s for config writes, ~8s for a reboot. */
export const MOCK_COMMAND_SETTLE_MS: Record<CommandType, number> = {
  WIFI_UPDATE: 2_000,
  CLIENT_BLOCK: 2_000,
  CLIENT_UNBLOCK: 2_000,
  REBOOT: 8_000,
};

const commands = new Map<string, StoredCommand>();

function stateOf(command: StoredCommand): Schemas['CommandState'] {
  if (command.immediate) return 'CONFIRMED';
  return Date.now() - command.createdAt >= command.settleAfterMs ? command.outcome : 'SENT';
}

/** Applies side effects of commands that have reached CONFIRMED. Call at the start of every handler. */
export function settleMockCommands(): void {
  for (const command of commands.values()) {
    if (!command.applied && stateOf(command) === 'CONFIRMED') {
      command.applied = true;
      command.apply?.();
    }
  }
}

export function toCommandView(command: StoredCommand): Command {
  const state = stateOf(command);
  const terminal = state === 'CONFIRMED' || state === 'FAILED';
  return {
    commandId: command.commandId,
    type: command.type,
    state,
    retryAfterSec: terminal ? null : command.type === 'REBOOT' ? 3 : 2,
    errorCode: state === 'FAILED' ? command.errorCode : null,
    createdAt: new Date(command.createdAt).toISOString(),
    updatedAt: new Date(terminal ? command.createdAt + command.settleAfterMs : Date.now()).toISOString(),
  };
}

export interface CreateMockCommandInput {
  type: CommandType;
  serialNumber: string;
  apply?: () => void;
  outcome?: MockCommandOutcome;
  errorCode?: Schemas['ErrorCode'];
  settleAfterMs?: number;
  immediate?: boolean;
}

export function createMockCommand(input: CreateMockCommandInput): Command {
  const command: StoredCommand = {
    commandId: createUuid(),
    type: input.type,
    serialNumber: input.serialNumber,
    createdAt: Date.now(),
    settleAfterMs: input.immediate ? 0 : (input.settleAfterMs ?? MOCK_COMMAND_SETTLE_MS[input.type]),
    outcome: input.outcome ?? 'CONFIRMED',
    errorCode: input.outcome === 'FAILED' ? (input.errorCode ?? 'VERIFY_MISMATCH') : null,
    apply: input.apply,
    applied: false,
    immediate: input.immediate ?? false,
  };
  commands.set(command.commandId, command);
  if (command.immediate) settleMockCommands();
  return toCommandView(command);
}

export function getMockCommand(commandId: string): Command | null {
  settleMockCommands();
  const command = commands.get(commandId);
  return command ? toCommandView(command) : null;
}

/** Commands still running on a device (PENDING, SENT, UNKNOWN). */
export function listActiveMockCommands(serialNumber: string): Command[] {
  settleMockCommands();
  return [...commands.values()]
    .filter((command) => command.serialNumber === serialNumber)
    .map(toCommandView)
    .filter((command) => command.state !== 'CONFIRMED' && command.state !== 'FAILED');
}

/** Device lock: one write command per modem at a time (P0-04). */
export function isMockDeviceBusy(serialNumber: string): boolean {
  return listActiveMockCommands(serialNumber).length > 0;
}

/** Latest confirmed reboot time; used to invalidate the last health check (P6-01). */
export function lastMockRebootAt(serialNumber: string): number | null {
  let latest: number | null = null;
  for (const command of commands.values()) {
    if (command.serialNumber !== serialNumber || command.type !== 'REBOOT') continue;
    if (stateOf(command) !== 'CONFIRMED') continue;
    const confirmedAt = command.createdAt + command.settleAfterMs;
    latest = latest === null ? confirmedAt : Math.max(latest, confirmedAt);
  }
  return latest;
}

/** Reboots requested in the last `windowMs` (rate limit 3 / 30 min, MD-04). */
export function countMockReboots(serialNumber: string, windowMs: number): number {
  const since = Date.now() - windowMs;
  return [...commands.values()].filter(
    (command) =>
      command.serialNumber === serialNumber && command.type === 'REBOOT' && command.createdAt >= since,
  ).length;
}

export function resetMockCommands(): void {
  commands.clear();
}
