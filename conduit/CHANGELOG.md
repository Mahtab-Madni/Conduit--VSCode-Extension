## [0.1.1] - 2026-03-18

### Fixed

- Fixed duplicate route detection on first panel open
  - The file watcher was triggering simultaneously with the direct refresh call
  - Added `isRefreshing` flag to prevent overlapping detection operations
  - Routes now display correct count (e.g., 37 instead of 74) on initial load
- Only detected routes once per refresh cycle
- Refresh button and file changes still work correctly

## [0.1.0] - 2026-03-18

### Added

- Redesigned marketplace README with professional formatting
- Enhanced quick start guide with 5-step setup
- Improved troubleshooting section
- Better feature organization and benefits focus

### Changed

- README now emphasizes user benefits over technical details
- Reorganized documentation structure
