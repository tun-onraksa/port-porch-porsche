// Detailed teaching diorama in the existing renderer. Original scene objects are restored on exit.
function buildC184Scene({THREE,scene,camera,controls,host,reduced}){
 const group=new THREE.Group();group.visible=false;scene.add(group);
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.72});
 const labels=[];
 const white=mat(0xf4f6f8),steel=mat(0x7d91a8),blue=mat(0x376ac2),dark=mat(0x25364b),amber=mat(0xd59632),green=mat(0x4b9078);
 const geom=new THREE.BoxGeometry(1,1,1);
 function box(w,h,d,m,x,y,z,parent=group){const o=new THREE.Mesh(geom,m);o.scale.set(w,h,d);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function text(s,w,x,y,z,parent=group,color='#324960'){
  const c=document.createElement('canvas');c.height=80;let ctx=c.getContext('2d');ctx.font='600 40px system-ui';c.width=Math.ceil(ctx.measureText(s).width)+48;ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,80);ctx.fillStyle=color;ctx.font='600 40px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,c.width/2,40);
  const texture=new THREE.CanvasTexture(c);texture.encoding=THREE.sRGBEncoding;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(w,w/8,1);sprite.position.set(x,y,z);parent.add(sprite);sprite.userData.labelAspect=c.width/80;sprite.userData.labelHeight=s==='C184'?26:20;labels.push(sprite);return sprite;
 }
 function container(x,z,color,parent=group){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);box(5.8,2.3,2.5,mat(color),0,2,0,g);for(let n=-2.6;n<=2.6;n+=.4)box(.07,2.15,2.55,steel,n,2,0,g);return g;}
 function truck(parent=group){const g=new THREE.Group();parent.add(g);box(6.8,.3,2.7,dark,0,.65,0,g);box(1.7,1.8,2.5,white,4,1.4,0,g);box(.07,.65,2.15,mat(0x8daecb),4.87,1.85,0,g);for(const x of [-2.1,1.8,4.1])for(const z of [-1.4,1.4]){const o=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.28,12),dark);o.rotation.x=Math.PI/2;o.position.set(x,.5,z);g.add(o);}return g;}
 function lane(x,z,length,color){box(length,.06,4.5,mat(color),x,.1,z);for(const side of [-1,1])box(length,.08,.13,white,x,.16,z+side*2.2);}
 box(160,.5,100,mat(0xdfe9ed),0,-.4,5);box(38,.12,100,mat(0x9bc6d7),-42,-.08,5);box(.3,.3,90,white,-23,.12,0);
 lane(9,0,64,0xc5d1db);lane(8,12,55,0xd1d9de);lane(8,23,55,0xd3e6e2);
 // Connecting inspection routes and gate approach.
 box(5,.05,26,mat(0xd1d9de),-12,.11,12);box(5,.05,26,mat(0xd1d9de),31,.11,12);
 for(let x=-16;x<40;x+=5)box(1.8,.08,.12,white,x,.17,0);
 text('INTAKE',5,-8,5.7,0);text('STANDARD INSPECTION',11,12,6,12);text('REFRIGERATED PRIORITY',12,12,6,23);
 // Intake camera arch and actual gate.
 for(const x of [-8,37]){for(const z of [-2.7,2.7])box(.3,4.7,.3,steel,x,2.35,z);box(.4,.4,6,blue,x,4.7,0);}
 text('TRUCK GATE',6,37,6.2,0);
 // Inspection bays: separate from the continuous main flow.
 for(const [z,m] of [[12,amber],[23,green]]){box(11,.16,5,m,17,.18,z);for(const x of [11.6,22.4])for(const dz of [-2.6,2.6])box(.18,4,.18,steel,x,2,z+dz);box(11,.22,.5,m,17,4,z-2.6);box(11,.22,.5,m,17,4,z+2.6);}
 box(1,2,1.2,blue,16,1,26.8);text('POWER',3,16,3,27);
 const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(16,1,26.8),new THREE.Vector3(14,.4,26),new THREE.Vector3(13.9,1.6,24.3)]),20,.055,6,false),dark);group.add(cable);cable.visible=false;
 // Vessel and working quay crane.
 const ship=new THREE.Group();group.add(ship);box(13,2,25,blue,-32,1,0,ship);box(13.2,.25,25.2,white,-32,2.1,0,ship);box(7,4,3,white,-32,4,-10,ship);box(7.1,.8,2.5,steel,-32,5,-10,ship);
 for(const x of [-34,-28])for(const z of [-6,0,6])if(!(x===-28&&z===0))container(x,z,0xa9b7c8,ship);
 for(const x of [-23,-18])for(const z of [-4,4])box(.5,12,.5,white,x,6,z);
 box(21,.6,1,blue,-27,12.3,0);const hook=new THREE.Group();group.add(hook);box(6.4,.22,2.8,amber,0,0,0,hook);
 const ropes=[-2.4,2.4].map(x=>box(.045,1,.045,dark,x,0,0));
 // Hero reefer: openable roof and doors, twenty individual pallet stacks.
 const hero=new THREE.Group();group.add(hero);box(6,.15,2.6,white,0,.08,0,hero);box(5.8,.04,2.4,mat(0xb2a38b),0,.19,0,hero);
 const shell=new THREE.Group();hero.add(shell);box(6,2.5,.08,white,0,1.4,-1.3,shell);const frontWall=new THREE.Group();shell.add(frontWall);box(6,2.5,.08,white,0,1.4,1.3,frontWall);
 for(let x=-2.8;x<3;x+=.27){box(.055,2.35,.06,steel,x,1.4,-1.36,shell);box(.055,2.35,.06,steel,x,1.4,1.36,frontWall);}
 const roof=box(6,.1,2.6,white,0,2.68,0,hero);box(.16,2.6,2.6,white,-3,1.4,0,hero);box(.3,1.8,1.7,steel,-3.2,1.3,0,hero);
 for(let z=-.65;z<.8;z+=.25)box(.32,.06,1.4,dark,-3.22,1.1+z,0,hero);
 const doors=[-1,1].map(side=>{const h=new THREE.Group();h.position.set(3,.15,side*1.3);hero.add(h);box(.09,2.5,1.3,white,0,1.25,-side*.65,h);box(.13,2.15,.06,steel,.07,1.25,-side*.65,h);return h;});
 const pallets=[];for(let row=0;row<10;row++)for(let col=0;col<2;col++){const p=new THREE.Group();p.position.set(-2.65+row*.57,.23,-.62+col*1.24);hero.add(p);box(.52,.10,1.1,mat(0xb49a70),0,.05,0,p);for(let h=0;h<3;h++){box(.48,.30,1.02,mat(0xb8c59f),0,.27+h*.32,0,p);for(const z of [-.35,0,.35])box(.29,.08,.21,mat(0xc35d62),0,.44+h*.32,z,p);}pallets.push(p);}
 const inspector=new THREE.Group();group.add(inspector);box(.45,.65,.25,blue,0,1.05,0,inspector);for(const x of [-.13,.13])box(.15,.7,.17,dark,x,.4,0,inspector);const head=new THREE.Mesh(new THREE.SphereGeometry(.22,12,10),mat(0xc99674));head.position.y=1.65;inspector.add(head);box(.64,.1,.4,white,0,1.82,0,inspector);box(.34,.08,.34,dark,-.3,1.2,-.25,inspector);
 const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.12,2.75,2.75)),new THREE.LineBasicMaterial({color:0x3674d4,transparent:true,opacity:.75}));outline.position.y=1.4;hero.add(outline);
 const label=text('C184',3,0,4,0,hero,'#2059ae');
 const carrier=truck();
 const queue=[-5,3,11].map((x,i)=>{const g=truck();g.position.set(x,0,12);const c=container(0,0,[0xb6c1cc,0xbbaea0,0xb6c7c6][i],g);c.position.y=.05;return g;});
 const busy=truck();busy.position.set(17,0,23);container(0,0,0xc5d3d0,busy);
 const traffic=Array.from({length:3},(_,i)=>{const g=truck();container(0,0,[0xaebdcb,0xc6b9aa,0xa7bdb3][i],g);return g;});
 const target=new THREE.Vector3(),desired=new THREE.Vector3();let active=false,previous=[],oldCamera=null,lastTime=0,follow=true,model=null;
 const mix=(a,b,q)=>a+(b-a)*Math.max(0,Math.min(1,q));
 function position(m){const t=m.phaseTime,q=m.duration?t/m.duration:0;let x=-28,y=3.2,z=0;
  if(m.phase==='arriving'){z=mix(-16,0,q);ship.position.z=z;}
  else{ship.position.z=0;if(m.phase==='unloading'){x=mix(-28,-17,Math.max(0,(q-.3)/.4));y=q<.3?mix(3.2,8.5,q/.3):q<.7?8.5:mix(8.5,.87,(q-.7)/.3);}
   else if(m.phase==='intake'){x=mix(-17,-8,q);y=.87;}
   else if(m.phase==='flagged'){x=-8;y=.87;}
   else if(m.phase==='divert'){x=mix(-8,-12,Math.min(1,q*3));z=mix(0,12,Math.max(0,(q-.3)/.7));y=.87;}
   else if(m.phase==='choice'){x=-12;y=.87;z=12;}
   else if(m.phase==='queue'){y=.87;if(m.route==='priority'){z=mix(12,23,Math.min(1,t/2));x=mix(-12,17,Math.max(0,(t-7)/3));}else{z=12;x=t<15?mix(-12,-5,(t-12)/3):t<30?mix(-5,2,(t-27)/3):mix(2,17,(t-42)/3);}}
   else if(m.phase==='inspection'||m.phase==='cleared'){x=17;y=.87;z=m.route==='priority'?23:12;}
   else if(m.phase==='departing'){y=.87;z=m.route==='priority'?23:12;if(q<.18){x=17;}else if(q<.5){x=mix(17,31,(q-.18)/.32);}else if(q<.75){x=31;z=mix(z,0,(q-.5)/.25);}else{x=mix(31,46,(q-.75)/.25);z=0;}}
   else{x=46;y=.87;z=0;}
  }return {x,y,z};
 }
 function draw(t){if(!active||!model)return;const m=model,dt=Math.min(.1,(t-lastTime)/1000||.016);lastTime=t;const p=position(m);hero.position.set(p.x,p.y,p.z);hero.visible=m.phase!=='departed';carrier.visible=m.phase!=='arriving';carrier.position.set(m.phase==='unloading'?-17:p.x,0,p.z);
  const q=m.duration?m.phaseTime/m.duration:0;let angle=0;
  if(m.phase==='divert')angle=-Math.PI/2*Math.max(0,Math.min(1,(q-.2)/.3));
  if(m.phase==='choice')angle=-Math.PI/2;
  if(m.phase==='queue')angle=-Math.PI/2*(1-Math.max(0,Math.min(1,(m.phaseTime-(m.route==='priority'?2:0))/2)));
  if(m.phase==='departing')angle=q<.5?mix(0,Math.PI/2,(q-.45)/.05):q<.75?Math.PI/2:mix(Math.PI/2,0,(q-.75)/.05);
  hero.rotation.y=carrier.rotation.y=angle;

  hook.position.set(m.phase==='unloading'?p.x:-28,m.phase==='unloading'?p.y+2.9:11,0);hook.visible=['arriving','unloading'].includes(m.phase);ropes.forEach((r,i)=>{r.visible=hook.visible;r.scale.y=Math.max(.1,12-hook.position.y);r.position.set(hook.position.x+(i?2.4:-2.4),(12+hook.position.y)/2,0);});
  const cut=m.phase==='inspection'||m.phase==='cleared';const opening=cut?Math.min(1,m.phase==='cleared'?1:m.phaseTime/1.5):m.phase==='departing'?Math.max(0,1-m.phaseTime/.8):0;
  roof.visible=frontWall.visible=!cut;doors.forEach((d,i)=>d.rotation.y=(i?1:-1)*opening*1.85);
  outline.material.color.setHex(m.phase==='departing'||m.phase==='departed'?0x34896c:m.stage>=1?0xc48b24:0x3674d4);
  inspector.visible=cut;inspector.position.set(20,0,(m.route==='priority'?23:12)+3.2);
  cable.visible=m.route==='priority'&&(cut||(m.phase==='queue'&&m.phaseTime>=9.99));
  const waitStart=15;const since=Math.max(0,m.elapsed-waitStart);queue.forEach((g,i)=>{const start=(2-i)*15,leave=start+15;g.position.x=since>=leave?Math.min(55,17+(since-leave)*4):i===2?17:i===1?mix(3,17,(since-12)/3):since<15?mix(-5,3,(since-12)/3):mix(3,17,(since-27)/3);g.visible=g.position.x<53;});busy.position.x=since<7?17:17+(since-7)*5;busy.visible=since<14;
  traffic.forEach((g,i)=>{g.position.set(-17+(m.elapsed*2+i*19)%70,0,-7);});
  if(follow){let distance= cut?20: m.phase==='divert'||m.phase==='choice'||m.phase==='queue'?54:55;
   target.copy(hero.position).add(new THREE.Vector3(0,1.2,0));if(m.phase==='choice'){target.x+=9;target.z+=3;}if(m.phase==='departed'){target.set(7,1,8);distance=92;}
   if(reduced){target.set(4,1,8);distance=100;}
   const offset=new THREE.Vector3(0.35,.86,1).normalize().multiplyScalar(distance/Math.min(1,camera.aspect));desired.copy(target).add(offset);
   const k=reduced?1:1-Math.exp(-dt*3);camera.position.lerp(desired,k);controls.target.lerp(target,k);
  }
  controls.update();
  for(const label of labels){const distance=camera.position.distanceTo(label.getWorldPosition(new THREE.Vector3()));const height=label.userData.labelHeight*2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,host.clientHeight);label.scale.set(height*label.userData.labelAspect,height,1);}
 }
 const api={get active(){return active;},start(m){model=m;if(!active){previous=scene.children.filter(o=>o!==group&&!o.isLight).map(o=>[o,o.visible]);previous.forEach(([o])=>o.visible=false);oldCamera={pos:camera.position.clone(),target:controls.target.clone(),min:controls.minDistance};}active=true;group.visible=true;carrier.rotation.y=hero.rotation.y=0;controls.minDistance=8;follow=true;lastTime=performance.now();},stop(){active=false;group.visible=false;previous.forEach(([o,v])=>o.visible=v);if(oldCamera){camera.position.copy(oldCamera.pos);controls.target.copy(oldCamera.target);controls.minDistance=oldCamera.min;}controls.update();},draw,refocus(){follow=true;},get state(){return {position:hero.position.toArray(),pallets:pallets.length,doorsOpen:Math.abs(doors[0].rotation.y)>1,cutaway:!roof.visible,powerConnected:cable.visible,follow};}};
 host.addEventListener('pointerdown',()=>{if(active)follow=false;});return api;
}
