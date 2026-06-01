// game.js – Guess the Flag game logic

const TOTAL_QUESTIONS = 10;
const TIME_PER_QUESTION = 15;
const POINTS_PER_CORRECT = 100;
const MAX_SPEED_BONUS = 50;

// Circumference of the timer circle (r=26)
const CIRCUMFERENCE = 2 * Math.PI * 26; // ≈ 163.4

let questions = [];
let currentIndex = 0;
let score = 0;
let correctCount = 0;
let wrongCount = 0;
let timerInterval = null;
let timeLeft = TIME_PER_QUESTION;
let answered = false;

// ── DOM refs ──────────────────────────────────────────────
const screens = {
  start:   document.getElementById('screen-start'),
  loading: document.getElementById('screen-loading'),
  game:    document.getElementById('screen-game'),
  results: document.getElementById('screen-results'),
};

const elQuestionCounter = document.getElementById('question-counter');
const elScoreDisplay    = document.getElementById('score-display');
const elTimerText       = document.getElementById('timer-text');
const elTimerCircle     = document.getElementById('timer-circle');
const elFlagImage       = document.getElementById('flag-image');
const elOptionsGrid     = document.getElementById('options-grid');
const elFeedbackBar     = document.getElementById('feedback-bar');
const elFeedbackText    = document.getElementById('feedback-text');
const elResultsScore    = document.getElementById('results-score');
const elResultsCorrect  = document.getElementById('results-correct');
const elResultsWrong    = document.getElementById('results-wrong');
const elResultsAccuracy = document.getElementById('results-accuracy');
const elResultsEmoji    = document.getElementById('results-emoji');

// ── Screens ───────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ── Fetch questions ───────────────────────────────────────
async function fetchQuestions() {
  showScreen('loading');
  try {
    const res = await fetch('/api/questions');
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    return data.questions;
  } catch (err) {
    alert('Could not load questions. Is the backend running?');
    showScreen('start');
    return null;
  }
}

// ── Start game ────────────────────────────────────────────
async function startGame() {
  questions = await fetchQuestions();
  if (!questions) return;

  currentIndex = 0;
  score = 0;
  correctCount = 0;
  wrongCount = 0;

  showScreen('game');
  loadQuestion();
}

// ── Load question ─────────────────────────────────────────
function loadQuestion() {
  answered = false;
  timeLeft = TIME_PER_QUESTION;

  const q = questions[currentIndex];

  // Update HUD
  elQuestionCounter.textContent = `${currentIndex + 1} / ${TOTAL_QUESTIONS}`;
  elScoreDisplay.textContent = score;

  // Load flag
  elFlagImage.style.opacity = '0';
  elFlagImage.src = q.flag_url;
  elFlagImage.onload = () => {
    elFlagImage.style.opacity = '1';
  };
  elFlagImage.onerror = () => {
    // Fallback to a different CDN size
    elFlagImage.src = `https://flagcdn.com/w160/${q.flag_code}.png`;
    elFlagImage.style.opacity = '1';
  };

  // Render options
  const optBtns = elOptionsGrid.querySelectorAll('.option-btn');
  optBtns.forEach((btn, i) => {
    btn.textContent = q.options[i];
    btn.className = 'option-btn';
    btn.disabled = false;
    btn.onclick = () => handleAnswer(btn, q.options[i], q.correct);
  });

  // Hide feedback
  elFeedbackBar.classList.add('hidden');
  elFeedbackBar.className = 'feedback-bar hidden';

  // Start timer
  clearInterval(timerInterval);
  updateTimerUI();
  timerInterval = setInterval(tick, 1000);
}

// ── Timer ─────────────────────────────────────────────────
function tick() {
  timeLeft--;
  updateTimerUI();
  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    handleTimeout();
  }
}

function updateTimerUI() {
  elTimerText.textContent = timeLeft;

  const ratio = timeLeft / TIME_PER_QUESTION;
  const offset = CIRCUMFERENCE * (1 - ratio);
  elTimerCircle.style.strokeDashoffset = offset;

  // Color shift as time runs out
  if (timeLeft <= 5) {
    elTimerCircle.style.stroke = '#ff4757';
    elTimerText.style.color = '#ff4757';
  } else if (timeLeft <= 8) {
    elTimerCircle.style.stroke = '#ffa502';
    elTimerText.style.color = '#ffa502';
  } else {
    elTimerCircle.style.stroke = 'var(--primary)';
    elTimerText.style.color = 'var(--text)';
  }
}

// ── Answer handling ───────────────────────────────────────
function handleAnswer(btn, chosen, correct) {
  if (answered) return;
  answered = true;
  clearInterval(timerInterval);

  const isCorrect = chosen === correct;

  // Disable all buttons & highlight
  const optBtns = elOptionsGrid.querySelectorAll('.option-btn');
  optBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent === correct) b.classList.add('reveal-correct');
  });

  if (isCorrect) {
    const speedBonus = Math.round((timeLeft / TIME_PER_QUESTION) * MAX_SPEED_BONUS);
    const earned = POINTS_PER_CORRECT + speedBonus;
    score += earned;
    correctCount++;
    btn.classList.add('correct');
    showFeedback(true, `✅ Correct! +${earned} pts${speedBonus > 0 ? ` (⚡ +${speedBonus} speed bonus)` : ''}`);
  } else {
    wrongCount++;
    btn.classList.add('wrong');
    showFeedback(false, `❌ Wrong! It was ${correct}`);
  }

  // Next question after delay
  setTimeout(nextQuestion, 1600);
}

function handleTimeout() {
  if (answered) return;
  answered = true;

  const q = questions[currentIndex];
  wrongCount++;

  const optBtns = elOptionsGrid.querySelectorAll('.option-btn');
  optBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent === q.correct) b.classList.add('reveal-correct');
  });

  showFeedback(false, `⏰ Time's up! It was ${q.correct}`);
  setTimeout(nextQuestion, 1600);
}

function showFeedback(isCorrect, text) {
  elFeedbackText.textContent = text;
  elFeedbackBar.className = `feedback-bar ${isCorrect ? 'correct' : 'wrong'}`;
}

// ── Next question / End ───────────────────────────────────
function nextQuestion() {
  currentIndex++;
  if (currentIndex < TOTAL_QUESTIONS) {
    loadQuestion();
  } else {
    endGame();
  }
}

async function endGame() {
  // Submit score to backend
  try {
    const res = await fetch('/api/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score,
        correct_answers: correctCount,
        total_questions: TOTAL_QUESTIONS,
      }),
    });
    if (res.status === 401) {
      // Session expired – redirect to login for fresh token
      alert('Sesiunea ta a expirat. Te rugăm să te autentifici din nou pentru a salva scorul.');
      window.location.href = '/login';
      return;
    }
  } catch (err) {
    console.warn('Could not submit score:', err);
  }

  showResults();
}

function showResults() {
  const accuracy = Math.round((correctCount / TOTAL_QUESTIONS) * 100);

  elResultsScore.textContent = score;
  elResultsCorrect.textContent = correctCount;
  elResultsWrong.textContent = wrongCount;
  elResultsAccuracy.textContent = accuracy + '%';

  // Pick emoji based on performance
  if (accuracy >= 90) elResultsEmoji.textContent = '🏆';
  else if (accuracy >= 70) elResultsEmoji.textContent = '🎉';
  else if (accuracy >= 50) elResultsEmoji.textContent = '👍';
  else elResultsEmoji.textContent = '📚';

  showScreen('results');
}

// ── Event listeners ───────────────────────────────────────
document.getElementById('start-game-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);
