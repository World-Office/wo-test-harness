# Comprehensive Parity Campaign
# Goal: Close all open parity gaps
# 
# Usage: make -f REPRO.mk run
#         make -f REPRO.mk status
#         make -f REPRO.mk stop

CAMPAIGN := comprehensive-parity
STATE_DIR := ~/.local/share/agentflow/state-$(CAMPAIGN)
TASKS_JSON := $(shell pwd)/config/$(CAMPAIGN)/tasks.json
WORKERS_JSON := $(shell pwd)/config/$(CAMPAIGN)/workers.json
REPOS_JSON := $(shell pwd)/../server/config/$(CAMPAIGN)/repos.json

export AF_STATE_DIR := $(STATE_DIR)
export AF_TASKS_JSON := $(TASKS_JSON)
export AF_WORKERS_JSON := $(WORKERS_JSON)

run:
	@mkdir -p $(STATE_DIR)
	@af clean 2>/dev/null || true
	@af run 2>&1

status:
	@af status 2>&1

stop:
	@af stop 2>/dev/null || true
	@pkill -9 af 2>/dev/null || true

clean:
	@rm -rf $(STATE_DIR)
	@git branch | grep '^\s*tf/' | xargs -r git branch -D 2>/dev/null || true

.PHONY: run status stop clean
