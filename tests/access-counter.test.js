import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ACCESS_CONFIG,createAccessRecorder} from '../src/access-counter.js';

test('GAS endpoint and recorder implementation match the square app',async t=>{
 let square;
 try {square=await readFile(new URL('../../tiling-checker/src/access-counter.js',import.meta.url),'utf8');}
 catch(error){if(error.code==='ENOENT'){t.skip('Sibling tiling-checker checkout is unavailable');return;}throw error;}
 const triangle=await readFile(new URL('../src/access-counter.js',import.meta.url),'utf8');
 assert.equal(triangle.replace("app:'triangle-tiling'","app:'tiling-checker'"),square);
});
test('one GET per document includes the exact app identifier and request options',async()=>{
 const calls=[];
 const record=createAccessRecorder((...args)=>{calls.push(args);return Promise.resolve();});
 for(let i=0;i<20;i++)record();
 await Promise.resolve();
 assert.equal(calls.length,1);
 const [url,options]=calls[0];
 assert.equal(new URL(url).origin,'https://script.google.com');
 assert.equal(new URL(url).pathname,new URL(ACCESS_CONFIG.endpoint).pathname);
 assert.equal(new URL(url).searchParams.get('app'),'triangle-tiling');
 assert.deepEqual(options,{method:'GET',mode:'no-cors',cache:'no-store',credentials:'omit',keepalive:true});
});
test('reload creates a new document recorder with exactly one new request',()=>{
 let count=0;
 const send=()=>{count++;return Promise.resolve();};
 const first=createAccessRecorder(send);first();first();
 assert.equal(count,1);
 const reload=createAccessRecorder(send);reload();reload();
 assert.equal(count,2);
});
test('synchronous and asynchronous failures never escape or retry',async()=>{
 for(const send of [()=>{throw Error('offline');},()=>Promise.reject(Error('offline'))]){
  let count=0;
  const record=createAccessRecorder((...args)=>{count++;return send(...args);});
  assert.doesNotThrow(record);
  await Promise.resolve();await Promise.resolve();
  assert.doesNotThrow(record);
  assert.equal(count,1);
 }
});
