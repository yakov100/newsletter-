"use client";

import { useEditor, EditorContent, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, Color, FontFamily } from "@tiptap/extension-text-style";
import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";

export interface RichEditorHandle {
  getSelectedText(): string;
  replaceSelection(html: string): void;
}

const FONTS = [
  { name: "ברירת מחדל", value: "" },
  { name: "היבו", value: "Heebo, sans-serif" },
  { name: "אסיסטנט", value: "Assistant, sans-serif" },
  { name: "רוביק", value: "Rubik, sans-serif" },
  { name: "נוטו סאנס עברית", value: '"Noto Sans Hebrew", sans-serif' },
  { name: "אלף", value: "Alef, sans-serif" },
  { name: "דוד ליברה", value: '"David Libre", serif' },
  { name: "חילוני וואן", value: '"Secular One", sans-serif' },
];

const TEXT_COLORS = [
  { name: "ברירת מחדל", value: "" },
  { name: "שחור", value: "#0f172a" },
  { name: "אפור", value: "#64748b" },
  { name: "טורקיז", value: "#0d9488" },
  { name: "כחול", value: "#2563eb" },
  { name: "סגול", value: "#7c3aed" },
  { name: "אדום", value: "#dc2626" },
  { name: "כתום", value: "#ea580c" },
  { name: "ירוק", value: "#16a34a" },
];

const HIGHLIGHT_COLORS = [
  { name: "צהוב", value: "yellow" },
  { name: "ירוק", value: "green" },
  { name: "כחול", value: "blue" },
  { name: "ורוד", value: "pink" },
  { name: "כתום", value: "orange" },
];

/** צבעי רקע לאזור הטיוטה */
const DRAFT_BACKGROUNDS = [
  { name: "ברירת מחדל", value: "#ffffff" },
  { name: "פסטל סגול", value: "#f5f3ff" },
  { name: "פסטל תכלת", value: "#eff6ff" },
  { name: "פסטל ורוד", value: "#fdf2f8" },
  { name: "פסטל מנטה", value: "#f0fdf4" },
  { name: "אפור בהיר", value: "#f8fafc" },
  { name: "כהה", value: "#1e293b" },
];

/** צבעי טקסט ברירת מחדל לטיוטה */
const DRAFT_TEXT_COLORS = [
  { name: "ברירת מחדל", value: "#1e1b4b" },
  { name: "שחור", value: "#0f172a" },
  { name: "אפור", value: "#64748b" },
  { name: "לבן", value: "#ffffff" },
  { name: "טורקיז", value: "#0d9488" },
  { name: "כחול", value: "#2563eb" },
  { name: "סגול", value: "#7c3aed" },
  { name: "ורוד", value: "#db2777" },
];

export interface DraftTheme {
  backgroundColor: string;
  textColor: string;
}

