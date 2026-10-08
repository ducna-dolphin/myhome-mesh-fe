# API contracts

`openapi.yaml` is a copy of the backend LLD contract (`bs-requirement/technical/lld/openapi.yaml`, version `1.0.0-draft`, copied 2026-10-08).

After updating the copy, regenerate the TypeScript types:

```bash
npm run gen:api   # → src/shared/api/generated/openapi.ts (do not edit by hand)
```

Mock fixtures are typed against the generated schemas, so a contract change that breaks a fixture fails `npm run typecheck`.
