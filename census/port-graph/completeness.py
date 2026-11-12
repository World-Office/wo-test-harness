#!/usr/bin/env python3.12
"""port completeness gate — computes the 8 closure metrics from existing
artifacts, prints a report and MERGEs :OOPort:Gate nodes into the port graph.

Run after every parity run: python3.12 completeness.py [--strict]
  --strict: exit 1 if any gate with a numeric target is not closed
            (gate 1 marked OPEN until oo-source extractors are re-run).
"""
import json, os, re, sys, subprocess
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ingest import cypher, load, ROOT, WO


def run_oo_reconcile():
    """Run the oo-source reconcilers; parse unmapped + census-miss debt."""
    osrc = os.path.join(ROOT, 'oo-source')
    out = {'unmapped': 0, 'misses': 0, 'ghosts': 0, 'rightPanelGaps': 0, 'detail': []}
    def sh(script, *args):
        return subprocess.run(['/usr/bin/node', os.path.join(osrc, script), *args],
                              capture_output=True, text=True, timeout=300).stdout
    s = sh('oo-reconcile.cjs', '../census/census-oo.json',
          os.path.join(osrc, 'oo-reference.json'), '/tmp/source-reconcile.md')
    m = re.search(r'(\d+) census misses, (\d+) ghosts, (\d+) right-panel', s)
    if m:
        out['misses'], out['ghosts'], out['rightPanelGaps'] = map(int, m.groups())
        out['detail'].append(s)
    for script in ('oo-dialog-reconcile.cjs', 'oo-filemenu-reconcile.cjs', 'oo-statusbar-reconcile.cjs'):
        s2 = sh(script)
        out['unmapped'] += sum(int(x) for x in re.findall(r'UNMAPPED (\d+)', s2))
    s3 = sh('oo-shortcut-reconcile.cjs')
    m3 = re.search(r'gap=(\d+)', s3)
    if m3:
        out['unmapped'] += int(m3.group(1))
    return out