function Toolbar({
  editor,
  onImproveText,
  draftTheme,
  onDraftThemeChange,
}: {
  editor: ReturnType<typeof useEditor>;
  onImproveText?: () => void;
  draftTheme: DraftTheme;
  onDraftThemeChange?: (theme: DraftTheme) => void;
}) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const update = () =>
      setWordCount(
        editor.getText().split(/\s+/).filter(Boolean).length
      );
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    "px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors " +
    (active
      ? "bg-[var(--primary)] text-white"
      : "text-muted hover:bg-card hover:text-foreground");

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkInput(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-card p-2"
    >
      <div className="flex flex-wrap items-center gap-1">
      {/* גופן */}
      <select
        title="גופן"
        className={`${btn(editor.isActive("textStyle"))} min-w-[120px] cursor-pointer border-0 bg-transparent`}
        value={
          FONTS.find((f) => editor.getAttributes("textStyle").fontFamily === f.value)?.value ?? ""
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
      >
        {FONTS.map((f) => (
          <option key={f.value || "default"} value={f.value}>
            {f.name}
          </option>
        ))}
      </select>

      <span className="h-6 w-px bg-border self-center" aria-hidden />

      {/* מודגש, נטוי, קו תחתון, חוצה */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="מודגש"
      >
        ב
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic")) + (editor.isActive("italic") ? " italic" : "")}
        title="נטוי"
      >
        נ
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(editor.isActive("underline")) + (editor.isActive("underline") ? " underline" : "")}
        title="קו תחתון"
      >
        <u>ק</u>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike")) + (editor.isActive("strike") ? " line-through" : "")}
        title="קו חוצה"
      >
        <s>ס</s>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btn(editor.isActive("code")) + (editor.isActive("code") ? " font-mono text-xs" : "")}
        title="קוד"
      >
        &lt;/&gt;
      </button>

      <span className="h-6 w-px bg-border self-center" aria-hidden />

      {/* צבע טקסט */}
      <select
        title="צבע טקסט"
        className={`${btn(editor.isActive("textStyle"))} min-w-[90px] cursor-pointer border-0 bg-transparent`}
        value={editor.getAttributes("textStyle").color ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setColor(v).run();
          else editor.chain().focus().unsetColor().run();
        }}
      >
        {TEXT_COLORS.map((c) => (
          <option key={c.value || "default"} value={c.value}>
            {c.name}
          </option>
        ))}
      </select>

      {/* הדגשה */}
      <div className="relative inline-block group">
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHighlight({ color: "yellow" }).run()
          }
          className={btn(editor.isActive("highlight"))}
          title="הדגשה"
        >
          🖍
        </button>
        <div className="invisible absolute right-0 top-full z-10 mt-1 flex gap-0.5 rounded-lg border border-border bg-card p-1 opacity-0 shadow-lg group-hover:visible group-hover:opacity-100">
          {HIGHLIGHT_COLORS.map((h) => (
            <button
              key={h.value}
              type="button"
              title={h.name}
              className="h-6 w-6 rounded border border-border transition-transform hover:scale-110"
              style={{
                backgroundColor:
                  h.value === "yellow"
                    ? "#fef08a"
                    : h.value === "green"
                      ? "#bbf7d0"
                      : h.value === "blue"
                        ? "#bfdbfe"
                        : h.value === "pink"
                          ? "#fbcfe8"
                          : "#fed7aa",
              }}
              onClick={() =>
                editor.chain().focus().toggleHighlight({ color: h.value }).run()
              }
            />
          ))}
        </div>
      </div>

      <span className="h-6 w-px bg-border self-center" aria-hidden />

      {/* כותרות */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
        title="כותרת 1"
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
        title="כותרת 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
        title="כותרת 3"
      >
        H3
      </button>

      <span className="h-6 w-px bg-border self-center" aria-hidden />

      {/* רשימות וציטוט */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="רשימה"
      >
        •
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        title="רשימה ממוספרת"
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
        title="ציטוט"
      >
        "
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btn(false)}
        title="קו מפריד"
      >
        —
      </button>

      <span className="h-6 w-px bg-border self-center" aria-hidden />

      {/* יישור */}
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={btn(editor.isActive({ textAlign: "right" }))}
        title="יישור ימין"
      >
        ≡‎˃
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={btn(editor.isActive({ textAlign: "center" }))}
        title="מרכוז"
      >
        ≡
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={btn(editor.isActive({ textAlign: "left" }))}
        title="יישור שמאל"
      >
        ˃≡
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        className={btn(editor.isActive({ textAlign: "justify" }))}
        title="יישור לשתי צדדים"
      >
        ≡≡
      </button>

      <span className="h-6 w-px bg-border self-center" aria-hidden />

      {/* קישור */}
      {showLinkInput ? (
        <span className="flex items-center gap-1">
          <input
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setLink();
              if (e.key === "Escape") setShowLinkInput(false);
            }}
            className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted"
            dir="ltr"
            autoFocus
          />
          <button type="button" onClick={setLink} className={btn(true)}>
            ✓
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl("");
            }}
            className={btn(false)}
          >
            ✕
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setShowLinkInput(true)}
          className={btn(editor.isActive("link"))}
          title="קישור"
        >
          🔗
        </button>
      )}
      {editor.isActive("link") && (
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className={btn(false)}
          title="הסר קישור"
        >
          הסר קישור
        </button>
      )}

      {/* צבעי טיוטה – רקע וצבע טקסט */}
      {onDraftThemeChange && (
        <>
          <span className="h-6 w-px bg-border self-center" aria-hidden />
          <div className="relative inline-block group">
            <button
              type="button"
              className={btn(false)}
              title="צבעי טיוטה"
            >
              <span className="material-symbols-outlined text-sm">palette</span>
            </button>
            <div className="invisible absolute right-0 top-full z-20 mt-1 flex flex-col gap-2 rounded-lg border border-border bg-card p-3 opacity-0 shadow-xl group-hover:visible group-hover:opacity-100 min-w-[200px]">
              <span className="text-xs font-bold text-foreground">צבעי טיוטה</span>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted">רקע</label>
                <select
                  title="רקע טיוטה"
                  className="w-full cursor-pointer rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  value={draftTheme.backgroundColor}
                  onChange={(e) =>
                    onDraftThemeChange({
                      ...draftTheme,
                      backgroundColor: e.target.value,
                    })
                  }
                >
                  {DRAFT_BACKGROUNDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted">צבע טקסט</label>
                <select
                  title="צבע טקסט טיוטה"
                  className="w-full cursor-pointer rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  value={draftTheme.textColor}
                  onChange={(e) =>
                    onDraftThemeChange({
                      ...draftTheme,
                      textColor: e.target.value,
                    })
                  }
                >
                  {DRAFT_TEXT_COLORS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
      {onImproveText && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onImproveText}
            className="flex items-center gap-1 rounded px-2 py-1.5 text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10"
            title="שיפור טקסט"
          >
            <span className="material-symbols-outlined text-sm">magic_button</span>
            <span className="text-xs font-bold">שיפור טקסט</span>
          </button>
          <span className="text-xs text-muted">{wordCount} מילים</span>
        </div>
      )}
    </div>
  );
}

