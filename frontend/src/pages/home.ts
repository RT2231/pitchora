import { api, getCurrentUser } from "../api";
import { escapeHtml, formatSlotTime, VISIBILITY_LABEL } from "../utils";

export async function renderHome(container: HTMLElement) {
  const user = getCurrentUser();

  container.innerHTML = `
    <div class="post-header" style="margin-top:28px">
      <div class="post-eyebrow">◉ ON AIR TIMELINE</div>
      <h1 class="post-title" style="font-size:26px">みんなの番組表</h1>
      ${
        user
          ? `<a href="#/new" class="btn btn-primary">＋ 番組を投稿する</a>`
          : `<p class="post-byline">投稿するには <a href="#/login" style="color:var(--accent)">ログイン</a> してください。</p>`
      }
    </div>
    <div id="post-list" class="loading">読み込み中…</div>
  `;

  const listEl = container.querySelector<HTMLDivElement>("#post-list")!;

  try {
    const { posts } = await api.listPosts();
    if (posts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="headline">まだ番組がありません</div>
          <p>最初の番組を投稿して、放送を始めましょう。</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = posts
      .map((p: any) => {
        const { day, time } = formatSlotTime(p.created_at);
        const visTag =
          p.visibility !== "public"
            ? `<span class="visibility-tag">${VISIBILITY_LABEL[p.visibility]}</span>`
            : "";
        return `
          <div class="slot" data-post-link="${p.id}" style="display:grid;cursor:pointer">
            <div class="slot-time"><span class="day">${day}</span>${time}</div>
            <div>
              <span class="slot-genre">${escapeHtml(p.genre_name)}</span>
              <h2 class="slot-title">${escapeHtml(p.title)}</h2>
              <p class="slot-desc">${escapeHtml(p.description)}</p>
              <div class="slot-meta">
                <a href="#/users/${encodeURIComponent(p.author_user_id)}" style="color:inherit" onclick="event.stopPropagation()">@${escapeHtml(p.author_user_id)}</a>
                <span>❤️ ${p.like_count ?? 0}</span>
                <span>💬 ${p.comment_count}</span>
                ${visTag}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll<HTMLDivElement>("[data-post-link]").forEach((el) => {
      el.addEventListener("click", () => {
        window.location.hash = `/posts/${el.dataset.postLink}`;
      });
    });
  } catch {
    listEl.innerHTML = `<div class="empty-state">番組表の読み込みに失敗しました。</div>`;
  }
}
