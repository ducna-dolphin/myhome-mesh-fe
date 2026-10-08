import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockCommand, MOCK_CONTRACTS, setMockScenario } from '@/shared/api/mock';
import { advanceFakeTime, createQueryWrapper, installFakeClock } from '@/shared/test';
import { healthCheckSchema, isTerminalHealthCheck } from '../model/health-check-schema';
import { healthCheckApi } from './health-check-api';
import {
  healthCheckKeys,
  useCreateFaultReportMutation,
  useCreateHealthCheckMutation,
  useHealthCheckQuery,
  useLatestHealthCheckQuery,
} from './health-check-queries';
import { healthCheckItemFixtures, viewHealthCheck } from './mock-handlers';

const SERIAL = MOCK_CONTRACTS[0].serialNumber;
const CONTRACT = MOCK_CONTRACTS[0].contractId;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('health-check model', () => {
  it.each(['stable', 'unstable', 'down'] as const)('parses %s fixtures at every progress step', (outcome) => {
    const startedAt = 1_000_000;
    for (const elapsed of [0, 1_000, 2_500, 4_500, 6_000]) {
      const view = viewHealthCheck({ checkId: 'c', outcome, startedAt }, startedAt + elapsed);
      expect(healthCheckSchema.safeParse(view).success).toBe(true);
    }
    for (const item of healthCheckItemFixtures[outcome]) {
      expect(healthCheckSchema.shape.items.element.safeParse(item).success).toBe(true);
    }
  });

  it('progresses item by item over ~6s', () => {
    const startedAt = 0;
    const states = (elapsed: number) =>
      viewHealthCheck({ checkId: 'c', outcome: 'unstable', startedAt }, startedAt + elapsed).items.map(
        (i) => i.state,
      );
    expect(states(0)).toEqual(['RUNNING', 'PENDING', 'PENDING']);
    expect(states(2_500)).toEqual(['DONE', 'RUNNING', 'PENDING']);
    expect(states(4_500)).toEqual(['DONE', 'DONE', 'RUNNING']);
    const done = viewHealthCheck({ checkId: 'c', outcome: 'unstable', startedAt }, 6_000);
    expect(done).toMatchObject({ state: 'DONE', overallStatus: 'ISSUES_FOUND', issueCount: 3 });
    expect(isTerminalHealthCheck(done)).toBe(true);
  });

  it('scopes keys by device', () => {
    expect(healthCheckKeys.latest('SN')).toEqual(['device', 'SN', 'health-checks', 'latest']);
    expect(healthCheckKeys.detail('SN', 'c')).toEqual(['device', 'SN', 'health-checks', 'detail', 'c']);
  });
});

describe('health-check API (MSW)', () => {
  it('starts a new run (202 + Location) when the last one is older than 30 minutes, then reuses it', async () => {
    const latest = await healthCheckApi.latest(SERIAL);
    expect(latest?.state).toBe('DONE');

    const created = await healthCheckApi.create(SERIAL, 'hc-1');
    expect(created.status).toBe(202);
    expect(created.check.state).toBe('RUNNING');
    expect(created.location).toContain(`/health-checks/${created.check.checkId}`);

    const running = await healthCheckApi.create(SERIAL, 'hc-2');
    expect(running).toMatchObject({ status: 202, check: { checkId: created.check.checkId } });

    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 7_000 });
    const fresh = await healthCheckApi.create(SERIAL, 'hc-3');
    expect(fresh).toMatchObject({ status: 200, check: { checkId: created.check.checkId, state: 'DONE' } });
  });

  it('re-runs after a confirmed reboot invalidates the latest result', async () => {
    const first = await healthCheckApi.create(SERIAL, 'r-1');
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 7_000 });
    createMockCommand({ type: 'REBOOT', serialNumber: SERIAL, immediate: true });
    const second = await healthCheckApi.create(SERIAL, 'r-2');
    expect(second.status).toBe(202);
    expect(second.check.checkId).not.toBe(first.check.checkId);
  });

  it('reports a disconnected line when the modem is offline', async () => {
    setMockScenario({ device: 'offline' });
    const { check } = await healthCheckApi.create(SERIAL, 'off');
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 7_000 });
    const done = await healthCheckApi.get(SERIAL, check.checkId);
    expect(done.overallStatus).toBe('INCOMPLETE');
    expect(done.items[0]).toMatchObject({ status: 'DISCONNECTED', action: 'REPORT_FAULT' });
    expect(done.items[1]).toMatchObject({ state: 'FAILED', errorCode: 'DEVICE_OFFLINE' });
  });

  it('creates a fault report (201 ticket)', async () => {
    await expect(healthCheckApi.createFaultReport(CONTRACT, null, 'fault-1')).resolves.toMatchObject({
      ticketCode: expect.stringMatching(/^BH-/),
    });
  });
});

describe('health-check hooks', () => {
  it('creates a run and polls every 3s until DONE, updating the latest cache', async () => {
    installFakeClock();
    const get = vi.spyOn(healthCheckApi, 'get');
    const { wrapper, queryClient } = createQueryWrapper();
    const create = renderHook(() => useCreateHealthCheckMutation(SERIAL), { wrapper });
    let started: Awaited<ReturnType<typeof healthCheckApi.create>> | undefined;
    await act(async () => {
      started = await create.result.current.mutateAsync({ idempotencyKey: 'poll-1' });
    });
    expect(started?.status).toBe(202);

    const { result } = renderHook(
      () => useHealthCheckQuery(SERIAL, started!.check.checkId, { initialCheck: started!.check }),
      { wrapper },
    );
    expect(result.current.isPolling).toBe(true);
    await advanceFakeTime(3_100);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current.check?.items[0]?.state).toBe('DONE');
    await advanceFakeTime(3_100);
    expect(result.current.check?.state).toBe('DONE');
    expect(result.current.isPolling).toBe(false);
    expect(queryClient.getQueryData(healthCheckKeys.latest(SERIAL))).toMatchObject({ state: 'DONE' });

    await advanceFakeTime(9_000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 minutes', async () => {
    installFakeClock();
    vi.spyOn(healthCheckApi, 'get').mockImplementation(async (_serial, checkId) => ({
      checkId,
      state: 'RUNNING',
      items: [],
    }));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useHealthCheckQuery(SERIAL, 'stuck'), { wrapper });
    await advanceFakeTime(179_000, 1_000);
    expect(result.current.isTimedOut).toBe(false);
    await advanceFakeTime(1_000);
    expect(result.current.isTimedOut).toBe(true);
    expect(result.current.isPolling).toBe(false);
  });

  it('reads the latest result and files a fault report', async () => {
    const { wrapper } = createQueryWrapper();
    const latest = renderHook(() => useLatestHealthCheckQuery(SERIAL), { wrapper });
    await waitFor(() => expect(latest.result.current.data?.state).toBe('DONE'));
    const fault = renderHook(() => useCreateFaultReportMutation(CONTRACT), { wrapper });
    await act(async () => {
      await fault.result.current.mutateAsync({
        checkId: latest.result.current.data!.checkId,
        idempotencyKey: 'f-1',
      });
    });
    // The hook re-renders after `mutateAsync` settles; wait instead of racing that commit.
    await waitFor(() => expect(fault.result.current.data?.ticketCode).toMatch(/^BH-/));
  });
});
