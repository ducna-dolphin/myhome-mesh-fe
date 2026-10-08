# Phase 04 — Entities: Zod schema, API, query hooks

## Context Links

- [plan.md](./plan.md)
- Code hiện tại: `src/entities/network/types.ts`, `src/shared/api/meshApi.ts`, `src/mocks/data.ts`

## Overview

- Priority: P0 · Status: Done · Effort: 4h
- Mỗi domain thành 1 entity slice: schema (nguồn sự thật cho type), API, mock, query-key, hook. Xoá `meshApi.ts` và `mocks/`.

## Key Insights

- 7 page lặp `queryKey: ['network', id, X]` + `queryFn` → gom vào hook `useXxxQuery()`.
- Type viết tay + Zod riêng = 2 nguồn sự thật → dùng `z.infer`.
- ONT và Mesh có schema khác nhau (ONE Link) nhưng BE MyHome sẽ chuẩn hoá → frontend chỉ giữ 1 schema chuẩn. Adapter theo model là việc của BE.

## Requirements

- Type suy ra từ schema. Không còn file `types.ts` viết tay.
- Tất cả query key bắt đầu bằng `['network', networkId]` → invalidate cả mạng được bằng 1 lệnh.
- Hook tự lấy `networkId` qua `useActiveNetworkId()`.

## Architecture

```
src/shared/lib/network-query-scope.ts   # networkScope(id) = ['network', id] as const
src/entities/
├── network/        # NetworkOverview, NetworkStatus, HealthLevel
├── wifi/           # WifiBand, WifiConfig
├── mesh-topology/  # MeshNode, MeshTopology
├── client/         # ConnectedClient
└── health-area/    # WifiHealthArea
Mỗi slice:
  model/<name>-schema.ts     # zod schema + export type
  api/<name>-api.ts          # withMock(mock, remote) dùng request({ schema })
  api/<name>-mock.ts         # data mock (từ mocks/data.ts)
  api/<name>-queries.ts      # keys + useXxxQuery
  index.ts                   # public API
```

Ví dụ `entities/wifi`:

```ts
// model/wifi-schema.ts
export const wifiBandSchema = z.object({
  id: z.string(),
  band: z.enum(['2.4GHz', '5GHz']),
  ssid: z.string(),
  enabled: z.boolean(),
  securityMode: z.string(),
});
export const wifiConfigSchema = z.object({ smartConnect: z.boolean(), bands: z.array(wifiBandSchema) });
export type WifiConfig = z.infer<typeof wifiConfigSchema>;

// api/wifi-queries.ts
export const wifiKeys = { config: (id: string) => [...networkScope(id), 'wifi'] as const };
export function useWifiConfigQuery() {
  const networkId = useActiveNetworkId();
  return useQuery({ queryKey: wifiKeys.config(networkId), queryFn: () => wifiApi.getConfig(networkId) });
}
```

Hook có option passthrough tối thiểu (`refetchInterval` cho clients/topology) — không mở full options (YAGNI).

Enum dùng chung (`HealthLevel`, `ConnectionType`, `Band`) đặt ở `shared/lib/network-enums.ts`? **Không** — đặt ở entity sở hữu chính (`network` cho `HealthLevel`/`NetworkStatus`; `client` cho `ConnectionType`). Entity khác cần thì dùng cross-import FSD `@x` (`entities/network/@x/health-area.ts`) — chỉ khi thực sự cần; nếu chỉ là union string nhỏ thì khai báo lại trong schema của entity đó.

`SpeedTestResult` không phải entity → để ở `features/run-speed-test` (phase 5). `updateWifi` là mutation → API đặt ở `entities/wifi/api` (`wifiApi.updateConfig`), hook mutation đặt ở feature (phase 5).

## Related Code Files

- Create: `src/shared/lib/network-query-scope.ts`, 5 entity slice như trên
- Modify: 7 page — thay `useQuery` bằng `useXxxQuery()`; `StatusPill` import type từ `@/entities/network`
- Delete: `src/entities/network/types.ts`, `src/shared/api/meshApi.ts`, `src/mocks/data.ts`

## Implementation Steps

1. `network-query-scope.ts`.
2. Tạo 5 entity: schema → mock → api → queries → index. Mock dữ liệu copy nguyên từ `mocks/data.ts` (giữ UI y hệt); `topologyMock.clients` import `clientMock` từ entity client qua `@x` hoặc dựng trong mock của topology — chọn đơn giản: topology mock tự import từ `@/entities/client/api/client-mock` bị cấm deep import → dùng `@x`.
3. `StatusPill` (shared/ui) đang import type domain → vi phạm layer. Đổi prop sang `tone: 'success'|'warning'|'danger'|'neutral'` + `label: string`; mapping domain→tone/label chuyển vào `entities/network/lib/status-presentation.ts` (và client). Giao diện không đổi.
4. Sửa 7 page dùng hook mới.
5. Test: schema parse mock hợp lệ (mỗi entity 1 test), `wifiKeys`/`clientKeys` bắt đầu bằng `networkScope`.
6. Xoá file cũ; lint/typecheck/test/build xanh.

## Todo List

- [x] networkScope
- [x] entity network
- [x] entity wifi
- [x] entity mesh-topology
- [x] entity client
- [x] entity health-area
- [x] StatusPill thành component thuần UI
- [x] page dùng query hook
- [x] xoá meshApi, mocks, types.ts
- [x] test schema + keys

## Success Criteria

- `grep -r "queryKey:" src/pages src/features` rỗng (trừ mutation).
- `shared/` không import từ `entities/`.
- UI giống hệt trước (so sánh thủ công 7 màn).

## Risk Assessment

- `@x` cross-import dễ bị lạm dụng → ghi luật trong code-standards: chỉ dùng cho type/mock, review bắt buộc.
- Schema quá chặt làm vỡ khi BE thật khác mock → chỉ `strict` với field UI dùng; dùng `.passthrough()` không cần thiết.

## Security Considerations

- Validate response giảm rủi ro render dữ liệu sai kiểu. Không dùng `dangerouslySetInnerHTML`.

## Next Steps

- Phase 05 di chuyển page/feature vào layer đúng, đổi tên file.
