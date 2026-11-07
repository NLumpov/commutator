import argparse,os,json,pathlib,shutil,subprocess,select,time,hashlib
root=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='POSIX-only SIGKILL/replay probe; run under an external process guard')
parser.add_argument('repo', type=pathlib.Path)
parser.add_argument('output', type=pathlib.Path)
args=parser.parse_args()
if os.name != 'posix': raise SystemExit('NOT_RUN: this SIGKILL/select probe requires POSIX')
repo=str(args.repo.resolve())
helper=root/'crash-child.ts'
output=args.output.resolve()
output.mkdir(parents=True,exist_ok=False)
template=output/'template'
p=subprocess.run(['bun',str(helper),repo,str(template),'prepare'],text=True,capture_output=True)
(template/'prepare.log').write_text(p.stdout+p.stderr)
assert p.returncode==0,p.stderr
expected=None
results=[]
for stage in ['none','before-start','after-start','after-B','before-commit','after-commit']:
    case=output/stage
    shutil.copytree(template,case,dirs_exist_ok=False)
    baseline=(case/'baseline.json').read_bytes()
    killed=None
    if stage!='none':
        p=subprocess.Popen(['bun',str(helper),repo,str(case),'run',stage],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        lines=[]
        try:
            deadline=time.monotonic()+20
            ready=False
            while time.monotonic()<deadline:
                if select.select([p.stdout],[],[],.2)[0]:
                    line=p.stdout.readline(); lines.append(line)
                    if line.strip()==f'READY {stage}': ready=True; break
                    if not line and p.poll() is not None: break
            assert ready,''.join(lines)
            p.kill(); killed=p.wait(timeout=10)
            assert killed==-9,killed
        finally:
            if p.poll() is None: p.kill(); p.wait(timeout=10)
            if p.stdout: p.stdout.close()
            (case/'killed.log').write_text(''.join(lines))
    p=subprocess.run(['bun',str(helper),repo,str(case),'run'],text=True,capture_output=True,timeout=20)
    (case/'resume.log').write_text(p.stdout+p.stderr)
    assert p.returncode==0,p.stderr
    receipt=json.loads((case/'command.json').read_text()); assert receipt['status']=='done'
    assert (case/'baseline.json').read_bytes()==baseline
    effects=(case/'effects.log').read_text().splitlines(); assert len(effects)==1,effects
    trace=(case/'trace.log').read_text().splitlines(); assert trace.count('seed')==1
    nodes=json.loads((case/'nodes.json').read_text())
    metas={e['uuid']:e['cache'] for e in receipt['snapshot']['metaCache']}
    assert metas[nodes['a']]==1,metas
    assert metas[nodes['seed']]==1,metas
    if expected is None: expected=receipt['snapshot']
    assert receipt['snapshot']==expected
    before_trace=(case/'trace.log').read_text()
    dup=subprocess.run(['bun',str(helper),repo,str(case),'run'],text=True,capture_output=True,timeout=20)
    assert dup.returncode==0 and 'RECONCILED' in dup.stdout,dup.stderr
    assert (case/'trace.log').read_text()==before_trace
    assert len((case/'effects.log').read_text().splitlines())==1
    results.append({'stage':stage,'killExit':killed,'resumeExit':p.returncode,'duplicateExit':dup.returncode,'effects':len(effects),'trace':trace,'snapshotSHA256':hashlib.sha256(json.dumps(receipt['snapshot'],sort_keys=True).encode()).hexdigest()})
    print('PASS',stage,'one fake agent, identical snapshot, committed command not replayed',flush=True)
(output/'result.json').write_text(json.dumps(results,indent=2))
print('COMPLETE 5 SIGKILL + clean control, 18 children settled',flush=True)
