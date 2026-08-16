# Ad & Tracker Blocker (ClearShield)

Local-first MV3 ad/tracker blocker (DNR). No remote code. You control updates by rebuilding from this repo.

```bash
bun run fetch:easylist # optional list refresh
bun run build
```

Load `packages/clearshield/dist` from `brave://extensions` with Developer mode enabled. Use `bun run verify` from the repository root before relying on a new build.
