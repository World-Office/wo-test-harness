#!/bin/bash
set -e

export AF_STATE_DIR=~/.local/share/agentflow/state-census-l4
export AF_TASKS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/census-l4/tasks-simple.json
export AF_WORKERS_JSON=/home/weiss/git/World-Office/wo-test-harness/config/census-l4/workers.json

mkdir -p "$AF_STATE_DIR"

cd /home/weiss/git/World-Office/wo-test-harness
af run