export const DEFAULT_DRAFT_THEME: DraftTheme = {
  backgroundColor: "#ffffff",
  textColor: "#1e1b4b",
};

const RichEditorInner = forwardRef<RichEditorHandle, {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImproveText?: () => void;
  draftTheme?: DraftTheme;
  onDraftThemeChange?: (theme: DraftTheme) => void;
}>(function RichEditorInner(
  { value, onChange, placeholder = "", onImproveText, draftTheme = DEFAULT_DRAFT_THEME, onDraftThemeChange },
  ref
) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener" },
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
    ],
    content: (value || "") as Content,
    editorProps: {
      attributes: {
        dir: "rtl",
        class:
          "min-h-[200px] px-4 py-3 bg-transparent focus:outline-none prose max-w-none prose-p:text-foreground prose-headings:text-foreground",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  const handleUpdate = useCallback(() => {
    if (editor) onChange(editor.getHTML());
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, handleUpdate]);

  useImperativeHandle(
    ref,
    () => ({
      getSelectedText() {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to);
      },
      replaceSelection(html: string) {
        if (!editor) return;
        editor.chain().focus().insertContent(html).run();
      },
    }),
    [editor]
  );

  if (!editor) return null;

  return (
    <div
      dir="rtl"
      className="overflow-hidden rounded-xl border border-border shadow-lg"
    >
      <Toolbar
        editor={editor}
        onImproveText={onImproveText}
        draftTheme={draftTheme}
        onDraftThemeChange={onDraftThemeChange}
      />
      <div
        className="min-h-[200px] px-4 py-3"
        style={{
          backgroundColor: draftTheme.backgroundColor,
          color: draftTheme.textColor,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

export const RichEditor = RichEditorInner;
