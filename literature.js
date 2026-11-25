import {compare,safeAudio} from './core.js';
import {professor} from './character.js';
import {literatureTypes,freshLiterature,locateRecord,chapterProgress,selectRecords} from './literature-core.js';
import {literatureAudio} from './literature-audio.js';

export function createLiterature({getState,update,speech,notify,isCloud}) {
 const $=s=>document.querySelector(s);
 const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 let corpus=null,loading=null,current=null,renderKey='',pending=false,session=0;
 const progress=()=>getState().literature||freshLiterature();
 function professorState(mood,line){$('#lit-professor').src=professor.images[mood];$('#lit-professor').alt=professor.alt[mood];$('#lit-professor-line').textContent=line;}
 function controls(){const {items,index}=corpus?locateRecord(corpus.records,progress()):{items:[],index:0};
  $('#literature').querySelectorAll('button,select').forEach(b=>b.disabled=pending);
  $('#lit-prev').disabled=pending||index===0;$('#lit-next').disabled=pending||index===items.length-1||!items.length;
 }
 async function commit(mutator){if(pending)return false;const token=session;pending=true;controls();$('#lit-save-status').textContent='保存中…';try{await update(state=>{state.literature??=freshLiterature();mutator(state);});if(token!==session)return false;$('#lit-save-status').textContent=isCloud()?'Supabaseに保存しました。ほかの端末では再読み込みで続きを開けます。':'この端末に保存しました。';return true;}catch(e){if(token===session){$('#lit-save-status').textContent='未保存：'+e.message;notify(e.message);}return false;}finally{if(token===session){pending=false;refresh();}}}
 async function open(){
  if(!corpus){if(!loading){$('#lit-status').textContent='教材を読み込んでいます…';$('#lit-retry-load').hidden=true;loading=fetch('./data/mythos_novel_b1.json').then(r=>{if(!r.ok)throw Error('教材ファイルを読み込めません');return r.json();}).then(data=>{if(data.chapters?.length!==5||!Array.isArray(data.records))throw Error('教材形式が不正です');corpus=data;}).catch(e=>{$('#lit-status').textContent=e.message+'。通信状態と公開ファイルをご確認ください。';$('#lit-retry-load').hidden=false;}).finally(()=>loading=null);}await loading;}
  if(corpus){$('#lit-status').textContent=`B1 · 全5章 · ${corpus.records.length}件の対訳教材`;$('#lit-content').hidden=false;refresh();}
 }
 function refresh(){if(!corpus)return;const p=progress();const {items,index}=locateRecord(corpus.records,p);const record=items[index];if(!record)return;
  const nextKey=`${session}:${record.id}`;
  if(nextKey!==renderKey){speech.stop();$('#lit-transcript').value='';$('#lit-result').replaceChildren();$('#lit-japanese').hidden=false;$('#lit-translation-toggle').textContent='日本語訳を隠す −';$('#lit-translation-toggle').setAttribute('aria-expanded','true');$('#lit-grammar').open=false;$('#lit-speech-status').textContent=speech.recognitionSupported?'マイクはボタンを押したときだけ使用します。':'このブラウザは音声認識非対応です。Safariの通常タブ、または入力欄の標準音声入力をお試しください。';$('#lit-voice').textContent=literatureAudio[record.id]?'教授の録音音声を再生します。':'端末標準のドイツ語音声で読み上げます。';professorState('book','一文ずつ、物語を読み進めましょう。');renderKey=nextKey;}
  current=record;
  $('#lit-german').textContent=record.german;$('#lit-japanese').textContent=record.japanese;
  $('#lit-section').textContent=record.section?`${record.section}. ${record.section_title_de} ／ ${record.section_title_ja}`:record.grammar_heading||literatureTypes[record.type];
  $('#lit-position').textContent=`第${p.lastChapter}章 · ${index+1} / ${items.length} ${record.type==='story'?'文':'件'} · ${p.completed.includes(record.id)?'学習済み':'未学習'}`;
  $('#lit-type').value=p.lastType;$('#lit-rate').value=String(p.rate);$('#lit-language').value=getState().settings.language;
  $('#lit-resume-label').textContent=`第${p.lastChapter}章 · ${literatureTypes[p.lastType]} · ${index+1} / ${items.length}`;
  $('#lit-complete').textContent=index===items.length-1?'この文章を学習済みにする':'学習済みにして次へ';
  const chapters=$('#lit-chapters');chapters.replaceChildren();
  corpus.chapters.forEach(c=>{const stats=chapterProgress(corpus.records,p.completed,c.chapter),story=chapterProgress(corpus.records,p.completed,c.chapter,'story'),button=element('button',undefined,'chapter-choice');button.setAttribute('aria-pressed',String(c.chapter===p.lastChapter));button.append(element('small',`KAPITEL ${c.chapter}`),element('strong',c.title_de),element('span',c.title_ja),element('small',`重点文法：${c.grammar_tags}`),element('small',`全教材 ${stats.done}/${stats.total}（${stats.percent}%） · 本文 ${story.done}/${story.total}`));const bar=element('progress');bar.max=stats.total;bar.value=stats.done;bar.setAttribute('aria-label',`第${c.chapter}章の学習進捗`);button.append(bar);button.onclick=()=>choose(c.chapter,p.lastType);chapters.append(button);});
  const notes=$('#lit-grammar-text');notes.replaceChildren();
  // Interleave original explanations and bilingual examples by source paragraph.
  const entries=[...corpus.grammar_notes.filter(n=>n.chapter===p.lastChapter).map(n=>({...n,order:n.paragraph})),...corpus.records.filter(r=>r.chapter===p.lastChapter&&r.type==='grammar_example').map(r=>({order:r.source_paragraph_de,text:r.german+'\n'+r.japanese}))].sort((a,b)=>a.order-b.order);
  entries.forEach(n=>notes.append(element(n.text.startsWith('文法ポイント')?'h3':'p',n.text)));
  controls();
 }
 async function choose(chapter,type){if(pending)return;speech.stop();const record=selectRecords(corpus.records,chapter,type)[0];if(!record)return;await commit(s=>Object.assign(s.literature,{lastChapter:chapter,lastType:type,lastId:record.id}));}
 async function move(delta,complete=false){if(!current||pending)return;speech.stop();const {items,index}=locateRecord(corpus.records,progress()),id=current.id,atEnd=index===items.length-1;
  const ok=await commit(s=>{if(complete&&!s.literature.completed.includes(id))s.literature.completed.push(id);s.literature.lastId=items[Math.max(0,Math.min(items.length-1,index+delta))].id;});
  if(ok){if(complete&&atEnd)professorState('tea','この教材を最後まで読みましたね。\n少し休んでから、次の章へ。');$('#lit-german').focus({preventScroll:true});}
 }
 function startMic(){if(!current||pending)return;if(speech.recognizing){speech.stopRecognition();return;}const id=current.id,token=session;try{speech.startRecognition({lang:$('#lit-language').value,onStatus:active=>{$('#lit-mic').textContent=active?'■ 認識を停止':'♩ マイクで練習';if(active)$('#lit-speech-status').textContent='聴いています。表示された文章をドイツ語で話してください。';else if($('#lit-speech-status').textContent.startsWith('聴いています'))$('#lit-speech-status').textContent='認識を終了しました。再挑戦はマイクボタンを押してください。';},onError:message=>{$('#lit-speech-status').textContent=message;},onResult:text=>{if(token!==session||current?.id!==id||$('#literature').hidden)return;$('#lit-transcript').value=text;$('#lit-speech-status').textContent='認識しました。文章を比較しています。';void evaluate('recognition');}});}catch(e){$('#lit-speech-status').textContent=e.message;$('#lit-transcript').focus();}}
 async function evaluate(source){if(!current||pending)return;const transcript=$('#lit-transcript').value.trim();if(!transcript){notify('ドイツ語を入力または音読してください');return;}if(transcript.length>2000){notify('入力は2000文字以内です');return;}
  speech.stop();const record=current,token=session,result=compare(record.german,transcript),root=$('#lit-result');root.replaceChildren(element('p',`音声認識結果の一致度 ${result.score}%`,'score'));
  const diff=element('div',undefined,'diff');result.diff.forEach(d=>{const word=element('span',d.expected||'（追加）','token'+(d.ok?'':' miss'));if(!d.ok)word.append(element('small',`入力：${d.actual||'（なし）'}`));diff.append(word);});root.append(diff,element('p',result.match?professor.lines.praise:professor.lines.retry));professorState(result.match?'smile':'neutral',result.match?professor.lines.praise:professor.lines.retry);
  const saved=await commit(s=>s.literature.practice.push({id:crypto.randomUUID(),recordId:record.id,chapter:record.chapter,type:record.type,transcript,score:result.score,match:result.match,language:$('#lit-language').value,source,at:new Date().toISOString()}));
  if(token===session&&current?.id===record.id){root.append(element('small',saved?'練習結果を保存しました。':'練習結果は未保存です。状態を確認し、もう一度比較してください。'));}
 }
 $('#lit-retry-load').onclick=open;
 $('#lit-resume').onclick=async()=>{if(!current)return;await commit(s=>{s.literature.lastId=current.id;});$('#lit-reader').scrollIntoView({behavior:'smooth',block:'start'});};
 $('#lit-type').onchange=e=>choose(progress().lastChapter,e.target.value);
 $('#lit-prev').onclick=()=>move(-1);$('#lit-next').onclick=()=>move(1);$('#lit-complete').onclick=()=>move(1,true);
 $('#lit-translation-toggle').onclick=()=>{const hide=!$('#lit-japanese').hidden;$('#lit-japanese').hidden=hide;$('#lit-translation-toggle').textContent=hide?'日本語訳を表示 ＋':'日本語訳を隠す −';$('#lit-translation-toggle').setAttribute('aria-expanded',String(!hide));};
 $('#lit-play').onclick=async()=>{if(!current)return;try{const path=literatureAudio[current.id],rate=Number($('#lit-rate').value);if(path){await speech.playFile(safeAudio(path),rate);}else speech.speak(current.german,{lang:$('#lit-language').value,rate,onVoice:text=>$('#lit-voice').textContent=text,onError:notify});}catch(e){notify(e.message);}};
 $('#lit-stop').onclick=()=>speech.stop();$('#lit-mic').onclick=startMic;
 $('#lit-compare').onclick=()=>evaluate('input');
 $('#lit-retry').onclick=()=>{speech.stop();$('#lit-transcript').value='';$('#lit-result').replaceChildren();professorState('book','ゆっくりで大丈夫。もう一度、ご一緒に。');$('#lit-speech-status').textContent='マイクボタンを押して、もう一度話してください。';$('#lit-mic').focus();};
 $('#lit-rate').onchange=e=>{speech.stopAudio();const rate=Number(e.target.value);void commit(s=>s.literature.rate=rate);};
 $('#lit-language').onchange=e=>{speech.stop();const language=e.target.value;void commit(s=>s.settings.language=language);};
 function reset(){session++;pending=false;current=null;renderKey='';speech.stop();$('#lit-result').replaceChildren();$('#lit-transcript').value='';$('#lit-save-status').textContent='';}
 return {open,refresh,reset};
}
