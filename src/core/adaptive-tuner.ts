import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

type Any = Record<string, any>;
const growthPath="config/growth.json", resultsDir="jobs/results";
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0};
const metric=(j:Any,k:string)=>Number(j?.result?.metrics?.[k]??0);
const score=(j:Any)=> metric(j,"comments")*4+metric(j,"reposts")*3+metric(j,"quotes")*3+metric(j,"engagement_rate")*100+Math.log10(1+metric(j,"views"));
async function loadJobs(){const fs=(await readdir(resultsDir)).filter(x=>x.endsWith(".json"));const out:Any[]=[];for(const f of fs){try{out.push(JSON.parse(await readFile(join(resultsDir,f),"utf8")))}catch{}}return out}
export async function adaptiveTune(){
 const g=JSON.parse(await readFile(growthPath,"utf8")); const c=g.adaptive_control;
 if(!c?.enabled)return {status:"disabled"};
 const jobs=(await loadJobs()).filter(j=>j.status==="PUBLISHED"&&j.result?.metrics&&j.result?.published_at);
 const now=Date.now(), mature=jobs.filter(j=>now-Date.parse(j.result.published_at)>=c.metrics_maturity_hours*3600000);
 if(mature.length<c.minimum_published_posts_before_tuning)return {status:"insufficient_sample",mature:mature.length,required:c.minimum_published_posts_before_tuning};
 await mkdir("state",{recursive:true}); let history:Any[]=[]; try{history=(await readFile(c.audit_log_path,"utf8")).trim().split("\n").filter(Boolean).map(JSON.parse)}catch{}
 const last=history.at(-1); if(last&&now-Date.parse(last.timestamp)<c.change_cooldown_hours*3600000)return {status:"cooldown"};
 const recent=mature.slice(-Math.min(10,mature.length)), prior=mature.slice(0,-recent.length);
 if(prior.length<c.minimum_posts_per_segment)return {status:"insufficient_baseline"};
 const r=median(recent.map(score)), b=median(prior.map(score)); const ratio=b>0?r/b:1;
 const changes:Any[]=[]; const set=(path:string,old:number,next:number)=>{if(old!==next&&changes.length<c.max_parameter_changes_per_cycle)changes.push({path,previous:old,next})};
 if(ratio>=1.15){const x=c.tunable_parameters.target_posts_per_day;set("cadence.target_posts_per_day",g.cadence.target_posts_per_day,clamp(g.cadence.target_posts_per_day+x.max_step,x.min,x.max));}
 if(ratio<=0.85){const x=c.tunable_parameters.strong_incremental_threshold;const cur=g.cadence.dynamic_quality_thresholds[1].minimum_score;set("cadence.dynamic_quality_thresholds[1].minimum_score",cur,clamp(cur+x.max_step,x.min,x.max));const s=c.tunable_parameters.batch_spacing_minutes;set("cadence.standard_spacing_minutes",g.cadence.standard_spacing_minutes,clamp(g.cadence.standard_spacing_minutes+s.max_step,s.min,s.max));}
 if(!changes.length)return {status:"stable",ratio};
 for(const ch of changes){if(ch.path==="cadence.target_posts_per_day")g.cadence.target_posts_per_day=ch.next;else if(ch.path.includes("dynamic_quality"))g.cadence.dynamic_quality_thresholds[1].minimum_score=ch.next;else if(ch.path==="cadence.standard_spacing_minutes")g.cadence.standard_spacing_minutes=ch.next}
 await writeFile(growthPath,JSON.stringify(g,null,2)+"\n");
 const event={timestamp:new Date().toISOString(),ratio,baseline_median:b,recent_median:r,mature_posts:mature.length,changes,reason:"bounded mature-metrics auto-tuning"};
 await writeFile(c.audit_log_path,JSON.stringify(event)+"\n",{flag:"a"}); return {status:"tuned",...event};
}
