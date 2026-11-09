const supabaseConfig = window.SUPABASE_CONFIG || {};
const captureModal = document.getElementById("captureModal");
const captureInput = document.getElementById("captureInput");
const capturePreview = document.getElementById("capturePreview");
const captureSubmit = document.getElementById("captureSubmitButton");
const captureStatus = document.getElementById("captureStatus");
let selectedFile = null;

function setCaptureStatus(text, kind = "") { captureStatus.textContent = text; captureStatus.dataset.kind = kind; }
function openCapture() { captureModal.hidden = false; setCaptureStatus(isConfigured() ? "可以选择照片开始识别" : "需要先配置 Supabase 后端"); }
function closeCapture() { captureModal.hidden = true; }
function isConfigured() { return Boolean(supabaseConfig.url && supabaseConfig.anonKey && !supabaseConfig.url.includes("你的项目")); }
function authHeaders() { return { apikey: supabaseConfig.anonKey, Authorization: "Bearer " + supabaseConfig.anonKey }; }

document.getElementById("captureOpenButton").addEventListener("click", openCapture);
document.getElementById("captureCloseButton").addEventListener("click", closeCapture);
captureModal.addEventListener("click", event => { if (event.target === captureModal) closeCapture(); });
captureInput.addEventListener("change", () => {
  selectedFile = captureInput.files?.[0] || null;
  if (!selectedFile) return;
  capturePreview.src = URL.createObjectURL(selectedFile);
  capturePreview.hidden = false;
  captureSubmit.disabled = !isConfigured();
  setCaptureStatus(isConfigured() ? "照片已选择，可以开始识别" : "照片已选择，但还没有配置 Supabase");
});

captureSubmit.addEventListener("click", async () => {
  if (!selectedFile || !isConfigured()) return;
  captureSubmit.disabled = true;
  setCaptureStatus("正在上传照片并识别，请稍候…");
  try {
    const ext = (selectedFile.name.split(".").pop() || "jpg").toLowerCase();
    const storagePath = "captures/" + Date.now() + "-" + crypto.randomUUID() + "." + ext;
    const upload = await fetch(supabaseConfig.url + "/storage/v1/object/word-captures/" + storagePath, { method: "POST", headers: { ...authHeaders(), "Content-Type": selectedFile.type || "image/jpeg", "x-upsert": "false" }, body: selectedFile });
    if (!upload.ok) throw new Error("图片上传失败：" + await upload.text());
    const job = await fetch(supabaseConfig.url + "/functions/v1/ocr-capture", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ storagePath, sourceName: selectedFile.name }) });
    const result = await job.json();
    if (!job.ok) throw new Error(result.error || "OCR 处理失败");
    setCaptureStatus("识别完成，已加入待确认词列表：" + (result.words || []).join("、"), "success");
    captureSubmit.disabled = false;
  } catch (error) {
    setCaptureStatus(error.message || "处理失败，请稍后重试", "error");
    captureSubmit.disabled = false;
  }
});
