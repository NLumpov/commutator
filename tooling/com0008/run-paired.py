import argparse, json, os, pathlib, statistics, subprocess, time, sys
root=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='Sequential paired Worker benchmark; run under an external process guard')
parser.add_argument('baseline', type=pathlib.Path)
parser.add_argument('candidate', type=pathlib.Path)
parser.add_argument('output', type=pathlib.Path)
parser.add_argument('--rounds', type=int, default=5)
args=parser.parse_args()
rounds=args.rounds
if rounds < 1: parser.error('--rounds must be positive')
root_data=args.output.resolve()
root_data.mkdir(parents=True,exist_ok=False)
(root_data/'sources.json').write_text(json.dumps({'baseline':str(args.baseline.resolve()),'candidate':str(args.candidate.resolve())}))
env={**os.environ,'COM0008_DATA_DIR':str(root_data)}
prepared=subprocess.run(['bun',str(root/'benchmark.ts'),'baseline','prepare'],capture_output=True,text=True,env=env)
(root_data/'prepare.log').write_text(prepared.stdout+prepared.stderr)
if prepared.returncode: raise SystemExit(prepared.returncode)
out=root_data/'paired'
out.mkdir()
counts={"empty-32":8142,"number-32":5591,"wide-32x8":2208,"nested-128x8":4596,"event-32":42828,"pure-16":26179,"unawaited-16":17121}
(root_data/'counts.json').write_text(json.dumps(counts,indent=2))
cases=[('measure',n,c) for n,c in counts.items()]
cases += [(mode,n,300) for mode in ['extract','restore','checkpoint'] for n in ['number-32','wide-32x8','nested-128x8']]
records=[]
for pair in range(rounds):
    variants=['baseline','candidate'] if pair%2==0 else ['candidate','baseline']
    ordered=cases[pair%len(cases):]+cases[:pair%len(cases)]
    for mode,name,count in ordered:
        outputs={}
        for v in variants:
            path=out/f'{pair}-{v}-{mode}-{name}.json'
            args=['bun',str(root/'benchmark.ts'),v,mode,name,str(count),str(path)]
            start=time.monotonic()
            p=subprocess.run(args,capture_output=True,text=True,env=env)
            path.with_suffix('.log').write_text(p.stdout+p.stderr)
            records.append({'path':str(path),'command':args,'exitCode':p.returncode,'seconds':time.monotonic()-start})
            (out/'commands.json').write_text(json.dumps(records,indent=2))
            if p.returncode: print(p.stdout+p.stderr,flush=True); raise SystemExit(p.returncode)
            outputs[v]=json.loads(path.read_text())
        assert outputs['baseline']['schemaHash']==outputs['candidate']['schemaHash']
        assert outputs['baseline']['workerHash']==outputs['candidate']['workerHash']
        med={v:statistics.median(r['samplesUs']) for v,r in outputs.items()}
        print(pair,mode,name,{k:round(v,3) for k,v in med.items()},f"{(med['candidate']/med['baseline']-1)*100:+.1f}%",flush=True)
print('COMPLETE',len(records),'sequential child processes all exited 0',flush=True)
