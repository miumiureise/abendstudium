export const words = text => text.normalize('NFKC').toLocaleLowerCase('de').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean);
export function compare(expected, actual) {
 const a=words(expected),b=words(actual),d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)d[i][0]=i; for(let j=0;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
 const diff=[];let i=a.length,j=b.length;
 while(i||j){if(i&&j&&d[i][j]===d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)){diff.unshift({expected:a[--i],actual:b[--j],ok:a[i]===b[j]});}else if(i&&d[i][j]===d[i-1][j]+1)diff.unshift({expected:a[--i],actual:'',ok:false});else diff.unshift({expected:'',actual:b[--j],ok:false});}
 return {score:Math.max(0,Math.round(100*(1-d[a.length][b.length]/Math.max(a.length,b.length,1)))),match:a.length>0&&d[a.length][b.length]===0,diff};
}
export function schedule(card, grade, now=new Date()) {
 if(!['again','hard','good'].includes(grade))throw Error('評価が不正です');
 const interval=grade==='again'?10/1440:grade==='hard'?Math.max(1,(card.interval||0)*1.2):card.interval>=1?Math.min(365,card.interval*2.5):1;
 return {...card,interval,reviews:(card.reviews||0)+1,due:new Date(+now+interval*86400000).toISOString()};
}
export const dayKey=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export function dueCards(state,now=new Date()) {const done=new Set(state.history.filter(h=>dayKey(h.at)===dayKey(now)).map(h=>h.cardId));return state.cards.filter(c=>new Date(c.due)<=now&&(!done.has(c.id)||c.interval<1)).sort((a,b)=>a.due.localeCompare(b.due)).filter(c=>done.has(c.id)||done.size<state.settings.daily).slice(0,Math.max(0,state.settings.daily-done.size)+state.cards.filter(c=>done.has(c.id)&&c.interval<1).length);}
export function parseCSV(text){const rows=[];let row=[],field='',quoted=false; text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field)throw Error('CSVの引用符が不正です');else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('CSVの引用符が閉じていません');row.push(field);if(row.some(Boolean))rows.push(row);if(!rows.length)return [];const headers=rows.shift();return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));}
export const csv = cards => ['german,japanese,grammar,vocabulary,category,level,audio',...cards.map(c=>['german','japanese','grammar','vocabulary','category','level','audio'].map(k=>'"'+String(c[k]||'').replace(/"/g,'""')+'"').join(','))].join('\r\n');
export function safeAudio(value){if(!value)return '';const u=new URL(value,'https://local.invalid/');if(u.protocol!=='https:'||value.startsWith('//'))throw Error('音声は相対パスまたは HTTPS URL を指定してください');return value;}
export function validateCards(cards){if(!Array.isArray(cards)||cards.length>2000)throw Error('例文は配列形式・2000件以内です');return cards.map(c=>{if(!c||typeof c.german!=='string'||!c.german.trim()||c.german.length>2000)throw Error('ドイツ語の例文が必要です（2000文字以内）');const out={};for(const k of ['german','japanese','grammar','vocabulary','category','audio']){out[k]=String(c[k]||'').slice(0,5000);}out.audio=safeAudio(out.audio);out.level=c.level==='B2'?'B2':'B1';return out;});}
