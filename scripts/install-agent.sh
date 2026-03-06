#!/usr/bin/env zsh
# Installs (or reinstalls) the launchd agent that keeps you "online"
# while your laptop is running. Run once; it survives reboots.

set -euo pipefail

PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/com.luuk.laptop-online.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.luuk.laptop-online.plist"

echo "→ Copying plist to $PLIST_DEST"
cp "$PLIST_SRC" "$PLIST_DEST"

# Unload first in case it was already installed (ignore errors)
launchctl unload "$PLIST_DEST" 2>/dev/null || true

echo "→ Loading agent..."
launchctl load "$PLIST_DEST"

echo "✓ Agent installed and running."
echo "  Logs: ~/Library/Logs/luuk-laptop-online.log"
echo "  Stop:    launchctl unload $PLIST_DEST"
echo "  Restart: launchctl unload $PLIST_DEST && launchctl load $PLIST_DEST"
