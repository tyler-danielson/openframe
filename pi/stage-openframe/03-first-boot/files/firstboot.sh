#!/bin/bash
set -euo pipefail

# OpenFrame First Boot Script
# Generates secrets, configures WiFi/timezone, pulls Docker images

LOG_TAG="openframe-firstboot"
OPENFRAME_DIR="/home/pi/openframe"
CONFIG_FILE="/boot/firmware/openframe.txt"
ENV_FILE="$OPENFRAME_DIR/.env"
ENV_DEFAULTS="$OPENFRAME_DIR/.env.defaults"

log() {
    echo "$1"
    logger -t "$LOG_TAG" "$1"
}

log "=== OpenFrame First Boot ==="

# --- Generate secrets ---
log "Generating unique secrets..."
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# --- Write .env from defaults + secrets ---
log "Writing $ENV_FILE..."
cp "$ENV_DEFAULTS" "$ENV_FILE"
cat >> "$ENV_FILE" << EOF
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
COOKIE_SECRET=$COOKIE_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF

# --- Read user config from boot partition ---
if [ -f "$CONFIG_FILE" ]; then
    log "Reading user config from $CONFIG_FILE..."

    read_config() {
        grep -E "^$1=" "$CONFIG_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true
    }

    WIFI_SSID=$(read_config "WIFI_SSID")
    WIFI_PASSWORD=$(read_config "WIFI_PASSWORD")
    WIFI_COUNTRY=$(read_config "WIFI_COUNTRY")
    TIMEZONE=$(read_config "TIMEZONE")
    KIOSK_URL=$(read_config "KIOSK_URL")

    # --- Configure WiFi ---
    if [ -n "$WIFI_SSID" ] && [ -n "$WIFI_PASSWORD" ]; then
        log "Configuring WiFi for SSID: $WIFI_SSID"
        if [ -n "$WIFI_COUNTRY" ]; then
            iw reg set "$WIFI_COUNTRY" 2>/dev/null || true
        fi
        nmcli device wifi connect "$WIFI_SSID" password "$WIFI_PASSWORD" || {
            log "WARNING: WiFi connection failed. Check credentials in $CONFIG_FILE"
        }
    fi

    # --- Set timezone ---
    if [ -n "$TIMEZONE" ]; then
        log "Setting timezone to $TIMEZONE"
        timedatectl set-timezone "$TIMEZONE" || {
            log "WARNING: Failed to set timezone $TIMEZONE"
        }
    fi

    # --- Override FRONTEND_URL if KIOSK_URL points to external server ---
    if [ -n "$KIOSK_URL" ] && [ "$KIOSK_URL" != "http://localhost:8080" ]; then
        log "Setting FRONTEND_URL to $KIOSK_URL"
        sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$KIOSK_URL|" "$ENV_FILE"
    fi
fi

# --- Set file ownership ---
chown -R pi:pi "$OPENFRAME_DIR"

# --- Pull Docker images ---
log "Pulling Docker images (this may take 5-15 minutes)..."
cd "$OPENFRAME_DIR"
sudo -u pi docker compose pull || {
    log "WARNING: Docker pull failed. Will retry on next boot."
    exit 1
}

# --- Disable this service (one-shot) ---
log "First boot complete. Disabling firstboot service."
systemctl disable openframe-firstboot.service

# --- Reboot to start services cleanly ---
log "Rebooting..."
reboot
