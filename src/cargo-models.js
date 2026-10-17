// Procedural teaching assets. Contents are invented, never inferred from Terminal49.
function cargoModelProfile(number){
 const n=Number(String(number).split('-').pop())||[...String(number)].reduce((a,c)=>a+c.charCodeAt(0),0);
 return [{key:'cartons',title:'Palletized consumer goods',packageName:'Carton pallet',contents:'Boxed household supplies',count:6,units:'6 pallets · 36 cartons',weight:'2,400 kg',color:0xc59663}, {key:'drums',title:'Sealed industrial drums',packageName:'Drum pallet',contents:'Non-hazardous food-grade oil (mock)',count:6,units:'6 pallets · 12 drums',weight:'2,640 kg',color:0x356e9d}, {key:'machinery',title:'Crated machinery',packageName:'Machine crate',contents:'Industrial pump assemblies',count:4,units:'4 crates · 4 pump assemblies',weight:'3,200 kg',color:0x749390}][(n-1+3)%3];
}
function buildCargoInspection(THREE,number){
 const profile=cargoModelProfile(number),group=new THREE.Group(),packages=[],doors=[],resources=[];
 const mat=(color,more={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.05,...more});resources.push(m);return m;};
 const steel=mat(0x235b83),inner=mat(0xcbd4d6),wood=mat(0xab8152),dark=mat(0x303e46),silver=mat(0xbfcbd3,{metalness:.65,roughness:.3}),tape=mat(0xe5c88c),boxMat=mat(profile.color);
 const mesh=(geometry,material,x,y,z,parent=group)=>{resources.push(geometry);const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(w,h,d,m,x,y,z,parent=group)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
 const cylinder=(radius,height,m,x,y,z,parent=group)=>mesh(new THREE.CylinderGeometry(radius,radius,height,24),m,x,y,z,parent);
 function label(text,w,h,x,y,z,parent=group,color='#f4f0df'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.fillStyle='#163044';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,61);ctx.font='19px sans-serif';ctx.fillText('PORTTABLE / MOCK CARGO',256,100);
  const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;resources.push(texture);const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});resources.push(material);return mesh(new THREE.PlaneGeometry(w,h),material,x,y,z,parent);
 }
 // Same footprint as a yard stack; the camera resolves the added geometry.
 box(1.9,.07,2.5,steel,0,.035,0);box(1.78,.025,2.38,wood,0,.084,0);
 const roof=new THREE.Group();group.add(roof);box(1.9,.045,2.5,steel,0,1.02,0,roof);
 box(1.9,1,.04,inner,0,.52,-1.23);
 for(const x of [-.93,.93]){box(.035,1,2.5,steel,x,.52,0);box(.015,.91,2.37,inner,x-Math.sign(x)*.025,.52,0);for(let z=-1.15;z<1.25;z+=.14)box(.028,.91,.032,steel,x+Math.sign(x)*.018,.52,z);}
 for(const x of [-.89,.89])for(const z of [-1.2,1.2])box(.065,1.05,.065,silver,x,.525,z);
 for(const side of [-1,1]){
  const hinge=new THREE.Group();hinge.position.set(side*.92,.52,1.25);group.add(hinge);doors.push(hinge);
  box(.91,.98,.045,steel,-side*.455,0,0,hinge);
  for(const x of [-side*.18,-side*.71]){box(.022,.87,.026,silver,x,0,.04,hinge);for(const y of [-.32,.32])box(.08,.025,.065,silver,x,y,.05,hinge);}
  label(side<0?number:'DEMO / INSPECT',.7,.18,-side*.455,.2,.032,hinge);
 }
 const seal=box(.08,.09,.035,mat(0xe29b32),-.19,.42,1.31,doors[1]);seal.position.set(-.7,-.2,.08);seal.userData.inspection={kind:'seal'};
 const sealTag=label('SEAL CHECK',.29,.075,-.66,-.3,.07,doors[1],'#ffdfa2');sealTag.userData.inspection={kind:'seal'};
 for(let i=0;i<profile.count;i++){
  const g=new THREE.Group();const row=Math.floor(i/2),x=(i%2?1:-1)*.43,z=-.8+row*.76;g.position.set(x,.1,z);group.add(g);
  const record={id:'P'+String(i+1).padStart(2,'0'),title:profile.packageName+' '+(i+1),contents:profile.contents,quantity:profile.key==='cartons'?'6 cartons':profile.key==='drums'?'2 sealed drums':'1 pump assembly',g};packages.push(record);
  for(const dx of [-.24,0,.24])box(.11,.06,.62,wood,dx,.03,0,g);
  for(let k=0;k<5;k++)box(.62,.025,.09,wood,0,.075,-.26+k*.13,g);
  if(profile.key==='cartons'){
   for(let y=0;y<2;y++)for(let j=0;j<3;j++){const bx=(j-1)*.2;box(.19,.23,.49,boxMat,bx,.21+y*.235,0,g);box(.026,.233,.493,tape,bx,.21+y*.235,0,g);box(.194,.018,.49,tape,bx,.21+y*.235,0,g);}
  }else if(profile.key==='drums'){
   for(const x of [-.16,.16]){cylinder(.145,.49,boxMat,x,.35,0,g);for(const y of [.14,.31,.56])cylinder(.15,.018,silver,x,y,0,g);cylinder(.025,.012,dark,x+.05,.603,.04,g);label('OIL',.16,.07,x,.4,.148,g);}
  }else{
   box(.58,.46,.52,dark,0,.32,0,g);cylinder(.15,.33,mat(0x6f9391,{metalness:.4}),0,.42,0,g);box(.46,.1,.35,silver,0,.16,0,g);
   for(const x of [-.3,.3])for(const z of [-.28,.28])box(.045,.66,.045,wood,x,.41,z,g);
   box(.65,.045,.61,wood,0,.15,0,g);for(const z of [-.28,.28])box(.65,.045,.055,wood,0,.7,z,g);for(const x of [-.3,.3])box(.055,.045,.61,wood,x,.7,0,g);
   for(const x of [-.31,.31])box(.025,.67,.04,silver,x,.41,.03,g);
  }
  label(record.id,.24,.075,0,.25,.31,g);
  g.traverse(o=>{if(o.isMesh)o.userData.inspection={kind:'package',index:i};});
 }
 const light=new THREE.PointLight(0xfff3d6,.8,7);light.position.set(0,1.8,.5);group.add(light);
 return {group,profile,packages,doors,roof,seal,dispose(){for(const r of new Set(resources))r.dispose();}};
}
