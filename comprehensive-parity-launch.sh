#!/bin/bash
set -e

export AF_STATE_DIR=~/.local/share/agentflow/state-comprehensive-parity
export AF_TASKS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/comprehensive-parity/tasks.json
export AF_WORKERS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/comprehensive-parity/workers.json
export AF_REPOS_JSON=/home/weiss/git/World-Office/server/config/comprehensive-parity/repos.json

mkdir -p "$AF_STATE_DIR"

cd /home/weiss/git/World-Office/wo-test-harness
af run
