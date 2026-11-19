import json, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR=44100; DUR=66.0; N=int(SR*DUR)
ev=json.load(open('src/timeline.json'))['ev']
rng=np.random.default_rng(7)
mus=np.zeros((2,N)); sfx=np.zeros((2,N))
def add(buf,x,t,pan=0.0,g=1.0):
    i=int(t*SR)
    if i>=N or i<0: return
    x=x[:N-i]; l=g*(1-max(pan,0)); r=g*(1+min(pan,0))
    buf[0,i:i+len(x)]+=x*l; buf[1,i:i+len(x)]+=x*r
def filt(x,kind,f,o=2):
    return sosfilt(butter(o,f,btype=kind,fs=SR,output='sos'),x)
def tt(d): return np.arange(int(d*SR))/SR
def env(d,a,r,p=2.0):
    t=tt(d); e=np.minimum(t/max(a,1e-4),1)*np.exp(-t/r*p); return e
def midi(n): return 440*2**((n-69)/12)
def kick(): t=tt(0.4); f=45+110*np.exp(-t*30); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)*1.0+0.0
def hat(o=False): d=0.25 if o else 0.07; return filt(rng.standard_normal(int(d*SR)),'high',7000)*env(d,0.001,d/4,3)*0.25
def clap(): d=0.2; return filt(rng.standard_normal(int(d*SR)),'band',[1200,3500])*env(d,0.001,0.07,3)*0.6
def pluck(f,d=0.5,bright=3000):
    t=tt(d); x=sum(np.sin(2*np.pi*f*k*t+0.3*k)/k for k in range(1,6)); x=filt(x,'low',bright); return x*env(d,0.002,d/3,3)*0.25
def bass(f,d):
    t=tt(d); x=np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*2*f*t); return filt(x,'low',500)*env(d,0.01,d,1.2)*0.5
def pad(notes,d):
    t=tt(d); x=0
    for n in notes:
        for dt in (-0.4,0.4): x=x+np.sign(np.sin(2*np.pi*(midi(n)*(1+dt/100))*t))*0.5+np.sin(2*np.pi*midi(n)*t)
    x=filt(x,'low',1400)
    a=np.minimum(t/1.2,1)*np.minimum((d-t)/1.0,1); return x*a*0.05
def whoosh(d=0.8,up=True):
    x=rng.standard_normal(int(d*SR)); t=tt(d); out=np.zeros_like(x)
    # swept bandpass in chunks
    ch=512
    for i in range(0,len(x),ch):
        p=i/len(x); c=300+ (6000*p**2 if up else 6000*(1-p)**2)
        sos=butter(2,[c*0.7,c*1.4],btype='band',fs=SR,output='sos'); out[i:i+ch]=sosfilt(sos,x[i:i+ch])
    e=np.sin(np.pi*np.clip(t/d,0,1))**2; return out*e*0.9
def click(): d=0.06; t=tt(d); return (np.sin(2*np.pi*1800*t)*np.exp(-t*90)+filt(rng.standard_normal(len(t)),'high',3000)*np.exp(-t*120)*0.4)*0.5
def tick(f=1200): d=0.04; t=tt(d); return np.sin(2*np.pi*f*t)*np.exp(-t*140)*0.35
def ping(f,d=0.9,g=0.35):
    t=tt(d); x=np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*2*f*t)+0.15*np.sin(2*np.pi*3.01*f*t); return x*env(d,0.002,d/3,3)*g
def chime(base):
    for k,n in enumerate([0,4,7,12]): add(sfx,ping(midi(base+n),1.2,0.3),0,0) if False else None
def impact():
    d=2.5; t=tt(d); sub=np.sin(2*np.pi*(38+60*np.exp(-t*5))*t)*np.exp(-t*2.2)
    nz=filt(rng.standard_normal(len(t)),'low',3000)*np.exp(-t*4)*0.5; return (sub*1.0+nz)*0.9
def riser(d):
    t=tt(d); x=filt(rng.standard_normal(len(t)),'high',500); f=200*2**(t/d*4); s=np.sin(2*np.pi*np.cumsum(f)/SR)
    return (x*0.5+s*0.3)*(t/d)**2*0.6

# ---------- music
bpm=120; beat=60/bpm
prog=[(45,[57,60,64]),(41,[53,57,60]),(48,[55,60,64]),(43,[55,59,62])]  # Am F C G
def section_gain(t):
    return 1.0
# pads throughout (soft)
for bar in range(int(DUR/ (beat*4))+1):
    t0=bar*beat*4; root,ch=prog[bar%4]
    if t0<DUR-2: add(mus,pad(ch,beat*4+0.6),t0,0,1.0 if t0>=4 else 0.5)
# groove
def kicks(a,b):
    t=a
    while t<b-1e-6: add(mus,kick(),t,0,0.9); t+=beat
def hats(a,b):
    t=a+beat/2
    while t<b: add(mus,hat(),t,0.2,1.0); t+=beat
    t=a
    while t<b: add(mus,hat(False)*0.5,t+beat/4,-0.2,1.0); t+=beat
def claps(a,b):
    t=a+beat
    while t<b: add(mus,clap(),t,0,0.8); t+=beat*2
def bassline(a,b):
    t=a; bar=int(a/(beat*4))
    while t<b-1e-6:
        root,_=prog[bar%4]
        for s in (0,1.5,2,3.5):
            add(mus,bass(midi(root),beat*0.9 if s!=3.5 else beat*0.4),t+s*beat,0,0.85)
        t+=beat*4; bar+=1
