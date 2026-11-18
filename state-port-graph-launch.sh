#!/bin/bash
set -e

export AF_STATE_DIR=~/.local/share/agentflow/state-port-graph
export AF_TASKS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/port-graph/tasks.json
export AF_WORKERS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/port-graph/workers.json
export AF_REPOS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/port-graph/repos.json
export LITELLM_API_KEY="$(grep -m1 "^export LITELLM_API_KEY" ~/.bashrc | sed "s/.*=//;s/\"//g")"

mkdir -p "$AF_STATE_DIR"

cd /home/weiss/git/World-Office/wo-test-harness
exec ~/git/agentflow/target/release/af run
