import { useMemo, useState } from "react";
import { MONTHS, todayISO } from "../format";
import { useYear } from "../hooks";
import { useStore } from "../store";
import { payerLabel } from "../model";
import { TopBar } from "../components/TopBar";
import { BackIcon, ForwardIcon } from "../components/Icons";
import { ChartCard, HBars, MonthColumns, SplitBar, TipRow, fullMoney } from "../components/charts";

const C = { gross: "var(--gross)", net: "var(--net)", paye: "var(--paye)", nis: "var(--nis)" };
// Payslips are parts of the gross, so they are shades of the gross blue, then spare colours.
const PAYSLIP_SHADES = ["var(--gross)", "var(--gross-2)", "var(--s3)", "var(--s4)"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const MAX_SITES = 8;

export function ChartsScreen() {
  const { data } = useStore();
  const [year, setYear] = useState(Number(todayISO().slice(0, 4)));
  const months = useYear(year);

  const bySite = useMemo(() => {
    const totals = new Map<string, { name: string; value: number }>();
    for (const m of months) {
      for (const { entry, pay } of m.entries) {
        if (pay.total <= 0) continue;
        const key = entry.site.trim().toLowerCase();
        const row = totals.get(key) ?? { name: entry.site.trim(), value: 0 };
        row.value += pay.total;
        totals.set(key, row);
      }
    }
    const sorted = [...totals.values()].sort((a, b) => b.value - a.value);
    if (sorted.length <= MAX_SITES) return sorted;
    const rest = sorted.slice(MAX_SITES - 1).reduce((s, r) => s + r.value, 0);
    return [...sorted.slice(0, MAX_SITES - 1), { name: "Other", value: rest }];
  }, [months]);

  const byPayer = useMemo(() => {
    const totals = new Map<string, number>();
    for (const m of months) for (const p of m.payers) totals.set(p.payer, (totals.get(p.payer) ?? 0) + p.gross);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([payer, value], i) => ({ name: payerLabel(data.payerNames, payer), value, color: PAYSLIP_SHADES[i] ?? "var(--muted)" }));
  }, [months, data.payerNames]);

  const gross = months.map((m) => m.gross);
  const net = months.map((m) => m.net);
  const paye = months.map((m) => m.paye);
  const nis = months.map((m) => m.nis);
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const siteTotal = sum(bySite.map((s) => s.value));
  const hasData = sum(gross) > 0;
  const monthRows = (a: number[], b: number[]) => MONTHS.map((m, i) => [m, fullMoney(a[i] ?? 0), fullMoney(b[i] ?? 0)]);

  return (
    <>
      <TopBar title="Charts" />
      <div className="monthbar">
        <button className="icon" onClick={() => setYear(year - 1)} aria-label="Previous year"><BackIcon /></button>
        <div className="monthname">{year}</div>
        <button className="icon" onClick={() => setYear(year + 1)} aria-label="Next year"><ForwardIcon /></button>
      </div>

      {!hasData && <p className="notice">No income logged for {year} yet. Charts appear once you log some days.</p>}

      <ChartCard
        title="Year to date by site"
        note="Gross income per site, from the days you logged."
        table={{ head: ["Site", "Gross"], rows: bySite.map((s) => [s.name, fullMoney(s.value)]), foot: ["Total", fullMoney(siteTotal)] }}
      >
        <HBars
          rows={bySite}
          format={(n) => `$${Math.round(n).toLocaleString("en-US")}`}
          tipFor={(r) => (<><TipRow color={C.gross} label={r.name} value={fullMoney(r.value)} /><div className="tip-title">{siteTotal > 0 ? ((r.value / siteTotal) * 100).toFixed(1) : 0}% of site income</div></>)}
        />
      </ChartCard>

      <ChartCard
        title="Gross and net by month"
        legend={[{ name: "Gross", color: C.gross }, { name: "Net", color: C.net }]}
        table={{ head: ["Month", "Gross", "Net"], rows: monthRows(gross, net), foot: ["Total", fullMoney(sum(gross)), fullMoney(sum(net))] }}
      >
        <MonthColumns
          title="Gross and net income by month"
          labels={SHORT}
          tipTitle={(i) => `${MONTHS[i]} ${year}`}
          series={[{ name: "Gross", color: C.gross, values: gross }, { name: "Net", color: C.net, values: net }]}
        />
      </ChartCard>

      <ChartCard
        title="PAYE and NIS by month"
        legend={[{ name: "PAYE", color: C.paye }, { name: "NIS", color: C.nis }]}
        table={{ head: ["Month", "PAYE", "NIS"], rows: monthRows(paye, nis), foot: ["Total", fullMoney(sum(paye)), fullMoney(sum(nis))] }}
      >
        <MonthColumns
          title="PAYE and NIS by month"
          labels={SHORT}
          tipTitle={(i) => `${MONTHS[i]} ${year}`}
          series={[{ name: "PAYE", color: C.paye, values: paye }, { name: "NIS", color: C.nis, values: nis }]}
        />
      </ChartCard>

      {byPayer.length > 0 && (
        <ChartCard
          title="Gross by payslip"
          note="How the year's gross splits between your payslips."
          table={{ head: ["Payslip", "Gross", "Share"], rows: byPayer.map((p) => [p.name, fullMoney(p.value), `${((p.value / sum(byPayer.map((x) => x.value))) * 100).toFixed(1)}%`]) }}
        >
          <SplitBar parts={byPayer} />
        </ChartCard>
      )}
    </>
  );
}
