#!/usr/bin/env python3.12
"""port-graph ingest — materialize the OO→WO port state into cgc's Neo4j.

Derived view ONLY: all nodes/edges are MERGEd from generated artifacts
(ledger, parity manifest, contract results, af run-states). Never edit
graph state by hand; regenerate artifacts and re-run this script.

Namespace: every node carries the :OOPort label (+ role label), so cgc's
code graph in the same database is untouched.

Usage: python3.12 ingest.py [--query CYPHER | --dump OUT.json]
"""
import json, os, sys, urllib.request, base64, glob

ENV = os.path.expanduser('~/.codegraphcontext/.env')
PWD = [l.split('=', 1)[1].strip() for l in open(ENV) if l.startswith('NEO4J_PASSWORD=')][0]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # census/
WO = os.path.join(os.path.dirname(ROOT), '..', 'server')                    # server/
AUTH = base64.b64encode(f'neo4j:{PWD}'.encode()).decode()
URI = 'http://127.0.0.1:7474/db/neo4j/tx/commit'


def cypher(stmts):
    """Run a list of (statement, params) in one transaction."""
    body = json.dumps({
        'statements': [{'statement': s, 'parameters': p} for s, p in stmts]
    }).encode()
    req = urllib.request.Request(URI, data=body, headers={
        'Content-Type': 'application/json', 'Authorization': 'Basic ' + AUTH})
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.load(r)
    if out.get('errors'):
        raise SystemExit(f'cypher error: {out["errors"]}')
    return out['results']


def load(path):
    with open(path) as f:
        return json.load(f)


def main():
    led = load(os.path.join(ROOT, 'census', 'ledger.json'))
    man = load(os.path.join(WO, 'tests/parity/word-parity-contracts.json'))
    res = load(os.path.join(WO, 'tests/parity/contract-results.json'))
    ran_at = res.get('ranAt')

    # ---- Features (ledger: 501) ----
    feats = [{'id': f['feature'], 'cluster': f.get('cluster'),
              'kind': f.get('kind'), 'level': f.get('level'),
              'oo': str(f.get('oo'))[:300], 'wo': str(f.get('wo'))[:300],
              'evidence': str(f.get('evidence'))[:300]} for f in led['features']]

    # ---- Contracts (manifest × results) ----
    by_key = {(r.get('feature'), r.get('token')): r for r in res['results']}
    contracts, edges_covers = [], []
    for e in man['entries']:
        r = by_key.get((e.get('feature'), e.get('token')))
        status = ('no-run' if r is None else
                  'known-gap' if r.get('xfail') and not r.get('ok') else
                  'pass' if r.get('ok') else 'fail')
        contracts.append({
            'id': f"{e.get('feature')}|{e.get('token')}",
            'feature': e.get('feature'), 'tab': e.get('tab'),
            'label': e.get('label'), 'cls': e.get('effektClass'),
            'censusStatus': e.get('censusStatus'),
            'woMatch': (e.get('wo') or {}).get('match'),
            'subFeatures': len(e.get('subFeatures') or []),
            'status': status, 'ranAt': ran_at,
            'observed': (r or {}).get('observed', '')[:200]})
        if e.get('feature'):
            edges_covers.append(e['feature'])

    # ---- Campaign tasks (.af-state run-states) ----
    tasks = []
    for rs in glob.glob(os.path.join(WO, '.af-state/*/run-state.json')):
        campaign = os.path.basename(os.path.dirname(rs))
        for tid, st in (load(rs) or {}).items():
            if isinstance(st, dict):
                tasks.append({'id': f'{campaign}:{tid}', 'campaign': campaign,
                              'task': tid, 'state': st.get('state'),
                              'phase': st.get('phase')})

    cypher([
        ('UNWIND $feats AS f MERGE (x:OOPort:Feature {id: f.id}) '
         'SET x += f, x.ingestAt = datetime()', {'feats': feats}),
        ('UNWIND $cons AS c MERGE (x:OOPort:Contract {id: c.id}) '
         'SET x += c, x.ingestAt = datetime() '
         'MERGE (t:OOPort:Tab {id: c.tab}) '
         'MERGE (x)-[:IN_TAB]->(t)', {'cons': contracts}),
        ('UNWIND $cons AS c MATCH (x:OOPort:Contract {id: c.id}), (f:OOPort:Feature {id: c.feature}) '
         'MERGE (x)-[:COVERS]->(f)', {'cons': contracts}),
        ('UNWIND $tasks AS t MERGE (x:OOPort:Task {id: t.id}) '
         'SET x += t, x.ingestAt = datetime()', {'tasks': tasks}),
    ])
    n_gap = sum(1 for c in contracts if c['status'] == 'no-run')
    print(f'features={len(feats)} contracts={len(contracts)} '
          f'(no-run={n_gap}) tasks={len(tasks)} ranAt={ran_at}')
    return feats, contracts, tasks, ran_at


def dump(path):
    """Write the joined port state as flat JSON (for af task generators)."""
    feats, contracts, tasks, ran_at = main()
    feat_by_id = {f['id']: dict(f) for f in feats}
    for c in contracts:
        feat_by_id.setdefault(c['feature'], {'id': c['feature']})
        feat_by_id[c['feature']].setdefault('contracts', []).append(
            {k: c[k] for k in ('id', 'tab', 'label', 'cls', 'status', 'woMatch', 'censusStatus')})
    out = {'ranAt': ran_at, 'totals': {
        'features': len(feats), 'contracts': len(contracts),
        'pass': sum(1 for c in contracts if c['status'] == 'pass'),
        'fail': sum(1 for c in contracts if c['status'] == 'fail'),
        'knownGap': sum(1 for c in contracts if c['status'] == 'known-gap'),
        'noRun': sum(1 for c in contracts if c['status'] == 'no-run')},
        'features': list(feat_by_id.values()), 'tasks': tasks}
    with open(path, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('dumped', path, '->', out['totals'])


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--query':
        out = cypher([(sys.argv[2], {})])
        for rec in out[0]['data']:
            print(' | '.join(str(v) for v in rec['row']))
    elif len(sys.argv) > 2 and sys.argv[1] == '--dump':
        dump(sys.argv[2])
    else:
        main()
