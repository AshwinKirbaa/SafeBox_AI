import React,{useEffect,useRef} from 'react';
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';

/** Original API-compatible interpretation. No third-party component source included. */
export default function AeroShards({shardColor='#896ABD',accentColor='#A855F7',placement='full',material='glass',markers='plus',count=1300,depthOfField=.75,vignette=.3,mouseInteraction=true,pulseOnClick=true,holdToGather=true,paused=false}){
 const host=useRef(),pause=useRef(paused);
 useEffect(()=>{pause.current=paused},[paused]);
 useEffect(()=>{
  const el=host.current;const pointer={x:0,y:0,held:false,pulse:0};let renderer,raf,clock=0,last=0,visible=true;
  const move=e=>{if(mouseInteraction){pointer.x=e.clientX/innerWidth*2-1;pointer.y=1-e.clientY/innerHeight*2}};
  const down=e=>{if(e.target.closest('button,a,input,select,textarea'))return;if(holdToGather)pointer.held=true;if(pulseOnClick)pointer.pulse=1};
  const up=()=>{pointer.held=false};
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('blur',up);
  const particles=Array.from({length:Math.min(Math.max(count,0),3000)},(_,i)=>({x:Math.sin(i*127.1)*21,y:Math.cos(i*311.7)*14,z:Math.sin(i*74.7)*15,scale:.025+(Math.sin(i*13.7)+1)*.045,phase:i*1.618}));
  let render,resize,dispose;
  try{
   renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x030309,1);el.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,100);camera.position.z=27;
   scene.add(new THREE.HemisphereLight(0xbcb6dd,0x0c0b2b,2));
   const light=new THREE.DirectionalLight(accentColor,3);light.position.set(8,5,10);scene.add(light);
   const geometry=new THREE.TetrahedronGeometry(1);
   const mat=new THREE.MeshPhysicalMaterial({color:shardColor,metalness:.15,roughness:material==='glass'?.12:.65,clearcoat:1,transparent:true,opacity:material==='glass'?.48:1,depthWrite:false});
   const mesh=new THREE.InstancedMesh(geometry,mat,particles.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
   const dummy=new THREE.Object3D();const colors=[new THREE.Color(shardColor),new THREE.Color(accentColor)];
   particles.forEach((p,i)=>mesh.setColorAt(i,colors[i%9===0?1:0]));
   const markGeo=new THREE.BufferGeometry();const verts=[];
   if(markers==='plus')particles.filter((_,i)=>i%45===0).forEach(p=>verts.push(p.x-.12,p.y,p.z,p.x+.12,p.y,p.z,p.x,p.y-.12,p.z,p.x,p.y+.12,p.z));
   markGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));const markMat=new THREE.LineBasicMaterial({color:shardColor,transparent:true,opacity:.25});const marks=new THREE.LineSegments(markGeo,markMat);scene.add(marks);
   const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bokeh=new BokehPass(scene,camera,{focus:27,aperture:.000055*depthOfField,maxblur:.006*depthOfField});composer.addPass(bokeh);
   resize=()=>{const b=el.getBoundingClientRect();renderer.setSize(b.width,b.height);composer.setSize(b.width,b.height);camera.aspect=b.width/Math.max(b.height,1);camera.updateProjectionMatrix()};
   render=()=>{particles.forEach((p,i)=>{const gather=pointer.held?.7:0;const flow=clock*.1;const x=p.x+Math.sin(flow+p.phase)*.65,y=((p.y+clock*.11+14)%28)-14;
    dummy.position.set(x*(1-gather)+pointer.x*10*gather,y*(1-gather)+pointer.y*7*gather,p.z+Math.sin(flow+p.phase)*.5);
    const dist=Math.hypot(x-pointer.x*10,y-pointer.y*7)+.5;dummy.position.x+=(x-pointer.x*10)/dist*pointer.pulse*2;dummy.position.y+=(y-pointer.y*7)/dist*pointer.pulse*2;
    dummy.rotation.set(p.phase+clock*.07,p.phase+clock*.11,p.phase);dummy.scale.set(p.scale*.5,p.scale*3,p.scale*.3);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});
    mesh.instanceMatrix.needsUpdate=true;camera.position.x+=(pointer.x*.6-camera.position.x)*.03;camera.position.y+=(pointer.y*.4-camera.position.y)*.03;camera.lookAt(0,0,0);composer.render()};
   dispose=()=>{geometry.dispose();mat.dispose();markGeo.dispose();markMat.dispose();bokeh.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove()};
  }catch{
   renderer?.dispose();renderer?.domElement.remove();
   const canvas=document.createElement('canvas');el.appendChild(canvas);const ctx=canvas.getContext('2d');
   resize=()=>{canvas.width=el.clientWidth;canvas.height=el.clientHeight};
   render=()=>{const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);particles.forEach((p,i)=>{const z=27-p.z,scale=27/z;let x=w/2+(p.x+Math.sin(clock*.1+p.phase)*.6)*w/40*scale,y=h/2+(((p.y+clock*.11+14)%28)-14)*h/28*scale;if(pointer.held){x+=(w*(pointer.x+1)/2-x)*.7;y+=(h*(1-pointer.y)/2-y)*.7}const a=clock*.1+p.phase,size=p.scale*35*scale;ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=.14+Math.max(0,1-Math.abs(p.z)/15)*.24;ctx.strokeStyle=i%9?shardColor:accentColor;ctx.fillStyle=shardColor;ctx.beginPath();ctx.moveTo(0,-size*2);ctx.lineTo(size*.5,size);ctx.lineTo(-size*.5,size*.6);ctx.closePath();ctx.fill();ctx.stroke();if(markers==='plus'&&i%45===0){ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.moveTo(0,-3);ctx.lineTo(0,3);ctx.stroke()}ctx.restore()})};
   dispose=()=>canvas.remove();
  }
  const ro=new ResizeObserver(resize);ro.observe(el);resize();const io=new IntersectionObserver(([e])=>visible=e.isIntersecting);io.observe(el);
  function loop(now){raf=requestAnimationFrame(loop);if(now-last<33)return;const dt=Math.min((now-last)/1000,.05);last=now;if(!visible||document.hidden)return;if(!pause.current){clock+=dt;pointer.pulse*=.94;render()}}
  render();raf=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(raf);ro.disconnect();io.disconnect();dispose();window.removeEventListener('pointermove',move);window.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('blur',up)}
 },[shardColor,accentColor,placement,material,markers,count,depthOfField,mouseInteraction,pulseOnClick,holdToGather]);
 return <div className="aero-shards" ref={host} aria-hidden="true"><div className="aero-vignette" style={{boxShadow:`inset 0 0 20vw 8vw rgba(3,3,9,${vignette})`}}/></div>
}
