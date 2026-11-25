// Optional manifest emitted by the local audio generator. Paths are relative to audio/.
let entries = {};
let request;

export function loadProfessorAudio() {
  request ??= fetch('./audio/manifest.json', {cache: 'no-cache'})
    .then(response => response.ok ? response.json() : null)
    .then(data => { entries = data?.version === 1 ? data.entries ?? {} : {}; })
    .catch(() => {});
  return request;
}

function readyPath(entry) {
  return entry?.status === 'ready' && typeof entry.path === 'string' &&
    /^(novel\/chapter_\d+\/|praise\/|encouragement\/|completion\/)[A-Za-z0-9_-]+\.mp3$/.test(entry.path)
    ? './audio/' + entry.path
    : '';
}

export function novelAudio(record) {
  const entry = entries[record.id];
  return entry?.text === record.german ? readyPath(entry) : '';
}

export function playProfessorFeedback({category, speech, container, fallbackPath = ''}) {
  const options = Object.values(entries).filter(entry => entry?.category === category && readyPath(entry));
  const clip = options[Math.floor(Math.random() * options.length)];
  const path = readyPath(clip) || fallbackPath;
  if (!path) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '教授の声を聴く';
  const status = document.createElement('small');
  status.setAttribute('role', 'status');
  container.append(button, status);
  const play = async () => {
    try {
      await speech.playFile(path, 0.9);
      status.textContent = '';
    } catch (error) {
      if (error?.name === 'AbortError') return;
      status.textContent = error?.name === 'NotAllowedError'
        ? 'ボタンを押すと再生できます。'
        : '音声を再生できません。画面のメッセージをご覧ください。';
    }
  };
  button.onclick = play;
  // SpeechRecognition callbacks and post-save callbacks may lack user activation.
  if (!navigator.userActivation || navigator.userActivation.isActive) void play();
}
