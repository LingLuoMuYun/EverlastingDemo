// 统一 prose 排版样式（从原文章/杂谈详情页抽取，供 /notes/[slug] 复用）
export default function ProseStyles() {
  return (
    <style>{`
      .prose h1 { font-size: 1.8rem !important; font-weight: 900 !important; margin-bottom: 1.2rem !important; margin-top: 2rem !important; line-height: 1.3 !important; color: inherit !important; }
      .prose h2 { font-size: 1.5rem !important; font-weight: 800 !important; margin-bottom: 1rem !important; margin-top: 1.5rem !important; color: inherit !important; }
      .prose h3 { font-size: 1.2rem !important; font-weight: 700 !important; margin-bottom: 0.8rem !important; color: inherit !important; }
      .prose p { font-size: 0.95rem !important; line-height: 1.75 !important; color: inherit !important; }

      .prose a { color: #6366f1 !important; text-decoration: none !important; font-weight: 600 !important; border-bottom: 1px dashed #6366f1 !important; transition: all 0.3s ease !important; }
      .prose a:hover { color: #4f46e5 !important; border-bottom-style: solid !important; background-color: rgba(99, 102, 241, 0.1) !important; padding: 0 0.2rem !important; border-radius: 0.2rem !important; }
      .dark .prose a { color: #818cf8 !important; border-bottom-color: #818cf8 !important; }
      .dark .prose a:hover { color: #a5b4fc !important; background-color: rgba(129, 140, 248, 0.15) !important; }

      .prose ul { list-style-type: disc !important; padding-left: 1.5rem !important; font-size: 0.95rem !important; }
      .prose ol { list-style-type: decimal !important; padding-left: 1.5rem !important; font-size: 0.95rem !important; }
      .prose li { display: list-item !important; margin-bottom: 0.5rem !important; }

      .prose ul ul, .prose ol ul { list-style-type: circle !important; margin-top: 0.25rem !important; margin-bottom: 0.25rem !important; }
      .prose ol ol, .prose ul ol { list-style-type: lower-alpha !important; margin-top: 0.25rem !important; margin-bottom: 0.25rem !important; }

      .prose del { text-decoration-color: inherit !important; opacity: 0.6; }

      .prose blockquote {
        border-left: 4px solid #6366f1 !important;
        background-color: rgba(99, 102, 241, 0.05) !important;
        padding: 1rem 1.5rem !important;
        margin: 1.5rem 0 !important;
        border-radius: 0 1.25rem 1.25rem 0 !important;
        font-style: italic !important;
        color: #64748b !important;
      }
      .prose blockquote p { margin: 0 !important; color: inherit !important; }
      .dark .prose blockquote {
        border-left-color: #818cf8 !important;
        background-color: rgba(129, 140, 248, 0.1) !important;
        color: #94a3b8 !important;
      }

      .prose pre {
        background-color: #282c34 !important; color: #abb2bf !important;
        padding: 1rem !important; border-radius: 0.75rem !important;
        overflow-x: auto !important; box-shadow: inset 0 0 10px rgba(0,0,0,0.3) !important;
        margin-top: 1rem !important; margin-bottom: 1rem !important;
      }

      .prose pre code, .prose p code, .prose li code {
        font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, ui-monospace, monospace !important;
        font-variant-ligatures: contextual !important;
      }
      .prose pre code { background-color: transparent !important; padding: 0 !important; color: inherit !important; font-size: 0.85em !important; }

      .prose code::before, .prose code::after { content: none !important; }
      .prose p code, .prose li code { background-color: rgba(99, 102, 241, 0.1) !important; color: #6366f1 !important; padding: 0.1rem 0.3rem !important; border-radius: 0.25rem !important; font-weight: 600 !important; font-size: 0.85em !important; }
      .dark .prose p code, .dark .prose li code { background-color: rgba(99, 102, 241, 0.2) !important; color: #818cf8 !important; }
      .prose img { display: block !important; margin: 1.5rem auto !important; border-radius: 1rem !important; box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important; max-width: 100% !important; height: auto !important; }

      .prose pre code .hljs-comment, .prose pre code .hljs-quote { color: #5c6370 !important; font-style: italic !important; }
      .prose pre code .hljs-doctag, .prose pre code .hljs-keyword, .prose pre code .hljs-formula { color: #c678dd !important; }
      .prose pre code .hljs-keyword.type_, .prose pre code .hljs-type { color: #c678dd !important; }
      .prose pre code .hljs-section, .prose pre code .hljs-name, .prose pre code .hljs-selector-tag, .prose pre code .hljs-deletion, .prose pre code .hljs-subst { color: #e06c75 !important; }
      .prose pre code .hljs-literal { color: #56b6c2 !important; }
      .prose pre code .hljs-string, .prose pre code .hljs-regexp, .prose pre code .hljs-addition, .prose pre code .hljs-attribute, .prose pre code .hljs-meta-string { color: #98c379 !important; }
      .prose pre code .hljs-built_in, .prose pre code .hljs-class .hljs-title, .prose pre code .hljs-title.class_ { color: #e6c07b !important; }
      .prose pre code .hljs-attr, .prose pre code .hljs-variable, .prose pre code .hljs-template-variable, .prose pre code .hljs-selector-class, .prose pre code .hljs-selector-attr, .prose pre code .hljs-selector-pseudo, .prose pre code .hljs-number { color: #d19a66 !important; }
      .prose pre code .hljs-symbol, .prose pre code .hljs-bullet, .prose pre code .hljs-link, .prose pre code .hljs-meta, .prose pre code .hljs-selector-id, .prose pre code .hljs-title, .prose pre code .hljs-title.function_ { color: #61aeee !important; }

      @media (min-width: 768px) {
        .prose h1 { font-size: 3rem !important; font-weight: 950 !important; margin-bottom: 2rem !important; margin-top: 3rem !important; line-height: 1.1 !important; }
        .prose h2 { font-size: 2.2rem !important; margin-bottom: 1.5rem !important; margin-top: 2rem !important; }
        .prose h3 { font-size: 1.5rem !important; margin-bottom: 1rem !important; }
        .prose p { font-size: 1.15rem !important; line-height: 1.85 !important; }

        .prose ul, .prose ol { padding-left: 2rem !important; font-size: 1.1rem !important; }

        .prose pre { padding: 1.25rem !important; margin-top: 1.5rem !important; margin-bottom: 1.5rem !important; }
        .prose pre code { font-size: 0.9em !important; }
        .prose p code, .prose li code { padding: 0.2rem 0.4rem !important; font-size: 0.9em !important; border-radius: 0.375rem !important;}
        .prose img { margin: 2rem auto !important; border-radius: 2rem !important; box-shadow: 0 20px 50px rgba(0,0,0,0.15) !important; }
      }
    `}</style>
  );
}
