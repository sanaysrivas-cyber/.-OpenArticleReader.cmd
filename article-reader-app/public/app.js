const form = document.querySelector("#article-form");
const urlInput = document.querySelector("#article-url");
const voiceSelect = document.querySelector("#voice-select");
const volumeSlider = document.querySelector("#volume-slider");
const speedSlider = document.querySelector("#speed-slider");
const volumeOutput = document.querySelector("#volume-output");
const speedOutput = document.querySelector("#speed-output");
const voiceStatus = document.querySelector("#voice-status");
const playButton = document.querySelector("#play-button");
const pauseButton = document.querySelector("#pause-button");
const stopButton = document.querySelector("#stop-button");
const message = document.querySelector("#message");
const toolButtons = document.querySelectorAll("[data-tool]");
const insightOutput = document.querySelector("#insight-output");
const checkQuizButton = document.querySelector("#check-quiz-button");
const articleTitle = document.querySelector("#article-title");
const sourceLabel = document.querySelector("#source-label");
const wordCount = document.querySelector("#word-count");
const articleText = document.querySelector("#article-text");

let voices = [];
let chunks = [];
let chunkIndex = 0;
let isReading = false;
let isPaused = false;
let currentQuiz = [];

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  stopReading();
  setBusy(true);
  setMessage("Fetching and extracting the article text...");

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.value }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not read that article.");
    }

    articleTitle.textContent = payload.title || "Untitled article";
    sourceLabel.textContent = new URL(payload.url).hostname;
    wordCount.textContent = `${payload.wordCount.toLocaleString()} words`;
    articleText.value = payload.text;
    renderSummary();
    setMessage("Article loaded. Choose a voice, adjust the sliders, then press Play.");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    setBusy(false);
  }
});

playButton.addEventListener("click", () => {
  if (!articleText.value.trim()) {
    setMessage("Load or paste some article text before pressing Play.", true);
    return;
  }

  if (isPaused) {
    speechSynthesis.resume();
    isPaused = false;
    setMessage("Reading resumed.");
    return;
  }

  stopReading();
  chunks = chunkText(articleText.value.trim());
  chunkIndex = 0;
  isReading = true;
  speakNextChunk();
});

pauseButton.addEventListener("click", () => {
  if (!isReading || isPaused) {
    return;
  }

  speechSynthesis.pause();
  isPaused = true;
  setMessage("Reading paused.");
});

stopButton.addEventListener("click", () => {
  stopReading();
  setMessage("Reading stopped.");
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tool = button.dataset.tool;
    if (tool === "summary") {
      renderSummary();
    } else if (tool === "points") {
      renderKeyPoints();
    } else {
      renderQuiz();
    }
  });
});

checkQuizButton.addEventListener("click", checkQuizAnswers);

volumeSlider.addEventListener("input", () => {
  volumeOutput.textContent = `${Math.round(Number(volumeSlider.value) * 100)}%`;
});

speedSlider.addEventListener("input", () => {
  speedOutput.textContent = `${Number(speedSlider.value).toFixed(1)}x`;
});

window.addEventListener("beforeunload", stopReading);

function loadVoices() {
  voices = speechSynthesis.getVoices().sort((a, b) => {
    const aLocal = a.localService ? 0 : 1;
    const bLocal = b.localService ? 0 : 1;
    return aLocal - bLocal || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name);
  });

  voiceSelect.innerHTML = "";

  if (voices.length === 0) {
    voiceSelect.append(new Option("System voices unavailable", ""));
    voiceStatus.textContent = "No voices";
    return;
  }

  const defaultIndex = voices.findIndex((voice) => voice.default);
  const preferred = defaultIndex >= 0 ? defaultIndex : 0;
  voices.forEach((voice, index) => {
    const label = `${voice.name} (${voice.lang})`;
    voiceSelect.append(new Option(label, String(index), index === preferred, index === preferred));
  });
  voiceStatus.textContent = `${voices.length} voices`;
}

