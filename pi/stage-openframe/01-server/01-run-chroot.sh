#!/bin/bash -e
# Enable server service and set ownership

chown -R 1000:1000 /home/pi/openframe
systemctl enable openframe-server.service
