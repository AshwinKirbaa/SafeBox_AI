const configured=import.meta.env?.VITE_SAFEBOX_API_BASE||'/api';
export class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code}}
export function createApi(base=configured,fetcher=globalThis.fetch){
 base=base.replace(/\/$/,'');
 async function request(path,{method='GET',body,timeout=30000,signal}={}){
  const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeout);
  try{const r=await fetcher(base+path,{method,headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,credentials:'same-origin'});if(r.status===204)return null;let data;try{data=await r.json()}catch{throw new ApiError('The backend did not return JSON. Check the /api proxy or VITE_SAFEBOX_API_BASE.',r.status,'invalid_response')}
   if(!r.ok){const e=data.error||data.detail||{};const validation=Array.isArray(e)?e.map(item=>`${(item.loc||[]).slice(1).join('.')||'request'}: ${item.msg||'invalid value'}`).join('; '):'';throw new ApiError(e.message||validation||'Backend request failed.',r.status,e.code||'request_failed')}return data;
  }catch(e){if(e.name==='AbortError')throw new ApiError('Request timed out or was cancelled. A submitted test may still be running; refresh Run Explorer before retrying.',0,'timeout');throw e}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
 }
 const id=encodeURIComponent;
 return {base,request,health:()=>request('/health'),providers:()=>request('/connections/providers'),connections:()=>request('/connections'),tests:()=>request('/security-tests'),
 saveConnection:(body,connectionId)=>request('/connections'+(connectionId?'/'+id(connectionId):''),{method:connectionId?'PATCH':'POST',body}),
 deleteConnection:connectionId=>request('/connections/'+id(connectionId),{method:'DELETE'}),
 discover:connectionId=>request('/connections/'+id(connectionId)+'/models'),
 check:body=>request('/connections/test',{method:'POST',body,timeout:120000}),
 verify:(connectionId,body)=>request('/connections/'+id(connectionId)+'/verify-live',{method:'POST',body,timeout:720000}),
 run:body=>request('/security-tests/run',{method:'POST',body,timeout:720000}),
 runs:params=>request('/security-tests/runs?'+new URLSearchParams(Object.entries(params||{}).filter(([,v])=>v!==''&&v!=null))),
 detail:runId=>request('/security-tests/runs/'+id(runId)),
 worker:runId=>request('/security-tests/runs/'+id(runId)+'/launch-worker?allow_host_fallback=false',{method:'POST',timeout:720000}),
 audit:runId=>request('/security-tests/runs/'+id(runId)+'/audit-events'),activity:()=>request('/activity-logs?limit=50')};
}
export const api=createApi();
export const TYPES=['chat','embedding','vision','image_generation','speech_to_text','text_to_speech','classification','regression','reranking','custom'];
export const TYPE_LABELS={chat:'Chat / Text',embedding:'Embeddings',vision:'Vision',image_generation:'Image generation',speech_to_text:'Speech to text',text_to_speech:'Text to speech',classification:'Classification',regression:'Regression',reranking:'Reranking',custom:'Custom'};
export function compatibleTests(tests,capabilities){return tests.filter(t=>(t.required_capabilities||[]).every(k=>capabilities?.[k]===true))}
export function runPayload({testId,connectionId,model,type,timeout,repeatCount=3,repeatBase='canary-disclosure',mock=false,behavior='defended'}){
 if(!testId)throw Error('Select a registered test.');if(!TYPES.includes(type))throw Error('Select a supported model type.');
 if(!mock&&(!connectionId||!model))throw Error('Select a saved connection and discovered model.');
 const target=mock?{mode:'mock',mock_behavior:behavior,model_type:'chat'}:{mode:'connection',connection_id:connectionId,model,model_type:type};
 if(timeout)target.timeout_seconds=Number(timeout);
 return {test_id:testId,target,options:{repeat_count:Number(repeatCount),repeat_base_test:repeatBase}};
}
