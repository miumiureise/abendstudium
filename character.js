// 画像・台詞・録音音声はこのファイルで差し替えられます。
export const professor = {
  name: 'Professor Adler',
  title: 'あなたのドイツ語の家庭教師',
  images: {
    neutral: 'assets/professor-neutral.png',
    book: 'assets/professor-book.png',
    smile: 'assets/professor-smile.png',
    tea: 'assets/professor-tea.png'
  },
  alt: {
    neutral: '穏やかな表情で迎える銀髪のアドラー教授',
    book: '本を開き、解説を読み進めるアドラー教授',
    smile: '笑顔で手を差し出し、称賛するアドラー教授',
    tea: '紅茶を飲みながら、ひと休みするアドラー教授'
  },
  lines: {
    welcome: '少しずつ、確かな言葉に。\n今日も、ご一緒しましょう。',
    book: '言葉の仕組みを、ひとつずつ。\nこの一文を一緒に読み解きましょう。',
    praise: 'Ausgezeichnet! とてもよくできました。',
    retry: '大丈夫。違った単語を確かめて、もう一度ゆっくり。',
    tea: 'お疲れさまでした。\n次のレッスンまで、紅茶を一杯。'
  },
  audio: { praise: '', retry: '' }
};
