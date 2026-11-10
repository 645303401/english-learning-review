const supabaseConfig = window.SUPABASE_CONFIG || {};
const captureModal = document.getElementById("captureModal");
const captureInput = document.getElementById("captureInput");
const capturePreview = document.getElementById("capturePreview");
const captureSubmit = document.getElementById("captureSubmitButton");
const captureStatus = document.getElementById("captureStatus");
const loginBox = document.getElementById("loginBox");
const manualBox = document.getElementById("manualBox");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");
const loginStatus = document.getElementById("loginStatus");
const manualStatus = document.getElementById("manualStatus");
let selectedFile = null;
let session = null;
let supabaseClient = null;

function setCaptureStatus(text, kind = "") { captureStatus.textContent = text; captureStatus.dataset.kind = kind; }
function isConfigured() { return Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase); }
function isLoggedIn() { return Boolean(session?.access_token); }
function authHeaders() { return { apikey: supabaseConfig.anonKey, Authorization: "Bearer " + session.access_token }; }
function refreshCaptureState() { loginBox.hidden = isLoggedIn(); manualBox.hidden = !isLoggedIn(); captureSubmit.disabled = !selectedFile || !isConfigured() || !isLoggedIn(); if (isLoggedIn()) window.dispatchEvent(new CustomEvent("review-authenticated", { detail: session })); if (!isConfigured()) setCaptureStatus("需要先配置 Supabase 后端"); else if (!isLoggedIn()) setCaptureStatus("请先登录或注册"); else if (selectedFile) setCaptureStatus("照片已选择，可以开始识别"); }
function openCapture() { captureModal.hidden = false; refreshCaptureState(); }
function closeCapture() { captureModal.hidden = true; }
document.getElementById("captureOpenButton").addEventListener("click", openCapture);
document.getElementById("captureCloseButton").addEventListener("click", closeCapture);
captureModal.addEventListener("click", event => { if (event.target === captureModal) closeCapture(); });

if (isConfigured()) {
  supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
  supabaseClient.auth.getSession().then(({ data }) => { session = data.session; refreshCaptureState(); });
  supabaseClient.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; refreshCaptureState(); });
}

async function authenticate(mode) {
  if (!supabaseClient || !loginEmail.value.trim() || !loginPassword.value) { loginStatus.textContent = "请输入邮箱和密码"; return; }
  loginButton.disabled = true; registerButton.disabled = true; loginStatus.textContent = mode === "register" ? "正在注册…" : "正在登录…";
  const result = mode === "register" ? await supabaseClient.auth.signUp({ email: loginEmail.value.trim(), password: loginPassword.value }) : await supabaseClient.auth.signInWithPassword({ email: loginEmail.value.trim(), password: loginPassword.value });
  loginButton.disabled = false; registerButton.disabled = false;
  if (result.error) loginStatus.textContent = result.error.message;
  else { session = result.data.session; loginStatus.textContent = mode === "register" ? "注册成功，已登录" : "登录成功"; refreshCaptureState(); }
}
loginButton.addEventListener("click", () => authenticate("login"));
registerButton.addEventListener("click", () => authenticate("register"));

captureInput.addEventListener("change", () => { selectedFile = captureInput.files?.[0] || null; if (!selectedFile) return; capturePreview.src = URL.createObjectURL(selectedFile); capturePreview.hidden = false; refreshCaptureState(); });

document.getElementById("manualSaveButton").addEventListener("click", async () => {
  const word = document.getElementById("manualWord").value.trim(); if (!word || !isLoggedIn()) { manualStatus.textContent = "请先登录并填写英文单词"; return; }
  const row = { user_id: session.user.id, word_key: word.toLowerCase(), word, meaning: document.getElementById("manualMeaning").value.trim(), pronunciation: document.getElementById("manualPronunciation").value.trim(), example: document.getElementById("manualExample").value.trim(), theme: document.getElementById("manualTheme").value.trim() || "手动新增", difficulty: "基础", status: "approved", source: "manual" };
  const response = await fetch(supabaseConfig.url + "/rest/v1/user_words", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
  manualStatus.textContent = response.ok ? "已保存到在线词库" : "保存失败：" + await response.text();
  if (response.ok) window.dispatchEvent(new CustomEvent("review-authenticated", { detail: session }));
});

captureSubmit.addEventListener("click", async () => {
  if (!selectedFile || !isConfigured() || !isLoggedIn()) return;
  captureSubmit.disabled = true; setCaptureStatus("正在上传照片并识别，请稍候…");
  try {
    const ext = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
    const storagePath = "captures/" + session.user.id + "/" + Date.now() + "-" + crypto.randomUUID() + "." + ext;
    const upload = await fetch(supabaseConfig.url + "/storage/v1/object/word-captures/" + storagePath, { method: "POST", headers: { ...authHeaders(), "Content-Type": selectedFile.type || "image/jpeg", "x-upsert": "false" }, body: selectedFile });
    if (!upload.ok) throw new Error("图片上传失败：" + await upload.text());
    const job = await fetch(supabaseConfig.url + "/functions/v1/ocr-capture", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ storagePath, sourceName: selectedFile.name }) });
    const result = await job.json(); if (!job.ok) throw new Error(result.error || "OCR 处理失败");
    setCaptureStatus("识别完成，已加入在线词库：" + (result.words || []).join("、"), "success"); captureSubmit.disabled = false; window.dispatchEvent(new CustomEvent("review-authenticated", { detail: session }));
  } catch (error) { setCaptureStatus(error.message || "处理失败，请稍后重试", "error"); captureSubmit.disabled = false; }
});
