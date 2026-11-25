// Shared browser speech/audio lifecycle. Start recognition directly in a click handler.
export function createSpeechTools(env=window) {
  let audio=null,utterance=null,recognition=null,status=null,generation=0;
  const Recognition=env.SpeechRecognition||env.webkitSpeechRecognition;
  function stopAudio(){if(audio){audio.pause();audio.currentTime=0;audio=null;}utterance=null;env.speechSynthesis?.cancel();}
  function stopRecognition(){generation++;const old=recognition;recognition=null;if(old){old.onresult=null;old.onerror=null;old.onend=null;try{old.abort();}catch{}}const callback=status;status=null;callback?.(false);}
  function stop(){stopAudio();stopRecognition();}
  async function playFile(path,rate=1){stop();audio=new env.Audio(path);audio.playbackRate=rate;await audio.play();}
  function speak(text,{lang='de-AT',rate=1,onError=()=>{},onVoice=()=>{}}={}){
    stop();
    if(!env.speechSynthesis||!env.SpeechSynthesisUtterance)throw Error('このブラウザでは読み上げを利用できません。');
    const voices=env.speechSynthesis.getVoices();
    const voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase()==='de-de')||voices.find(v=>/^de[-_]/i.test(v.lang));
    const item=new env.SpeechSynthesisUtterance(text);utterance=item;
    item.lang=voice?.lang||lang;item.voice=voice||null;item.rate=rate;
    item.onerror=e=>{if(utterance===item&&!['canceled','interrupted'].includes(e.error))onError('読み上げを開始できません。端末のドイツ語音声と音量をご確認ください。');};
    item.onend=()=>{if(utterance===item)utterance=null;};
    onVoice(voice?`${voice.name}（${voice.lang}）`:'端末の標準音声（ドイツ語音声が未取得の場合は端末設定をご確認ください）');
    env.speechSynthesis.speak(item);
  }
  function startRecognition({lang='de-AT',onResult,onStatus=()=>{},onError=()=>{}}){
    stop();
    if(!Recognition)throw Error('このブラウザでは音声認識が利用できません。入力欄で端末標準の音声入力を使えます。');
    const item=new Recognition(),token=++generation;recognition=item;status=onStatus;
    item.lang=lang;item.interimResults=false;item.continuous=false;item.maxAlternatives=1;
    item.onresult=e=>{if(token!==generation)return;const text=Array.from(e.results).filter(r=>r.isFinal!==false).map(r=>r[0].transcript).join(' ');if(text){stopRecognition();onResult(text);}};
    item.onerror=e=>{if(token!==generation)return;stopRecognition();const messages={
      'not-allowed':'マイクが許可されていません。Safariのサイト設定を確認し、再度ボタンを押してください。',
      'service-not-allowed':'音声認識サービスを使用できません。Safariと端末の音声入力設定をご確認ください。',
      'no-speech':'声を聞き取れませんでした。もう一度マイクボタンを押してください。',
      'audio-capture':'マイクを使用できません。他の録音アプリを閉じてお試しください。',
      'language-not-supported':'この言語は未対応です。de-DEへ切り替えてお試しください。',
      'network':'音声認識サービスに接続できません。通信状態をご確認ください。',
      'aborted':'音声認識を停止しました。'
    };onError(messages[e.error]||`音声認識エラー：${e.error}`);};
    item.onend=()=>{if(token!==generation)return;recognition=null;status=null;onStatus(false);};
    try{item.start();onStatus(true);}catch(error){stopRecognition();throw Error('音声認識を開始できません。Safariの通常タブやマイク権限をご確認ください。');}
  }
  return {stop,stopAudio,stopRecognition,playFile,speak,startRecognition,recognitionSupported:!!Recognition,get recognizing(){return !!recognition;}};
}
