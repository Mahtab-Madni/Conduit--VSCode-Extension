## [0.1.4] - 2026-05-12

### Updated
- Improved README with clearer features and getting started
- Backend-powered AI (no API key configuration needed)
- Enhanced documentation for developers
- Better troubleshooting guide

## [0.1.3] - 2026-03-22

### Added

- ES6 module export support for controller function detection
  - Now detects functions in `export const login = () => {}`
  - Now detects functions in `export function login() {}`
  - Now detects functions in `export { login }`
  - Now detects functions in `export default handler`

### Fixed

- Fixed payload prediction for ES6 module exports
  - Works now with named exports, default exports, and export statements
- Fixed snapshot code capture for ES6 module exports
  - Snapshot service now correctly extracts ES6 exported controller functions
- Full ES6/CommonJS compatibility for both payload prediction and snapshots


## [0.1.2] - 2026-03-18

### Fixed

- Fixed duplicate route detection on first panel open
  - Root cause: `vscode.window.withProgress` was not being awaited
  - Detection flag (`isRefreshing`) was reset before detection completed
  - File watcher would trigger during ongoing detection causing duplicates
  - Solution: Added `await` to `vscode.window.withProgress` to ensure flag persists until detection finishes
  - Routes now display correct count on initial panel open (e.g., 37 instead of 74)

## [0.1.1] - 2026-03-18

### Fixed

- Refresh button and file changes continue to work correctly
- No routes duplicated across refresh cycles

## [0.1.0] - 2026-03-18

### Added

- Redesigned marketplace README with professional formatting
- Enhanced quick start guide with 5-step setup
- Improved troubleshooting section
- Better feature organization and benefits focus

### Changed

- README now emphasizes user benefits over technical details
- Reorganized documentation structure
