// Developer balancing tool: search legal shots through the actual input handlers.
const {createGame}=require('../tests/harness.cjs');
const fs=require('node:fs');
const first=Number(process.argv[2] || 1)-1;
const last=Number(process.argv[3] || 10)-1;
const game=createGame();
const solutions=[];
const angles=[6,12,18,24,30,38,46,56,65,0];
const powers=[.9,1,.78];
for(let index=first;index<=last;index++){
 const sequence=[];
 for(let shot=0;shot<game.game.levels[index].birds.length;shot++){
  let best=null;
  const type=game.game.levels[index].birds[shot];
  const abilities=type==='red'?[null]:type==='bomb'?[null,36,48]:[null,28,42];
  outer:for(const power of powers)for(const angle of angles)for(const ability of abilities){
   game.start(index);
   for(const old of sequence)game.playShot(...old);
   if(game.game.state.mode!=='ready')break outer;
   const result=game.playShot(angle,power,ability,930);
   const hp=game.game.pigs.reduce((n,p)=>n+Math.max(0,p.game.hp),0);
   const score=(game.game.levels[index].pigs.length-result.pigs)*100000-hp*100+game.game.state.scoreParts.blocks;
   if(!best||score>best.score)best={shot:[angle,power,ability],score,result};
   if(result.mode==='won')break outer;
  }
  if(!best)break;
  sequence.push(best.shot);
  console.log(JSON.stringify({level:index+1,shot:shot+1,...best}));
  if(best.result.mode==='won')break;
 }
 game.start(index);
 for(const shot of sequence)game.playShot(...shot);
 const row={level:index+1,sequence,mode:game.game.state.mode,pigs:game.game.pigs.length};
 solutions.push(row);
 console.log('FINAL '+JSON.stringify(row));
 fs.writeFileSync('/tmp/angry-birds-solutions-'+(first+1)+'.json',JSON.stringify(solutions,null,2));
}
