// Shared browser speech/audio lifecycle. Only a user's mic click calls start().
const START_TIMEOUT = 15000;
const LISTEN_TIMEOUT = 30000;
const END_TIMEOUT = 2500;

const recognitionErrors = {
  'not-allowed': 'マイクが許可されていません。Safariのサイト設定を確認し、再度ボタンを押してください。',
  'service-not-allowed': '音声認識サービスを使用できません。Safariと端末の音声入力設定をご確認ください。',
  'no-speech': '声を聞き取れませんでした。もう一度マイクボタンを押してください。',
  'audio-capture': 'マイクを使用できません。他の録音アプリを閉じてお試しください。',
  'language-not-supported': 'この言語は未対応です。de-DEへ切り替えてお試しください。',
  network: '音声認識サービスに接続できません。通信状態をご確認ください。',
  aborted: '音声認識を停止しました。'
};

export function createSpeechTools(env = window) {
  let audio = null;
  let utterance = null;
  let session = null;
  const Recognition = env.SpeechRecognition || env.webkitSpeechRecognition;
  const clock = env.setTimeout ? env : globalThis;

  function releaseAudio() {
    const previous = audio;
    audio = null;
    if (!previous) return;
    previous.onended = null;
    previous.pause();
    previous.removeAttribute('src');
    previous.load();
  }

  function stopAudio() {
    releaseAudio();
    if (utterance) {
      utterance = null;
      env.speechSynthesis?.cancel();
    }
  }

  function arm(attempt, delay, action) {
    clock.clearTimeout(attempt.timer);
    attempt.timer = clock.setTimeout(() => {
      if (session === attempt) action();
    }, delay);
  }

  function finish(attempt) {
    if (session !== attempt) return;
    session = null;
    clock.clearTimeout(attempt.timer);
    const { recognizer } = attempt;
    recognizer.onstart = null;
    recognizer.onresult = null;
    recognizer.onerror = null;
    recognizer.onend = null;
    if (!attempt.stopReported) attempt.onStatus(false);
    if (!attempt.cancelled && attempt.transcript) attempt.onResult(attempt.transcript);
  }

  function close(attempt, { abort }) {
    if (session !== attempt || attempt.phase === 'closing') return;
    attempt.phase = 'closing';
    // Keep the session until onend. Some engines omit it after an error or abort.
    arm(attempt, END_TIMEOUT, () => finish(attempt));
    if (abort) {
      try { attempt.recognizer.abort(); } catch { finish(attempt); }
    }
  }

  function stopRecognition() {
    const attempt = session;
    if (!attempt || attempt.cancelled) return;
    attempt.cancelled = true;
    attempt.stopReported = true;
    attempt.onStatus(false);
    // A final-result session is already winding down. Discard its text without
    // aborting it mid-teardown. Navigation before a result must stop capture.
    if (attempt.phase !== 'finishing') close(attempt, { abort: true });
  }

  function stop() {
    stopAudio();
    stopRecognition();
  }

  function preparePlayback() {
    stop();
    if (session) throw Error('マイクの終了処理中です。少し待ってから、音声をもう一度再生してください。');
  }

  async function playFile(path, rate = 1, { repeat = false } = {}) {
    preparePlayback();
    const item = new env.Audio(path);
    audio = item;
    item.preservesPitch = true;
    item.playbackRate = rate;
    item.loop = repeat;
    item.onended = () => { if (audio === item) releaseAudio(); };
    try {
      await item.play();
    } catch (error) {
      if (audio !== item) {
        throw new DOMException('再生を停止しました。', 'AbortError');
      }
      releaseAudio();
      throw error;
    }
  }

  function speak(text, { lang = 'de-AT', rate = 1, repeat = false, onError = () => {}, onVoice = () => {} } = {}) {
    preparePlayback();
    if (!env.speechSynthesis || !env.SpeechSynthesisUtterance) {
      throw Error('このブラウザでは読み上げを利用できません。');
    }
    const voices = env.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase())
      || voices.find(v => v.lang.toLowerCase() === 'de-de')
      || voices.find(v => /^de[-_]/i.test(v.lang));
    function say() {
      const item = new env.SpeechSynthesisUtterance(text);
      utterance = item;
      item.lang = voice?.lang || lang;
      item.voice = voice || null;
      item.rate = rate;
      item.onerror = event => {
        if (utterance !== item) return;
        utterance = null;
        if (!['canceled', 'interrupted'].includes(event.error)) {
          onError('読み上げを開始できません。端末のドイツ語音声と音量をご確認ください。');
        }
      };
      item.onend = () => {
        if (utterance !== item) return;
        utterance = null;
        if (repeat) say();
      };
      env.speechSynthesis.speak(item);
    }
    onVoice(voice ? `${voice.name}（${voice.lang}）`
      : '端末の標準音声（ドイツ語音声が未取得の場合は端末設定をご確認ください）');
    say();
  }

  function startRecognition({ lang = 'de-AT', onResult, onStatus = () => {}, onError = () => {} }) {
    if (!Recognition) {
      throw Error('このブラウザでは音声認識が利用できません。入力欄で端末標準の音声入力を使えます。');
    }
    if (session) {
      // An async auto-start could lose Safari's user activation. Only retry
      // from a fresh tap, after the old browser session has closed.
      throw Error('前回のマイクの終了処理中です。少し待ってから、もう一度押してください。');
    }
    stopAudio();
    const recognizer = new Recognition();
    const attempt = {
      recognizer, onStatus, onResult, phase: 'starting',
      transcript: '', cancelled: false, stopReported: false
    };
    session = attempt;
    recognizer.lang = lang;
    recognizer.interimResults = false;
    recognizer.continuous = false;
    recognizer.maxAlternatives = 1;

    function timeOut(message) {
      close(attempt, { abort: true });
      onError(message);
    }

    recognizer.onstart = () => {
      if (session !== attempt || attempt.phase !== 'starting') return;
      attempt.phase = 'listening';
      arm(attempt, LISTEN_TIMEOUT, () => timeOut('音声認識が時間内に終わりませんでした。もう一度マイクボタンを押してください。'));
      onStatus(true);
    };
    recognizer.onresult = event => {
      if (session !== attempt || attempt.cancelled ||
          !['starting', 'listening'].includes(attempt.phase)) return;
      const transcript = Array.from(event.results)
        .filter(result => result.isFinal !== false)
        .map(result => result[0]?.transcript)
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!transcript) return;
      attempt.transcript = transcript;
      attempt.phase = 'finishing';
      // With continuous=false, WebKit ends this session naturally after the
      // final result. Let it release the input before grading or playing praise.
      arm(attempt, END_TIMEOUT, () => close(attempt, { abort: true }));
    };
    recognizer.onerror = event => {
      if (session !== attempt || attempt.phase === 'closing') return;
      const reportError = !attempt.cancelled && !attempt.transcript;
      close(attempt, { abort: false });
      if (reportError) onError(recognitionErrors[event.error] || `音声認識エラー：${event.error}`);
    };
    recognizer.onend = () => finish(attempt);

    arm(attempt, START_TIMEOUT, () => timeOut('マイクが時間内に開始しませんでした。権限を確認し、もう一度押してください。'));
    try {
      recognizer.start();
    } catch {
      finish(attempt);
      throw Error('音声認識を開始できません。Safariの通常タブやマイク権限をご確認ください。');
    }
  }

  return {
    stop, stopAudio, stopRecognition, playFile, speak, startRecognition,
    recognitionSupported: !!Recognition,
    get recognizing() { return !!session && !session.cancelled && session.phase !== 'closing'; }
  };
}
