## [0.1.1] - 2026-03-18

### Fixed

- Fixed duplicate route detection on first panel open
  - Root cause: `vscode.window.withProgress` was not being awaited
  - Detection flag (`isRefreshing`) was reset before detection completed
  - File watcher would trigger during ongoing detection causing duplicates
  - Solution: Added `await` to `vscode.window.withProgress` to ensure flag persists until detection finishes
  - Routes now display correct count on initial panel open (e.g., 37 instead of 74)
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
