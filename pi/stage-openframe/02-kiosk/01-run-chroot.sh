#!/bin/bash -e
# Install kiosk packages and configure auto-login

apt-get update
apt-get install -y --no-install-recommends \
    cage \
    chromium-browser \
    fonts-noto \
    fonts-noto-color-emoji

# Set default target to graphical
systemctl set-default graphical.target

# Configure auto-login for pi user on tty1
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
EOF

# Enable kiosk service
systemctl enable openframe-kiosk.service

# GPU memory split for smooth Chromium rendering
# Appended to config.txt on the boot partition
if [ -f /boot/firmware/config.txt ]; then
    # Only add if not already present
    grep -q "^gpu_mem=" /boot/firmware/config.txt || echo "gpu_mem=128" >> /boot/firmware/config.txt
    grep -q "^dtoverlay=vc4-kms-v3d" /boot/firmware/config.txt || echo "dtoverlay=vc4-kms-v3d" >> /boot/firmware/config.txt
fi
