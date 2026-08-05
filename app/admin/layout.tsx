import AdminReadonly from "../../components/admin/AdminReadonly";
import AdminShell from "../../components/admin/AdminShell";

// 统一管理后台：生产只读，本地 dev 渲染 AdminShell 外壳
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") return <AdminReadonly />;
  return <AdminShell>{children}</AdminShell>;
}
