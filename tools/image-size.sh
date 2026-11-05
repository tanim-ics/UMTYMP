#!/bin/sh
# The production image stays at most 50 MB (docs/CONSTRAINTS.md, Task 25). Runs on the host, where Docker is:
#   docker compose build web && sh tools/image-size.sh [image]
# 1 MB = 1,000,000 bytes, as Docker reports it.
set -u
# Compose names the image after the folder, so ask it rather than guess.
IMAGE="${1:-$(docker compose config --images web 2>/dev/null)}"
LIMIT_BYTES=50000000

if ! SIZE=$(docker image inspect "$IMAGE" --format '{{.Size}}' 2>/dev/null); then
  echo "image-size: no image $IMAGE. Build it first: docker compose build web"
  exit 1
fi
MB=$(awk "BEGIN { printf \"%.1f\", $SIZE / 1000000 }")
if [ "$SIZE" -gt "$LIMIT_BYTES" ]; then
  echo "image-size: $IMAGE is $MB MB, over 50 MB"
  exit 1
fi
echo "image-size: $IMAGE is $MB MB (limit 50 MB)"
