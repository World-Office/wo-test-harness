import sys, tempfile, time, shutil
from pathlib import Path
sys.path.insert(0, '/home/weiss/git/World-Office/wo-test-harness/census')
import reconcile as R
td = tempfile.mkdtemp()
base, procs = R.spawn_docserver(Path('/home/weiss/git/World-Office/server'), Path(td), 'rust')
# inject a long multi-paragraph doc into the stub's docs dir
shutil.copy('/tmp/long-doc.docx', Path(td)/'docs'/'long-doc.docx')
print(base, flush=True)
with open('/tmp/pag-pids.txt','w') as f: f.write(' '.join(str(p.pid) for p in procs))
time.sleep(160)
