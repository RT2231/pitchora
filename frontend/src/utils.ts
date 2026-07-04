export function escapeHtml(input: string): string {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

// 番組表のオンエア時刻風にタイムスタンプを整形する（APIはUTCのISO8601文字列を返す）
export function formatSlotTime(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const day = days[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { day: `${d.getMonth() + 1}/${d.getDate()}(${day})`, time: `${hh}:${mm}` };
}

export function formatRelative(iso: string): string {
  const { day, time } = formatSlotTime(iso);
  return `${day} ${time}`;
}

export const VISIBILITY_LABEL: Record<string, string> = {
  public: "公開",
  unlisted: "限定公開",
  private: "非公開（下書き）",
};
