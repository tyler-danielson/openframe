#!/bin/bash -e
# Copy first-boot files into rootfs

install -m 755 files/firstboot.sh "${ROOTFS_DIR}/usr/local/bin/openframe-firstboot.sh"
install -m 644 files/openframe-firstboot.service "${ROOTFS_DIR}/etc/systemd/system/openframe-firstboot.service"

# Copy user config file to boot partition (FAT32, editable from any OS)
install -m 644 files/openframe.txt "${ROOTFS_DIR}/boot/firmware/openframe.txt"
