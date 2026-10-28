import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';

// A continuous folded landscape, not a floating centerpiece.
export default function Architecture({paused=false}){
 const host=useRef(),pause=useRef(paused),[webgl,setWebgl]=useState(false);
 useEffect(()=>{pause.current=paused},[paused]);
 useEffect(()=>{
  const el=host.current;let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'})}catch{return}
  setWebgl(true);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x050611,.027);
  const camera=new THREE.PerspectiveCamera(49,1,.1,130);camera.position.set(0,4,19);
  scene.add(new THREE.HemisphereLight(0x979de0,0x04040c,2));
  const moon=new THREE.DirectionalLight(0x6471b9,3);moon.position.set(-10,12,4);scene.add(moon);
  const violet=new THREE.DirectionalLight(0x0c0b4f,2);violet.position.set(12,4,-15);scene.add(violet);
  const geometry=new THREE.PlaneGeometry(100,110,140,150);geometry.rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;const original=new Float32Array(positions.array);
  const material=new THREE.MeshStandardMaterial({color:0x0c0b2b,roughness:.63,metalness:.4,side:THREE.DoubleSide});
  const landscape=new THREE.Mesh(geometry,material);landscape.position.set(0,-4,-24);scene.add(landscape);
  const threads=new THREE.Group();scene.add(threads);const lines=[];
  for(let j=0;j<26;j++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(150*3),3));const m=new THREE.LineBasicMaterial({color:j%3===0?0x37324f:0x252b48,transparent:true,opacity:.22});const line=new THREE.Line(g,m);line.position.copy(landscape.position);threads.add(line);lines.push(line)}
  function height(x,z,t){return Math.sin(x*.12+z*.055+t*.2)*2.1+Math.sin(x*.29-z*.06-t*.13)*.65+Math.cos(z*.105+t*.16)*1.6}
  function deform(t){for(let i=0;i<positions.count;i++){positions.setY(i,height(original[i*3],original[i*3+2],t))}positions.needsUpdate=true;geometry.computeVertexNormals();lines.forEach((line,j)=>{const a=line.geometry.attributes.position;for(let k=0;k<150;k++){const x=(j-12.5)*3.8,z=k/149*110-55;a.setXYZ(k,x,height(x,z,t)+.035,z)}a.needsUpdate=true})}
  let raf,last=0,time=0,visible=true,prev=scrollY,velocity=0;const pointer={x:0,y:0};
  const move=e=>{pointer.x=(e.clientX/innerWidth-.5)*2;pointer.y=(e.clientY/innerHeight-.5)*2};
  window.addEventListener('pointermove',move,{passive:true});
  const ro=new ResizeObserver(()=>{const b=el.getBoundingClientRect();renderer.setSize(b.width,b.height);camera.aspect=b.width/Math.max(b.height,1);camera.updateProjectionMatrix()});ro.observe(el);
  const io=new IntersectionObserver(([e])=>visible=e.isIntersecting);io.observe(el);deform(0);
  function draw(now){raf=requestAnimationFrame(draw);const dt=Math.min((now-last)/1000,.05);if(now-last<33)return;last=now;if(!visible||document.hidden)return;
   if(!pause.current){velocity+=(Math.min(Math.abs(scrollY-prev)*.008,1.5)-velocity)*.06;prev=scrollY;time+=dt*(1+velocity);deform(time);const progress=Math.min(scrollY/Math.max(document.documentElement.scrollHeight-innerHeight,1),1);camera.position.x+=(pointer.x*1.3-camera.position.x)*.025;camera.position.y+=(4+pointer.y*.4+progress*2-camera.position.y)*.025;camera.position.z+=(19-progress*4-camera.position.z)*.025}
   camera.lookAt(0,-1,-23);renderer.render(scene,camera)
  }raf=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(raf);ro.disconnect();io.disconnect();window.removeEventListener('pointermove',move);scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});renderer.dispose();renderer.domElement.remove()}
 },[]);
 return <div ref={host} className="architecture night-landscape" aria-label="Continuous midnight landscape with animated folded surfaces and camera parallax">
 {!webgl&&<svg className="night-fallback" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-label="Midnight landscape fallback">{Array.from({length:28},(_,i)=><path key={i} d={`M-100 ${470+i*19}C250 ${150+i*12} 410 ${870-i*5} 760 ${430+i*11}S1200 ${280+i*14} 1510 ${460+i*17}`} fill="none" stroke={i%3?'#23365b':'#40335b'} strokeWidth={i%3?2:6}/>)}</svg>}
 <div className="architecture-caption"><span>THE MIDNIGHT FIELD / CONTINUOUS SURFACE</span><span>{webgl?'LIVE 3D ENVIRONMENT':'ILLUSTRATED FALLBACK / WEBGL UNAVAILABLE'}</span></div></div>
}
