import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://645303401.github.io", "http://localhost:4173"]);
const headersFor = (request: Request) => ({ "Access-Control-Allow-Origin": allowedOrigins.has(request.headers.get("Origin") || "") ? request.headers.get("Origin")! : "https://645303401.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" });
const json = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headersFor(request), "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headersFor(request) });
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(request, { error: "登录已失效，请重新登录" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(request, { error: "无法验证登录身份" }, 401);
    const { storagePath, sourceName } = await request.json();
    const pathParts = String(storagePath || "").split("/");
    if (pathParts.length !== 3 || pathParts[0] !== "captures" || pathParts[1] !== user.id || !/^[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(pathParts[2])) return json(request, { error: "图片路径无效" }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: image, error: downloadError } = await supabase.storage.from("word-captures").download(storagePath);
    if (downloadError) throw downloadError;
    const bytes = new Uint8Array(await image.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const base64 = btoa(binary);
    const model = Deno.env.get("OPENAI_VISION_MODEL") || "gpt-4o-mini";
    const aiPayload = { model, response_format: { type: "json_object" }, messages: [
      { role: "system", content: "你是儿童英语词库整理助手。只输出 JSON，格式为 {words:[{word,pronunciation,meaning,partOfSpeech,example,collocations,theme,difficulty,errorPoint}]}。从图片中提取英文单词并补齐可靠字段；无法确认的字段写【待核验】，不要编造。" },
      { role: "user", content: [{ type: "text", text: "识别这张图片中的英文单词，去除重复并按词库字段整理。" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64," + base64 } }] },
    ] };
    const ai = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + Deno.env.get("OPENAI_API_KEY"), "Content-Type": "application/json" }, body: JSON.stringify(aiPayload) });
    const aiBody = await ai.json();
    if (!ai.ok) throw new Error(aiBody.error?.message || "OCR provider failed");
    const parsed = JSON.parse(aiBody.choices?.[0]?.message?.content || "{}");
    const words = Array.isArray(parsed.words) ? parsed.words : [];
    const { data: capture, error: captureError } = await supabase.from("capture_items").insert({ user_id: user.id, storage_path: storagePath, source_name: sourceName || null, status: "processed", extracted_words: words }).select("id").single();
    if (captureError) throw captureError;
    const candidates = words.map((item: Record<string, string>) => ({ user_id: user.id, word_key: String(item.word || "").trim().toLowerCase(), word: String(item.word || "").trim(), pronunciation: item.pronunciation || "", meaning: item.meaning || "", part_of_speech: item.partOfSpeech || "", example: item.example || "", collocations: item.collocations || "", theme: item.theme || "", difficulty: item.difficulty || "基础", error_point: item.errorPoint || "", source_capture_id: capture.id, status: "pending" })).filter((item: Record<string, string>) => item.word_key);
    if (candidates.length) await supabase.from("word_candidates").upsert(candidates, { onConflict: "word_key", ignoreDuplicates: true });
    return json(request, { captureId: capture.id, words: candidates.map((item: Record<string, string>) => item.word) });
  } catch (error) { return json(request, { error: error instanceof Error ? error.message : "Unknown error" }, 500); }
});