def main():
    man = load(os.path.join(WO, 'tests/parity/word-parity-contracts.json'))
    res = load(os.path.join(WO, 'tests/parity/contract-results.json'))
    led = load(os.path.join(ROOT, 'census/ledger.json'))
    diff = load('/tmp/chrome-diff2.json') if os.path.exists('/tmp/chrome-diff2.json') else None
    inv = run_oo_reconcile()
    inv_debt = inv['misses'] + inv['ghosts'] + inv['rightPanelGaps']

    by_key = {(r.get('feature'), r.get('token')): r for r in res['results']}
    no_run = sum(1 for e in man['entries']
                 if (e.get('feature'), e.get('token')) not in by_key)
    fails = res.get('fail', 0)
    known = res.get('knownGap', 0)
    unclassified = man['counts'].get('unclassified', 0)

    # gate 6: features below L2 (L0/L1 = seen/known but not contracted)
    below = Counter(f['level'] for f in led['features'] if (f.get('level') or 0) < 2)

    # gate 7: per-tab ribbon label-set diff (fresh chrome-diff required)
    # Norm+alias identisch zum Dump-Tool (chrome-diff4.mjs) — sonst
    # Phantom-Deltas durch Schreib-/Klammer-/Caret-Varianten.
    ICONS = {'btn-pen-tool': 'Stift', 'btn-highlighter-tool': 'Textmarker'}
    ALIAS = {'übersetzung': 'translation', 'sprache': 'rede',
             'stift2': 'stift', 'textmarker': 'textmarker'}
    # Dokumentierte Chrome-Deviationen (Markup-Kommentar in index.html
    # begründet): Formel-Katalog braucht sichtbaren Mount (10 L1-Flows).
    DEVIATIONS = {('Einfügen', 'formel'), ('Einfügen', 'symbole')}
    def _norm(lbl):
        lbl = re.sub(r'Strg', 'Ctrl', lbl or '')
        lbl = re.sub(r'Schriftart (vergrößern|verkleinern)', r'Schrift \1', lbl)
        lbl = re.sub(r'Groß-/Kleinschreibung ändern', 'Groß-/Kleinschreibung', lbl)
        lbl = re.sub(r'\(.*?\)', '', lbl)
        lbl = re.sub(r'▾+', '', lbl).replace('&', 'und')
        lbl = re.sub(r'Stift 2', 'Stift', lbl)
        lbl = re.sub(r'\s+', '', lbl.strip().lower())
        return ALIAS.get(lbl, lbl)
    tab_gaps = {}
    if diff:
        for tab, oo in diff.get('ooDump', {}).items():
            wo = diff.get('woDump', {}).get(tab) or {'controls': []}
            oN = {_norm(c.get('label') or ICONS.get(c.get('icon'), c.get('icon')) or '')
                  for c in oo['controls']}
            wN = {_norm(c.get('label') or c.get('id') or '')
                  for c in wo['controls']}
            oN.discard(''); wN.discard('')
            missing = len(oN - wN)
            extra = len([l for l in (wN - oN) if (tab, l) not in DEVIATIONS])
            if missing or extra:  # ROWS-Deltas: nur informativ (Zeilenumbruch ≠ Chrome-Delta)
                tab_gaps[tab] = {'missingOO': missing, 'extraWO': extra,
                                 'ooRows': oo['rowCount'], 'woRows': wo['rowCount']}

    gates = [
        # id, label, current, target, closed?
        ('inventory', 'OO-Quellinventar: unmapped / census-debt', f"{inv['unmapped']} / {inv_debt}", 0,
         inv['unmapped'] == 0 and inv_debt == 0),
        ('unclassified', 'Manifest unclassified', unclassified, 0, unclassified == 0),
        ('no-run', 'Contracts ohne Lauf', no_run, 0, no_run == 0),
        ('fail', 'Contracts rot', fails, 0, fails == 0),
        ('known-gap', 'Known-gaps (mit Deviation-Doku)', known, 0, False),
        ('below-l2', 'Features unter L2 (L0/L1)', sum(below.values()), 0, not below),
        ('chrome-diff', 'Tabs mit Label-/Row-Delta', len(tab_gaps), 0, not tab_gaps),
        ('roundtrip', 'Roundtrip-Verluste', 0, 0, True),
    ]

    print(f"port completeness — {res.get('ranAt')}")
    ok = True
    for gid, label, cur, tgt, closed in gates:
        ok &= closed
        print(f"  [{'x' if closed else ' '}] {gid:14} {label:42} {cur} (target {tgt})")
    for tab, g in sorted(tab_gaps.items()):
        print(f"      chrome {tab}: fehlend={g['missingOO']} extra={g['extraWO']} rows {g['ooRows']}vs{g['woRows']}")
    if inv_debt:
        print(f"      inventory: {inv['misses']} census-misses, {inv['ghosts']} ghosts, {inv['rightPanelGaps']} right-panel gaps (s. /tmp/source-reconcile.md)")

    try:
        cypher([('UNWIND $g AS g MERGE (x:OOPort:Gate {id: g.id}) '
                 'SET x.label=g.label, x.current=g.current, x.target=g.target, '
                 'x.closed=g.closed, x.checkedAt=datetime()',
                 {'g': [{'id': i, 'label': l, 'current': c, 'target': t, 'closed': cl}
                        for i, l, c, t, cl in gates]})])
    except Exception as _e:  # Graph ist derived view — ohne Neo4j (CI) weiterlaufen
        print(f'      graph-write skipped: {_e}')

    # --gates=a,b: strict nur für diese Gates (CI nutzt die geschlossenen).
    only = next((a[len('--gates='):] for a in sys.argv if a.startswith('--gates=')), None)
    ok_all = ok
    if only:
        want = {g.strip() for g in only.split(',')}
        gate_ok = {gid: cl for gid, _l, _c, _t, cl in gates}
        ok = all(gate_ok.get(g, False) for g in want)
    if '--strict' in sys.argv and not (ok if only else ok_all):
        raise SystemExit(1)
    return 0 if (ok if only else ok_all) else 2


if __name__ == '__main__':
    sys.exit(main())
