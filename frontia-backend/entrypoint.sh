#!/bin/sh
set -eu
# Preserve v0.5 root-owned volumes while moving application execution to node.
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /data/codex /data/workspace
  chmod 700 /data/codex /data/workspace
  exec gosu node "$@"
fi
exec "$@"
