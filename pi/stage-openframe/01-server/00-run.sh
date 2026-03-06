#!/bin/bash -e
# Copy server files into rootfs

install -d "${ROOTFS_DIR}/home/pi/openframe"

install -m 644 files/docker-compose.yml "${ROOTFS_DIR}/home/pi/openframe/docker-compose.yml"
install -m 644 files/.env.defaults "${ROOTFS_DIR}/home/pi/openframe/.env.defaults"
install -m 644 files/openframe-server.service "${ROOTFS_DIR}/etc/systemd/system/openframe-server.service"
