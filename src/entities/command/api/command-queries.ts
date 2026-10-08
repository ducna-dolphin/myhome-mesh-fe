import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  commandPollIntervalMs,
  commandPollLimitMs,
  isTerminalCommand,
  type Command,
  type CommandPollStatus,
  type CommandType,
} from '@/shared/api';
import { useDeadline } from '@/shared/lib';
import { commandApi } from './command-api';
import { commandKeys } from './command-keys';

export interface UseCommandPollerOptions {
  /** Command type; `REBOOT` polls up to 6 minutes instead of 2. Falls back to the seed's `type`. */
  type?: CommandType;
  /** Command returned by the write API (202/200); the first poll waits for its `retryAfterSec`. */
  initialCommand?: Command | null;
  /** Called once when the command reaches CONFIRMED or FAILED (e.g. invalidate screen data). */
  onSettled?: (command: Command) => void;
}

export interface CommandPollerResult {
  command: Command | null;
  status: CommandPollStatus;
  /** Gave up after the poll limit; the command may still finish in the background (not an error). */
  isTimedOut: boolean;
}

/**
 * commandPoller (LLD §11.1, P0-04): re-reads `GET /mesh/v1/commands/{id}` every `retryAfterSec`
 * (default 2s) until CONFIRMED/FAILED. Never resends the command. `UNKNOWN` keeps polling — it is
 * not an error. Gives up after 2 minutes (REBOOT: 6 minutes) with status `timeout`.
 */
export function useCommandPoller(
  commandId: string | null,
  { type, initialCommand, onSettled }: UseCommandPollerOptions = {},
): CommandPollerResult {
  const seed = initialCommand && initialCommand.commandId === commandId ? initialCommand : undefined;
  const limitMs = commandPollLimitMs(type ?? seed?.type);
  const isTimedOut = useDeadline(commandId, limitMs, commandId !== null);

  const query = useQuery({
    queryKey: commandKeys.detail(commandId ?? ''),
    queryFn: ({ signal }) => commandApi.get(commandId!, signal),
    enabled: commandId !== null && !isTimedOut && !(seed && isTerminalCommand(seed)),
    initialData: seed,
    // Seeded data counts as fresh, so the first request waits `retryAfterSec` instead of firing on mount.
    staleTime: Infinity,
    // A failed poll (e.g. phone offline while the modem reboots) is retried by the next interval tick.
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (current) => {
      const data = current.state.data;
      if (data && isTerminalCommand(data)) return false;
      return commandPollIntervalMs(data);
    },
  });

  const command = query.data ?? null;

  let status: CommandPollStatus = 'idle';
  if (commandId !== null) {
    if (command?.state === 'CONFIRMED') status = 'confirmed';
    else if (command?.state === 'FAILED') status = 'failed';
    else if (isTimedOut) status = 'timeout';
    else status = 'polling';
  }

  const settledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!command || !isTerminalCommand(command) || settledFor.current === command.commandId) return;
    settledFor.current = command.commandId;
    onSettled?.(command);
  }, [command, onSettled]);

  return { command, status, isTimedOut: status === 'timeout' };
}

/**
 * Commands still running on the modem (`PENDING`, `SENT`, `UNKNOWN`), created by this user.
 * Call when entering the Modem, Wifi or Devices tab and hand each to `useCommandPoller`.
 */
export function useActiveCommands(serialNumber: string | null) {
  return useQuery({
    queryKey: commandKeys.active(serialNumber ?? ''),
    queryFn: ({ signal }) => commandApi.listActive(serialNumber!, signal),
    enabled: serialNumber !== null,
    staleTime: 0,
  });
}
