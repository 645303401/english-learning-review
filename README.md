# 每日 7 词复习网页

打开网址：

http://localhost:4173/

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

