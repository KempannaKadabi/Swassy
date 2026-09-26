#!/usr/bin/env bash
set -e

echo "================================================================"
echo "  Starting Swasya AI Clinical Operating System"
echo "================================================================"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

export PYTHONPATH="$SCRIPT_DIR:$PYTHONPATH"

# Run startup script
python3 start.py
