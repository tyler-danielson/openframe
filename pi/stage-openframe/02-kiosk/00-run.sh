#!/bin/bash -e
# Copy kiosk files into rootfs

install -m 755 files/kiosk.sh "${ROOTFS_DIR}/usr/local/bin/kiosk.sh"
install -m 644 files/openframe-kiosk.service "${ROOTFS_DIR}/etc/systemd/system/openframe-kiosk.service"
