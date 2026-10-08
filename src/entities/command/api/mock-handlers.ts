import { http } from 'msw';
import {
  apiError,
  apiPath,
  checkAuth,
  checkDevice,
  getMockCommand,
  listActiveMockCommands,
  mockDelay,
  ok,
  resetMockCommands,
} from '@/shared/api/mock';

export const commandMockHandlers = [
  http.get(apiPath('/mesh/v1/commands/:commandId'), async ({ request, params }) => {
    await mockDelay(150);
    const unauthorized = checkAuth(request);
    if (unauthorized) return unauthorized;
    const command = getMockCommand(String(params.commandId));
    return command ? ok(command) : apiError(404, 'NOT_FOUND');
  }),

  http.get(apiPath('/mesh/v1/devices/:serialNumber/commands'), async ({ request, params }) => {
    await mockDelay(150);
    const serialNumber = String(params.serialNumber);
    const denied = checkDevice(request, serialNumber, { requireOnline: false });
    if (denied) return denied;
    if (new URL(request.url).searchParams.get('active') !== 'true') return apiError(400, 'VALIDATION_FAILED');
    return ok(listActiveMockCommands(serialNumber));
  }),
];

export function resetCommandMockDb(): void {
  resetMockCommands();
}
