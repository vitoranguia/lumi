const OPENAI_MODEL = 'gpt-4o-mini';

const composer = document.querySelector('#composer');
const input = document.querySelector('#questionInput');
const messages = document.querySelector('#messages');
const micButton = document.querySelector('#micButton');
const clearButton = document.querySelector('#clearButton');
const avatar = document.querySelector('#avatar');
const connectionLabel = document.querySelector('#connectionLabel');
const recordingIndicator = document.querySelector('#recordingIndicator');
const apiModal = document.querySelector('#apiModal');
const apiKeyInput = document.querySelector('#apiKeyInput');
const startButton = document.querySelector('#startButton');
const demoButton = document.querySelector('#demoButton');
const topicButtons = document.querySelectorAll('.topic-chip');

const conversation = [];
let openaiApiKey = '';
let recognition;
let isListening = false;

function closeApiModal(apiKey) {
  openaiApiKey = apiKey.trim();
  apiModal.hidden = true;
  input.focus();
}

startButton.addEventListener('click', () => closeApiModal(apiKeyInput.value));
demoButton.addEventListener('click', () => closeApiModal(''));
apiKeyInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') closeApiModal(apiKeyInput.value);
});

function addMessage(author, text) {
  const message = document.createElement('article');
  message.className = `message message-${author === 'Lumi' ? 'lumi' : 'user'}`;
  message.innerHTML = author === 'Lumi'
    ? `<div class="message-avatar">✦</div><div><span class="message-author">Lumi</span><p></p></div>`
    : `<div><span class="message-author">Você</span><p></p></div><div class="message-avatar">●</div>`;
  message.querySelector('p').textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

function setBusy(busy) {
  avatar.classList.toggle('thinking', busy);
  if (!isListening) connectionLabel.textContent = busy ? 'Lumi está pensando...' : 'pronta para conversar';
}

function setRecordingState(recording) {
  isListening = recording;
  micButton.classList.toggle('listening', recording);
  recordingIndicator.hidden = !recording;
  micButton.setAttribute('aria-pressed', String(recording));
  micButton.setAttribute('aria-label', recording ? 'Parar gravação' : 'Falar com a Lumi');
  micButton.title = recording ? 'Parar gravação' : 'Falar com a Lumi';
  if (recording) connectionLabel.textContent = 'estou ouvindo...';
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.03;
  window.speechSynthesis.speak(utterance);
}

async function askLumi(question) {
  if (!question.trim()) return;
  addMessage('Você', question);
  conversation.push({ role: 'user', content: question });
  input.value = '';
  setBusy(true);

  if (!openaiApiKey) {
    const demoAnswer = 'Sua pergunta chegou! Recarregue a página e informe uma chave da OpenAI para ativar minhas respostas.';
    addMessage('Lumi', demoAnswer);
    setBusy(false);
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.6,
        max_tokens: 220,
        messages: [
          { role: 'system', content: 'Você é Lumi, uma tutora simpática para alunos dos primeiros anos do ensino médio no Brasil. Explique em português do Brasil, com clareza, exemplos curtos e incentivo ao raciocínio. Não faça a tarefa inteira sem explicar. Seja breve e respeitosa.' },
          ...conversation.slice(-8)
        ]
      })
    });

    if (!response.ok) throw new Error(`OpenAI respondeu com status ${response.status}`);
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || 'Não consegui montar uma resposta agora.';
    conversation.push({ role: 'assistant', content: answer });
    addMessage('Lumi', answer);
    speak(answer);
  } catch (error) {
    console.error(error);
    addMessage('Lumi', 'Tive um problema para acessar a IA. Confira sua chave e a conexão com a internet.');
  } finally {
    setBusy(false);
  }
}

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  askLumi(input.value);
});

topicButtons.forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.prompt;
    input.focus();
  });
});

clearButton.addEventListener('click', () => {
  conversation.length = 0;
  messages.innerHTML = '<article class="message message-lumi"><div class="message-avatar">✦</div><div><span class="message-author">Lumi</span><p>Conversa limpa. Qual vai ser a próxima descoberta?</p></div></article>';
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onstart = () => setRecordingState(true);
  recognition.onresult = (event) => { input.value = event.results[0][0].transcript; askLumi(input.value); };
  recognition.onerror = () => { setRecordingState(false); connectionLabel.textContent = 'não consegui ouvir'; };
  recognition.onend = () => { setRecordingState(false); if (avatar.classList.contains('thinking')) connectionLabel.textContent = 'Lumi está pensando...'; };
  micButton.addEventListener('click', () => { if (isListening) recognition.stop(); else recognition.start(); });
} else {
  micButton.disabled = true;
  micButton.title = 'Seu navegador não oferece reconhecimento de voz';
  connectionLabel.textContent = 'digite sua pergunta';
}
