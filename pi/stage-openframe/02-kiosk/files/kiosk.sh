#!/bin/bash
# OpenFrame Kiosk Launcher
# Waits for the web server to be ready, then launches Chromium in kiosk mode

# Read kiosk URL from boot partition config (user-editable before first boot)
KIOSK_URL="http://localhost:8080"
CONFIG_FILE="/boot/firmware/openframe.txt"

if [ -f "$CONFIG_FILE" ]; then
    CUSTOM_URL=$(grep -E "^KIOSK_URL=" "$CONFIG_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')
    if [ -n "$CUSTOM_URL" ]; then
        KIOSK_URL="$CUSTOM_URL"
    fi
fi

echo "OpenFrame Kiosk: waiting for $KIOSK_URL ..."

# Wait up to 120 seconds for the web server to respond
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -sf -o /dev/null "$KIOSK_URL" 2>/dev/null; then
        echo "OpenFrame Kiosk: server ready after ${ELAPSED}s"
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "OpenFrame Kiosk: server not ready after ${TIMEOUT}s, launching anyway"
fi

# Launch Chromium in kiosk mode under Wayland
exec chromium-browser \
    --kiosk \
    --ozone-platform=wayland \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --disable-session-crashed-bubble \
    --disable-features=TranslateUI \
    --autoplay-policy=no-user-gesture-required \
    --check-for-update-interval=31536000 \
    "$KIOSK_URL"
