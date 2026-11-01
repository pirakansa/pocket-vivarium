/* Presentation vocabulary only: retain numeric state, IDs and timestamps. */
(function(root){
 const terms=[['お腹がすいてきた','蓄電量が減ってきた'],['朝ごはん','朝の充電'],['腹ごしらえ','エネルギー補給'],['食事をしよう','充電しよう'],['少し休もう','機体を整備しよう'],['ゆっくり休もう','機体を整備しよう'],['木の実を集めよう','電力セルを回収しよう'],['話をしたい','通信したい'],['見に行こう','調べに行こう'],['食べる','充電する'],['休む','整備する'],['採集する','資源を回収する'],['交流する','通信する'],['探検する','探索する'],['住人','MEHS'],['食料','電力セル'],['木の実','電力セル'],['食事','充電'],['朝食','充電'],['採集','資源回収'],['探検','探索'],['交流','通信'],['話した','通信した'],['話す','通信する'],['仲間','ほかの機体'],['疲れた','機体の負荷が高い'],['お腹','エネルギー'],['空腹','充電不足'],['体力','機体コンディション'],['家','充電ステーション'],['暮らし','稼働']];
 function translate(text){for(const [from,to]of terms)text=text.split(from).join(to);return text;}
 function convertTimeline(input){
  const data=JSON.parse(JSON.stringify(input));
  const states=[...(data.frames||[]).map(f=>f.state),data.endState].filter(Boolean);
  for(const s of states){if((s.people||[]).every(p=>p.kind==='mehs'))continue;s.logs=(s.logs||[]).map(translate);for(const p of s.people||[]){p.kind='mehs';for(const k of ['trait','action','reason'])if(typeof p[k]==='string')p[k]=translate(p[k]);for(const c of p.scores||[])if(typeof c.why==='string')c.why=translate(c.why);}}
  return data;
 }
 const api={translate,convertTimeline};if(typeof module==='object')module.exports=api;else root.Mehs=api;
})(typeof window!=='undefined'?window:{});
