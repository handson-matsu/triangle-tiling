import assert from 'node:assert/strict';
import {triangleStructure,pieces,sourcePieces,assembly,configureTriangle,vertices,transform,piecePolygon,pieceMarkPoints,initialTiles,checkTiling,worldEdges,marksMatch,MARKS} from '../src/geometry.js';
import {createPairs} from '../src/pairing.js';
import {isBack,pieceAppearance} from '../src/appearance.js';
import {createAccessRecorder} from '../src/access-counter.js';
const state=(half=false,blankSplit=false,blank=2)=>({half,blankSplit,blank,pairs:createPairs(triangleStructure(half,blankSplit,blank).groups),backs:[],backColor:true});
const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;
export function runTests(register=(name,fn)=>fn()){let count=0;const test=(name,fn)=>{register(name,fn);count++;};
 test('Every legal split and blank configuration has real, unique pieces and pairs',()=>{for(let blank=0;blank<3;blank++)for(const half of [false,true])for(const split of [false,true]){const s=state(half,split,blank),pp=pieces(s);assert.equal(pp.length,3+(half?2:0)+(split?1:0));assert.equal(s.pairs.length,(half?2:1)+(split?1:0));assert.equal(new Set(s.pairs.map(p=>p.mark)).size,s.pairs.length);assert.equal(new Set(s.pairs.flatMap(p=>p.members)).size,s.pairs.length*2);for(const p of pp)assert.equal(piecePolygon(p).length,3);}});
 test('All six rigid transforms preserve the footprint of each grid slot',()=>{for(const down of [false,true])for(const flip of [false,true])for(let rotation=0;rotation<3;rotation++){const t={down,flip,rotation};const base=vertices.map(p=>transform(p,{down}));assert.ok(vertices.map(p=>transform(p,t)).every(p=>base.some(q=>near(p,q))));}});
 test('Three rotations and two reflections are identity; rotations preserve faces',()=>{const s=state();s.backs=[true,false,true];for(const p of vertices){assert.ok(near(transform(p,{rotation:3}),p));assert.ok(near(transform(transform(p,{flip:true}),{flip:true}),p));}for(let i=0;i<3;i++){assert.equal(isBack(s,i,{rotation:2}),s.backs[i]);assert.equal(isBack(s,i,{flip:true}),!s.backs[i]);}assert.equal(pieceAppearance(s,0,{}).background,'#DCE2E6');});
 test('24 tiles form 28 unique shared edges under every local rotation/reflection',()=>{for(let rotation=0;rotation<3;rotation++)for(const flip of [false,true]){const tiles=initialTiles().map(t=>({...t,rotation,flip})),r=checkTiling(state(),tiles);assert.equal(r.length,28);assert.equal(new Set(r.map(x=>[x.i,x.j].join(':'))).size,28);}});
 test('Marks remain inside their physical triangle pieces for all profiles and faces',()=>{const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);for(const half of [false,true])for(const split of [false,true])for(const mark of Object.keys(MARKS))for(const back of [false,true]){const s=state(half,split);s.pairs.forEach(p=>p.mark=mark);s.backs=Array(6).fill(back);for(const p of pieces(s)){const polygon=piecePolygon(p);for(const q of pieceMarkPoints(s,p))assert.ok(polygon.every((a,i)=>cross(a,polygon[(i+1)%3],q)>=-1e-6));}}});
 test('Reflection across a shared edge joins complementary halves; reversed position, same halves, wrong type and split mismatch fail',()=>{const s=state(true,true);for(const mark of Object.keys(MARKS)){s.pairs.forEach(p=>p.mark=mark);for(const face of [false,true]){s.backs=Array(6).fill(face);const a=worldEdges(s,{})[1];const b=worldEdges(s,{down:true,flip:true,y:2*Math.sqrt(3)*100/3})[1];assert.ok(marksMatch(a,b));const changed=structuredClone(b);changed.segments[0].mark='wrong';assert.equal(marksMatch(a,changed),false);const halves=structuredClone(b);halves.segments.forEach(m=>m.half=m.half==='right'?'left':'right');assert.equal(marksMatch(a,halves),false);const shifted=structuredClone(b);shifted.segments[0].points[0][0]+=1;assert.equal(marksMatch(a,shifted),false);assert.equal(marksMatch(a,{...b,segments:b.segments.slice(1)}),false);}}});
 test('Blank edges match blanks, including subdivided blanks, and reject marks',()=>{const a={ends:[[0,0],[1,0]],segments:[{mark:null,ends:[[0,0],[1,0]]}]};assert.ok(marksMatch(a,{...a,segments:[{mark:null},{mark:null}]}));assert.equal(marksMatch(a,{...a,segments:[{mark:'heart',ends:[[0,0],[1,0]]}]}),false);});
 test('Split and merge inherit the correct physical faces',()=>{const s=state();s.backs=[true,false,true];configureTriangle(s,{half:true,blankSplit:true});assert.deepEqual(s.backs,[true,true,false,false,true,true]);s.backs[1]=false;configureTriangle(s,{half:false,blankSplit:false});assert.deepEqual(s.backs,[true,false,true]);});
 test('Access recording is one GET per recorder even after failure',()=>{let calls=[];const send=(url,options)=>{calls.push({url,options});throw Error('offline');};const record=createAccessRecorder(send);record();record();assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).searchParams.get('app'),'triangle-tiling');assert.equal(calls[0].options.method,'GET');createAccessRecorder(send)();assert.equal(calls.length,2);});
 test('Every face combination either assembles each physical piece exactly once or is rejected',()=>{
  for(let blank=0;blank<3;blank++)for(const half of [false,true])for(const split of [false,true]){
   const s=state(half,split,blank),sources=sourcePieces(s),halves=sources.filter(p=>p.end-p.start<1);
   for(let mask=0;mask<2**sources.length;mask++){
    s.backs=sources.map(p=>Boolean(mask&(1<<p.index)));
    const expected=halves.filter(p=>(p.segment^Number(s.backs[p.index]))===0).length===halves.length/2;
    const result=assembly(s);assert.equal(result.valid,expected);
    if(!expected){assert.equal(result.pieces.length,0);assert.deepEqual(checkTiling(s,initialTiles()),[]);continue;}
    assert.equal(new Set(result.pieces.map(p=>p.sourceId)).size,sources.length);
    for(const p of result.pieces){const source=sources[p.index];if(p.end-p.start<1)assert.equal(p.segment,source.segment^Number(s.backs[p.index]));assert.equal(p.pair,source.pair);}
   }
  }
 });
 test('Moved half pieces are exact physical reflections and rotations, including their mark contours',()=>{
  const s=state(true,true),sources=sourcePieces(s);
  for(let mask=0;mask<64;mask++){
   s.backs=sources.map(p=>Boolean(mask&(1<<p.index)));const result=assembly(s);if(!result.valid)continue;
   for(const destination of result.pieces){
    const source=sources[destination.index];
    const angle=(source.edge*120-30)*Math.PI/180,n=[Math.cos(angle),Math.sin(angle)];
    const rigid=p=>{const dot=p[0]*n[0]+p[1]*n[1];const q=s.backs[source.index]?[2*dot*n[0]-p[0],2*dot*n[1]-p[1]]:p;return transform(q,{rotation:destination.edge-source.edge});};
    const original={...s,backs:[]};
    const shape=piecePolygon(source).map(rigid),target=piecePolygon(destination);
    assert.ok(shape.every(p=>target.some(q=>near(p,q))));
    const marks=pieceMarkPoints(original,source).map(rigid),actual=pieceMarkPoints(s,destination);
    assert.ok(marks.every((p,i)=>near(p,actual[i])));
   }
  }
 });
 test('An isolated flipped half is rejected and an opposite half can restore assembly by exchange',()=>{
  const s=state(true,true);s.backs[0]=true;assert.equal(assembly(s).valid,false);
  s.backs[3]=true;const result=assembly(s);assert.equal(result.valid,true);
  assert.ok(result.pieces.some(p=>p.sourceEdge!==p.edge));
 });
 return `${count} test groups passed`;}
