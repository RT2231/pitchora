import { api } from "../api";
import { escapeHtml, formatSlotTime } from "../utils";

const SORT_LABELS: Record<string, string> = {
  newest: "新着",
  popular: "人気",
  updated: "更新順",
};

export async function renderSearch(container: HTMLElement, initialQuery = "") {
  container.innerHTML = `<div class="loading">読み込み中…</div>`;

  let genres: { id: number; name: string }[] = [];
  try {
    const res = await api.listGenres();
    genres = res.genres;
  } catch {
    genres = [];
  }

  container.innerHTML = `
    <div class="post-header" style="margin-top:28px">
      <div class="post-eyebrow">🔍 SEARCH</div>
      <h1 class="post-title" style="font-size:26px">番組・ユーザーをさがす</h1>
    </div>

    <form id="search-form" class="form-card" style="padding:20px">
      <div class="field" style="margin-bottom:12px">
        <input type="text" id="search-q" placeholder="キーワード・タイトル・ユーザー名で検索…" value="${escapeAttr(initialQuery)}" />
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:140px;margin-bottom:0">
          <label for="search-genre">ジャンル</label>
          <select id="search-genre">
            <option value="">すべて</option>
            ${genres.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="flex:1;min-width:140px;margin-bottom:0">
          <label for="search-sort">並び替え</label>
          <select id="search-sort">
            ${Object.entries(SORT_LABELS)
              .map(([v, label]) => `<option value="${v}">${label}</option>`)
              .join("")}
          </select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:16px">検索する</button>
    </form>

    <div id="user-results"></div>

    <div class="comments-section">
      <div class="comments-heading">📺 番組</div>
      <div id="post-results" class="loading">検索条件を指定してください。</div>
    </div>
  `;

  const form = container.querySelector<HTMLFormElement>("#search-form")!;
  const qInput = container.querySelector<HTMLInputElement>("#search-q")!;
  const genreSelect = container.querySelector<HTMLSelectElement>("#search-genre")!;
  const sortSelect = container.querySelector<HTMLSelectElement>("#search-sort")!;

  async function runSearch() {
    const q = qInput.value.trim();
    const genreId = genreSelect.value ? Number(genreSelect.value) : undefined;
    const sort = sortSelect.value as "newest" | "popular" | "updated";

    await Promise.all([searchPosts(container, q, genreId, sort), searchUsers(container, q)]);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });

  if (initialQuery) {
    await runSearch();
  } else {
    // キーワード未指定でも、ジャンル・並び替えの初期状態で新着を見せる
    await searchPosts(container, "", undefined, "newest");
  }
}

async function searchPosts(container: HTMLElement, q: string, genreId: number | undefined, sort: "newest" | "popular" | "updated") {
  const listEl = container.querySelector<HTMLDivElement>("#post-results")!;
  listEl.innerHTML = `<div class="loading">読み込み中…</div>`;
  try {
    const { posts } = await api.listPosts({ q: q || undefined, genre_id: genreId, sort });
    if (posts.length === 0) {
      listEl.innerHTML = `<p class="post-byline">条件に一致する番組が見つかりませんでした。</p>`;
      return;
    }
    listEl.innerHTML = posts
      .map((p: any) => {
        const { day, time } = formatSlotTime(p.created_at);
        return `
          <a class="slot" href="#/posts/${p.id}" style="display:grid">
            <div class="slot-time"><span class="day">${day}</span>${time}</div>
            <div>
              <span class="slot-genre">${escapeHtml(p.genre_name)}</span>
              <h2 class="slot-title">${escapeHtml(p.title)}</h2>
              <p class="slot-desc">${escapeHtml(p.description)}</p>
              <div class="slot-meta">
                <span>@${escapeHtml(p.author_user_id)}</span>
                <span>❤️ ${p.like_count ?? 0}</span>
                <span>💬 ${p.comment_count}</span>
              </div>
            </div>
          </a>
        `;
      })
      .join("");
  } catch {
    listEl.innerHTML = `<p class="post-byline">検索に失敗しました。</p>`;
  }
}

async function searchUsers(container: HTMLElement, q: string) {
  const panel = container.querySelector<HTMLDivElement>("#user-results")!;
  if (!q) {
    panel.innerHTML = "";
    return;
  }
  try {
    const { users } = await api.searchUsers(q);
    if (users.length === 0) {
      panel.innerHTML = "";
      return;
    }
    panel.innerHTML = `
      <div class="comments-section" style="margin-top:32px">
        <div class="comments-heading">👤 ユーザー</div>
        <div class="form-card" style="padding:16px 20px">
          ${users
            .map(
              (u) => `
                <a href="#/users/${encodeURIComponent(u.user_id)}" style="display:block;padding:8px 0;border-bottom:1px solid var(--border)">
                  <span class="comment-author">${escapeHtml(u.username)}</span>
                  <span class="comment-time" style="margin-left:8px">@${escapeHtml(u.user_id)}</span>
                </a>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  } catch {
    panel.innerHTML = "";
  }
}

function escapeAttr(input: string): string {
  return input.replace(/"/g, "&quot;");
}
