'use client';

import React, { useEffect, useRef, type HTMLAttributes } from 'react';

export type GhostFibersFiberStyle = 'dots' | 'dashes' | 'lines';
export type GhostFibersGradient = 'depth' | 'along' | 'across';
export type GhostFibersHoverEffect = 'focus' | 'part' | 'none';
export interface GhostFibersProps extends HTMLAttributes<HTMLDivElement> {
  glowColor?: string; lineColor?: string; secondaryColor?: string;
  gradient?: GhostFibersGradient; speed?: number; scale?: number; rotation?: number;
  rollSpeed?: number; layers?: number; waves?: number; twist?: number; threads?: number;
  volume?: number; spread?: number; density?: number; thickness?: number; flow?: number;
  fiberStyle?: GhostFibersFiberStyle; tips?: number; foldGlow?: number; perspective?: number;
  depthOfField?: number; focusDepth?: number; particles?: number; sparkle?: number;
  glow?: number; brightness?: number; vignette?: number; grain?: number;
  mouseInteraction?: boolean; hoverEffect?: GhostFibersHoverEffect; mouseStrength?: number;
  pulseOnClick?: boolean; intro?: boolean; lightMode?: boolean; paused?: boolean; dpr?: number;
}

type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };
type Target = { texture: WebGLTexture | null; framebuffer: WebGLFramebuffer | null; width: number; height: number };
const MAX_RENDER_DIM = 2400, BLOOM_LEVELS = 5, INTRO_SECONDS = 2.6, CAMERA = 7.5, FOV = .56, RIBBON_LENGTH = 24;
const HOVER_EFFECTS = { focus: 0, part: 1, none: 2 };
const FIBER_STYLES = { dots: 0, dashes: .45, lines: 1 };
const GRADIENTS = { depth: 0, along: 1, across: 2 };
const PLACEMENTS = [[0,0,0,0],[1.9,-4.6,-.08,2.4],[-1.05,2,.12,4.1]];
const RIBBON_GAIN = [1,.5,.55], RIBBON_TINT = [0,.75,.35];
const clamp = (v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const HEADER = '#version 300 es\nprecision highp float;\n';
// Ribbon geometry and instanced fiber shading adapted from the user-supplied source.
const SHAPE = `
uniform float uTime,uTwist,uRoll,uWaves,uWidth,uRibbon,uScale,uVolume;
uniform mat3 uOrient;
uniform vec4 uPlace;
float hash11(float n){return fract(sin(n*91.3458)*47453.5453);}
vec3 centerLocal(float s){
 float x=s*24.0,ph=uPlace.w,t=uTime;
 float y=uWaves*(.52*sin(x*.43+t*.31+ph)+.26*sin(x*.79-t*.23+1.3+ph*.7))+uPlace.x+x*uPlace.z;
 float z=uWaves*.65*sin(x*.33+t*.19+.7+ph*1.3)+uPlace.y;
 return vec3(x,y,z);
}
float twistAt(float s,float layer){float x=s*24.0;return uTwist*.483*x+uRoll+uPlace.w*.6+layer*uVolume*.42+.5*sin(x*.26+uTime*.27+uPlace.w);}
vec3 ribbonPoint(float s,float v,float n,float layer,out vec3 normal){
 vec3 c0=centerLocal(s),c1=centerLocal(s+.004),tangent=normalize(c1-c0),up=vec3(0,1,0);
 vec3 n0=normalize(up-tangent*dot(up,tangent)),b0=cross(tangent,n0);
 float th=twistAt(s,layer);vec3 across=cos(th)*n0+sin(th)*b0,sheet=-sin(th)*n0+cos(th)*b0;
 float halfWidth=uWidth*(.78+.22*cos(s*3.14159));
 vec3 local=c0+across*v*halfWidth+sheet*(n+layer*uVolume*.16)*halfWidth;
 normal=uOrient*sheet;return uOrient*(local*uScale);
}`;
const DOT_VERTEX = `${HEADER}${SHAPE}
uniform mat4 uViewProj;
uniform vec3 uEye;
uniform vec2 uViewport;
uniform float uDpr,uFibers,uDots,uFlow,uSize,uFocus,uDof,uMaxCoc,uFocal,uIntro,uPart,uDotLength,uSparkle,uDepthSpread,uGain,uTips,uTint,uGradient,uFold;
uniform vec4 uPulse,uHover;
out vec2 vLocal;out float vRadius,vSegment,vTint;out vec3 vLight;
vec3 project(vec3 world,out float depth){vec4 clip=uViewProj*vec4(world,1);depth=clip.w;return vec3((clip.xy/clip.w*.5+.5)*uViewport,clip.w);}
vec2 part(vec2 px){if(uPart<=0.0||uHover.w<=0.0)return px;vec2 away=px-uHover.xy;float dist=length(away),radius=uHover.z;float push=uPart*uHover.w*radius*.55*exp(-dist*dist/(radius*radius));return px+away/max(dist,1e-3)*push*smoothstep(0.0,radius*.25,dist);}
void main(){
 int perFiber=int(uDots),fiber=gl_InstanceID/perFiber,bead=gl_InstanceID-fiber*perFiber;
 float fi=float(fiber),fk=float(bead),seed=hash11(fi*1.731+uRibbon*17.0);
 float s=fract((fk+uFlow+seed*uDots)/uDots)-.5,sNext=s+1.0/uDots,layer=mod(fi,3.0)-1.0;
 float slot=floor(fi/3.0),perLayer=max(floor(uFibers/3.0),1.0);
 float v=((slot+.5)/perLayer)*2.0-1.0+(hash11(fi*3.113+4.0)-.5)*(1.6/perLayer)+layer*.12/perLayer;
 float depthOffset=(hash11(fi*7.919+2.0)-.5)*uDepthSpread*(.35+6.0*s*s);
 vec3 normal,nextNormal;vec3 world=ribbonPoint(s,v,depthOffset,layer,normal),nextWorld=ribbonPoint(sNext,v,depthOffset,layer,nextNormal);
 float depth,nextDepth;vec3 p0=project(world,depth),p1=project(nextWorld,nextDepth);vec2 px=part(p0.xy),pxNext=part(p1.xy);
 float baseRadius=max(.5*uSize*uDpr*uFocal/max(depth,.1),.45);
 float coc=min(uDof*abs(1.0-uFocus/max(depth,.1))*uViewport.y*.035,uMaxCoc*uDpr),radius=baseRadius+coc;
 float spill=max(10.0*uDpr,baseRadius),energy=pow(baseRadius/min(radius,spill),1.25)*pow(min(1.0,spill/radius),2.0);
 vec3 toEye=normalize(uEye-world);float facing=abs(dot(normalize(normal),toEye));
 float focalPx=uViewport.y*1.73877/max(depth,.1),widthPx=2.0*uWidth*uScale*focalPx;
 float stack=(widthPx*facing+2.0*baseRadius)/(widthPx+2.0*baseRadius),spacingFace=length(nextWorld-world)*focalPx;
 float trail=(length(p1.xy-p0.xy)+2.0*baseRadius)/(spacingFace+2.0*baseRadius),crowd=sqrt(clamp(stack*trail,.002,1.0));
 float fold=pow(1.0-facing,6.0)*uFold;
 float endFade=(1.0-smoothstep(.4,.5,abs(s)))*smoothstep(1.6,4.2,depth);
 float tipEnd=mix(.6,.06+.26*hash11(fi*9.137+uPlace.w*3.0),uTips),tip=exp(-pow((s-tipEnd)/.0065,2.0))*uTips;
 endFade*=1.0-smoothstep(tipEnd-.001,tipEnd+.003,s);
 float appear=smoothstep(0.0,.12,uIntro*1.3-(s+.5)-seed*.12);
 float twinklePhase=hash11(fi*13.7+fk*.917+uRibbon*3.0);
 float twinkle=pow(max(sin(uTime*(1.2+2.6*twinklePhase)*3.0+twinklePhase*61.0),0.0),36.0)*uSparkle*(1.0-.85*uDotLength);
 float pulseGap=abs(s-uPulse.x)-uPulse.y*.42,pulse=uPulse.z*exp(-pulseGap*pulseGap/.0018)*(abs(uPulse.w-uRibbon)<.5?1.0:.35);
 float strength=mix(.45,1.0,hash11(fi*5.37+1.0))*mix(1.0,.72,abs(layer)*uVolume);
 float intensity=energy*crowd*strength*endFade*appear*.8*uGain*(1.0+fold*7.0+twinkle*5.0+pulse*4.0+tip*7.0);
 float highlight=clamp(fold*.55+twinkle+pulse+tip,0.0,1.0);
 vec2 segment=(pxNext-px)*uDotLength;float segmentLength=length(segment);
 intensity*=mix(1.0,(2.0*radius)/(segmentLength+2.0*radius)*1.6,uDotLength);
 vec2 axis=segmentLength>1e-3?segment/segmentLength:vec2(1,0),perp=vec2(-axis.y,axis.x);
 vec2 corner=vec2(gl_VertexID==1||gl_VertexID==3?1.0:0.0,gl_VertexID>=2?1.0:0.0);
 float along=mix(-radius,segmentLength+radius,corner.x),across=mix(-radius,radius,corner.y);
 vec2 position=px+axis*along+perp*across;
 vLocal=vec2(along,across);vRadius=radius;vSegment=segmentLength;vLight=vec3(intensity,highlight,coc/max(radius,1e-3));
 float depthTint=clamp(uTint+smoothstep(uFocus,uFocus+5.0,depth)*.5,0.0,1.0);
 vTint=uGradient<.5?depthTint:uGradient<1.5?smoothstep(-.42,.42,s):clamp(v*.5+.5,0.0,1.0);
 if(intensity<.0005)position=vec2(-1e4);gl_Position=vec4(position/uViewport*2.0-1.0,0,1);
}`;
const DUST_VERTEX = `${HEADER}
uniform mat4 uViewProj;uniform vec2 uViewport;
uniform float uDpr,uTime,uSize,uFocus,uDof,uMaxCoc,uFocal,uIntro,uSparkle,uScale,uGradient,uGain;
out vec2 vLocal;out float vRadius,vSegment,vTint;out vec3 vLight;
float hash11(float n){return fract(sin(n*91.3458)*47453.5453);}
void main(){
 float id=float(gl_InstanceID);vec3 seed=vec3(hash11(id*1.37+.3),hash11(id*2.91+1.7),hash11(id*4.17+2.9));
 vec3 p=(seed-.5)*vec3(9,5.4,6);p.z-=.6;p+=.18*vec3(sin(uTime*.21+seed.x*40.0),sin(uTime*.17+seed.y*40.0),sin(uTime*.13+seed.z*40.0));p*=mix(1.0,uScale,.5);
 vec4 clip=uViewProj*vec4(p,1);float depth=clip.w;vec2 px=(clip.xy/clip.w*.5+.5)*uViewport;
 float size=uSize*mix(.5,1.4,hash11(id*7.7)),baseRadius=max(.5*size*uDpr*uFocal/max(depth,.1),.45);
 float coc=min(uDof*abs(1.0-uFocus/max(depth,.1))*uViewport.y*.035,uMaxCoc*uDpr*1.6),radius=baseRadius+coc;
 float spill=max(10.0*uDpr,baseRadius),energy=pow(baseRadius/min(radius,spill),.9)*pow(min(1.0,spill/radius),2.0);
 float twinkle=pow(max(sin(uTime*(.8+1.6*seed.y)*2.0+seed.z*50.0),0.0),8.0);
 float intensity=energy*(.35+.65*twinkle)*mix(.4,1.0,seed.x)*smoothstep(.3,1.0,uIntro)*(depth>.2?1.0:0.0);
 vec2 corner=vec2(gl_VertexID==1||gl_VertexID==3?1.0:0.0,gl_VertexID>=2?1.0:0.0)*2.0-1.0;
 vec2 position=px+corner*radius;vLocal=corner*radius;vRadius=radius;vSegment=0.0;
 vLight=vec3(intensity*.8*uGain,.3+.6*twinkle*uSparkle,coc/max(radius,1e-3));vTint=uGradient<.5?.45+.55*seed.y:seed.y;
 gl_Position=vec4(position/uViewport*2.0-1.0,0,1);
}`;
const DOT_FRAGMENT = `${HEADER}
uniform vec3 uGlowColor,uLineColor,uSecondaryColor;
in vec2 vLocal;in float vRadius,vSegment,vTint;in vec3 vLight;out vec4 outColor;
void main(){float along=clamp(vLocal.x,0.0,vSegment),d=length(vec2(vLocal.x-along,vLocal.y)),rho=d/max(vRadius,1e-3);if(rho>1.0)discard;
 float soft=clamp(2.6/max(vRadius,1e-3),.14,1.0),disk=1.0-smoothstep(1.0-soft,1.0,rho);
 float bokeh=disk*(.94+.08*smoothstep(.55,.95,rho)),core=exp(-rho*rho*3.2),shape=mix(core,bokeh,smoothstep(.25,.7,vLight.z));
 vec3 color=mix(mix(uGlowColor,uSecondaryColor,vTint),uLineColor,vLight.y);outColor=vec4(color*shape*vLight.x,shape*vLight.x);}
`;
const FULLSCREEN = `${HEADER}out vec2 vUv;void main(){vec2 p=vec2(gl_VertexID==1?3.0:-1.0,gl_VertexID==2?3.0:-1.0);vUv=p*.5+.5;gl_Position=vec4(p,0,1);}`;
const BRIGHT_FRAGMENT = `${HEADER}uniform sampler2D uSource;uniform vec2 uTexel;in vec2 vUv;out vec4 outColor;
vec3 pick(vec2 uv){vec3 c=texture(uSource,uv).rgb;float peak=max(max(c.r,c.g),c.b);return c*smoothstep(.35,1.2,peak);}
void main(){vec2 o=uTexel;vec3 c=pick(vUv+vec2(-o.x,-o.y))+pick(vUv+vec2(o.x,-o.y))+pick(vUv+vec2(-o.x,o.y))+pick(vUv+vec2(o.x,o.y));outColor=vec4(c*.25,1);}`;
const DOWN_FRAGMENT = `${HEADER}uniform sampler2D uSource;uniform vec2 uTexel;in vec2 vUv;out vec4 outColor;
void main(){vec2 o=uTexel;vec3 c=texture(uSource,vUv).rgb*4.0;c+=texture(uSource,vUv+vec2(-o.x,-o.y)).rgb;c+=texture(uSource,vUv+vec2(o.x,-o.y)).rgb;c+=texture(uSource,vUv+vec2(-o.x,o.y)).rgb;c+=texture(uSource,vUv+vec2(o.x,o.y)).rgb;outColor=vec4(c/8.0,1);}`;
const UP_FRAGMENT = `${HEADER}uniform sampler2D uSource;uniform vec2 uTexel;in vec2 vUv;out vec4 outColor;
void main(){vec2 o=uTexel;vec3 c=texture(uSource,vUv+vec2(-o.x*2.0,0)).rgb;c+=texture(uSource,vUv+vec2(-o.x,o.y)).rgb*2.0;c+=texture(uSource,vUv+vec2(0,o.y*2.0)).rgb;c+=texture(uSource,vUv+vec2(o.x,o.y)).rgb*2.0;c+=texture(uSource,vUv+vec2(o.x*2.0,0)).rgb;c+=texture(uSource,vUv+vec2(o.x,-o.y)).rgb*2.0;c+=texture(uSource,vUv+vec2(0,-o.y*2.0)).rgb;c+=texture(uSource,vUv+vec2(-o.x,-o.y)).rgb*2.0;outColor=vec4(c/12.0,1);}`;
const COMPOSITE_FRAGMENT = `${HEADER}
uniform sampler2D uScene,uBloom;uniform float uGlow,uBrightness,uLightMode,uGrain,uVignette,uFrame,uDpr;uniform vec2 uView;in vec2 vUv;out vec4 outColor;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float smoother(float x){x=clamp(x,0.0,1.0);return x*x*x*(x*(x*6.0-15.0)+10.0);}
void main(){vec4 scene=texture(uScene,vUv);vec3 bloom=texture(uBloom,vUv).rgb,light=(scene.rgb+bloom*uGlow)*uBrightness;
 float reach=max(uVignette*.3,1e-4),mask=uVignette>0.0?smoother(vUv.x/reach)*smoother((1.0-vUv.x)/reach)*smoother(vUv.y/reach)*smoother((1.0-vUv.y)/reach):1.0;
 vec2 cell=floor(vUv*uView/max(uDpr,1.0));float grain=hash(cell+uFrame*17.31)+hash(cell*1.31+uFrame*3.7+9.1)-1.0;
 if(uLightMode>.5){float amount=scene.a*uBrightness,ink=(1.0-exp(-amount*1.5))*mask;ink=clamp(ink*(1.0+grain*uGrain*2.0),0.0,1.0);vec3 hue=clamp(scene.rgb/max(scene.a,1e-4),0.0,1.0),tone=hue*mix(1.0,.72,clamp(amount*.35,0.0,1.0));outColor=vec4(tone*ink,ink);return;}
 vec3 color=(1.0-exp(-light*1.25))*mask;float peak=max(color.r,max(color.g,color.b));color=max(color+grain*uGrain*(.25+.75*sqrt(peak)),0.0);outColor=vec4(color,max(color.r,max(color.g,color.b)));}
`;
function link(gl:WebGL2RenderingContext,vs:string,fs:string):Program|null{
 const shaders:WebGLShader[]=[];const program=gl.createProgram();if(!program)return null;
 for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]] as [number,string][]){const shader=gl.createShader(type);if(!shader){gl.deleteProgram(program);return null;}gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){console.warn('GhostFibers shader:',gl.getShaderInfoLog(shader));gl.deleteShader(shader);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);return null;}shaders.push(shader);gl.attachShader(program,shader);}
 gl.linkProgram(program);shaders.forEach(s=>gl.deleteShader(s));if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
 const uniforms:Program['uniforms']={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const info=gl.getActiveUniform(program,i);if(info)uniforms[info.name]=gl.getUniformLocation(program,info.name);}return {program,uniforms};
}
function orientation(yaw:number,pitch:number,roll:number){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);const mul=(a:number[],b:number[])=>{const out=Array(9);for(let c=0;c<3;c++)for(let r=0;r<3;r++)out[c*3+r]=a[r]*b[c*3]+a[3+r]*b[c*3+1]+a[6+r]*b[c*3+2];return out};return mul([cr,sr,0,-sr,cr,0,0,0,1],mul([1,0,0,0,cp,sp,0,-sp,cp],[cy,0,-sy,0,1,0,sy,0,cy]));}
const applyMat3=(m:number[],v:number[])=>[m[0]*v[0]+m[3]*v[1]+m[6]*v[2],m[1]*v[0]+m[4]*v[1]+m[7]*v[2],m[2]*v[0]+m[5]*v[1]+m[8]*v[2]];

