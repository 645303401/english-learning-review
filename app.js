const DATA_URL = "data/words.json";
const STORAGE_KEY = "english-learning-review-v1";
const DAILY_SIZE = 7;
const intervals = [1, 2, 4, 7, 14, 30];
let words = [];
let state;
let current = null;
const $ = id => document.getElementById(id);
const today = () => { const d = new Date(); return d.toISOString().slice(0, 10); };
const addDays = (date, n) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const formatDate = () => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
const emptyState = () => ({ reviews: {}, daily: { date: "", ids: [], completed: [], index: 0 }, activity: {} });
function loadState(){ try { return Object.assign(emptyState(), JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")); } catch { return emptyState(); } }
state = loadState();
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function reviewOf(word){ return state.reviews[word.id] || { streak: 1, mastered: true, due: today(), correct: 0, wrong: 0 }; }
function daysLate(due){ if(!due) return 0; return Math.max(0, Math.round((new Date(today()) - new Date(due)) / 86400000)); }
function weight(word){ const r = reviewOf(word); if(r.due && r.due > today()) return 0.35; if(!r.mastered) return 8 + daysLate(r.due); return Math.max(0.7, 4 / (r.streak + 1)) + daysLate(r.due); }
function isSimpleWord(word){ return word.difficulty === "基础" && word.word.replace(/[^a-zA-Z]/g, "").length <= 5; }
function nextKnownInterval(word, review){ if(isSimpleWord(word)) return review.correct === 0 ? 14 : 30; return intervals[Math.min(review.streak, intervals.length - 1)]; }
function weightedPick(pool, count){ const result = []; const available = [...pool]; while(available.length && result.length < count){ const total = available.reduce((sum, w) => sum + weight(w), 0); let cursor = Math.random() * total; let picked = available[available.length - 1]; for(const word of available){ cursor -= weight(word); if(cursor <= 0){ picked = word; break; } } result.push(picked); available.splice(available.indexOf(picked), 1); } return result; }
function startToday(){ const eligible = words.filter(w => weight(w) > 0); const pool = eligible.length >= DAILY_SIZE ? eligible : words; state.daily = { date: today(), ids: weightedPick(pool, DAILY_SIZE).map(w => w.id), completed: [], index: 0 }; saveState(); }
function ensureToday(){ if(state.daily.date !== today() || !state.daily.ids || !state.daily.ids.length) startToday(); }
function currentWord(){ return words.find(w => w.id === state.daily.ids[state.daily.index]); }
function updateStats(){ const reviews = words.map(reviewOf); $("masteredCount").textContent = reviews.filter(r => r.mastered).length; $("dueCount").textContent = reviews.filter(r => !r.due || r.due <= today()).length; $("todayProgress").textContent = state.daily.completed.length + "/" + DAILY_SIZE; $("streakCount").textContent = Object.keys(state.activity).length; }
function render(){ ensureToday(); updateStats(); $("todayLabel").textContent = formatDate(); const done = state.daily.completed.length >= DAILY_SIZE || state.daily.index >= state.daily.ids.length; $("reviewPanel").hidden = done; $("completePanel").hidden = !done; if(done) return; current = currentWord(); $("progressText").textContent = "今日第 " + (state.daily.index + 1) + " / " + DAILY_SIZE + " 词"; $("progressFill").style.width = ((state.daily.completed.length / DAILY_SIZE) * 100) + "%"; $("wordText").textContent = current.word; $("pronunciation").textContent = current.pronunciation || ""; $("themeTag").textContent = (current.theme || "日常词汇").split("｜").slice(-1)[0]; $("difficultyTag").textContent = current.difficulty || "基础"; $("answerArea").hidden = true; $("choiceActions").hidden = true; $("revealButton").hidden = false; $("thinkHint").textContent = "先在心里说出中文意思，再查看答案"; }
function showAnswer(){ if(!current) return; $("meaningText").textContent = current.meaning; $("partOfSpeech").textContent = current.partOfSpeech || ""; $("exampleText").textContent = current.example ? "例句：" + current.example : ""; $("collocationsText").textContent = current.collocations ? "搭配：" + current.collocations : ""; $("errorPoint").textContent = current.errorPoint ? "易错提醒：" + current.errorPoint : ""; $("answerArea").hidden = false; $("choiceActions").hidden = false; $("revealButton").hidden = true; $("thinkHint").textContent = "选择你的复习结果"; }
function finish(result){ if(!current) return; const r = reviewOf(current); if(result === "know"){ const nextStreak = r.streak + 1; state.reviews[current.id] = { ...r, streak: nextStreak, mastered: true, correct: r.correct + 1, due: addDays(today(), nextKnownInterval(current, r)), lastSeen: today() }; } else { state.reviews[current.id] = { ...r, streak: 0, mastered: false, wrong: r.wrong + 1, due: addDays(today(), 2), lastSeen: today() }; } state.daily.completed.push(current.id); state.daily.index += 1; state.activity[today()] = true; saveState(); render(); }
function speak(){ if(!current || !window.speechSynthesis) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(current.word); u.lang = "en-US"; u.rate = .78; window.speechSynthesis.speak(u); }
$("revealButton").addEventListener("click", showAnswer); $("knowButton").addEventListener("click", () => finish("know")); $("againButton").addEventListener("click", () => finish("again")); $("soundButton").addEventListener("click", speak); $("reviewStatsButton").addEventListener("click", () => { alert("已掌握 " + $("masteredCount").textContent + " 个词。待复习词会按计划再次出现。"); });
fetch(DATA_URL).then(r => r.json()).then(data => { words = data; render(); }).catch(() => { $("wordText").textContent = "词库加载失败"; $("thinkHint").textContent = "请确认使用本地网址打开，而不是直接双击 HTML 文件"; });

