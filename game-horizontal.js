85.5const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const stageEl = document.getElementById('stage');
const livesEl = document.getElementById('lives');
const message = document.getElementById('message');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const soundButton = document.getElementById('soundButton');
const W = canvas.width, H = canvas.height, TILE = 40;
const carStyles = [{ speed:1.15, color:'#ef5b49', type:0 }, { speed:-1.45, color:'#f5b82e', type:1 }, { speed:1.75, color:'#68b8c4', type:2 }];
let dog, cars, bones, collectedBoneCols, catcher, cameraX, cameraTargetX, running=false, paused=false, lastTime=0, score=0, stage=1, lives=1, soundOn=true, audioCtx;
let best = Number(localStorage.getItem('dogCrossingBest') || 0); bestEl.textContent = String(best).padStart(6, '0');
function roadWidth(worldCol) { return [2, 3, 4][((Math.floor(worldCol / 8) % 3) + 3) % 3]; }
function isRoadCol(worldCol) { const cycle=((worldCol%8)+8)%8; return cycle>=3 && cycle<3+roadWidth(worldCol); }
function resetGame() {
  cameraX=0; cameraTargetX=0; score=0; stage=1; lives=1; paused=false; cars=[]; bones=[]; collectedBoneCols=new Set();
    dog={x:0,y:H/2-16,worldX:0,startX:0,startY:H/2-16,targetX:0,targetY:H/2-16,moving:false,moveWasForward:false,moveProgress:0,w:32,h:30,bob:0};
    catcher={x:-140,y:dog.y,targetY:dog.y,w:50,h:58};
  ensureTraffic(); ensureBones(); updateHud();
}
function ensureTraffic() {
  const firstCol=Math.floor(cameraX/TILE)-2, lastCol=firstCol+Math.ceil(W/TILE)+5;
  for(let col=firstCol;col<=lastCol;col++) {
    if(!isRoadCol(col) || cars.some(car=>car.worldCol===col)) continue;
    const style=carStyles[((col%carStyles.length)+carStyles.length)%carStyles.length];
    for(let index=0;index<2;index++) { const speedFactor=1+(Math.abs(col*7+index*11)%5)*.12; cars.push({worldCol:col,worldX:col*TILE+5,y:70+index*255+(col%3)*25,w:29+(style.type===2?7:0),h:58,speed:style.speed*speedFactor,color:style.color,type:style.type}); }
  }
  cars=cars.filter(car=>car.worldX-cameraX<W+100&&car.worldX-cameraX>-100);
}
function ensureBones() {
  const firstCol=Math.floor(cameraX/TILE)-2, lastCol=firstCol+Math.ceil(W/TILE)+5;
  for(let col=firstCol;col<=lastCol;col++) {
    if(collectedBoneCols.has(col)||bones.some(bone=>bone.worldCol===col)) continue;
    const seed=Math.abs(col*37+19), count=isRoadCol(col)?1:2;
    for(let index=0;index<count;index++) bones.push({worldCol:col,worldX:col*TILE+12+((seed+index*17)%15),y:55+((seed+index*83)%500),w:20,h:10});
  }
  bones=bones.filter(bone=>bone.worldX-cameraX<W+100&&bone.worldX-cameraX>-100&&!bone.collected);
}
function updateHud() { scoreEl.textContent=String(score).padStart(6,'0'); stageEl.textContent=String(stage).padStart(2,'0'); livesEl.textContent=lives?'♥':'·'; }
function startGame() { resetGame(); running=true; message.classList.add('hidden'); message.querySelector('.tombstone').classList.remove('visible'); startButton.blur(); playTone(440,.06); }
function endGame() { running=false; message.classList.remove('hidden'); message.querySelector('.eyebrow').textContent='✦ RUN COMPLETE ✦'; message.querySelector('h1').innerHTML='RIP<br><span>SPARKY</span>'; message.querySelector('.tagline').textContent=`FINAL SCORE: ${String(score).padStart(6,'0')}`; message.querySelector('.tombstone').classList.add('visible'); startButton.innerHTML='<span>↻</span> RUN AGAIN'; if(score>best){best=score;localStorage.setItem('dogCrossingBest',best);bestEl.textContent=String(best).padStart(6,'0');} }
function togglePause() { if(!running)return; paused=!paused; pauseButton.textContent=paused?'▶':'Ⅱ'; }
function playTone(freq,duration) { if(!soundOn)return; audioCtx ||= new(window.AudioContext||window.webkitAudioContext)(); const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(); osc.frequency.value=freq;osc.type='square';gain.gain.setValueAtTime(.035,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration); }
function move(key) {
  if(!running||paused||dog.moving)return;
  const step=40,forward=key==='ArrowRight'; dog.startX=dog.x; dog.startY=dog.y; dog.targetX=dog.x; dog.targetY=dog.y;
  if(key==='ArrowRight')dog.targetX+=step; if(key==='ArrowLeft')dog.targetX-=step; if(key==='ArrowUp')dog.targetY-=step; if(key==='ArrowDown')dog.targetY+=step;
  dog.targetX=Math.max(10,Math.min(W-dog.w-10,dog.targetX)); dog.targetY=Math.max(10,Math.min(H-dog.h-10,dog.targetY));
  dog.moveWasForward=forward; dog.moveProgress=0; dog.moving=true; dog.bob=1;
  if(forward&&dog.targetX>520){cameraTargetX+=step;ensureTraffic();}
  playTone(forward?620:300,.035);
}
function hitTest(a,b){return a.x<b.x+b.w-5&&a.x+a.w-5>b.x&&a.y<b.y+b.h-4&&a.y+a.h-4>b.y;}
function isDogHit(){if(!isRoadCol(Math.floor((dog.worldX+dog.w/2)/TILE)))return false;return cars.some(car=>hitTest(dog,{x:car.worldX-cameraX,y:car.y,w:car.w,h:car.h}));}
function update(dt) {
  if(!running||paused)return;
  cameraTargetX+=dt*10;
  const previousCameraX=cameraX;
  cameraX+=(cameraTargetX-cameraX)*Math.min(1,dt/.18);
  const cameraShift=cameraX-previousCameraX;
  dog.x-=cameraShift; dog.targetX-=cameraShift; dog.startX-=cameraShift; dog.worldX=dog.x+cameraX; dog.bob=Math.max(0,dog.bob-dt*5);
  catcher.x+=dt*64.125; catcher.targetY=dog.y; catcher.y+=(catcher.targetY-catcher.y)*Math.min(1,dt/.3);
  if(hitTest({x:catcher.x,y:catcher.y+10,w:catcher.w,h:catcher.h-10},dog)){loseLife();return;}
  if(dog.moving){dog.moveProgress=Math.min(1,dog.moveProgress+dt/.2);const eased=dog.moveProgress<.5?2*dog.moveProgress*dog.moveProgress:1-Math.pow(-2*dog.moveProgress+2,2)/2;dog.x=dog.startX+(dog.targetX-dog.startX)*eased;dog.y=dog.startY+(dog.targetY-dog.startY)*eased;
    if(dog.moveProgress>=1){dog.x=dog.targetX;dog.y=dog.targetY;dog.worldX=dog.x+cameraX;dog.moving=false;if(dog.moveWasForward&&!isDogHit()){score++;stage=Math.floor(score/10)+1;catcher.x-=22;updateHud();}else if(isDogHit())loseLife();}
  }
  cars.forEach(car=>{car.y+=car.speed*(1+stage*.035)*dt*60;if(car.speed>0&&car.y>H+30)car.y=-car.h-20;if(car.speed<0&&car.y+car.h<-20)car.y=H+20;if(!dog.moving&&isDogHit())loseLife();});
  if(!dog.moving)collectBones(); ensureTraffic(); ensureBones();
}
function loseLife(){lives=0;dog.moving=false;playTone(110,.2);updateHud();endGame();}
function collectBones(){bones.forEach(bone=>{if(!bone.collected&&hitTest(dog,{x:bone.worldX-cameraX,y:bone.y,w:bone.w,h:bone.h})){bone.collected=true;collectedBoneCols.add(bone.worldCol);score++;stage=Math.floor(score/10)+1;playTone(760,.05);updateHud();}});}
function draw(){drawBackground();drawCatcher();bones.forEach(drawBone);cars.forEach(drawCar);drawDog();if(paused&&running){ctx.fillStyle='rgba(23,21,31,.65)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f9e8bd';ctx.font='22px "Press Start 2P"';ctx.textAlign='center';ctx.fillText('PAUSED',W/2,H/2);}}
function drawBackground(){
  ctx.fillStyle='#72bfc5';ctx.fillRect(0,0,W,H);
  const firstCol=Math.floor(cameraX/TILE)-2,lastCol=firstCol+Math.ceil(W/TILE)+4;
  for(let worldCol=firstCol;worldCol<=lastCol;worldCol++){
    const x=Math.round(worldCol*TILE-cameraX);
    if(isRoadCol(worldCol)){ctx.fillStyle='#523747';ctx.fillRect(x,0,TILE,H);ctx.fillStyle='#72505b';ctx.fillRect(x+4,0,TILE-8,H);ctx.fillStyle='#f9e8bd';for(let y=18;y<H;y+=80)ctx.fillRect(x+18,y,3,38);ctx.fillStyle='#332536';ctx.fillRect(x,0,3,H);ctx.fillRect(x+TILE-3,0,3,H);ctx.fillStyle='#d89d80';ctx.font='10px "Press Start 2P"';ctx.textAlign='center';ctx.fillText(worldCol%2?'▼':'▲',x+TILE/2,18);}
    else{ctx.fillStyle=worldCol%3?'#8bd5b0':'#91d3a9';ctx.fillRect(x,0,TILE,H);drawTree(x+8,58+(Math.abs(worldCol)%4)*92);drawShrub(x+26,285+(Math.abs(worldCol)%3)*90);}
  }
  ctx.fillStyle='#f5b82e';ctx.fillRect(0,0,3,H);ctx.fillStyle='#ef5b49';ctx.fillRect(TILE-(cameraX%TILE),0,4,H);ctx.fillStyle='#251c32';ctx.font='10px "Press Start 2P"';ctx.textAlign='left';ctx.fillText('RIGHT = FORWARD',12,24);ctx.textAlign='right';ctx.fillText('◀',W-14,24);
}
function drawTree(x,y){ctx.fillStyle='#17151f';ctx.fillRect(x+7,y-14,6,30);ctx.fillStyle='#34785e';ctx.fillRect(x,y-12,20,18);ctx.fillRect(x+4,y-20,12,10);ctx.fillStyle='#65ad79';ctx.fillRect(x+4,y-12,6,6);ctx.fillRect(x+12,y-7,5,5);ctx.fillStyle='#f5b82e';ctx.fillRect(x+7,y+14,7,4);}
function drawShrub(x,y){ctx.fillStyle='#34785e';ctx.fillRect(x,y,13,8);ctx.fillRect(x+5,y-5,12,10);ctx.fillStyle='#ef5b49';ctx.fillRect(x+2,y-3,4,4);ctx.fillStyle='#f9e8bd';ctx.fillRect(x+15,y+5,4,3);}
function drawBone(bone){const x=Math.round(bone.worldX-cameraX);if(x<-30||x>W+30)return;ctx.save();ctx.translate(x,Math.round(bone.y));ctx.fillStyle='rgba(23,21,31,.25)';ctx.fillRect(2,8,18,3);ctx.fillStyle='#f9e8bd';ctx.fillRect(5,3,11,5);ctx.fillRect(2,1,5,5);ctx.fillRect(2,6,5,4);ctx.fillRect(14,1,5,5);ctx.fillRect(14,6,5,4);ctx.restore();}
function drawCatcher(){if(catcher.x<-90)return;ctx.save();ctx.translate(Math.round(catcher.x),Math.round(catcher.y));ctx.fillStyle='rgba(23,21,31,.3)';ctx.fillRect(7,55,42,7);ctx.strokeStyle='#f9e8bd';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(38,8);ctx.lineTo(61,-15);ctx.stroke();ctx.strokeStyle='#ef5b49';ctx.beginPath();ctx.arc(66,-20,14,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#17151f';ctx.fillRect(12,20,32,30);ctx.fillRect(8,45,15,14);ctx.fillRect(34,45,15,14);ctx.fillStyle='#8d5360';ctx.fillRect(14,22,28,24);ctx.fillStyle='#f9e8bd';ctx.font='5px "Press Start 2P"';ctx.textAlign='center';ctx.fillText('DOG',28,34);ctx.fillText('CATCHER',28,41);ctx.fillStyle='#efb08a';ctx.fillRect(16,4,25,22);ctx.fillStyle='#17151f';ctx.fillRect(13,1,31,8);ctx.fillRect(19,0,20,4);ctx.fillStyle='#f9e8bd';ctx.fillRect(21,12,4,4);ctx.fillRect(33,12,4,4);ctx.fillStyle='#17151f';ctx.fillRect(22,13,2,3);ctx.fillRect(34,13,2,3);ctx.fillStyle='#7d302b';ctx.fillRect(25,20,10,4);ctx.fillStyle='#f5b82e';ctx.fillRect(17,29,22,5);ctx.restore();}
function drawCar(car){const x=Math.round(car.worldX-cameraX),danger=Math.abs(x-dog.x)<38&&Math.abs(car.y-dog.y)<130;ctx.save();ctx.translate(x,Math.round(car.y));if(danger){ctx.fillStyle='#ef5b49';ctx.fillRect(-8,-5,4,car.h+10);ctx.fillRect(car.w+4,-5,4,car.h+10);ctx.font='12px "Press Start 2P"';ctx.textAlign='center';ctx.fillText('!',car.w/2,-10);}ctx.fillStyle='rgba(23,21,31,.35)';ctx.fillRect(4,car.h-3,car.w+5,7);ctx.fillStyle='#17151f';ctx.fillRect(4,4,car.w,car.h-8);ctx.fillStyle=car.color;ctx.fillRect(8,0,car.w-8,car.h);ctx.fillStyle='#ff9270';ctx.fillRect(9,2,car.w-13,5);ctx.fillStyle='#b7e1d1';ctx.fillRect(10,12,8,12);ctx.fillRect(10,car.h-24,8,12);ctx.fillStyle='#17151f';ctx.fillRect(0,8,7,12);ctx.fillRect(0,car.h-20,7,12);ctx.fillStyle='#f9e8bd';ctx.fillRect(12,car.speed>0?car.h-5:0,5,4);ctx.fillStyle='#7d3342';ctx.fillRect(car.w-7,10,4,car.h-20);ctx.restore();}
function drawDog(){ctx.save();const bounce=dog.bob?-3:0;ctx.translate(Math.round(dog.x),Math.round(dog.y+bounce));ctx.fillStyle='rgba(23,21,31,.3)';ctx.fillRect(3,29,30,6);ctx.fillStyle='#17151f';ctx.fillRect(5,8,24,20);ctx.fillRect(10,3,18,18);ctx.fillRect(7,0,7,8);ctx.fillRect(25,1,7,8);ctx.fillStyle='#f5b82e';ctx.fillRect(10,9,18,15);ctx.fillStyle='#ef5b49';ctx.fillRect(25,13,7,6);ctx.fillStyle='#f9e8bd';ctx.fillRect(14,6,4,4);ctx.fillRect(24,6,4,4);ctx.fillStyle='#17151f';ctx.fillRect(15,7,2,3);ctx.fillRect(25,7,2,3);ctx.fillStyle='#f9e8bd';ctx.fillRect(8,25,6,6);ctx.fillRect(23,25,6,6);ctx.fillStyle='#ef5b49';ctx.fillRect(2,12,7,4);ctx.restore();}
function loop(time){const dt=Math.min(.035,(time-lastTime)/1000||0);lastTime=time;update(dt);draw();requestAnimationFrame(loop);}
document.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key))event.preventDefault();if(event.key===' ')togglePause();else if(event.key.startsWith('Arrow'))move(event.key);});
startButton.addEventListener('click',startGame);pauseButton.addEventListener('click',togglePause);soundButton.addEventListener('click',()=>{soundOn=!soundOn;soundButton.textContent=soundOn?'♫':'×';});document.querySelectorAll('[data-key]').forEach(button=>button.addEventListener('pointerdown',()=>move(button.dataset.key)));
resetGame();requestAnimationFrame(loop);
