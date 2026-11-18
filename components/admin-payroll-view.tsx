"use client";

import { PayrollComponentsView } from "@/components/payroll/payroll-components-view";
import { PayrollAdjustmentsView, PayrollLocksView, PayrollOvertimeView } from "@/components/payroll/payroll-operations-view";
import { PayrollPayslipsView } from "@/components/payroll/payroll-payslips-view";
import { PayrollPeriodsView } from "@/components/payroll/payroll-periods-view";
import { PayrollRunsView } from "@/components/payroll/payroll-runs-view";
import { PayrollSettingsView } from "@/components/payroll/payroll-settings-view";

export type PayrollView = "runs" | "periods" | "settings" | "components" | "payslips" | "overtime" | "adjustments" | "locks";

export function AdminPayrollView({ view, permissions }: { view: PayrollView; permissions: string[] }) {
  switch (view) {
    case "periods":
      return <PayrollPeriodsView permissions={permissions} />;
    case "settings":
      return <PayrollSettingsView permissions={permissions} />;
    case "components":
      return <PayrollComponentsView permissions={permissions} />;
    case "payslips":
      return <PayrollPayslipsView permissions={permissions} />;
    case "overtime":
      return <PayrollOvertimeView permissions={permissions} />;
    case "adjustments":
      return <PayrollAdjustmentsView permissions={permissions} />;
    case "locks":
      return <PayrollLocksView permissions={permissions} />;
    case "runs":
    default:
      return <PayrollRunsView permissions={permissions} />;
  }
}
