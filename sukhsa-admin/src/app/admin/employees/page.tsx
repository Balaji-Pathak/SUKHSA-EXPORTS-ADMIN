import Link from "next/link";
import type { Metadata } from "next";
import { Search, Users, ChevronRight } from "lucide-react";
import { listDepartments, listEmployees, nextEmpCode } from "@/lib/services/employees";
import { Badge, Card, EmptyState, PageHeader, field, table } from "@/components/ui/ui";
import { fmtRate } from "@/lib/dates";
import { EmployeeDialog } from "@/components/admin/EmployeeDialog";

export const metadata: Metadata = { title: "Employees · Sukhsa Exports Admin" };

type SP = { q?: string; category?: string; status?: string; department?: string };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = sp.category === "permanent" || sp.category === "temporary" ? sp.category : undefined;
  const status = sp.status === "inactive" ? "inactive" : sp.status === "all" ? "all" : "active";
  const [employees, departments, suggested] = await Promise.all([
    listEmployees({ q: sp.q, category, department: sp.department || undefined, active: status === "all" ? undefined : status === "active" }),
    listDepartments(),
    nextEmpCode(),
  ]);

  const chip = (label: string, params: Partial<SP>, on: boolean) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...params }).filter(([, v]) => v) as [string, string][]);
    return (
      <Link
        key={label}
        href={`/admin/employees?${q}`}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft hover:text-ink"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="animate-rise">
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} shown`}
        actions={<EmployeeDialog departments={departments} suggestedCode={suggested} />}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <form className="relative w-full lg:max-w-sm" action="/admin/employees">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            {category && <input type="hidden" name="category" value={category} />}
            {status !== "active" && <input type="hidden" name="status" value={status} />}
            <input name="q" defaultValue={sp.q} placeholder="Search name, code or department" className={`${field.input} pl-9`} />
          </form>
          <div className="flex flex-wrap gap-1.5">
            {chip("All categories", { category: "" }, !category)}
            {chip("Permanent", { category: "permanent" }, category === "permanent")}
            {chip("Temporary", { category: "temporary" }, category === "temporary")}
            <span className="mx-1 w-px self-stretch bg-line" />
            {chip("Active", { status: "" }, status === "active")}
            {chip("Inactive", { status: "inactive" }, status === "inactive")}
            {chip("All", { status: "all" }, status === "all")}
          </div>
        </div>

        {employees.length === 0 ? (
          <EmptyState icon={Users} title="No employees match">Try a different search or filter.</EmptyState>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Code</th>
                  <th className={table.th}>Name</th>
                  <th className={table.th}>Department</th>
                  <th className={table.th}>Category</th>
                  <th className={table.thNum}>Rate / hr</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th} aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e._id} className={table.row}>
                    <td className={table.td}>{e.empCode}</td>
                    <td className={table.tdStrong}>
                      <Link href={`/admin/employees/${e._id}`} className="hover:text-brand">
                        {e.name}
                      </Link>
                    </td>
                    <td className={table.td}>{e.department || "—"}</td>
                    <td className={table.td}>
                      <Badge tone={e.category === "permanent" ? "green" : "amber"}>{e.category === "permanent" ? "Permanent" : "Temporary"}</Badge>
                    </td>
                    <td className={table.num}>₹{fmtRate(e.hourlyRate)}</td>
                    <td className={table.td}>{e.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className={`${table.td} text-right`}>
                      <Link href={`/admin/employees/${e._id}`} className="inline-flex text-ink-faint hover:text-brand" aria-label={`Open ${e.name}`}>
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
