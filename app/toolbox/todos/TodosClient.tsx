"use client";

import { useCallback } from "react";
import { useToolboxData } from "../../../components/toolbox/useToolboxData";
import {
  useTodos,
  type TodosUpdater,
} from "../../../components/toolbox/useTodos";
import TodoPanel from "../../../components/toolbox/TodoPanel";
import BackLink from "../../../components/toolbox/BackLink";
import type { ToolboxData } from "../../../components/toolbox/types";

export default function TodosClient() {
  const { data, updateData } = useToolboxData();

  if (!data) {
    return (
      <div className="w-full max-w-5xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
        <div className="h-96 rounded-3xl bg-white/30 dark:bg-slate-800/30 backdrop-blur-md border border-white/40 dark:border-white/10 animate-pulse" />
      </div>
    );
  }

  return <TodosWorkspace data={data} updateData={updateData} />;
}

function TodosWorkspace({
  data,
  updateData,
}: {
  data: ToolboxData;
  updateData: (updater: (d: ToolboxData) => ToolboxData) => void;
}) {
  const handleTodosChange = useCallback(
    (updater: TodosUpdater) =>
      updateData((d) => ({ ...d, todos: updater(d.todos) })),
    [updateData]
  );
  const todosApi = useTodos(data.todos, handleTodosChange);

  return (
    <div className="w-full max-w-5xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
      <BackLink />
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-2 transition-colors duration-700">
          TodoList
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">
          待办清单 · 数据仅保存在当前浏览器
        </p>
      </div>
      <div className="pb-10">
        <TodoPanel api={todosApi} />
      </div>
    </div>
  );
}
