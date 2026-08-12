"use client";

import { useEffect, useRef, useState } from "react";
import {
  ListTodo,
  Plus,
  Trash2,
  Pencil,
  Flag,
  Calendar,
  Search,
  Check,
  GripVertical,
  Tags,
} from "lucide-react";
import { useToast } from "../ToastProvider";
import type { TodoItem, TodoPriority } from "./types";
import {
  RECYCLE_TTL,
  type TodoFilter,
  type TodoSort,
  type UseTodosReturn,
} from "./useTodos";
import { dateKeyOffset, todayKey } from "./storage";

const PRIORITY_META: Record<
  TodoPriority,
  { label: string; dot: string; badge: string; select: string }
> = {
  high: {
    label: "高",
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    select: "text-red-600 dark:text-red-400",
  },
  medium: {
    label: "中",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    select: "text-amber-600 dark:text-amber-400",
  },
  low: {
    label: "低",
    dot: "bg-slate-400",
    badge: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
    select: "text-slate-600 dark:text-slate-400",
  },
};

const FILTER_TABS: { key: TodoFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "进行中" },
  { key: "completed", label: "已完成" },
];

const SORT_OPTIONS: { key: TodoSort; label: string }[] = [
  { key: "created", label: "创建时间" },
  { key: "priority", label: "优先级" },
  { key: "due", label: "截止日期" },
  { key: "manual", label: "手动排序" },
];

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDateShort(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`;
}

/** 截止日期快捷选择器:今天/明天/自定义/清除,新增栏与编辑表单共用 */
function DateQuickPicker({
  value,
  onChange,
  compact = false,
}: {
  value?: string;
  onChange: (v?: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnCls = compact
    ? "h-8 px-2 rounded-lg text-xs"
    : "h-11 px-3 rounded-xl text-sm";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="设置截止日期"
        aria-expanded={open}
        title={value ? `截止日期:${value}` : "设置截止日期"}
        className={`${btnCls} border font-bold flex items-center gap-1.5 transition-colors ${
          value
            ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
            : "bg-white/50 dark:bg-slate-900/50 border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-300"
        }`}
      >
        <Calendar className="w-4 h-4 shrink-0" />
        <span className="max-w-[7.5rem] truncate">
          {value ? formatDateShort(value) : "期限"}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-30 w-52 rounded-2xl border border-white/60 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl p-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                onChange(dateKeyOffset(0));
                setOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl text-sm font-bold text-left hover:bg-indigo-500/10"
            >
              今天
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(dateKeyOffset(1));
                setOpen(false);
              }}
              className="w-full px-3 py-2 rounded-xl text-sm font-bold text-left hover:bg-indigo-500/10"
            >
              明天
            </button>
            <input
              type="date"
              value={value ?? ""}
              onChange={(e) => {
                onChange(e.target.value || undefined);
                setOpen(false);
              }}
              aria-label="自定义截止日期"
              className="w-full h-9 px-2 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-sm font-bold text-left text-red-500 hover:bg-red-500/10"
              >
                清除期限
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** 标签选择器:从标签库选择/新建,新增栏与编辑表单共用 */
function TagPicker({
  value,
  tags,
  onChange,
  onAddTag,
  compact = false,
}: {
  value?: string;
  tags: string[];
  onChange: (v?: string) => void;
  onAddTag: (name: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const btnCls = compact
    ? "h-8 px-2 rounded-lg text-xs"
    : "h-11 px-3 rounded-xl text-sm";
  const commitNew = () => {
    const name = draft.trim();
    if (!name) return;
    onAddTag(name);
    onChange(name);
    setDraft("");
    setOpen(false);
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="选择标签"
        aria-expanded={open}
        className={`${btnCls} border font-bold flex items-center gap-1.5 transition-colors ${
          value
            ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
            : "bg-white/50 dark:bg-slate-900/50 border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-300"
        }`}
      >
        <Tags className="w-4 h-4 shrink-0" />
        <span className="max-w-[7rem] truncate">{value || "标签"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-30 w-56 rounded-2xl border border-white/60 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl p-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 rounded-xl text-sm font-bold text-left hover:bg-indigo-500/10 ${
                !value
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                  : ""
              }`}
            >
              无标签
            </button>
            {tags.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                还没有标签,输入新标签后回车即可创建
              </p>
            )}
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  onChange(tag);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-sm font-bold text-left truncate hover:bg-indigo-500/10 ${
                  value === tag
                    ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                    : ""
                }`}
              >
                {tag}
              </button>
            ))}
            <div className="flex gap-1 pt-1.5 mt-1 border-t border-white/30 dark:border-white/10">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitNew();
                  }
                }}
                placeholder="新建标签"
                aria-label="新建标签"
                className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button
                type="button"
                onClick={commitNew}
                className="h-9 px-3 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function TodoPanel({
  api,
  tags,
  onAddTag,
  onRenameTag,
  onDeleteTag,
}: {
  api: UseTodosReturn;
  tags: string[];
  onAddTag: (name: string) => void;
  onRenameTag: (oldName: string, newName: string) => void;
  onDeleteTag: (name: string) => void;
}) {
  const { showToast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TodoPriority>("medium");
  const [newDueDate, setNewDueDate] = useState<string | undefined>(undefined);
  const [newTag, setNewTag] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TodoItem | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);

  const today = todayKey();

  useEffect(() => {
    addInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editingId) editTitleRef.current?.focus();
  }, [editingId]);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    api.add(newTitle, {
      priority: newPriority,
      dueDate: newDueDate,
      tag: newTag,
    });
    if (newTag) onAddTag(newTag);
    setNewTitle("");
    setNewDueDate(undefined);
    setNewTag(undefined);
    addInputRef.current?.focus();
  };

  const handleRemove = (t: TodoItem) => {
    if (editingId === t.id) {
      setEditingId(null);
      setDraft(null);
    }
    api.remove(t.id);
    showToast(
      `已删除「${t.title}」`,
      "info",
      {
        label: "撤销",
        onClick: () => api.undoRemove([t]),
      },
      RECYCLE_TTL
    );
  };

  const handleClearCompleted = () => {
    const completed = api.todos.filter((x) => x.completed);
    if (!completed.length) return;
    api.clearCompleted();
    showToast(
      `已清空 ${completed.length} 项已完成任务`,
      "info",
      {
        label: "撤销",
        onClick: () => api.undoRemove(completed),
      },
      RECYCLE_TTL
    );
  };

  const startEdit = (t: TodoItem) => {
    setEditingId(t.id);
    setDraft({ ...t });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!editingId || !draft) return;
    const title = draft.title.trim();
    if (!title) return;
    const nextTag = draft.tag?.trim() || undefined;
    api.update(editingId, {
      title,
      note: draft.note?.trim() || undefined,
      priority: draft.priority,
      tag: nextTag,
      dueDate: draft.dueDate || undefined,
    });
    if (nextTag) onAddTag(nextTag);
    cancelEdit();
  };

  const handleCommitNewTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    onAddTag(name);
    setNewTagName("");
  };

  const handleCommitRename = () => {
    if (renamingTag) {
      onRenameTag(renamingTag, tagDraft);
      if (api.tagFilter === renamingTag) {
        api.setTagFilter(tagDraft.trim() || null);
      }
    }
    setRenamingTag(null);
    setTagDraft("");
  };

  const handleDeleteTag = (tag: string) => {
    onDeleteTag(tag);
    if (api.tagFilter === tag) api.setTagFilter(null);
  };

  const dueTodayCount = api.todos.filter(
    (t) => !t.completed && t.dueDate === today
  ).length;

  const progress =
    api.counts.total > 0 ? api.counts.completed / api.counts.total : 0;

  const tagChipCls = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${
      active
        ? "bg-indigo-500 text-white border-indigo-500"
        : "bg-white/40 dark:bg-slate-900/40 border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/10"
    }`;

  return (
    <section className="rounded-3xl backdrop-blur-md border shadow-xl p-6 bg-white/40 dark:bg-slate-800/40 border-white/60 dark:border-slate-600/50 flex flex-col">
      <header className="flex items-center gap-3 mb-5">
        <span className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <ListTodo className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">
            TodoList
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            待办清单 · 数据保存在本机浏览器
          </p>
        </div>
      </header>

      {/* 添加栏:标题 + 优先级 + 期限 + 标签 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          ref={addInputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="添加新任务，回车确认..."
          aria-label="新任务标题"
          className="flex-1 min-w-[180px] h-11 px-4 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-white/10 text-sm text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
          className="h-11 px-2 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-white/50 dark:border-white/10 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          title="优先级"
          aria-label="优先级"
        >
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
        <DateQuickPicker value={newDueDate} onChange={setNewDueDate} />
        <TagPicker
          value={newTag}
          tags={tags}
          onChange={setNewTag}
          onAddTag={onAddTag}
        />
        <button
          onClick={handleAdd}
          className="h-11 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm flex items-center gap-1 transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>

      {/* 筛选行:状态 Tab + 搜索 + 排序 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => api.setFilter(tab.key)}
            aria-pressed={api.filter === tab.key}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              api.filter === tab.key
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-white/40 dark:bg-slate-900/40 border-white/50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={api.keyword}
            onChange={(e) => api.setKeyword(e.target.value)}
            placeholder="搜索任务..."
            aria-label="搜索任务"
            className="w-full h-9 pl-9 pr-3 rounded-full bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <select
          value={api.sort}
          onChange={(e) => api.setSort(e.target.value as TodoSort)}
          className="h-9 px-2 rounded-full bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none"
          title="排序"
          aria-label="排序方式"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* 标签筛选与管理 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => api.setTagFilter(null)}
          aria-pressed={api.tagFilter === null}
          className={tagChipCls(api.tagFilter === null)}
        >
          全部
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() =>
              api.setTagFilter(api.tagFilter === tag ? null : tag)
            }
            aria-pressed={api.tagFilter === tag}
            className={tagChipCls(api.tagFilter === tag)}
          >
            <Tags className="w-3 h-3" />
            {tag}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTagManagerOpen((o) => !o)}
          aria-expanded={tagManagerOpen}
          className="px-2.5 py-1 rounded-full text-xs font-bold border border-white/50 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all flex items-center gap-1"
        >
          <Pencil className="w-3 h-3" />
          管理
        </button>
      </div>

      {tagManagerOpen && (
        <div className="mb-3 rounded-2xl border border-white/60 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 p-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCommitNewTag();
                }
              }}
              placeholder="新建标签"
              aria-label="新建标签"
              className="flex-1 h-9 px-3 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button
              type="button"
              onClick={handleCommitNewTag}
              className="h-9 px-3 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition-colors"
            >
              新建
            </button>
          </div>
          {tags.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              暂无标签,新建后即可给任务打标签
            </p>
          )}
          {tags.map((tag) => (
            <div key={tag} className="flex items-center gap-2">
              {renamingTag === tag ? (
                <>
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCommitRename();
                      } else if (e.key === "Escape") {
                        setRenamingTag(null);
                        setTagDraft("");
                      }
                    }}
                    autoFocus
                    aria-label={`重命名标签 ${tag}`}
                    className="flex-1 h-8 px-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleCommitRename}
                    className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingTag(null);
                      setTagDraft("");
                    }}
                    className="h-8 px-3 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    {tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingTag(tag);
                      setTagDraft(tag);
                    }}
                    aria-label={`重命名标签 ${tag}`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag)}
                    aria-label={`删除标签 ${tag}`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {api.sort === "manual" && (
        <p className="mb-3 text-xs font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5" />
          手动排序模式:拖拽任务行可调整顺序
        </p>
      )}

      {api.counts.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
            <span>
              进行中 {api.counts.active} · 已完成 {api.counts.completed} · 共{" "}
              {api.counts.total}
              {dueTodayCount > 0 && (
                <span className="ml-2 text-amber-500 dark:text-amber-400">
                  · 今日到期 {dueTodayCount}
                </span>
              )}
            </span>
            {api.counts.completed > 0 && (
              <button
                onClick={handleClearCompleted}
                className="text-red-500 hover:text-red-600 dark:text-red-400 transition-colors"
              >
                清空已完成
              </button>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      <ul className="flex-1 space-y-2 overflow-y-auto max-h-[560px] pr-1 list-none">
        {api.visible.length === 0 && (
          <li className="py-12 text-center text-sm text-slate-400 dark:text-slate-500 font-medium">
            {api.counts.total === 0 ? "暂无任务，先添加一条吧" : "没有匹配的任务"}
          </li>
        )}

        {api.visible.map((t) => {
          const meta = PRIORITY_META[t.priority];
          const overdue = !t.completed && !!t.dueDate && t.dueDate < today;
          const dueToday = !t.completed && t.dueDate === today;
          return (
            <li
              key={t.id}
              draggable={api.sort === "manual"}
              onDragStart={(e) => {
                setDragId(t.id);
                try {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", t.id);
                } catch {
                  // 静默
                }
              }}
              onDragOver={(e) => {
                if (api.sort !== "manual" || !dragId || dragId === t.id) return;
                e.preventDefault();
                setDragOverId(t.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== t.id) api.moveBefore(dragId, t.id);
                setDragId(null);
                setDragOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDragOverId(null);
              }}
              className={`rounded-2xl border p-3.5 transition-all ${
                api.sort === "manual"
                  ? "cursor-grab active:cursor-grabbing"
                  : ""
              } ${dragId === t.id ? "opacity-40" : t.completed ? "opacity-70" : ""} ${
                dragOverId === t.id && dragId !== t.id
                  ? "ring-2 ring-indigo-500/70 border-indigo-400"
                  : ""
              } ${
                t.completed
                  ? "bg-white/30 dark:bg-slate-900/30 border-white/40 dark:border-white/5"
                  : "bg-white/50 dark:bg-slate-900/50 border-white/60 dark:border-white/10"
              }`}
            >
              {editingId === t.id && draft ? (
                <div className="space-y-2">
                  <input
                    ref={editTitleRef}
                    type="text"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    aria-label="任务标题"
                    className="w-full h-9 px-3 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <textarea
                    value={draft.note ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, note: e.target.value })
                    }
                    placeholder="备注(可选)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={draft.priority}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          priority: e.target.value as TodoPriority,
                        })
                      }
                      aria-label="优先级"
                      className="h-8 px-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10 text-xs font-bold focus:outline-none"
                    >
                      <option value="high">高优先级</option>
                      <option value="medium">中优先级</option>
                      <option value="low">低优先级</option>
                    </select>
                    <TagPicker
                      compact
                      value={draft.tag}
                      tags={tags}
                      onChange={(v) => setDraft({ ...draft, tag: v })}
                      onAddTag={onAddTag}
                    />
                    <DateQuickPicker
                      compact
                      value={draft.dueDate}
                      onChange={(v) => setDraft({ ...draft, dueDate: v })}
                    />
                    <div className="ml-auto flex gap-1.5">
                      <button
                        onClick={saveEdit}
                        className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="h-8 px-3 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => api.toggle(t.id)}
                    aria-pressed={t.completed}
                    aria-label={
                      t.completed ? "标记为未完成" : "标记为已完成"
                    }
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      t.completed
                        ? "bg-indigo-500 border-indigo-500 text-white"
                        : "border-slate-300 dark:border-slate-500 hover:border-indigo-500 text-transparent"
                    }`}
                    title={t.completed ? "标记为未完成" : "标记为已完成"}
                  >
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-sm break-all ${
                          t.completed
                            ? "text-slate-400 dark:text-slate-500 line-through"
                            : "text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {t.title}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`}
                        title={`${meta.label}优先级`}
                      />
                    </div>
                    {t.note && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                        {t.note}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded-full border font-bold ${meta.badge}`}
                      >
                        <Flag className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                        {meta.label}优先级
                      </span>
                      {t.tag && (
                        <span className="px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                          {t.tag}
                        </span>
                      )}
                      {t.dueDate && (
                        <span
                          className={`px-2 py-0.5 rounded-full border font-bold ${
                            overdue
                              ? "border-red-500/40 bg-red-500/10 text-red-500"
                              : dueToday
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400"
                          }`}
                          title={t.dueDate}
                        >
                          <Calendar className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                          {formatDateShort(t.dueDate)}
                        </span>
                      )}
                      {t.completed && t.completedAt && (
                        <span className="text-slate-400 dark:text-slate-500 font-medium">
                          {new Date(t.completedAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {api.sort === "manual" && (
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 cursor-grab"
                        title="拖拽排序"
                        aria-hidden
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>
                    )}
                    <button
                      onClick={() => startEdit(t)}
                      aria-label="编辑任务"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(t)}
                      aria-label="删除任务"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
