export function createCardPlayback({speech, findRecording, language}) {
  const unavailable = new Set();
  let request = 0;

  function stop() {
    request++;
    speech.stopAudio();
  }

  async function play(card, {rate, repeat, report}) {
    const token = ++request;
    const recorded = findRecording(card.german);
    const path = recorded || card.audio;
    if (path && !unavailable.has(path)) {
      report(recorded ? '教授の音声' : '登録済みの音声');
      try {
        // Invoke playFile directly from the click, before any async lookup.
        await speech.playFile(path, rate, {repeat});
      } catch (error) {
        if (token !== request || error.name === 'AbortError') return;
        if (['NotAllowedError', 'NotSupportedError', 'NetworkError'].includes(error.name)) {
          unavailable.add(path);
          report('録音を再生できませんでした。もう一度押すと端末音声で読み上げます。');
        } else {
          report(error.message || '録音を再生できませんでした。');
        }
      }
      return;
    }

    try {
      speech.speak(card.german, {
        lang: language(), rate, repeat,
        onVoice: () => report('端末のドイツ語音声'),
        onError: message => { if (token === request) report(message); }
      });
    } catch (error) {
      report(error.message || '読み上げを開始できませんでした。');
    }
  }

  return {stop, play};
}
