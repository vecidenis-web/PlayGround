(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, FLOOR = 432;
  const $ = id => document.getElementById(id);
  const intro = $('intro'), hud = $('hud'), overlay = $('roundOverlay');
  const selectedButtons = [...document.querySelectorAll('.fighter-card')];
  const keys = Object.create(null), touchHeld = Object.create(null);
  let selected = 'sonic', running = false, ended = false, paused = false;
  let player, cpu, timeLeft = 99, lastTime = 0, roundDelay = 0, shake = 0, particles = [], rings = [], ambient = 0;
  let audioOn = true, audioCtx = null;

  const palettes = {
    sonic: {body:'#168de0', dark:'#1250b8', light:'#56cfff', skin:'#f6c19a', shoe:'#f04448', trim:'#fff7ed', eye:'#f7f8ff', pupil:'#142347', aura:'#54eaff'},
    shadow:{body:'#242635', dark:'#111522', light:'#e53355', skin:'#e8b18d', shoe:'#e52d50', trim:'#f7f4ee', eye:'#ff354e', pupil:'#171521', aura:'#ff3e67'}
  };
  // 16-bit pixel silhouettes. Each character has its own recognizable quills, streaks and shoes.
  const spriteMaps = {
    sonic:[
      '...BBBB.........','..BBBBBBB.......','.BBBBBBBBB......','BBBBBBBBBBBB....','..BBBBBBBBBBBB..','...BBBBBBBBBBBB.','....BBLLLLBBBBB.','.....BLLLLLBBBB.','......BLLLWWBBB.','......BLLLWWBBB.','.......BBWWBBBB.','.......SSSSBBBB.','......SSSSSSBB..','.....SSSSSSSS...','.....DDSSDD.....','....DD.DD.DD....','...RRR..RRRR....','..WWWW..WWWW....','..WWWW..WWWW....'
    ],
    shadow:[
      'RR..BBBB.........','RR.BBBBBBB.......','.RBBBBBBBB.......','BBBBBBBBBBBB.....','..BBBBBBBBBBBB...','...BBBBBBBBBBBB..','....BBLLLLBBBBB..','.....BLLLLLBBBB..','......BLLLWWBBB..','......BLLLWWBBB..','.......BBWWBBBB..','.......SSSSBBBB..','......SSSSSSBB...','.....SSSSSSSS....','.....DDSSDD......','....DD.DD.DD.....','...RRR..RRRR.....','..WWWW..WWWW.....','..WWWW..WWWW.....'
    ]
  };
  function beep(freq=360,duration=.06,type='square',volume=.035){
    if(!audioOn)return;
    try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch(_){ }
  }
  function fighter(kind,x,isCpu=false){return {kind,x,y:FLOOR,vx:0,vy:0,face:isCpu?-1:1,health:100,meter:kind==='shadow'?10:0,attack:0,attackKind:'spin',attackHit:false,boostCooldown:0,stun:0,transformed:0,walk:0,flash:0,block:false,isCpu};}
  function startGame(){
    selectedButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fighter===selected)));
    player=fighter(selected,246,false);cpu=fighter(selected==='sonic'?'shadow':'sonic',714,true);
    running=true;ended=false;paused=false;timeLeft=99;particles=[];rings=[];shake=0;roundDelay=1.35;
    intro.classList.add('hidden');hud.classList.add('active');overlay.classList.remove('show');$('statusText').textContent='FIGHT! LAND HITS TO CHARGE YOUR CHAOS METER';
    $('playerName').textContent=selected.toUpperCase();$('cpuName').textContent=cpu.kind.toUpperCase();
    $('playerIcon').textContent=selected==='sonic'?'S':'S';$('cpuIcon').textContent='S';$('cpuIcon').classList.toggle('shadow-icon',cpu.kind==='shadow');$('playerIcon').classList.toggle('shadow-icon',selected==='shadow');
    syncHud();
  }
  selectedButtons.forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.fighter;selectedButtons.forEach(c=>{c.classList.toggle('selected',c===b);c.setAttribute('aria-pressed',String(c===b))});beep(540,.04)}));
  $('playButton').addEventListener('click',()=>{startGame();beep(250,.12,'sawtooth')});
  $('rematchButton').addEventListener('click',()=>{startGame();beep(260,.1,'sawtooth')});
  $('resetButton').addEventListener('click',()=>{running=false;ended=false;overlay.classList.remove('show');hud.classList.remove('active');intro.classList.remove('hidden');$('statusText').textContent='PICK YOUR SIDE AND GET READY';});
  $('soundButton').addEventListener('click',()=>{audioOn=!audioOn;$('soundButton').innerHTML=audioOn?'♫ <span>SOUND ON</span>':'♫ <span>SOUND OFF</span>';if(audioOn)beep(520,.05)});
  function setAction(action,down){touchHeld[action]=down;const button=document.querySelector(`[data-action="${action}"]`);if(button)button.classList.toggle('pressed',down);if(down&&action==='attack')doAttack(player,'spin');if(down&&action==='boost')doAttack(player,'boost');if(down&&action==='transform')transform(player);if(down&&action==='jump'&&running&&!ended&&player.y>=FLOOR-1){player.vy=-570;beep(420,.04)}}
  document.querySelectorAll('.touch-btn').forEach(button=>{
    const action=button.dataset.action;
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(['left','right'].includes(action))setAction(action,true);else setAction(action,true)});
    const release=e=>{if(['left','right'].includes(action))setAction(action,false);else setAction(action,false)};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  });
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup',' ','j','k','l','a','d','w'].includes(k))e.preventDefault();keys[k]=true;
    if(e.repeat||!running||ended)return;
    if(k==='j'||k==='z')doAttack(player,'spin');if(k==='k'||k==='x')doAttack(player,'boost');if(k==='l'||k==='c')transform(player);
    if((k==='arrowup'||k==='w'||k===' ')&&player.y>=FLOOR-1){player.vy=-570;beep(420,.04)}
    if(k==='escape'||k==='p'){paused=!paused;$('statusText').textContent=paused?'PAUSED · PRESS P TO RESUME':'FIGHT! LAND HITS TO CHARGE YOUR CHAOS METER'}
  });
  window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
  window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;for(const k in touchHeld)touchHeld[k]=false});

  function doAttack(f,kind){if(!running||ended||paused||roundDelay>0||f.stun>0)return;if(kind==='boost'&&f.boostCooldown>0)return;if(f.attack>0)return;
    f.attack=kind==='boost'?.32:.25;f.attackKind=kind;f.attackHit=false;
    if(kind==='boost'){f.boostCooldown=1.05;f.vx=f.face*(f.transformed?730:590);f.vy=Math.min(f.vy,0);beep(170,.13,'sawtooth',.045)}else beep(f.kind==='sonic'?520:330,.055,'square',.025);
  }
  function transform(f){if(!running||ended||paused||roundDelay>0||f.transformed>0||f.meter<100)return;f.meter=0;f.transformed=8;f.health=Math.min(100,f.health+7);burst(f.x,f.y-43,palettes[f.kind].aura,26);$('transformFlash').classList.remove('show');void $('transformFlash').offsetWidth;$('transformFlash').classList.add('show');$('statusText').textContent=`${f.kind.toUpperCase()} UNLEASHED CHAOS CONTROL`;beep(105,.26,'sawtooth',.06);setTimeout(()=>beep(710,.26,'triangle',.04),90);}

  function bg(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#172347');sky.addColorStop(.52,'#392c63');sky.addColorStop(1,'#14152c');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // distant moon and pixel stars
    ctx.fillStyle='#ffe9a1';ctx.fillRect(738,65,5,5);ctx.fillRect(743,61,5,5);ctx.fillRect(748,65,5,5);ctx.fillRect(743,70,5,5);ctx.fillStyle='#fff5cf';ctx.fillRect(743,65,5,5);
    for(let i=0;i<34;i++){const x=(i*173+31)%W,y=(i*67+25)%210;ctx.fillStyle=i%3?'#aab9ea66':'#e8cfffaa';ctx.fillRect(x,y,(i%7===0?3:2),(i%7===0?3:2))}
    // stylized night city, each block is crisp pixels
    ctx.fillStyle='#22264a';ctx.beginPath();ctx.moveTo(0,315);for(let x=0;x<=W;x+=64){ctx.lineTo(x,290+Math.sin(x*.025)*23);ctx.lineTo(x+32,322+Math.sin((x+32)*.02)*18)}ctx.lineTo(W,420);ctx.lineTo(0,420);ctx.fill();
    for(let i=0;i<15;i++){const x=i*71-12,h=75+(i*43)%116,y=388-h,w=41+(i%3)*8;ctx.fillStyle=i%2?'#242444':'#28264b';ctx.fillRect(x,y,w,h);ctx.fillStyle='#42406b';ctx.fillRect(x+4,y+6,w-8,3);for(let r=0;r<Math.floor(h/20);r++)for(let c=0;c<3;c++){ctx.fillStyle=(i+r+c)%4===0?'#ffd78888':'#64c3ff55';ctx.fillRect(x+7+c*11,y+17+r*19,4,6)}}
    // glowing rift
    ctx.globalAlpha=.6;ctx.fillStyle='#ed5caa';ctx.fillRect(468,164,5,172);ctx.fillRect(460,178,4,141);ctx.fillStyle='#4ce8ff';ctx.fillRect(480,188,4,140);ctx.globalAlpha=1;
    // low horizon haze and distant track
    ctx.fillStyle='#ff74be18';ctx.fillRect(0,346,W,46);ctx.fillStyle='#e2b9ff';ctx.fillRect(0,386,W,2);
    // stage platform and checker floor
    ctx.fillStyle='#11142a';ctx.fillRect(0,390,W,150);ctx.fillStyle='#383250';ctx.fillRect(0,390,W,5);ctx.fillStyle='#ff72bd';ctx.fillRect(0,390,W,2);ctx.fillStyle='#54def4';ctx.fillRect(0,395,W,2);
    for(let row=0;row<8;row++){for(let col=0;col<24;col++){if((row+col)%2===0){ctx.fillStyle=row<3?'#22243c':'#1b1d34';ctx.fillRect(col*44+(row%2)*22,402+row*18,44,18)}}}
    ctx.fillStyle='#464061';ctx.fillRect(0,FLOOR,W,3);ctx.fillStyle='#8c678e';ctx.fillRect(0,FLOOR+3,W,2);
  }
  function drawFighter(f){
    const p=palettes[f.kind],map=spriteMaps[f.kind];const bob=f.y>=FLOOR-1?Math.sin(f.walk)*2:0;
    ctx.save();ctx.translate(Math.round(f.x),Math.round(f.y+bob));ctx.scale(f.face,1);
    ctx.globalAlpha=Math.max(.12,.32-(FLOOR-f.y)/180);ctx.fillStyle='#070817';ctx.beginPath();ctx.ellipse(0,1,39,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    if(f.transformed>0){ctx.strokeStyle=p.aura;ctx.globalAlpha=.48+Math.sin(ambient*18)*.2;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-38,43,48,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.15;ctx.fillStyle=p.aura;ctx.beginPath();ctx.ellipse(0,-38,37,44,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
    if(f.attack>0&&f.attackKind==='spin'){ctx.globalAlpha=.7;ctx.strokeStyle=p.aura;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,-38,43,30,Math.sin(ambient*24)*.3,Math.PI*.08,Math.PI*1.72);ctx.stroke();ctx.globalAlpha=1}
    if(f.attack>0&&f.attackKind==='boost'){ctx.globalAlpha=.35;ctx.fillStyle=p.aura;ctx.fillRect(-75,-55,65,6);ctx.fillRect(-60,-43,47,3);ctx.globalAlpha=1}
    const colors={B:f.transformed>0?'#ffe75b':p.body,L:p.light,S:p.skin,D:p.dark,R:p.shoe,W:p.trim};
    ctx.translate(-32,-76);
    for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){const c=map[y][x];if(colors[c]){ctx.fillStyle=colors[c];ctx.fillRect(x*4,y*4,4,4)}}
    if(f.kind==='sonic'){ctx.fillStyle=p.pupil;ctx.fillRect(46,32,3,7)}else{ctx.fillStyle=p.eye;ctx.fillRect(46,32,4,6);ctx.fillStyle='#18131d';ctx.fillRect(48,33,2,4)}
    if(f.transformed>0){ctx.fillStyle='#fff5a8';ctx.fillRect(45,31,5,3)}
    if(f.flash>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=.45;ctx.fillStyle='#fff';ctx.fillRect(0,0,72,78)}
    ctx.restore();
  }
  function burst(x,y,color,count=14){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*240;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:.28+Math.random()*.42,max:.7,color,size:2+Math.random()*4})}}
  function updateEffects(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=350*dt;if(p.life<=0)particles.splice(i,1)}shake=Math.max(0,shake-dt*28)}
  function drawEffects(){for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size)}ctx.globalAlpha=1}
  function hit(attacker,target,kind){
    const dist=Math.abs(attacker.x-target.x);if(dist>112||attacker.attackHit)return;
    const facing=attacker.face===Math.sign(target.x-attacker.x);if(!facing)return;
    attacker.attackHit=true;const guarded=target.block&&target.face===-attacker.face;
    const power=(kind==='boost'?19:11)*(attacker.transformed>0?1.55:1)*(guarded?.32:1);
    target.health=Math.max(0,target.health-power);target.meter=Math.min(100,target.meter+(guarded?10:17));attacker.meter=Math.min(100,attacker.meter+(guarded?9:24));
    target.stun=guarded?.08:.2;target.vx=attacker.face*(guarded?85:kind==='boost'?350:220);target.vy=guarded?target.vy:-95;target.flash=.12;
    burst((attacker.x+target.x)/2,FLOOR-45,guarded?'#ffe579':palettes[attacker.kind].aura,guarded?8:16);shake=guarded?2:kind==='boost'?8:4;beep(guarded?250:kind==='boost'?120:220,guarded?.05:.1,guarded?'triangle':'square',.045);
    if(!guarded)attacker.meter=Math.min(100,attacker.meter+7);
    syncHud();if(target.health<=0)finish(attacker===player?selected.toUpperCase():cpu.kind.toUpperCase());
  }
  function finish(winner){if(ended)return;ended=true;running=false;$('roundStamp').textContent='RIFT ARENA · ROUND 01';$('roundMessage').textContent=winner+' WINS';$('roundMessage').style.color=winner==='SONIC'?'#63eaff':'#ff6482';$('rematchButton').innerHTML='RUN IT BACK <span>↻</span>';overlay.classList.add('show');$('statusText').textContent=winner+' TAKES THE ROUND';burst(winner==='SONIC'?cpu.x:player.x,FLOOR-55,'#ffe774',38);beep(120,.35,'sawtooth',.05)}
  function syncHud(){if(!player||!cpu)return;$('playerHealth').style.width=player.health+'%';$('cpuHealth').style.width=cpu.health+'%';$('playerMeter').style.width=player.meter+'%';$('cpuMeter').style.width=cpu.meter+'%';$('playerMeterText').textContent=Math.floor(player.meter)+'%';$('cpuMeterText').textContent=Math.floor(cpu.meter)+'%';$('clock').textContent=Math.ceil(timeLeft);$('playerMeter').style.background=player.transformed>0?'#ffe75b':selected==='shadow'?'#ff7390':'#ffe57a'}
  function updateFighter(f,other,dt){
    f.attack=Math.max(0,f.attack-dt);f.boostCooldown=Math.max(0,f.boostCooldown-dt);f.stun=Math.max(0,f.stun-dt);f.flash=Math.max(0,f.flash-dt);f.transformed=Math.max(0,f.transformed-dt);f.face=other.x>=f.x?1:-1;
    const speed=(f.kind==='sonic'?290:245)*(f.transformed>0?1.22:1);let move=0;
    if(f===player){if(keys.a||keys.arrowleft||touchHeld.left)move-=1;if(keys.d||keys.arrowright||touchHeld.right)move+=1;f.block=!!(keys.shift||keys['/']);if(f.stun<=0&&f.attackKind!=='boost')f.vx=move*speed;if(move)f.walk+=dt*13;}
    else if(f.stun<=0&&f.attackKind!=='boost'){const d=other.x-f.x,ad=Math.abs(d);f.block=ad<105&&other.attack>0&&ambient%2>.9;if(ad>94){f.vx=Math.sign(d)*speed*.76;f.walk+=dt*10}else{f.vx*=Math.pow(.06,dt);if(Math.random()<dt*.92&&f.attack<=0)doAttack(f,Math.random()<.28?'boost':'spin')}if(ad>170&&f.y>=FLOOR-1&&Math.random()<dt*.17)f.vy=-525;}
    if(f.stun>0)f.vx*=Math.pow(.12,dt);if(f.attack>0&&!f.attackHit)hit(f,other,f.attackKind);
    f.x+=f.vx*dt;f.x=Math.max(42,Math.min(W-42,f.x));if(f.y<FLOOR||f.vy<0){f.vy+=1450*dt;f.y+=f.vy*dt;if(f.y>=FLOOR){f.y=FLOOR;f.vy=0}}
    if(f.attackKind!=='boost'||f.attack<=0)f.vx*=Math.pow(.035,dt);
  }
  function update(dt){ambient+=dt;updateEffects(dt);if(!running||paused)return;if(roundDelay>0){roundDelay-=dt;if(roundDelay<=0)$('statusText').textContent='FIGHT! LAND HITS TO CHARGE YOUR CHAOS METER';return}timeLeft=Math.max(0,timeLeft-dt);player.meter=Math.min(100,player.meter+dt*.75);cpu.meter=Math.min(100,cpu.meter+dt*.7);if(cpu.meter>=100&&cpu.transformed<=0&&Math.random()<dt*.7)transform(cpu);updateFighter(player,cpu,dt);if(running)updateFighter(cpu,player,dt);syncHud();if(timeLeft<=0){if(player.health===cpu.health)finish('DRAW');else finish(player.health>cpu.health?selected.toUpperCase():cpu.kind.toUpperCase())}}
  function render(){
    ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);bg();
    if(running||ended){drawFighter(player);drawFighter(cpu)}else{
      const a=fighter(selected,320,false),b=fighter(selected==='sonic'?'shadow':'sonic',640,true);a.face=1;b.face=-1;a.walk=ambient*1.1;b.walk=ambient*1.1;drawFighter(a);drawFighter(b);
      // soft pixel rings floating around the title-card arena
      for(let i=0;i<4;i++){const x=112+i*202+Math.sin(ambient*1.3+i)*8,y=302+Math.sin(ambient*2+i*1.8)*14;ctx.strokeStyle=i%2?'#ffcd68':'#66eaff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,7,10,-.3,0,Math.PI*2);ctx.stroke()}
    }
    drawEffects();ctx.restore();
  }
  function frame(now){const dt=Math.min(.034,(now-lastTime)/1000||0);lastTime=now;update(dt);render();requestAnimationFrame(frame)}
  requestAnimationFrame(frame);
})();