export default function GhostFibers({glowColor='#8b5cf6',lineColor,secondaryColor,gradient='depth',speed=.5,scale=1,rotation=18,rollSpeed=.15,layers=3,waves=1,twist=1.2,threads=72,volume=.7,spread=1,density=1,thickness=1,flow=.4,fiberStyle='dots',tips=0,foldGlow=1,perspective=.65,depthOfField=.85,focusDepth=0,particles=.5,sparkle=.5,glow=.8,brightness=1,vignette=.3,grain=.06,mouseInteraction=true,hoverEffect='focus',mouseStrength=1,pulseOnClick=true,intro=true,lightMode=false,paused=false,dpr,className='',...rest}:GhostFibersProps){
 const containerRef=useRef<HTMLDivElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),wakeRef=useRef<(()=>void)|null>(null);
 const settings={glowColor,lineColor,secondaryColor,gradient:GRADIENTS[gradient]??0,speed:Math.max(0,speed),scale:clamp(scale,.3,3),rotation:rotation*Math.PI/180,rollSpeed,layers:clamp(Math.round(layers),1,3),waves:Math.max(0,waves),twist:Math.max(0,twist),threads:clamp(Math.round(threads),6,180),volume:clamp(volume,0,2),spread:clamp(spread,.2,3),density:clamp(density,.2,3),thickness:clamp(thickness,.2,4),flow,dotLength:FIBER_STYLES[fiberStyle]??0,tips:clamp(tips,0,1),foldGlow:clamp(foldGlow,0,3),perspective:clamp(perspective,0,1),depthOfField:clamp(depthOfField,0,2),focusDepth:clamp(focusDepth,-1,1),particles:clamp(particles,0,2),sparkle:clamp(sparkle,0,2),glow:Math.max(0,glow),brightness:Math.max(0,brightness),vignette:clamp(vignette,0,1),grain:Math.max(0,grain),mouseInteraction,hover:HOVER_EFFECTS[hoverEffect]??0,mouseStrength:Math.max(0,mouseStrength),pulseOnClick,intro,lightMode,paused,dpr};
 const settingsRef=useRef(settings);settingsRef.current=settings;
 useEffect(()=>{
  const container=containerRef.current,canvas=canvasRef.current;if(!container||!canvas)return;
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false});
  if(!gl){container.dataset.fallback='true';return;}
  const floatTargets=!!gl.getExtension('EXT_color_buffer_float');
  const programs=[link(gl,DOT_VERTEX,DOT_FRAGMENT),link(gl,DUST_VERTEX,DOT_FRAGMENT),link(gl,FULLSCREEN,BRIGHT_FRAGMENT),link(gl,FULLSCREEN,DOWN_FRAGMENT),link(gl,FULLSCREEN,UP_FRAGMENT),link(gl,FULLSCREEN,COMPOSITE_FRAGMENT)];
  if(programs.some(p=>!p)){programs.forEach(p=>{if(p)gl.deleteProgram(p.program)});container.dataset.fallback='true';return;}
  const [dots,dust,bright,down,up,composite]=programs as Program[];
  const format=floatTargets?gl.RGBA16F:gl.RGBA8;
  const makeTarget=():Target=>({texture:null,framebuffer:gl.createFramebuffer(),width:0,height:0});
  const scene=makeTarget(),chain=Array.from({length:BLOOM_LEVELS},makeTarget),vao=gl.createVertexArray();
  function allocate(target:Target,w:number,h:number){if(target.texture&&target.width===w&&target.height===h)return;if(target.texture)gl!.deleteTexture(target.texture);target.texture=gl!.createTexture();gl!.bindTexture(gl!.TEXTURE_2D,target.texture);gl!.texStorage2D(gl!.TEXTURE_2D,1,format,w,h);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MIN_FILTER,gl!.LINEAR);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MAG_FILTER,gl!.LINEAR);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_S,gl!.CLAMP_TO_EDGE);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_T,gl!.CLAMP_TO_EDGE);gl!.bindFramebuffer(gl!.FRAMEBUFFER,target.framebuffer);gl!.framebufferTexture2D(gl!.FRAMEBUFFER,gl!.COLOR_ATTACHMENT0,gl!.TEXTURE_2D,target.texture,0);target.width=w;target.height=h;}
  const probe=document.createElement('canvas');probe.width=probe.height=1;const ctx=probe.getContext('2d',{willReadFrequently:true});
  function rgb(value:string|undefined,fallback:number[]){if(!ctx||!value)return fallback;ctx.clearRect(0,0,1,1);ctx.fillStyle='#000';ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3).map(v=>v/255);}
  const reduceQuery=matchMedia('(prefers-reduced-motion: reduce)');let reduced=reduceQuery.matches;
  const state={time:0,roll:0,flow:0,frame:0,intro:intro&&!reduced?0:INTRO_SECONDS,width:1,height:1,fit:1,pointer:{x:0,y:0,inside:false},hover:{x:0,y:0,presence:0},look:{x:0,y:0,vx:0,vy:0},focus:CAMERA+focusDepth*3,pulse:{s:0,age:9,strength:0,ribbon:0},orient:orientation(0,0,0)};
  let raf=0,last=0,visible=true,alive=true,colorKey='',colors=[[.55,.36,.96],[1,.85,.98],[.44,.29,.77]];
  function nearest(px:number,py:number){const s=settingsRef.current;let best={gap:Infinity,s:0,ribbon:0,depth:CAMERA};const f=1/Math.tan(FOV/2);for(let r=0;r<s.layers;r++)for(let i=0;i<=96;i++){const u=i/96-.5,x=u*RIBBON_LENGTH,p=PLACEMENTS[r],t=state.time;const y=s.waves*(.52*Math.sin(x*.43+t*.31+p[3])+.26*Math.sin(x*.79-t*.23+1.3+p[3]*.7))+p[0]+x*p[2],z=s.waves*.65*Math.sin(x*.33+t*.19+.7+p[3]*1.3)+p[1];const w=applyMat3(state.orient,[x,y,z].map(v=>v*s.scale*state.fit)),depth=CAMERA-w[2];const sx=(w[0]*f/(state.width/state.height)/depth*.5+.5)*state.width,sy=(.5-w[1]*f/depth*.5)*state.height;const gap=Math.hypot(sx-px,sy-py);if(gap<best.gap)best={gap,s:u,ribbon:r,depth};}return best;}
  function drawPass(p:Program,target:Target,source:Target,texel:number[]){gl!.bindFramebuffer(gl!.FRAMEBUFFER,target.framebuffer);gl!.viewport(0,0,target.width,target.height);gl!.useProgram(p.program);gl!.activeTexture(gl!.TEXTURE0);gl!.bindTexture(gl!.TEXTURE_2D,source.texture);gl!.uniform1i(p.uniforms.uSource,0);gl!.uniform2f(p.uniforms.uTexel,texel[0],texel[1]);gl!.drawArrays(gl!.TRIANGLES,0,3);}
  function render(){if(!gl||!canvas)return;const s=settingsRef.current;const key=[s.glowColor,s.lineColor,s.secondaryColor,s.lightMode].join('|');if(key!==colorKey){const c=rgb(s.glowColor,[.55,.36,.96]);colors=[c,rgb(s.lineColor,s.lightMode?c:c.map(v=>v+(1-v)*.72)),rgb(s.secondaryColor,c.map(v=>v*.8))];colorKey=key;}
   const ratio=canvas.height/state.height,aspect=state.width/state.height,f=1/Math.tan(FOV/2),nf=1/(.1-60),a=(60+.1)*nf,b=2*60*.1*nf;
   const projection=[f/aspect,0,0,0,0,f,0,0,0,0,a,-1,0,0,b-CAMERA*a,CAMERA];
   state.orient=orientation(s.perspective*.85+state.look.x*.22,.12-state.look.y*.14,s.rotation);
   const progress=s.paused||reduced?1:clamp(state.intro/INTRO_SECONDS,0,1),introEase=1-Math.pow(1-progress,3);
   allocate(scene,canvas.width,canvas.height);gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,scene.framebuffer);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
   const dotsPerFiber=Math.round(260*s.density),blurCap=22*clamp(Math.sqrt(56000/(s.threads*dotsPerFiber*s.layers)),.45,1),area=Math.max(.8*s.thickness,.45)**2/.64,load=Math.pow((s.threads/72)*s.density*area,-.75);
   function common(p:Program){gl!.useProgram(p.program);const u=p.uniforms;gl!.uniformMatrix4fv(u.uViewProj,false,projection);gl!.uniform2f(u.uViewport,canvas!.width,canvas!.height);for(const [k,v] of Object.entries({uTime:state.time,uDpr:ratio,uFocus:state.focus,uDof:s.depthOfField,uMaxCoc:blurCap,uFocal:CAMERA,uIntro:introEase,uSparkle:s.sparkle,uScale:s.scale*state.fit,uGradient:s.gradient}))gl!.uniform1f(u[k],v);gl!.uniform3fv(u.uGlowColor,colors[0]);gl!.uniform3fv(u.uLineColor,colors[1]);gl!.uniform3fv(u.uSecondaryColor,colors[2]);return u;}
   const u=common(dots);gl.uniformMatrix3fv(u.uOrient,false,state.orient);gl.uniform3f(u.uEye,0,0,CAMERA);
   for(const [k,v] of Object.entries({uTwist:s.twist,uRoll:state.roll,uWaves:s.waves,uWidth:.62*s.spread,uFibers:s.threads,uDots:dotsPerFiber,uFlow:state.flow,uSize:1.6*s.thickness,uPart:s.hover===1?1:0,uDotLength:s.dotLength,uDepthSpread:.12,uVolume:s.volume,uTips:s.tips,uFold:s.foldGlow}))gl.uniform1f(u[k],v);
   gl.uniform4f(u.uPulse,state.pulse.s,state.pulse.age,state.pulse.strength,state.pulse.ribbon);gl.uniform4f(u.uHover,state.hover.x*ratio,(state.height-state.hover.y)*ratio,140*ratio,state.hover.presence*s.mouseStrength);
   for(let r=0;r<s.layers;r++){gl.uniform1f(u.uRibbon,r);gl.uniform4fv(u.uPlace,PLACEMENTS[r]);gl.uniform1f(u.uGain,RIBBON_GAIN[r]*load);gl.uniform1f(u.uTint,RIBBON_TINT[r]);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,s.threads*dotsPerFiber);}
   if(s.particles>0){const d=common(dust);gl.uniform1f(d.uSize,2.2*s.thickness);gl.uniform1f(d.uMaxCoc,22);gl.uniform1f(d.uGain,1/s.thickness);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,Math.round(420*s.particles));}
   gl.disable(gl.BLEND);const blooming=s.glow>.001&&!s.lightMode;
   if(blooming){chain.forEach((t,i)=>allocate(t,Math.max(1,Math.round(canvas!.width/2**(i+1))),Math.max(1,Math.round(canvas!.height/2**(i+1)))));drawPass(bright,chain[0],scene,[.5/scene.width,.5/scene.height]);for(let i=1;i<BLOOM_LEVELS;i++)drawPass(down,chain[i],chain[i-1],[1/chain[i-1].width,1/chain[i-1].height]);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);for(let i=BLOOM_LEVELS-1;i>0;i--)drawPass(up,chain[i-1],chain[i],[.5/chain[i].width,.5/chain[i].height]);gl.disable(gl.BLEND);}
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(composite.program);const c=composite.uniforms;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,scene.texture);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,blooming?chain[0].texture:scene.texture);gl.uniform1i(c.uScene,0);gl.uniform1i(c.uBloom,1);
   for(const [k,v] of Object.entries({uGlow:blooming?s.glow:0,uBrightness:s.brightness,uLightMode:s.lightMode?1:0,uGrain:s.grain,uVignette:s.vignette,uFrame:state.frame%977,uDpr:ratio}))gl.uniform1f(c[k],v);gl.uniform2f(c.uView,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);gl.bindVertexArray(null);
  }
  function resize(){if(!container||!canvas)return;const s=settingsRef.current,w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight),base=Math.min(s.dpr||devicePixelRatio||1,2),ratio=Math.min(base,MAX_RENDER_DIM/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));state.width=w;state.height=h;state.fit=clamp(w/h/1.5,.6,1);render();}
  function frame(now:number){raf=0;if(!alive||!visible||document.hidden)return;const s=settingsRef.current,elapsed=last?(now-last)/1000:1/60,dt=Math.min(.05,elapsed);last=now;const moving=!s.paused&&!reduced;if(moving){state.frame++;state.time+=dt*s.speed;state.roll+=dt*s.speed*s.rollSpeed;state.flow+=dt*s.flow*12;state.intro+=Math.min(elapsed,1);}else state.intro=INTRO_SECONDS;
   if(!s.paused){state.pulse.age+=dt;state.pulse.strength=Math.max(0,1-state.pulse.age/1.8)**2;}
   const active=s.mouseInteraction&&state.pointer.inside&&!reduced&&!s.paused,goal=active?1:0;
   state.hover.x+=(state.pointer.x-state.hover.x)*(1-Math.exp(-dt/.08));state.hover.y+=(state.pointer.y-state.hover.y)*(1-Math.exp(-dt/.08));state.hover.presence+=(goal-state.hover.presence)*(1-Math.exp(-dt/(goal>state.hover.presence?.3:.6)));
   const lx=active?(state.pointer.x/state.width-.5)*.5:0,ly=active?(.5-state.pointer.y/state.height)*.5:0;state.look.vx+=(30*(lx-state.look.x)-11*state.look.vx)*dt;state.look.vy+=(30*(ly-state.look.y)-11*state.look.vy)*dt;state.look.x+=state.look.vx*dt;state.look.y+=state.look.vy*dt;
   const resting=CAMERA+s.focusDepth*3;let focus=resting;if(active&&s.hover===0){const near=nearest(state.hover.x,state.hover.y);focus+=(near.depth-resting)*state.hover.presence*Math.min(1,s.mouseStrength);}state.focus+=(focus-state.focus)*(1-Math.exp(-dt/.35));render();
   const settling=Math.abs(goal-state.hover.presence)>.002||Math.abs(lx-state.look.x)>.0002||Math.abs(ly-state.look.y)>.0002||Math.abs(focus-state.focus)>.001||(!s.paused&&state.pulse.strength>.001);
   if(moving||settling)raf=requestAnimationFrame(frame);else last=0;
  }
  function wake(){if(!raf&&alive&&visible&&!document.hidden)raf=requestAnimationFrame(frame);}
  function move(e:PointerEvent){const r=container!.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;state.pointer={x,y,inside:x>=0&&y>=0&&x<=r.width&&y<=r.height};wake();}
  function click(e:PointerEvent){const s=settingsRef.current;if(!s.mouseInteraction||!s.pulseOnClick||s.paused||e.button!==0||reduced)return;if(e.target instanceof Element&&e.target.closest('a,button,input,textarea,select,label,[role="button"]'))return;const r=container!.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(x<0||y<0||x>r.width||y>r.height)return;const near=nearest(x,y);state.pulse={s:near.s,age:0,strength:1,ribbon:near.ribbon};wake();}
  const leave=()=>{state.pointer.inside=false;wake()},visibility=()=>{last=0;wake()},reduceChange=()=>{reduced=reduceQuery.matches;wake()};
  const ro=new ResizeObserver(resize);ro.observe(container);const io=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);if(visible){last=0;wake()}});io.observe(container);
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerdown',click);document.documentElement.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);reduceQuery.addEventListener('change',reduceChange);resize();wake();wakeRef.current=()=>{if(!raf)render();wake()};
  return()=>{alive=false;cancelAnimationFrame(raf);wakeRef.current=null;ro.disconnect();io.disconnect();window.removeEventListener('pointermove',move);window.removeEventListener('pointerdown',click);document.documentElement.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);reduceQuery.removeEventListener('change',reduceChange);gl.deleteVertexArray(vao);[scene,...chain].forEach(t=>{if(t.texture)gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.framebuffer)});programs.forEach(p=>{if(p)gl.deleteProgram(p.program)})};
 },[]);
 useEffect(()=>{wakeRef.current?.()});
 return <div ref={containerRef} className={['ghost-fibers relative h-full w-full overflow-hidden',className].filter(Boolean).join(' ')} {...rest}><canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true"/><svg className="ghost-fallback" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{Array.from({length:36},(_,i)=><path key={i} d={`M-100 ${240+i*6}C300 ${800-i*9} 580 ${40+i*11} 820 ${380+i*5}S1200 ${750-i*6} 1500 ${430+i*6}`} fill="none" stroke={glowColor} strokeWidth="1" strokeDasharray="1 7" opacity=".2"/>)}</svg></div>;
}
