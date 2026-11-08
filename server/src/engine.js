import { randomInt } from 'node:crypto';
export function shuffle() {
  const cards = Array.from({length:52}, (_,i)=>({rank:i%13+2,suit:Math.floor(i/13)}));
  for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
  return cards;
}
export function score(hand) {
  if (!Array.isArray(hand)||hand.length!==3) throw Error('Three cards required');
  const r=hand.map(c=>c.rank).sort((a,b)=>b-a), suits=hand.map(c=>c.suit);
  const flush=suits.every(s=>s===suits[0]);
  const straight=(r[0]===r[1]+1&&r[1]===r[2]+1)||(r.join(',')==='14,3,2');
  const high=r.join(',')==='14,3,2'?[3,2,1]:r;
  const counts=new Map();for(const n of r)counts.set(n,(counts.get(n)||0)+1);
  const same=[...counts].find(([,v])=>v===3);
  const pair=[...counts].find(([,v])=>v===2);
  if(same)return [6,same[0]];
  if(flush&&straight)return [5,...high];
  if(straight)return [4,...high];
  if(flush)return [3,...r];
  if(pair)return [2,pair[0],r.find(n=>n!==pair[0])];
  return [1,...r];
}
export function compare(a,b){const x=score(a),y=score(b);for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return Math.sign((x[i]||0)-(y[i]||0));}return 0;}
