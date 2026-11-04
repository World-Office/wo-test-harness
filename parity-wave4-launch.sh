#!/bin/bash
set -e

export AF_STATE_DIR=/home/weiss/.local/share/agentflow/state-parity-wave4
export AF_TASKS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/parity-wave4/tasks.json
export AF_WORKERS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/parity-wave4/workers.json
export AF_REPOS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/parity-wave4/repos.json
export AF_REPO_DIR=/home/weiss/git/World-Office/wo-test-harness

mkdir -p "$AF_STATE_DIR"

cd /home/weiss/git/World-Office/wo-test-harness
exec /home/weiss/git/agentflow/target/release/af run >> /home/weiss/.local/share/agentflow/state-parity-wave4/campaign.log 2>&1