def arp(a,b,gain=1.0):
    t=a; bar=int(a/(beat*4))
    while t<b-1e-6:
        _,ch=prog[bar%4]
        seq=[ch[0]+12,ch[1]+12,ch[2]+12,ch[1]+12]
        for i in range(8): add(mus,pluck(midi(seq[i%4]+(12 if i%4==3 else 0)),0.35,2500),t+i*beat/2,(-0.3 if i%2 else 0.3),gain)
        t+=beat*4; bar+=1
def lead(a,b):
    t=a; bar=int(a/(beat*4))
    while t<b-1e-6:
        _,ch=prog[bar%4]
        for i,(s,n) in enumerate([(0,ch[2]+12),(1.5,ch[1]+19),(3,ch[0]+19)]): add(mus,pluck(midi(n),0.7,3500),t+s*beat,0.1,0.8)
        t+=beat*4; bar+=1
add(mus,riser(2.0),0,0,0.8)
add(mus,impact(),2.0,0,1.0)
# Section A 4..18: kick+hat+bass light
kicks(4,18); hats(10,18); bassline(4,18)
# B 18..30.8: + claps, arp
kicks(18,30.8); hats(18,30.8); claps(18,30.8); bassline(18,30.8); arp(18,30.8,0.7)
# bridge 30.8..39.8: no kick, arp+pad
arp(30.8,39.8,0.8); hats(34.8,39.8)
add(mus,riser(1.0),29.8,0,0.5)
# C 40..52 full
kicks(40,52); hats(40,52); claps(40,52); bassline(40,52); arp(40,52,0.9); lead(44,52)
# build 52..58: snare roll-ish
kicks(52,58); hats(52,58); claps(52,58); bassline(52,58); arp(52,58,1.0); lead(52,58)
add(mus,riser(2.0),56.0,0,0.8)
# final
add(mus,impact(),58.0,0,1.1)
for k,n in enumerate([57,60,64,69]): add(mus,pluck(midi(n),1.8,4000),58.0+k*0.02,(-0.2+0.13*k),1.0)
add(mus,pad([57,60,64,69],7.5),58.0,0,1.8)
t=58.5
while t<63: add(mus,hat(),t,0.2,0.8); t+=beat/2
kicks(58.5,62.5)
# sidechain-ish duck on kick for pad is skipped; apply master fade
fade=np.ones(N); i0=int(64.0*SR); fade[i0:]=np.linspace(1,0,N-i0)**1.5
fi=int(1.0*SR); fade[:fi]*=np.linspace(0,1,fi)
mus*=fade

# ---------- sfx
def whoo(t,up=True,d=0.8,g=0.7): add(sfx,whoosh(d,up),t-d*0.55 if up else t-0.05,0,g)
for t in (0.3,0.8,1.3): add(sfx,tick(900+300*(t>0.5)),t,0,1)
add(sfx,whoosh(0.5,False)*0.6,1.65,0,1)
for t in (3.8,10.9,17.5,30.8,34.6,39.8,51.0,58.0): whoo(t)
for k in ('clickDemo','clickNew','clickAmount','clickCont1','clickRecipient','clickProt','clickMsg','clickCont2','clickFund','clickView','clickWa','clickPhoneCont'):
    add(sfx,click(),ev[k],0,1)
for a,b in (('typeAmountA','typeAmountB'),('typeRecA','typeRecB'),('typeMsgA','typeMsgB'),('waTypeA','waTypeB')):
    t=ev[a]
    while t<ev[b]: add(sfx,tick(rng.uniform(1000,1500)),t,rng.uniform(-.3,.3),rng.uniform(.5,1)); t+=rng.uniform(0.05,0.11)
for k in ('themeLight','themeDark'): add(sfx,whoosh(0.5,True),ev[k]-0.25,0,0.5); add(sfx,ping(1318,0.4,0.2),ev[k]+0.15)
for k in ('hlQuote','hlFund','hlLink','hlWa','hlWallet','hlBadge','hlBalance','hlStatus','hlTx'):
    add(sfx,ping(1760,0.35,0.12),ev[k],0.2)
# success chimes
for t in (ev['swapDone'],ev['swapDonePhone']):
    for k,n in enumerate([72,76,79,84]): add(sfx,ping(midi(n),1.4,0.28),t+k*0.07,-0.3+0.2*k)
add(sfx,impact()*0.25,ev['swapDonePhone'],0,1)
add(sfx,ping(880,0.5,0.4),ev['waSend']); add(sfx,ping(1175,0.7,0.3),ev['waDelivered']); add(sfx,ping(1568,0.8,0.3),ev['waRead'])
add(sfx,whoosh(0.7,True),ev['waSend']-0.4,0,0.4)
add(sfx,click()*1.5,ev['phoneIn']+0.2,0,1)
for k in ('chip1','chip2','chip3'): add(sfx,ping(1318,0.5,0.3),ev[k]); add(sfx,tick(700),ev[k]-0.05)
add(sfx,ping(1976,1.5,0.3),ev['cta']); add(sfx,impact()*0.5,ev['logoHit'],0,1)
add(sfx,ping(2093,0.5,0.3),ev['clickDemo']+0.3)

out=mus*0.75+sfx*0.9
# gentle master: soft clip + normalize
out=np.tanh(out*1.3)/np.tanh(1.3)
pk=np.abs(out).max(); out=out/pk*0.89
wavfile.write('out/audio.wav',SR,(out.T*32767).astype(np.int16))
print('ok',out.shape, pk)
