let context: AudioContext | null=null;
export function unlockAudio() {
  try {
    const C=window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    context??=new C(); void context.resume();
  } catch { /* Audio is optional on unsupported devices. */ }
}
export function sound(kind:string) {
  if(!context || context.state!=="running") return;
  const c=context,t=c.currentTime;
  const notes=kind==="win"?[392,494,587,784]:kind==="call"?[220,165]:kind==="out"?[75,48]:kind==="click"?[1600]:kind==="deal"?[330,440]:[620];
  notes.forEach((frequency,i)=>{
    const o=c.createOscillator(),g=c.createGain(),start=t+i*0.09;
    o.type=kind==="out"?"triangle":"sine";o.frequency.setValueAtTime(frequency,start);
    g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(0.075,start+0.008);
    g.gain.exponentialRampToValueAtTime(0.001,start+(kind==="out"?0.55:0.19));
    o.connect(g);g.connect(c.destination);o.start(start);o.stop(start+0.6);
  });
}
