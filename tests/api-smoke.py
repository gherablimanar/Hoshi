#!/usr/bin/env python3
"""Real HTTP integration checks; run against a disposable local DATA_DIR.
No provider credentials are required and no fake flight data is substituted.
"""
import io,json,os,time,urllib.request,urllib.error,zipfile
from pathlib import Path
BASE=os.environ.get('ROCKET_TEST_URL','http://127.0.0.1:8080')+'/api'
ROOT=Path(__file__).resolve().parent
checks=[]
def request(path,body=None,raw=None):
 data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
 req=urllib.request.Request(BASE+path,data,{'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=30) as r:
   b=r.read();return r.status,json.loads(b) if r.headers.get_content_type()=='application/json' else b
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def check(name,value):
 assert value,name
 checks.append({'check':name,'passed':True})
def job(project,index):
 status,j=request(f"/projects/{project['id']}/jobs",{'revision':project['revision'],'simulationIndex':index});check('job accepted',status==202)
 deadline=time.monotonic()+30
 while time.monotonic()<deadline:
  _,state=request('/jobs/'+j['id'])
  if state['state'] not in ('pending','running'):break
  time.sleep(.05)
 status,run=request('/runs/'+j['id']);check('terminal run persisted before terminal state',status==200)
 return run
status,health=request('/health');check('headless 24.12 baseline',status==200 and health['commit']=='133b558de556f0282f51c3f53f3b3fc633b4310a')
for headers,name in [({'Host':'evil.invalid:8080'},'untrusted Host rejected'),({'Origin':'https://evil.invalid'},'cross-origin browser request rejected')]:
 try:
  urllib.request.urlopen(urllib.request.Request(BASE+'/health',headers=headers),timeout=10)
  check(name,False)
 except urllib.error.HTTPError as e:check(name,e.code==403)
status,p=request('/import',raw=(ROOT/'fixtures/simple.ork').read_bytes());check('real upstream archive import',status==201)
status,exported=request('/projects/'+p['id']+'/export');check('native export',status==200)
with zipfile.ZipFile(io.BytesIO(exported)) as actual,zipfile.ZipFile(ROOT/'fixtures/simple.ork') as expected:
 check('embedded decals preserved byte-for-byte',all(actual.read(n)==expected.read(n) for n in expected.namelist() if n!='rocket.ork'))
status,reopened=request('/import',raw=exported);check('native archive reopened',status==201 and len(reopened['configurations'])==len(p['configurations']))
def flatten(c):return [c]+[x for child in c['children'] for x in flatten(child)]
tube=next(c for c in flatten(p['rocket']) if c['type']=='BodyTube')
status,edited=request('/projects/'+p['id']+'/mutate',{'revision':p['revision'],'op':'set','componentId':tube['id'],'changes':{'length':.31}});check('component edit persisted',status==200 and edited['revision']==2)
status,err=request('/projects/'+p['id']+'/mutate',{'revision':1,'op':'set','componentId':tube['id'],'changes':{'length':.32}});check('stale write rejected',status==409 and err['error']['code']=='stale_revision')
status,err=request('/projects/'+p['id']+'/mutate',{'revision':2,'op':'set','componentId':tube['id'],'changes':{'length':-.1}});check('invalid dimension rejected',status==422)
run=job(edited,0);check('real edited rocket flight and apogee event',run['status']=='completed' and run['summary']['maxAltitude']>0 and any(e['type']=='APOGEE' for e in run['branches'][0]['events']))
_,csv=request('/runs/'+run['id']+'/csv?variables=t,h');check('selectable CSV and event context',b'Altitude [m]' in csv and b'Total velocity' not in csv and b'# event APOGEE' in csv)
_,empty=request('/projects',{'name':'HTTP empty warning test'});_,empty=request('/projects/'+empty['id']+'/mutate',{'revision':empty['revision'],'op':'simulation'})
failed=job(empty,0);check('genuine no-motor failure retained honestly',failed['status']=='failed' and ('NO_MOTORS' in json.dumps(failed) or failed['error']))
status,_=request('/import',raw=b'<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><openrocket>&e;</openrocket>');check('external entity import rejected',status==422)
status,_=request('/import',raw=b'<openrocket><rocket>');check('malformed import rejected as validation error',status==422)
if not health['aiConfigured']:
 status,_=request('/projects/'+edited['id']+'/ai',{'revision':edited['revision'],'message':'Explain this result'});check('unconfigured AI explicit 503; no fake response',status==503)
_,restored=request('/projects/'+edited['id']);check('AI unavailable leaves project revision intact',restored['revision']==edited['revision'])
(ROOT/'api-results.json').write_text(json.dumps({'checks':checks},indent=2)+'\n')
print(f'{len(checks)} HTTP integration assertions passed')
