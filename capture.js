const supabaseConfig = window.SUPABASE_CONFIG || {};
const captureModal = document.getElementById("captureModal");
const captureInput = document.getElementById("captureInput");
const capturePreview = document.getElementById("capturePreview");
const captureSubmit = document.getElementById("captureSubmitButton");
const captureStatus = document.getElementById("captureStatus");
const loginBox = document.getElementById("loginBox");
const loginEmail = document.getElementById("loginEmail");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");
let selectedFile = null;
let session = null;
let supabaseClient = null;

function setCaptureStatus(text, kind = "") { captureStatus.textContent = text; captureStatus.dataset.kind = kind; }
function isConfigured() { return Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase); }
function isLoggedIn() { return Boolean(session?.access_token); }
function authHeaders() { return { apikey: supabaseConfig.anonKey, Authorization: "Bearer " + session.access_token }; }
function refreshCaptureState() { loginBox.hidden = isLoggedIn(); captureSubmit.disabled = !selectedFile || !isConfigured() || !isLoggedIn(); if (!isConfigured()) setCaptureStatus("需要先配置 Supabase 后端"); else if (!isLoggedIn()) setCaptureStatus("请先用邮箱登录"); else if (selectedFile) setCaptureStatus("照片已选择，可以开始识别"); }
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

loginButton.addEventListener("click", async () => {
  if (!supabaseClient || !loginEmail.value.trim()) { loginStatus.textContent = "请输入邮箱"; return; }
  loginButton.disabled = true; loginStatus.textContent = "正在发送登录链接…";
  const { error } = await supabaseClient.auth.signInWithOtp({ email: loginEmail.value.trim(), options: { emailRedirectTo: window.location.href.split("#")[0] } });
  loginButton.disabled = false; loginStatus.textContent = error ? error.message : "登录链接已发送，请打开邮箱完成登录";
});

captureInput.addEventListener("change", () => {
  selectedFile = captureInput.files?.[0] || null;
  if (!selectedFile) return;
  capturePreview.src = URL.createObjectURL(selectedFile); capturePreview.hidden = false; refreshCaptureState();
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
    setCaptureStatus("识别完成，已加入待确认词列表：" + (result.words || []).join("、"), "success"); captureSubmit.disabled = false;
  } catch (error) { setCaptureStatus(error.message || "处理失败，请稍后重试", "error"); captureSubmit.disabled = false; }
});
