import {placeFlipButton} from './floating-flip.js';
import {appendMismatchLayer} from './mismatch.js';
import {HAND_PARTS,handAppearance,tileTransform} from './hand.js';
import {recordAccessOnce} from './access-counter.js';
import {pieceAppearance} from './appearance.js';
import {pairLabel,createPairs} from './pairing.js';
import {MARKS,COLORS,pieces,sourcePieces,assembly,piecePolygon,splitLines,triangleStructure,configureTriangle,vertices,transform,pieceMarkPoints,path,checkTiling,initialTiles} from './geometry.js';
const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg';
const defaults=()=>({half:false,blankSplit:false,blank:2,pairs:createPairs(triangleStructure().groups),backs:[false,false,false],backColor:true,showHand:true});
let state=defaults(),tiles=initialTiles(),selected=null;
let showMismatches=true;
const names=['右斜辺','底辺','左斜辺'];
function el(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;}
function drawTile(parent,tile,{interactive=false,index=0}={}){const outer=el('g',{transform:tileTransform(tile)});parent.append(outer);if(interactive){outer.setAttribute('role','button');outer.setAttribute('tabindex','0');outer.setAttribute('data-tile',index);outer.setAttribute('aria-pressed',selected===index);outer.setAttribute('aria-label',`タイル${index+1}、${selected===index?'選択中、押すと120度回転':'押すと選択'}`);const click=()=>{if(selected===index){tiles[index].rotation=(tiles[index].rotation+1)%3;}else{selected=index;}render();};outer.addEventListener('click',event=>{event.stopPropagation();click();});outer.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();click();}});}
// White triangular paper, with colored marks entirely inside its boundary.
outer.append(el('path',{d:path(vertices),fill:'#fff'}));
// All piece backgrounds are painted before marks and cutting lines.
const active=pieces(state);
for(const piece of active){
  const background=el('path',{d:path(piecePolygon(piece)),fill:pieceAppearance(state,piece.index,tile).background,'data-piece-background':piece.index});
  outer.append(background);
}
for(const piece of active){
  const pair=state.pairs[piece.pair];
  if(!pair)continue;
  const appearance=pieceAppearance(state,piece.index,tile,pair.color);
  outer.append(el('path',{d:path(pieceMarkPoints(state,piece)),fill:appearance.markColor,stroke:'#263238','stroke-width':1.5,'stroke-linejoin':'round','data-piece-mark':piece.index,'pointer-events':interactive?'auto':'none'}));

}
for(const [a,b] of splitLines(state)){
  outer.append(el('path',{d:`M${a} L${b}`,stroke:'#5c666b','stroke-width':1,'stroke-dasharray':'4 4','data-cut-line':'true','pointer-events':'none'}));
}
if(state.showHand){
 const hand=el('g',{'data-hand':'true','pointer-events':'none',...handAppearance(tile),'stroke-width':1.6,'stroke-linejoin':'round','stroke-linecap':'round','aria-hidden':'true'});
 for(const part of HAND_PARTS)hand.append(el(part.tag,part.attrs));
 outer.append(hand);
}
outer.append(el('path',{d:path(vertices),fill:'none',stroke:'#263238','stroke-width':1.5,'pointer-events':'none'}));
return outer;}
function svg(box){return el('svg',{xmlns:NS,viewBox:box,'aria-label':'白い正三角形と色付きの半分のマーク'});}
function render(){
const physical=assembly(state),count=sourcePieces(state).length;
renderPieceFaceButtons();
$('#assembly-status').textContent=physical.message;
$('#assembly-status').className=physical.valid?'hint':'assembly-error';
$('#save-tile').disabled=$('#save-board').disabled=$('#flip').disabled=$('#one-reset').disabled=!physical.valid;
if(!physical.valid){
 $('#preview').replaceChildren();$('#board').replaceChildren();
 updateFloatingFlip();
 $('#status').textContent='実物の紙で組み立てられる表裏の組み合わせを選んでください。';
 $('#selection').textContent='組立不可の設定ではタイル操作・PNG保存を停止します。';
 return;
}
const moved=physical.pieces.filter(p=>p.sourceId!==p.id);
$('#assembly-status').textContent=moved.length?'実物で組立可能。移動：'+moved.map(p=>`${pieceName(sourcePieces(state).find(q=>q.id===p.sourceId))} → ${pieceName(p)}`).join(' ／ '):'実物で組立可能。各ピースは元の位置にあります。';$('.badge').textContent=`正三角形 · ${count}ピース`;$('#piece-description').textContent=`点線に沿って切り分ける${count}枚のパーツ`;const p=svg('-130 -140 260 230');drawTile(p,{rotation:0,flip:false});$('#preview').replaceChildren(p);const b=svg('-125 -170 1050 670');tiles.forEach((t,i)=>drawTile(b,t,{interactive:true,index:i}));const results=checkTiling(state,tiles);const t=selected===null?null:tiles[selected];if(t)b.append(el('path',{d:path(vertices.map(p=>transform(p.map(v=>v*.92),t))),fill:'none',stroke:'#233f49','stroke-width':3,'stroke-dasharray':'12 7','pointer-events':'none','data-selection':'true'}));appendMismatchLayer(b,results,showMismatches,el);$('#show-mismatches').checked=showMismatches;$('#board').replaceChildren(b);const good=results.filter(r=>r.match).length;$('#status').textContent=`隣接する${results.length}辺中 ${good}辺が一致 ／ ${results.length-good}辺が不一致`;$('#flip').disabled=!t;$('#one-reset').disabled=!t;$('#selection').textContent=t?`選択：${Math.floor(selected/8)+1}行 ${selected%8+1}列 · ${t.rotation*120}° · ${t.flip?'裏返し':'通常'}`:'タイルを選択してください。選択中のタイルを再度押すと120°回転します。';updateFloatingFlip();}
function pieceName(piece){return names[piece.edge]+(piece.end-piece.start<1?`・区間${piece.segment+1}`:'');}
function setPieceBack(index,back){
 state.backs[index]=back;
 const checkbox=$(`#piece-back-${index}`);
 if(checkbox)checkbox.checked=back;
 render();
}
function renderPieceFaceButtons(){
 const host=$('#piece-face-buttons'),active=sourcePieces(state);
 const structure=active.map(p=>p.id).join('|');
 if(host.dataset.structure!==structure){
  host.replaceChildren();
  active.forEach(piece=>{
   const button=document.createElement('button');button.type='button';button.dataset.pieceFace=piece.index;
   button.append(document.createElement('span'),document.createElement('strong'));
   button.onclick=()=>setPieceBack(piece.index,!state.backs[piece.index]);
   host.append(button);
  });
  host.dataset.structure=structure;
 }
 active.forEach(piece=>{
  const button=host.children[piece.index],back=Boolean(state.backs[piece.index]);
  const name=`${pieceName(piece)}（${piece.pair<0?'マークなし':pairLabel(piece.pair)}）`;
  button.firstElementChild.textContent=name;
  button.lastElementChild.textContent=back?'裏':'表';
  button.setAttribute('aria-pressed',String(back));
  button.setAttribute('aria-label',`${name}：${back?'裏':'表'}。押すと${back?'表':'裏'}にする`);
 });
}
function controls(){
 const active=sourcePieces(state),host=$('#pairs');host.replaceChildren();
 state.pairs.forEach((pair,i)=>{
  const f=document.createElement('fieldset'),l=document.createElement('legend');l.textContent=`ペア${pairLabel(i)}`;f.append(l);
  const members=document.createElement('p');members.className='hint';members.textContent=pair.members.map(id=>pieceName(active.find(p=>p.id===id))).join(' ＋ ');f.append(members);
  const label=document.createElement('label');label.textContent='マーク';
  const select=document.createElement('select');select.id=`pair-mark-${i}`;
  for(const [key,m]of Object.entries(MARKS)){const option=document.createElement('option');option.value=key;option.textContent=m.name;select.append(option);}
  select.value=pair.mark;select.onchange=()=>{pair.mark=select.value;render();};label.append(select);f.append(label);
  const colors=document.createElement('div');colors.className='swatches';colors.setAttribute('role','group');colors.setAttribute('aria-label',`ペア${pairLabel(i)}の色`);
  COLORS.forEach((color,n)=>{const btn=document.createElement('button');btn.className='swatch';btn.style.background=color;btn.setAttribute('aria-label',['ローズ','ブルー','グリーン','イエロー','パープル','ターコイズ','オレンジ','ブラウン'][n]);btn.setAttribute('aria-pressed',pair.color===color);btn.onclick=()=>{pair.color=color;controls();render();};colors.append(btn);});f.append(colors);host.append(f);
 });
 $('#blank').value=state.blank;$('#half').checked=state.half;$('#blank-split').checked=state.blankSplit;
 $('#backs').replaceChildren();
 active.forEach(piece=>{
  const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.checked=state.backs[piece.index];input.id=`piece-back-${piece.index}`;
  input.onchange=()=>setPieceBack(piece.index,input.checked);label.append(input,`${pieceName(piece)}（${piece.pair<0?'マークなし':pairLabel(piece.pair)}）を裏返す`);$('#backs').append(label);
 });
 $('#back-color').checked=state.backColor;$('#show-hand').checked=state.showHand;
}
function reconfigure(options){configureTriangle(state,options);controls();render();}
$('#show-mismatches').onchange=e=>{showMismatches=e.target.checked;render();};
$('#show-hand').onchange=e=>{state.showHand=e.target.checked;render();};
$('#half').onchange=e=>reconfigure({half:e.target.checked});
$('#blank-split').onchange=e=>reconfigure({blankSplit:e.target.checked});
$('#blank').onchange=e=>reconfigure({blank:Number(e.target.value)});
$('#back-color').onchange=e=>{state.backColor=e.target.checked;render();};$('#settings-reset').onclick=()=>{state=defaults();controls();render();};$('#flip').onclick=flipSelectedTile;$('#one-reset').onclick=()=>{if(selected===null||!assembly(state).valid)return;Object.assign(tiles[selected],{rotation:0,flip:false});render();};$('#all-reset').onclick=()=>{tiles=initialTiles();selected=null;render();};
function flipSelectedTile(){
 if(selected===null||!assembly(state).valid)return;
 tiles[selected].flip=!tiles[selected].flip;
 render();
}
$('#floating-flip').addEventListener('click',event=>{
 event.stopPropagation();
 flipSelectedTile();
});
function updateFloatingFlip(){
 const button=$('#floating-flip');
 const tile=selected===null?null:$(`#board [data-tile="${selected}"]`);
 if(!tile){button.hidden=true;return;}
 const rect=tile.getBoundingClientRect(),shell=$('#board-shell').getBoundingClientRect();
 const viewport=window.visualViewport;
 const screen={left:viewport?.offsetLeft||0,top:viewport?.offsetTop||0,right:(viewport?.offsetLeft||0)+(viewport?.width||innerWidth),bottom:(viewport?.offsetTop||0)+(viewport?.height||innerHeight)};
 if(rect.bottom<=screen.top||rect.top>=screen.bottom||rect.right<=screen.left||rect.left>=screen.right){button.hidden=true;return;}
 button.hidden=false;
 const bounds={left:Math.max(shell.left,screen.left+8),right:Math.min(shell.right,screen.right-8),top:Math.max(shell.top,screen.top+8),bottom:Math.min(shell.bottom,screen.bottom-8)};
 if(bounds.right-bounds.left<button.offsetWidth||bounds.bottom-bounds.top<button.offsetHeight){button.hidden=true;return;}
 const pos=placeFlipButton(rect,bounds,{width:button.offsetWidth,height:button.offsetHeight});
 button.style.left=`${pos.left-shell.left}px`;
 button.style.top=`${pos.top-shell.top}px`;
 button.dataset.side=pos.side;
}
let floatingFrame=null;
function scheduleFloatingFlip(){
 if(floatingFrame!==null)return;
 floatingFrame=requestAnimationFrame(()=>{floatingFrame=null;updateFloatingFlip();});
}
window.addEventListener('resize',scheduleFloatingFlip);
window.addEventListener('scroll',scheduleFloatingFlip,{capture:true,passive:true});
window.visualViewport?.addEventListener('resize',scheduleFloatingFlip);
window.visualViewport?.addEventListener('scroll',scheduleFloatingFlip);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleFloatingFlip).observe($('#board-shell'));
// Keep action/settings controls usable without clearing the selected tile.
document.addEventListener('click',event=>{
  if(event.target.closest('#board [data-tile],#preview,button,input,select,label,aside'))return;
  if(selected!==null){selected=null;render();}
});
export async function exportPNG(source,filename,size){const copy=source.cloneNode(true);copy.querySelectorAll('[data-selection],[data-editor-selection]').forEach(e=>e.remove());copy.setAttribute('width',size);copy.setAttribute('height',size*source.viewBox.baseVal.height/source.viewBox.baseVal.width);const blob=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size*source.viewBox.baseVal.height/source.viewBox.baseVal.width;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error('PNGを作成できませんでした');const link=document.createElement('a'),download=URL.createObjectURL(png);link.href=download;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(download),10000);return png;}finally{URL.revokeObjectURL(url);}}
for(const [id,target,name,size]of [['save-tile','preview','tile.png',1800],['save-board','board','tiling.png',3200]])$("#"+id).onclick=async()=>{try{if(!assembly(state).valid)return;await exportPNG($("#"+target+' svg'),name.replace('.png',`-${pieces(state).length}pieces.png`),size);$('#export-status').textContent='PNG画像を保存しました。';}catch(error){$('#export-status').textContent='保存できませんでした。もう一度お試しください。';console.error(error);}};
controls();render();
recordAccessOnce();
