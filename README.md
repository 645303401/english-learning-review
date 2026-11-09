# 每日 7 词复习网页

打开网址：

http://localhost:4173/

公网网址：

https://645303401.github.io/english-learning-review/

## 启动

在终端运行：

`/Users/zy/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 4173 --directory /Users/zy/03_Projects/english-learning/review-app`

## 复习规则

- 每天随机安排 7 个单词。
- 初始词库默认视为已掌握，第一次复习后再根据反馈调整频率。
- 简单基础词答对后安排 14 天、30 天后再出现；进阶或易混淆词使用 1、2、4、7、14、30 天间隔。
- 记住的单词按 1、2、4、7、14、30 天逐步降低出现频率。
- 选择“还不会”的单词，2 天后再次出现。
- 学习记录保存在当前浏览器的 localStorage，不需要登录或联网数据库。
- 词库数据来自工程中的 `words.xlsx`，导出到 `data/words.json` 供网页读取。

## 拍照录入后端

拍照录入需要配置 Supabase：

1. 在 Supabase SQL Editor 执行工程中的 `../supabase/schema.sql`。
2. 将 Supabase 项目 URL 和 anon public key 填入 `config.js`。
3. 将 `supabase/functions/ocr-capture/index.ts` 部署为 Edge Function。
4. 在 Edge Function 环境变量中设置 `OPENAI_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 和可选的 `OPENAI_VISION_MODEL`。

service role key 和 OpenAI API key 只放在 Supabase 后端环境变量中，不要提交到 GitHub。

