# Stats Data Directory

This directory contains persistent statistics data for the RandomChatt application.

## Files

- `stats.json` - Stores lifetime statistics that persist across server restarts
  - Total visitors
  - Total connections
  - Total messages
  - Video chat visitors (unique count)

## How It Works

- Stats are loaded from `stats.json` when the server starts
- Stats are saved automatically:
  - Every time a counter is incremented (immediate save)
  - Every 60 seconds (periodic auto-save)
  - When the server shuts down gracefully
- The file is excluded from git via `.gitignore`

## Manual Reset

To reset all statistics to zero, you can either:
1. Delete the `stats.json` file (it will be recreated with zeros)
2. Edit the file manually and restart the server
