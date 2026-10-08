import { describe, expect, it } from 'vitest';
import { isTabPath, paths } from './routes';

describe('paths', () => {
  it('encodes route params when building URLs', () => {
    expect(paths.deviceDetail('AA:BB/1')).toBe('/devices/AA%3ABB%2F1');
    expect(paths.deviceEdit('AA:BB')).toBe('/devices/AA%3ABB/edit');
    expect(paths.wifiNetworkEdit(2)).toBe('/wifi/2/edit');
    expect(paths.wifiNetworkShare('1')).toBe('/wifi/1/share');
  });

  it('recognises tab paths only', () => {
    expect(isTabPath('/modem')).toBe(true);
    expect(isTabPath('/wifi/1/edit')).toBe(false);
    expect(isTabPath(null)).toBe(false);
  });
});
