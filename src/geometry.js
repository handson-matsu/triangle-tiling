import {profile} from './marks.js';
import {isBack} from './appearance.js';
import {createPairs} from './pairing.js';
export {MARKS,COLORS} from './marks.js';
export const H=Math.sqrt(3)*100;
export const vertices=[[0,-2*H/3],[100,H/3],[-100,H/3]];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.join(',')}`).join(' ')+' Z';
export function triangleStructure(half=false,blankSplit=false,blank=2){
 const raw=vertices.flatMap((_,edge)=> (edge===blank?blankSplit:half)?[[0,.5],[.5,1]].map(([start,end],segment)=>({edge,start,end,segment,id:`${edge}:${start}-${end}`})):[{edge,start:0,end:1,segment:0,id:`${edge}:0-1`}]).map((p,index)=>({...p,index}));
 const groups=half?vertices.flatMap((_,edge)=>raw.filter(p=>p.edge===edge).length===2?[raw.filter(p=>p.edge===edge).map(p=>p.id)]:[]):[raw.filter(p=>p.edge!==blank).map(p=>p.id),...(blankSplit?[raw.filter(p=>p.edge===blank).map(p=>p.id)]:[])];
 return {raw,groups};
}
// Settings address physical source pieces; rendering addresses destination slots.
export function sourcePieces(state) {
 const {raw}=triangleStructure(state.half,state.blankSplit,state.blank);
 return raw.map(p=>{
  const pair=state.pairs.findIndex(g=>g.members.includes(p.id));
  return {...p,pair,half:pair<0?null:state.pairs[pair].members.indexOf(p.id)===0?'right':'left'};
 });
}
export function assembly(state) {
 const sources=sourcePieces(state);
 const halves=sources.filter(p=>p.end-p.start<1);
 const required=halves.length/2;
 const handedness=p=>p.segment ^ Number(Boolean(state.backs[p.index]));
 const first=halves.filter(p=>handedness(p)===0).length;
 if(first!==required) return {valid:false,message:`組立不可：裏返した後の区間1型が${first}枚、区間2型が${halves.length-first}枚です。それぞれ${required}枚になるよう別の半分ピースの表裏も変更してください。`,pieces:[]};
 const placements=new Map();
 // Keep every unturned piece in its original slot before placing turned ones.
 for(const p of sources)if(p.end-p.start===1||!state.backs[p.index]){placements.set(p.id,p);}
 for(const source of halves.filter(p=>state.backs[p.index])){
  const slots=halves.filter(slot=>!placements.has(slot.id)&&slot.segment===handedness(source));
  const destination=slots.find(p=>p.edge===source.edge)||slots[0];
  placements.set(destination.id,source);
 }
 return {valid:true,message:'',pieces:sources.map(slot=>{
  const source=placements.get(slot.id);
  return {...slot,pair:source.pair,half:source.half,index:source.index,sourceId:source.id,sourceEdge:source.edge,sourceSegment:source.segment};
 })};
}
export const pieces=state=>assembly(state).pieces;
export function configureTriangle(state,options={}) {
 const old=sourcePieces(state).map(p=>({...p,back:!!state.backs[p.index]}));
 Object.assign(state,options);
 const {raw,groups}=triangleStructure(state.half,state.blankSplit,state.blank);
 state.pairs=createPairs(groups,state.pairs);
 state.backs=raw.map(p=>(old.find(q=>q.id===p.id)||old.find(q=>q.edge===p.edge&&q.start<=p.start&&q.end>p.start))?.back||false);
}
export const pieceEnds=p=>[lerp(vertices[p.edge],vertices[(p.edge+1)%3],p.start),lerp(vertices[p.edge],vertices[(p.edge+1)%3],p.end)];
export const piecePolygon=p=>[[0,0],...pieceEnds(p)];
export function splitLines(state){return [...vertices.map(v=>[[0,0],v]),...vertices.flatMap((v,i)=>pieces(state).filter(p=>p.edge===i).length===2?[[[0,0],lerp(v,vertices[(i+1)%3],.5)]]:[])];}
export function pieceMark(state,p){const half=isBack(state,p.index)?(p.half==='right'?'left':'right'):p.half;const [a,b]=pieceEnds(p),d=half==='right'?-1:1;return {mark:p.pair<0?null:state.pairs[p.pair].mark,half,axis:[d*(b[0]-a[0]),d*(b[1]-a[1])]};}
export function pieceMarkPoints(state,p){const m=pieceMark(state,p);if(!m.mark)return [];const [a,b]=pieceEnds(p);return profile(m.mark).map(([x,y])=>{const span=['circle','star'].includes(m.mark)?.42:.55;const t=(1-span)/2+span*(m.half==='right'?1-y:y);const depth=.23*x;return [a[0]+(b[0]-a[0])*t-(b[1]-a[1])*depth,a[1]+(b[1]-a[1])*t+(b[0]-a[0])*depth];});}
// Grid orientation is a rotation; only an explicit flip reflects the paper.
export function transform(p,t){const angle=((t.rotation||0)*120+(t.down?180:0))*Math.PI/180,x=t.flip?-p[0]:p[0],y=p[1];return [Math.cos(angle)*x-Math.sin(angle)*y+(t.x||0),Math.sin(angle)*x+Math.cos(angle)*y+(t.y||0)];}
const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;
export const sameBoundary=(a,b)=>(near(a.ends[0],b.ends[0])&&near(a.ends[1],b.ends[1]))||(near(a.ends[0],b.ends[1])&&near(a.ends[1],b.ends[0]));
export function worldEdges(state,tile){return vertices.map((_,edge)=>({ends:[vertices[edge],vertices[(edge+1)%3]].map(p=>transform(p,tile)),segments:pieces(state).filter(p=>p.edge===edge).map(p=>{const m=pieceMark(state,p),o=transform([0,0],tile),v=transform(m.axis,tile);return {...m,half:tile.flip?(m.half==='right'?'left':'right'):m.half,axis:[v[0]-o[0],v[1]-o[1]],ends:pieceEnds(p).map(q=>transform(q,tile)),points:pieceMarkPoints(state,p).map(q=>transform(q,tile))};})}));}
export function marksMatch(a,b){if(!sameBoundary(a,b))return false;const aa=a.segments,bb=b.segments;
 // Unmarked boundaries match independently of subdivision.
 if(aa.every(m=>!m.mark)&&bb.every(m=>!m.mark))return true;
 return aa.length===bb.length&&aa.every(m=>bb.some(n=>{if(!sameBoundary(m,n)||m.mark!==n.mark)return false;if(!m.mark)return true;if(m.half===n.half||!near(m.axis,n.axis))return false;const [u,v]=m.ends,dx=v[0]-u[0],dy=v[1]-u[1],l=dx*dx+dy*dy;return m.points.length===n.points.length&&m.points.every((p,i)=>{const t=((p[0]-u[0])*dx+(p[1]-u[1])*dy)/l;return near([2*(u[0]+t*dx)-p[0],2*(u[1]+t*dy)-p[1]],n.points[i]);});}));}
export function checkTiling(state,tiles){if(!assembly(state).valid)return [];const edges=tiles.map(t=>worldEdges(state,t)),out=[];for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++)for(const a of edges[i])for(const b of edges[j])if(sameBoundary(a,b))out.push({i,j,a,b,match:marksMatch(a,b)});return out;}
export function initialTiles(){return Array.from({length:24},(_,i)=>{const row=Math.floor(i/8),col=i%8,down=col%2===1;return {x:col*100+(row%2)*100,y:row*H+(down?-H/3:0),down,rotation:0,flip:false};});}