function speakNextChunk() {
  if (!isReading || chunkIndex >= chunks.length) {
    isReading = false;
    isPaused = false;
    setMessage("Finished reading.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
  utterance.voice = voices[Number(voiceSelect.value)] || null;
  utterance.volume = Number(volumeSlider.value);
  utterance.rate = Number(speedSlider.value);
  utterance.pitch = 1;

  utterance.onstart = () => {
    setMessage(`Reading part ${chunkIndex + 1} of ${chunks.length}.`);
  };

  utterance.onend = () => {
    chunkIndex += 1;
    speakNextChunk();
  };

  utterance.onerror = (event) => {
    isReading = false;
    isPaused = false;
    setMessage(`Speech playback stopped: ${event.error}.`, true);
  };

  speechSynthesis.speak(utterance);
}

function stopReading() {
  isReading = false;
  isPaused = false;
  chunkIndex = 0;
  speechSynthesis.cancel();
}

function chunkText(text) {
  const sentences = text
    .replace(/\n{2,}/g, ". ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const result = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > 1500) {
      if (current) {
        result.push(current.trim());
      }
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }

  if (current) {
    result.push(current.trim());
  }

  return result.length ? result : [text.slice(0, 1500)];
}

function setBusy(isBusy) {
  form.querySelector("button").disabled = isBusy;
  urlInput.disabled = isBusy;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function getCurrentText() {
  return articleText.value.trim();
}

function renderSummary() {
  const text = getCurrentText();
  checkQuizButton.hidden = true;

  if (!text) {
    insightOutput.textContent = "Load an article to create a summary.";
    return;
  }

  const sentences = rankSentences(text).slice(0, 4).sort((a, b) => a.index - b.index);
  insightOutput.innerHTML = "";

  for (const sentence of sentences) {
    const paragraph = document.createElement("p");
    paragraph.textContent = sentence.text;
    insightOutput.append(paragraph);
  }
}

function renderKeyPoints() {
  const text = getCurrentText();
  checkQuizButton.hidden = true;

  if (!text) {
    insightOutput.textContent = "Load an article to find key points.";
    return;
  }

  const points = rankSentences(text)
    .filter((sentence) => sentence.text.length < 240)
    .slice(0, 6)
    .sort((a, b) => a.index - b.index);

  const list = document.createElement("ul");
  for (const point of points) {
    const item = document.createElement("li");
    item.textContent = point.text;
    list.append(item);
  }

  insightOutput.replaceChildren(list);
}

function renderQuiz() {
  const text = getCurrentText();

  if (!text) {
    insightOutput.textContent = "Load an article before starting a quiz.";
    checkQuizButton.hidden = true;
    return;
  }

  currentQuiz = buildQuiz(text);
  if (currentQuiz.length === 0) {
    insightOutput.textContent = "There is not enough article text to build a quiz yet.";
    checkQuizButton.hidden = true;
    return;
  }

  const form = document.createElement("div");
  currentQuiz.forEach((question, questionIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = "quiz-question";

    const prompt = document.createElement("p");
    prompt.textContent = `${questionIndex + 1}. ${question.prompt}`;
    wrapper.append(prompt);

    const options = document.createElement("div");
    options.className = "quiz-options";
    question.options.forEach((option, optionIndex) => {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `quiz-${questionIndex}`;
      radio.value = String(optionIndex);
      label.append(radio, document.createTextNode(option));
      options.append(label);
    });

    const result = document.createElement("div");
    result.className = "quiz-result";
    result.dataset.resultFor = String(questionIndex);

    wrapper.append(options, result);
    form.append(wrapper);
  });

  insightOutput.replaceChildren(form);
  checkQuizButton.hidden = false;
}

function checkQuizAnswers() {
  currentQuiz.forEach((question, questionIndex) => {
    const selected = insightOutput.querySelector(`input[name="quiz-${questionIndex}"]:checked`);
    const result = insightOutput.querySelector(`[data-result-for="${questionIndex}"]`);
    if (!result) {
      return;
    }

    if (!selected) {
      result.textContent = "Choose an answer.";
      result.style.color = "#74302f";
      return;
    }

    const isCorrect = Number(selected.value) === question.answerIndex;
    result.textContent = isCorrect ? "Correct." : `Answer: ${question.options[question.answerIndex]}`;
    result.style.color = isCorrect ? "#23543f" : "#74302f";
  });
}

function rankSentences(text) {
  const sentences = splitSentences(text);
  const frequencies = new Map();

  for (const word of tokenize(text)) {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  return sentences
    .map((sentence, index) => {
      const words = tokenize(sentence);
      const score = words.reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / Math.max(words.length, 1);
      return { text: sentence, index, score };
    })
    .filter((sentence) => sentence.text.length > 45)
    .sort((a, b) => b.score - a.score);
}

function buildQuiz(text) {
  const ranked = rankSentences(text).slice(0, 10);
  const terms = extractTerms(text);
  const quiz = [];

  for (const sentence of ranked) {
    const answer = chooseAnswerTerm(sentence.text, terms);
    if (!answer) {
      continue;
    }

    const options = shuffle([
      answer,
      ...terms.filter((term) => term !== answer).slice(0, 8),
    ]).slice(0, 4);

    if (options.length < 3) {
      continue;
    }

    quiz.push({
      prompt: sentence.text.replace(new RegExp(escapeRegExp(answer), "i"), "_____"),
      options,
      answerIndex: options.indexOf(answer),
    });

    if (quiz.length === 5) {
      break;
    }
  }

  return quiz;
}

function chooseAnswerTerm(sentence, terms) {
  const sentenceLower = sentence.toLowerCase();
  return terms.find((term) => sentenceLower.includes(term.toLowerCase())) || "";
}

function extractTerms(text) {
  const phraseMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g) || [];
  const phrases = phraseMatches
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 3 && !/^(The|This|That|When|Where|After|Before)$/.test(phrase));

  const frequentWords = [...tokenize(text).reduce((map, word) => {
    map.set(word, (map.get(word) || 0) + 1);
    return map;
  }, new Map())]
    .filter(([word, count]) => count > 1 && word.length > 5)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  return unique([...phrases, ...frequentWords]).slice(0, 24);
}

function splitSentences(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenize(text) {
  const stopWords = new Set([
    "about", "after", "again", "also", "because", "been", "being", "could", "from", "have",
    "into", "more", "most", "over", "said", "that", "their", "there", "these", "they",
    "this", "through", "under", "were", "when", "where", "which", "while", "with", "would",
  ]);

  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
  setMessage("This browser does not support speech synthesis.", true);
  playButton.disabled = true;
  pauseButton.disabled = true;
  stopButton.disabled = true;
} else {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
  setMessage("Paste an article URL to begin.");
}
