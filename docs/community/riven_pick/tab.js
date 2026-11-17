const o=require(process.argv[2])[+process.argv[3]||0]; const names=o.rows[0].res.map(x=>x.n); const cols=o.rows.map(r=>r.v);
const ref=process.argv[4]==='first'?o.rows.map(r=>r.res[0].s):o.rows.map(r=>Math.max(...r.res.map(x=>x.s)));
const tab=names.map((n,i)=>{const rel=o.rows.map((r,k)=>r.res[i].s/ref[k]); return {n,rel,geo:Math.exp(rel.reduce((a,v)=>a+Math.log(Math.max(v,1e-9)),0)/rel.length),min:Math.min(...rel)};}); if(process.argv[4]!=='first') tab.sort((a,b)=>b.geo-a.geo);
console.log(o.name+' | '+o.atk+' evo '+JSON.stringify(o.evo)+' '+(o.errs||[]).join('|')); console.log('build'.padEnd(16)+' geo   min  '+cols.map(c=>c.slice(0,7).padStart(8)).join(''));
for(const t of tab.slice(0,+process.argv[5]||40)) console.log(t.n.slice(0,16).padEnd(16)+t.geo.toFixed(3)+' '+t.min.toFixed(3)+' '+t.rel.map(v=>(v*100).toFixed(0).padStart(8)).join(''));
