import * as THREE from 'three';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { clone } from './assets/vendor/SkeletonUtils.js';
import { height, terrainColor, regionAt, seeded } from './terrain.js';
import { REGIONS, WORLD_SIZE } from './data.js';

export class World {
  constructor(scene){this.scene=scene;this.models={};this.colliders=[];this.beacons=[];this.chests=[];this.enemies=[];this.turbines=[];this.bobbing=[];this.clouds=[];}
  async load(progress){
    const names=['mage','rogue','knight','barbarian','robot','tree_oak','tree_pineRoundA','tree_palmDetailedTall','rock_largeA','stone_largeA','rock_tallA','plant_bush','flower_purpleC','bridge_wood','canoe','tent_detailedOpen','campfire_stones','lily_large'];
    const loader=new GLTFLoader();let completed=0;
    await Promise.all(names.map(async name=>{this.models[name]=await loader.loadAsync('./assets/models/'+name+'.glb');progress(++completed/names.length,name);}));
    this.buildTerrain();this.buildSky();this.buildCampus();this.buildNature();this.buildSites();this.buildCollectibles();
  }
  mat(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:.82,...options});}
  mesh(geometry,material,x=0,y=0,z=0,parent=this.scene){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(w,h,d,color,x,y,z,parent){return this.mesh(new THREE.BoxGeometry(w,h,d),this.mat(color),x,y,z,parent);}
  cylinder(r,h,color,x,y,z,parent){return this.mesh(new THREE.CylinderGeometry(r,r,h,16),this.mat(color),x,y,z,parent);}
  buildTerrain(){
    const geo=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,184,184);geo.rotateX(-Math.PI/2);
    const p=geo.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,height(x,z));const c=new THREE.Color().setRGB(...terrainColor(x,z),THREE.SRGBColorSpace);colors.push(c.r,c.g,c.b);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    this.terrain=this.mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));this.terrain.castShadow=false;
    const waterGeo=new THREE.PlaneGeometry(185,185,32,32);waterGeo.rotateX(-Math.PI/2);
    this.water=new THREE.Mesh(waterGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'uniform float time; varying vec3 vPos; void main(){vec3 p=position; p.y+=sin(p.x*.24+time)*.08+cos(p.z*.3+time*.8)*.08;vPos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'uniform float time;varying vec3 vPos;void main(){float r=sin(vPos.x*.18+vPos.z*.22+time)*.5+.5;float line=smoothstep(.92,1.,r);gl_FragColor=vec4(mix(vec3(.22,.61,.67),vec3(.61,.87,.86),line*.55),.79);}'}));
    this.water.position.set(140,.45,115);this.scene.add(this.water);
  }
  buildSky(){
    const sky=new THREE.Mesh(new THREE.SphereGeometry(1700,32,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#86b5dc')},bottom:{value:new THREE.Color('#c2d5d8')}},vertexShader:'varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vWorld;void main(){float h=normalize(vWorld).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.08,.75,h)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));this.scene.add(sky);
    const r=seeded(223);for(let i=0;i<15;i++){const g=new THREE.Group();for(let j=0;j<4;j++){const c=this.mesh(new THREE.SphereGeometry(7+j*2,8,5),new THREE.MeshBasicMaterial({color:'#f1f0e4',transparent:true,opacity:.55,depthWrite:false}),j*11,0,0,g);c.scale.y=.28;}g.position.set((r()-.5)*800,85+r()*65,(r()-.5)*800);this.scene.add(g);this.clouds.push(g);}
    const sun=this.mesh(new THREE.SphereGeometry(17,20,12),new THREE.MeshBasicMaterial({color:'#fff2c5'}),-260,210,-430);sun.castShadow=false;
  }
  addModel(name,x,z,size=1,yaw=0){const source=this.models[name].scene;const root=source.clone(true);const b=new THREE.Box3().setFromObject(root),v=b.getSize(new THREE.Vector3());const s=size/Math.max(v.y,.1);root.scale.multiplyScalar(s);root.position.set(x,height(x,z)-b.min.y*s,z);root.rotation.y=yaw;root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});this.scene.add(root);return root;}
  instances(name,placements,targetHeight){
    const model=this.models[name].scene;model.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),base=targetHeight/Math.max(size.y,.1);const matrix=new THREE.Matrix4(),rot=new THREE.Quaternion(),scale=new THREE.Vector3(),p=new THREE.Vector3();
    model.traverse(n=>{if(!n.isMesh)return;const inst=new THREE.InstancedMesh(n.geometry,n.material,placements.length);inst.castShadow=true;inst.receiveShadow=true;
      placements.forEach((v,i)=>{const s=base*v.s;scale.setScalar(s);rot.setFromAxisAngle(new THREE.Vector3(0,1,0),v.yaw);p.set(v.x,height(v.x,v.z)-b.min.y*s,v.z);matrix.compose(p,rot,scale);matrix.multiply(n.matrixWorld);inst.setMatrixAt(i,matrix);});inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();this.scene.add(inst);});
  }
  buildNature(){
    const rand=seeded(1913),trees=[],pines=[],palms=[],rocks=[],stones=[],bushes=[],flowers=[];
    for(let i=0;i<730;i++){const x=(rand()-.5)*480,z=(rand()-.5)*480;if(Math.hypot(x,z)<76||REGIONS.some(r=>Math.hypot(x-r.x,z-r.z)<16))continue;const h=height(x,z);if(h<.6)continue;
      const region=regionAt(x,z).id,p={x,z,s:.65+rand()*.8,yaw:rand()*Math.PI*2};
      if(region==='forest'){trees.push(p);if(trees.length<100)this.colliders.push({x,z,r:.6});}
      else if(region==='mountain'){if(h<42)pines.push(p);else stones.push(p);}
      else if(region==='wetland'){if(rand()<.45)palms.push(p);else bushes.push(p);}
      else{if(rand()<.15)trees.push(p);else if(rand()<.65)flowers.push(p);else rocks.push(p);}
    }
    for(const [name,list,s] of [['tree_oak',trees,9],['tree_pineRoundA',pines,8],['tree_palmDetailedTall',palms,8],['rock_largeA',rocks,3.5],['stone_largeA',stones,3.5],['plant_bush',bushes,1.6],['flower_purpleC',flowers,.6]])if(list.length)this.instances(name,list,s);
    const plazaTrees=[[-37,26],[37,26],[-38,-6],[38,-6],[-41,-40],[41,-40]];this.instances('tree_oak',plazaTrees.map(([x,z])=>({x,z,s:1,yaw:x})),9);
    this.addModel('tent_detailedOpen',-95,-115,2.8);this.addModel('campfire_stones',-91,-110,.7);this.addModel('canoe',155,95,1.1).position.y=.4;
    const lilies=Array.from({length:16},()=>({x:120+rand()*60,z:100+rand()*65,s:.7+rand(),yaw:rand()*6}));
    for(const p of lilies){const m=this.addModel('lily_large',p.x,p.z,.35);m.position.y=.5;}
  }
  roof(w,d,h,x,y,z){
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,h);shape.lineTo(w/2,0);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});return this.mesh(geo,this.mat('#b46664'),x,y,z-d/2);
  }
  buildCampus(){
    this.box(70,.3,62,'#d5d0be',0,1.96,-5);
    this.box(39,7.4,14,'#ede8d9',0,5.7,-31);this.roof(43,18,4,0,9.4,-31);
    this.box(42,.8,18,'#c6b6a2',0,2.3,-31);
    for(let x=-17;x<=17;x+=4.25){this.box(1,7,1,'#faf2e6',x,5.8,-22);this.box(2.3,2.4,.2,'#59777f',x,6.4,-23.85);this.box(2.4,.18,.4,'#b77b75',x,5.1,-23.5);}
    this.box(44,.4,3,'#e6ddcd',0,2.1,-20);this.box(46,.25,3,'#d7cdbd',0,2,-18);
    this.colliders.push({x:0,z:-30,w:40,d:15});
    for(const x of [-30,30]){this.box(10,5,19,'#d7d7c7',x,4.5,-23);this.roof(13,22,2.4,x,7,-23);this.colliders.push({x,z:-23,w:11,d:20});}
    const g=new THREE.Group();g.position.set(0,4.6,-3);const gold=this.mat('#ce8495',{metalness:.32,roughness:.4});
    this.mesh(new THREE.TorusGeometry(2.5,.45,8,36),gold,0,0,0,g);
    for(let i=0;i<12;i++){const a=i*Math.PI/6,m=this.mesh(new THREE.BoxGeometry(.9,1,.65),gold,Math.sin(a)*2.9,Math.cos(a)*2.9,0,g);m.rotation.z=-a;}
    this.scene.add(g);this.gear=g;this.cylinder(3.7,.65,'#bba9a1',0,2.3,-3);this.colliders.push({x:0,z:-3,r:3.5});
    this.label('อินทาเนีย',0,11,-21,4.5,'#5d5261');
    for(let x of [-23,23]){this.cylinder(.12,9,'#c6bfb1',x,6.5,3);this.box(2,3,.04,'#d6839c',x+1,9,3);this.cylinder(1.7,.25,'#e4dcce',x,2.1,3);}
    this.box(3,.1,24,'#c3bca3',0,2.04,26);
    // A 3D walkway connects the wetland island to the dry western rim.
    const start=new THREE.Vector3(75,1.6,80),end=new THREE.Vector3(135,1.6,115),mid=start.clone().add(end).multiplyScalar(.5),length=start.distanceTo(end),bridge=new THREE.Group();bridge.position.copy(mid);bridge.rotation.y=-Math.atan2(end.z-start.z,end.x-start.x);
    this.box(length,.3,3.6,'#b7a086',0,0,0,bridge);
    for(const side of [-1,1]){this.box(length,.12,.14,'#dac1a0',0,1.25,side*1.8,bridge);for(let x=-length/2;x<=length/2;x+=5)this.box(.16,1.4,.16,'#d9be9e',x,.7,side*1.8,bridge);}
    this.scene.add(bridge);this.bridge={start,end,width:2.2,y:1.8};
  }
  groundAt(x,z){const b=this.bridge;if(b){const dx=b.end.x-b.start.x,dz=b.end.z-b.start.z,t=((x-b.start.x)*dx+(z-b.start.z)*dz)/(dx*dx+dz*dz);if(t>=0&&t<=1&&Math.hypot(x-b.start.x-dx*t,z-b.start.z-dz*t)<b.width)return Math.max(height(x,z),b.y);}if(Math.abs(x)<=35&&Math.abs(z+5)<=31)return Math.max(height(x,z),2.11);if(Math.hypot(x-140,z+145)<15)return height(140,-145)+.2;return height(x,z);}
  buildSites(){
    for(const r of REGIONS){const g=new THREE.Group(),h=height(r.x,r.z);g.position.set(r.x,h,r.z);this.cylinder(2.2,.25,'#d5cebf',0,.1,0,g);this.cylinder(.6,2.8,'#616979',0,1.5,0,g);
      const orb=this.mesh(new THREE.OctahedronGeometry(.9),new THREE.MeshStandardMaterial({color:r.color,emissive:r.color,emissiveIntensity:.3,roughness:.2,metalness:.4}),0,3.7,0,g);const ring=this.mesh(new THREE.TorusGeometry(1.1,.08,6,24),this.mat('#e4d6b3',{metalness:.5}),0,3.7,0,g);ring.rotation.x=Math.PI/2;
      const beam=this.mesh(new THREE.CylinderGeometry(.13,.35,25,8),new THREE.MeshBasicMaterial({color:r.color,transparent:true,opacity:.25,depthWrite:false}),0,15,0,g);beam.castShadow=false;this.scene.add(g);this.beacons.push({id:r.id,type:'beacon',x:r.x,z:r.z,root:g,orb,beam,name:'สถานี '+r.name});this.bobbing.push(orb);
    }
    for(const [x,z] of [[-150,140],[-175,105],[-115,155]]){const h=height(x,z);this.cylinder(.35,15,'#e9dfc6',x,h+7.5,z);const hub=new THREE.Group();hub.position.set(x,h+16,z);this.scene.add(hub);for(let i=0;i<3;i++){const blade=this.box(.6,7,.18,'#f3ecd6',0,3.3,0);blade.removeFromParent();const pivot=new THREE.Group();pivot.rotation.z=i*Math.PI*2/3;pivot.add(blade);hub.add(pivot);}this.turbines.push(hub);}
    const r=REGIONS[4];this.cylinder(15,.3,'#697b85',r.x,height(r.x,r.z)+.05,r.z);this.label('แกนกลจักร',r.x,height(r.x,r.z)+13,r.z,5,'#ecdee3');
    const npc=this.createActor('knight',2.4);npc.root.position.set(8,this.groundAt(8,15),15);npc.root.rotation.y=Math.PI;this.scene.add(npc.root);npc.play('Idle');this.npc={...npc,id:'pim',type:'npc',name:'พี่พิม · ผู้ประสานงาน',x:8,z:15};this.label('พี่พิม',8,height(8,15)+3.1,15,2.2,'#f7ecd6');
  }
  buildCollectibles(){
    const spots=[[15,34],[-31,43],[-95,-69],[-153,-123],[-183,-67],[-105,-152],[76,71],[179,83],[100,166],[175,155],[-111,85],[-172,177],[-216,131],[83,-106],[180,-182],[120,-222],[210,-78],[25,104],[-55,-181],[206,200]];
    spots.forEach(([x,z],i)=>{const g=new THREE.Group();g.position.set(x,Math.max(this.groundAt(x,z),.6),z);this.box(1.6,.9,1,'#9d7857',0,.5,0,g);this.box(1.75,.25,1.1,'#dab378',0,1,0,g);this.box(.2,1,.07,'#f3df9e',0,.6,.54,g);this.scene.add(g);const glow=this.mesh(new THREE.OctahedronGeometry(.25),new THREE.MeshBasicMaterial({color:'#f6d887'}),0,1.7,0,g);this.bobbing.push(glow);this.chests.push({id:'chest-'+i,type:'chest',name:'หีบสำรวจ',x,z,root:g});});
    const enemySpots=[[-81,-57],[-125,-71],[-158,-90],[-190,-137],[83,100],[175,122],[114,166],[-90,91],[-147,110],[-193,155],[90,-96],[177,-122],[187,-193],[215,-83],[35,96],[-53,-138]];
    enemySpots.forEach(([x,z],i)=>{const a=this.createActor('robot',1.9);a.root.position.set(x,Math.max(height(x,z),.5),z);this.scene.add(a.root);a.play('Idle');this.enemies.push({...a,id:'enemy-'+i,x,z,homeX:x,homeZ:z,hp:100,maxHP:100,type:'enemy',cooldown:1,windup:0,element:null,elementTime:0,dead:false,boss:false});});
    const r=REGIONS[4],a=this.createActor('robot',7.5);a.root.position.set(r.x,this.groundAt(r.x,r.z),r.z);this.scene.add(a.root);a.play('Idle');this.boss={...a,id:'boss',type:'enemy',name:'ATLAS · แกนกลจักร',x:r.x,z:r.z,homeX:r.x,homeZ:r.z,hp:1500,maxHP:1500,cooldown:3,windup:0,element:null,elementTime:0,dead:false,boss:true};this.enemies.push(this.boss);
  }
  createActor(name,targetHeight,color){
    const gltf=this.models[name],model=clone(gltf.scene);
    const mixer=new THREE.AnimationMixer(model),actions={};for(const clip of gltf.animations)actions[clip.name]=mixer.clipAction(clip);
    // A cloned skin has no current bone matrices until its pose is updated.
    // Fit the posed mesh, and keep the fit outside nodes animated by the GLB.
    if(actions.Idle)actions.Idle.play();mixer.update(0);model.updateMatrixWorld(true);
    model.traverse(n=>{if(n.isSkinnedMesh){n.skeleton.update();n.computeBoundingBox();n.computeBoundingSphere();n.frustumCulled=false;}});
    const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),s=targetHeight/Math.max(size.y,.1),fit=new THREE.Group(),root=new THREE.Group();fit.scale.setScalar(s);fit.position.y=-b.min.y*s;fit.add(model);root.add(fit);
    model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;if(color){n.material=n.material.clone();n.material.color.lerp(new THREE.Color(color),.25);}}});
    let current='';return {root,model,mixer,actions,play(name,once=false){const action=actions[name]||actions.Idle||Object.values(actions)[0];if(!action)return;if(current===action._clip.name&&!once)return;for(const a of Object.values(actions))if(a!==action)a.fadeOut(.15);action.reset().fadeIn(.15).setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;action.play();current=action._clip.name;}};
  }
  label(text,x,y,z,width,color){const c=document.createElement('canvas');c.width=640;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='600 60px "Noto Sans Thai", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,320,80);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:true}));sp.position.set(x,y,z);sp.scale.set(width,width/4,1);this.scene.add(sp);return sp;}
  restore(state){for(const c of this.chests)c.root.visible=!state.chests.includes(c.id);for(const e of this.enemies){if(e.boss)e.dead=state.bossDefeated;else e.dead=state.kills.includes(e.id);e.root.visible=!e.dead;}for(const b of this.beacons){const on=state.beacons.includes(b.id);b.beam.visible=!on;b.orb.material.emissiveIntensity=on?.8:.2;}}
  blocked(x,z,r=.45){for(const c of this.colliders){if(c.r&&Math.hypot(x-c.x,z-c.z)<c.r+r)return true;if(c.w&&Math.abs(x-c.x)<c.w/2+r&&Math.abs(z-c.z)<c.d/2+r)return true;}return false;}
  update(dt,time){this.water.material.uniforms.time.value=time;for(const h of this.turbines)h.rotation.z+=dt*.65;for(const c of this.clouds){c.position.x+=dt*1.3;if(c.position.x>500)c.position.x=-500;}for(const m of this.bobbing)m.rotation.y+=dt*.5;this.npc.mixer.update(dt);}
}
