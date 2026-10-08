import { apiError } from './mock-http';
import { getMockScenario, mockOwnedContractIds, mockOwnedSerials } from './mock-scenario';

/** 401 when the request carries no bearer token (gateway check). */
export function checkAuth(request: Request): Response | null {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') && header.length > 'Bearer '.length
    ? null
    : apiError(401, 'UNAUTHENTICATED');
}

/** Auth + ownership (P0-03: not owned → 404) + optionally reachability (409 DEVICE_OFFLINE). */
export function checkDevice(
  request: Request,
  serialNumber: string,
  { requireOnline = true }: { requireOnline?: boolean } = {},
): Response | null {
  const unauthorized = checkAuth(request);
  if (unauthorized) return unauthorized;
  if (!mockOwnedSerials().includes(serialNumber)) return apiError(404, 'NOT_FOUND');
  if (requireOnline && getMockScenario().device === 'offline') return apiError(409, 'DEVICE_OFFLINE');
  return null;
}

export function checkContract(request: Request, contractId: string): Response | null {
  const unauthorized = checkAuth(request);
  if (unauthorized) return unauthorized;
  return mockOwnedContractIds().includes(contractId) ? null : apiError(404, 'NOT_FOUND');
}
