export const literatureTypes={story:'小説本文',expression:'重要表現',grammar_example:'文法例文',reading_practice:'重点音読練習'};
export const freshLiterature=()=>({lastChapter:1,lastType:'story',lastId:null,completed:[],practice:[],rate:1});
export function validateLiterature(value){
 if(value===undefined)return freshLiterature();
 if(!value||typeof value!=='object'||!Array.isArray(value.completed)||!Array.isArray(value.practice))throw Error('小説の進捗形式が不正です');
 if(!Number.isInteger(value.lastChapter)||value.lastChapter<1||value.lastChapter>5||!literatureTypes[value.lastType]||(value.lastId!==null&&typeof value.lastId!=='string'))throw Error('小説の再開位置が不正です');
 if(value.completed.some(id=>typeof id!=='string'))throw Error('学習済みIDが不正です');
 for(const p of value.practice)if(!p||typeof p.recordId!=='string'||typeof p.transcript!=='string'||!Number.isFinite(p.score)||p.score<0||p.score>100||!Number.isFinite(Date.parse(p.at)))throw Error('小説の練習結果が不正です');
 return {...value,completed:[...new Set(value.completed)],rate:[.7,.85,1,1.15].includes(value.rate)?value.rate:1};
}
export function selectRecords(records,chapter,type){return records.filter(r=>r.chapter===Number(chapter)&&r.type===type).sort((a,b)=>a.sequence-b.sequence);}
export function chapterProgress(records,completed,chapter,type=null){const ids=new Set(completed),items=records.filter(r=>r.chapter===chapter&&(!type||r.type===type)),done=items.filter(r=>ids.has(r.id)).length;return {done,total:items.length,percent:items.length?Math.round(done/items.length*100):0};}
export function locateRecord(records,progress){const items=selectRecords(records,progress.lastChapter,progress.lastType);return {items,index:Math.max(0,items.findIndex(r=>r.id===progress.lastId))};}
