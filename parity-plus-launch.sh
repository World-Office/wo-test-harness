#!/bin/bash
set -e

export AF_STATE_DIR=~/.local/share/agentflow/state-parity-plus
export AF_TASKS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/parity-plus/tasks.json
export AF_WORKERS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/parity-plus/workers.json

mkdir -p "$AF_STATE_DIR"

cd /home/weiss/git/World-Office/wo-test-harness
af run
