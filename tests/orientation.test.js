import test from 'node:test';
import assert from 'node:assert/strict';
import {initialTiles,transform,worldEdges,triangleStructure,checkTiling} from '../src/geometry.js';
import {createPairs} from '../src/pairing.js';
import {pieceAppearance} from '../src/appearance.js';
import {handAppearance,handLandmarks,tileTransform} from '../src/hand.js';
const state=()=>({half:false,blankSplit:false,blank:2,pairs:createPairs(triangleStructure().groups),backs:[false,false,false],backColor:true});
const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;
test('Both lattice directions start on the front, with white paper and orange hands',()=>{
 const tiles=initialTiles(),s=state();
 assert.ok(tiles.some(t=>t.down)&&tiles.some(t=>!t.down));
 for(const t of tiles){
  assert.equal(t.flip,false);
  assert.equal(handAppearance(t).fill,'#F5C49B');
  for(let i=0;i<3;i++)assert.equal(pieceAppearance(s,i,t).background,'#FFFFFF');
 }
 assert.equal(checkTiling(s,tiles).length,28);
});
test('Downward placement rotates every mark and hand coordinate by 180 degrees without reflection',()=>{
 const s=state(),up={rotation:0,flip:false},down={...up,down:true};
 const a=worldEdges(s,up),b=worldEdges(s,down);
 for(let i=0;i<3;i++){
  for(let j=0;j<2;j++)assert.ok(near(b[i].ends[j],a[i].ends[j].map(v=>-v)));
  a[i].segments.forEach((m,k)=>{
   const n=b[i].segments[k];assert.equal(n.half,m.half);
   assert.ok(near(n.axis,m.axis.map(v=>-v)));
   m.points.forEach((p,j)=>assert.ok(near(n.points[j],p.map(v=>-v))));
  });
 }
 for(const [name,p] of Object.entries(handLandmarks(up)))assert.ok(near(handLandmarks(down)[name],p.map(v=>-v)));
 assert.equal(tileTransform(down),'translate(0 0) rotate(180) scale(1 1)');
});
test('Only explicit flips change face and handedness; all 120 degree rotations preserve them',()=>{
 const s=state();
 for(const down of [false,true])for(let rotation=0;rotation<3;rotation++){
  const front={down,rotation,flip:false},back={...front,flip:true};
  assert.equal(handAppearance(front).fill,'#F5C49B');
  assert.equal(handAppearance(back).fill,'#B7D9E8');
  for(let i=0;i<3;i++){
   assert.equal(pieceAppearance(s,i,front).back,false);
   assert.equal(pieceAppearance(s,i,back).background,'#DCE2E6');
  }
  // Reflection changes the chirality of the asymmetric hand in both grid directions.
  const origin=transform([0,0],front),x=transform([1,0],front),y=transform([0,1],front);
  const cross=(x[0]-origin[0])*(y[1]-origin[1])-(x[1]-origin[1])*(y[0]-origin[0]);
  const bx=transform([1,0],back),by=transform([0,1],back);
  assert.ok(cross>0);
  assert.ok((bx[0]-origin[0])*(by[1]-origin[1])-(bx[1]-origin[1])*(by[0]-origin[0])<0);
 }
});
