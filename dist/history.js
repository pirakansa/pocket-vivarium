(()=>{'use strict';
 const metrics=[{key:'population',label:'稼働個体数',unit:'機',color:'#4c8267'},{key:'cells',label:'電力セル',unit:'個',color:'#bc8a35'},{key:'parts',label:'部品',unit:'個',color:'#64889a'}];
 const $=id=>document.getElementById(id),fmt=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
 const date=t=>fmt.format(new Date(t)),value=n=>n===null?'—':Number.isInteger(n)?String(n):n.toFixed(1);
 let data=null,days=30,points=[],events=[],selected=-1,models=[];
 function svgEl(tag,attrs={},text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;}
 for(const m of metrics){const card=document.createElement('section');card.className='chart-card';card.style.setProperty('--color',m.color);card.innerHTML=`<div class="card-head"><h2><span class="dot"></span>${m.label}</h2><div class="metric" id="value-${m.key}">—<small>${m.unit}</small></div></div><svg class="chart" id="chart-${m.key}" role="img" tabindex="0" aria-label="${m.label}の推移"></svg>`;$('charts').append(card);}
 function inspect(index){
  if(!points.length)return;selected=Math.max(0,Math.min(points.length-1,index));const p=points[selected],at=Date.parse(p.at);
  for(const m of models){const y=m.y(p[m.key]),x=m.x(at);m.cursor.setAttribute('x1',x);m.cursor.setAttribute('x2',x);m.cursor.removeAttribute('visibility');m.dot.setAttribute('cx',x);m.dot.setAttribute('cy',y);if(p[m.key]===null)m.dot.setAttribute('visibility','hidden');else m.dot.removeAttribute('visibility');$(`value-${m.key}`).replaceChildren(document.createTextNode(value(p[m.key])),Object.assign(document.createElement('small'),{textContent:m.unit}));}
  $('inspection').replaceChildren();const time=document.createElement('time');time.dateTime=p.at;time.textContent=date(p.at);$('inspection').append(time);
  const summary=document.createElement('p');summary.textContent=`稼働 ${p.population}機　 /　セル ${value(p.cells)}個　 /　部品 ${value(p.parts)}個`;$('inspection').append(summary);
  const recent=events.filter(e=>Date.parse(e.at)>at-300000&&Date.parse(e.at)<=at);
  const detail=document.createElement('p');detail.textContent=recent.length?recent.map(e=>`MEHS #${e.id} ${e.kind==='start'?(e.outside?'起動（来訪）':'起動'):'引退'}`).join(' ／ '):'この5分間の起動・引退はありません。';$('inspection').append(detail);
 }
 function render(){
  if(!data)return;const now=Date.now(),available=data.points.filter(p=>Date.parse(p.at)<=now),latest=available.at(-1);
  const end=latest?Date.parse(latest.at):now,start=end-days*86400000;
  points=available.filter(p=>Date.parse(p.at)>=start);events=data.events.filter(e=>Date.parse(e.at)>=start&&Date.parse(e.at)<=end);models=[];
  for(const m of metrics){
   const svg=$(`chart-${m.key}`);svg.replaceChildren();const w=Math.max(280,svg.getBoundingClientRect().width),h=svg.getBoundingClientRect().height||190;
   svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
   if(!points.length){svg.append(svgEl('text',{x:w/2,y:h/2,'text-anchor':'middle',class:'axis'},'表示できる記録がありません'));continue;}
   const left=42,right=w-12,top=14,bottom=h-32,begin=Date.parse(points[0].at),finish=Math.max(begin+300000,end);
   const max=Math.max(1,...points.map(p=>p[m.key]).filter(Number.isFinite)),step=m.key==='population'?Math.max(1,Math.ceil(max/4)):Math.max(1,Math.ceil(max/4/5)*5),ceiling=Math.max(step,Math.ceil(max/step)*step);
   const x=t=>left+(t-begin)/(finish-begin)*(right-left),y=v=>bottom-v/ceiling*(bottom-top);
   for(let v=0;v<=ceiling;v+=step){const py=y(v);svg.append(svgEl('line',{x1:left,x2:right,y1:py,y2:py,class:'grid'}),svgEl('text',{x:left-8,y:py+4,'text-anchor':'end',class:'axis'},value(v)));}
   const ticks=w<500?2:4;for(let i=0;i<ticks;i++){const t=begin+(finish-begin)*i/(ticks-1);svg.append(svgEl('text',{x:x(t),y:h-8,'text-anchor':i===0?'start':i===ticks-1?'end':'middle',class:'axis'},date(t)));}
   const segments=[];let segment=[];for(const p of points){if(p[m.key]===null){if(segment.length)segments.push(segment);segment=[];continue;}if(segment.length&&Date.parse(p.at)-Date.parse(segment.at(-1).at)>300001){segments.push(segment);segment=[];}segment.push(p);}if(segment.length)segments.push(segment);
   for(const part of segments){let d=`M${x(Date.parse(part[0].at))},${y(part[0][m.key])}`;for(let i=1;i<part.length;i++){const p=part[i];d+=`H${x(Date.parse(p.at))}V${y(p[m.key])}`;}const first=x(Date.parse(part[0].at)),last=x(Date.parse(part.at(-1).at));svg.append(svgEl('path',{d:d+`L${last},${bottom}L${first},${bottom}Z`,class:'area'}),svgEl('path',{d,class:'series'}));if(part.length===1)svg.append(svgEl('circle',{cx:first,cy:y(part[0][m.key]),r:2.5,fill:m.color}));}
   const cursor=svgEl('line',{y1:top,y2:bottom,class:'cursor',visibility:'hidden'}),dot=svgEl('circle',{r:4,class:'selected',visibility:'hidden'});svg.append(cursor,dot);models.push({...m,x,y,cursor,dot});
   function pick(event){const rect=svg.getBoundingClientRect(),target=begin+Math.max(0,Math.min(1,(event.clientX-rect.left-left)/(right-left)))*(finish-begin);let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(Date.parse(points[mid].at)<target)lo=mid+1;else hi=mid;}if(lo&&target-Date.parse(points[lo-1].at)<Date.parse(points[lo].at)-target)lo--;inspect(lo);}
   svg.onpointermove=e=>{if(e.pointerType==='mouse')pick(e);};svg.onpointerdown=pick;svg.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();inspect(e.key==='Home'?0:e.key==='End'?points.length-1:selected+(e.key==='ArrowLeft'?-1:1));};
   svg.setAttribute('aria-label',`${m.label}の推移。${date(points[0].at)}から${date(latest.at)}。矢印キーで時刻を選択できます。`);
  }
  if(points.length){inspect(points.length-1);$('status').textContent=`${date(points[0].at)} 〜 ${date(points.at(-1).at)}`;$('range-label').textContent=`蓄積済みの範囲を表示しています（最大30日）。データ作成：${date(data.generatedAt)}`;}
  else{$('status').textContent='記録はまだありません';$('inspection').textContent='次の記録更新後にご覧ください。';}
 }
 for(const button of document.querySelectorAll('[data-days]'))button.onclick=()=>{days=Number(button.dataset.days);for(const b of document.querySelectorAll('[data-days]'))b.setAttribute('aria-pressed',String(b===button));render();};
 async function load(){try{const r=await fetch('./history.json',{cache:'no-store'});if(!r.ok)throw Error('fetch');const next=await r.json();if(next.schemaVersion!==1||!Array.isArray(next.points)||!Array.isArray(next.events))throw Error('format');data=next;render();}catch{$('status').textContent=data?'更新できませんでした。前の記録を表示しています。':'記録を取得できませんでした。時間をおいて再読み込みしてください。';if(!data)$('inspection').textContent='記録を読み込めませんでした。';}}
 let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(render,120);});setInterval(load,60000);load();
})();
