// flow 使用真实音乐调用与解码 OGG 离线重建音乐总线；快进游戏时间和墙钟音频时间分开。
// 阈值 -60 dBFS、50ms 窗；旧曲淡出与新曲淡入同时计入，失败加载与一次性乐段结束均会产生静音。
import {readFileSync} from 'node:fs';
export async function installMusicTrace(page) {
 const object=(file,name)=>JSON.parse(readFileSync(file,'utf8').match(new RegExp(`export const ${name} = (\\{[\\s\\S]*?\\}) as const`))[1]);
 const files=object('src/audio/materials.ts','MUSIC_FILES'),cues=object('src/audio/music-cues.ts','MUSIC_CUES');
 await page.evaluate(async({files:MUSIC_FILES,cues:MUSIC_CUES})=>{
  const a=window.__game.audio;await a.init();
  window.__musicMeta={files:MUSIC_FILES,cues:MUSIC_CUES,busGain:.65*window.__game.settings.musicVol};window.__musicTrace=[];
  // 记录实际开始播放的曲目；异步完成与道中回退也进入时间线。
  a.diagnostics().onMusic=(id,fade)=>{const g=window.__game,diag=a.diagnostics();window.__musicTrace.push({at:g.world.real,stage:g.world.stageIndex,state:g.state,id,fade,ready:id?diag.status['music:'+MUSIC_FILES[id]]==='ready':true,playing:diag.playing?.id??null});};
 },{files,cues});
}
export async function summarizeMusic(page,events,seconds) {
 return page.evaluate(async({events,seconds})=>{
  const {files,cues,busGain}=window.__musicMeta;const cache=new Map();
  const sr=11025,bin=.05;let silent=0,maxGap=0,gap=0,excepted=0;const silentRanges=[];let range=null;
  // 去重使用真实调用结果。music() 对同名当前曲保持播放位置。
  const timeline=[];let prev=null;
  for(const e of events){if(e.id!==prev){timeline.push({...e,at:Math.max(0,e.at)});prev=e.id;}}
  const ctx0=new OfflineAudioContext(2,sr,sr);
  for(const id of new Set(timeline.map(e=>e.id).filter(Boolean))){
   const response=await fetch('/audio/music/'+files[id]+'.ogg');if(!response.ok)throw Error('音乐资源缺失 '+id);
   cache.set(id,await ctx0.decodeAudioData(await response.arrayBuffer()));
  }
  const segments=timeline.map((e,i)=>({ ...e,end:timeline[i+1]?.at??seconds,endFade:timeline[i+1]?.fade??0 }));
  for(let start=0;start<seconds;start+=30){
   const dur=Math.min(30,seconds-start),ctx=new OfflineAudioContext(2,Math.ceil(dur*sr),sr);
   for(const e of segments){
    if(!e.id||!e.ready)continue;const buffer=cache.get(e.id),loop=cues[e.id].loop;
    const end=Math.min(e.end+Math.max(.03,e.endFade),loop?Infinity:e.at+buffer.duration);
    const begin=Math.max(start,e.at);if(begin>=Math.min(start+dur,end))continue;
    const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;src.loop=loop;src.connect(gain);gain.connect(ctx.destination);
    const value=t=>busGain*Math.min(1,(t-e.at)/Math.max(.03,e.fade))*Math.max(0,Math.min(1,(end-t)/Math.max(.03,e.endFade||.03)));
    gain.gain.setValueAtTime(Math.max(0,value(begin)),begin-start);
    const marks=[e.at+Math.max(.03,e.fade),e.end,end].filter(t=>t>begin&&t<start+dur);
    for(const t of marks)gain.gain.linearRampToValueAtTime(value(t),t-start);
    gain.gain.linearRampToValueAtTime(Math.max(0,value(Math.min(end,start+dur))),Math.min(end,start+dur)-start);
    const offset=loop?(begin-e.at)%buffer.duration:begin-e.at;
    src.start(begin-start,offset,Math.min(start+dur,end)-begin);
   }
   const rendered=await ctx.startRendering(),pcm=rendered.getChannelData(0),right=rendered.getChannelData(1),step=Math.round(bin*sr);
   for(let i=0;i<pcm.length;i+=step){let q=0,n=Math.min(step,pcm.length-i);for(let j=0;j<n;j++)q+=(pcm[i+j]**2+right[i+j]**2)/2;
    const t=start+i/sr,dt=n/sr;if(Math.sqrt(q/n)<.001){const exempt=timeline.some(e=>e.id==='warning'&&t>=e.at-1&&t<e.at);if(exempt)excepted+=dt;else {silent+=dt;if(!range){range={start:t,seconds:0};silentRanges.push(range);}range.seconds+=dt;}gap+=dt;maxGap=Math.max(maxGap,gap);}else {gap=0;range=null;}
   }
  }
  return {seconds,busGain,scope:'音乐素材总线，包含轨道交叉淡入与设置音量；快进流程不重建墙钟对白闪避及主输出滤波',thresholdDbfs:-60,windowSeconds:bin,silentSeconds:+silent.toFixed(3),maxGapSeconds:+maxGap.toFixed(3),silentRanges,warningExemptionSeconds:+excepted.toFixed(3),timeline};
 },{events,seconds});
}
