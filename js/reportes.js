export const groupBy=(records,key)=>records.reduce((a,r)=>(a[r[key]||'Sin dato']=(a[r[key]||'Sin dato']||0)+1,a),{});
export const listHtml=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>`<div class="list-row"><span>${k}</span><strong>${v}</strong></div>`).join('')||'<p class="muted">Sin información todavía.</p>';
