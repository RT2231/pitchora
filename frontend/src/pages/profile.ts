import { api, getCurrentUser } from "../api";
import { escapeHtml, formatSlotTime } from "../utils";

export async function renderProfile(container: HTMLElement, userId: string) {
  container.innerHTML = `<div class="loading">読み込み中…</div>`;
  const currentUser = getCurrentUser();

  let profile: any;
  try {
    profile = await api.getUserProfile(userId);
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="headline">ユーザーが見つかりません</div></div>`;
    return;
  }

  const { user, post_count, follower_count, following_count, is_following, is_self } = profile;

  container.innerHTML = `
    <a href="#/" class="btn btn-ghost" style="margin-top:20px">← 番組表に戻る</a>
    <div class="post-header">
      <div class="post-eyebrow">◉ PROFILE</div>
      <h1 class="post-title" style="font-size:26px">${escapeHtml(user.username)}</h1>
      <div class="post-byline">@${escapeHtml(user.user_id)}</div>
      <div class="slot-meta" style="margin-top:14px">
        <span>投稿 ${post_count}</span>
        <button class="btn btn-ghost" id="show-following" style="padding:2px 8px;font-size:12px">フォロー中 ${following_count}</button>
        <button class="btn btn-ghost" id="show-followers" style="padding:2px 8px;font-size:12px">フォロワー ${follower_count}</button>
      </div>
      ${
        !is_self && currentUser
          ? `<div class="post-actions">
               <button id="follow-toggle" class="btn ${is_following ? "" : "btn-primary"}">${is_following ? "フォロー中" : "フォローする"}</button>
             </div>`
          : !is_self && !currentUser
          ? `<p class="post-byline" style="margin-top:14px"><a href="#/login" style="color:var(--accent)">ログイン</a>するとフォローできます。</p>`
          : ""
      }
    </div>

    <div id="follow-list-panel"></div>

    <div class="comments-section">
      <div class="comments-heading">📺 投稿一覧</div>
      <div id="profile-posts" class="loading">読み込み中…</div>
    </div>
  `;

  if (!is_self && currentUser) {
    const btn = container.querySelector<HTMLButtonElement>("#follow-toggle")!;
    let following = is_following;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        if (following) {
          await api.unfollowUser(user.user_id);
          following = false;
        } else {
          await api.followUser(user.user_id);
          following = true;
        }
        btn.textContent = following ? "フォロー中" : "フォローする";
        btn.classList.toggle("btn-primary", !following);
      } catch {
        alert("操作に失敗しました。");
      } finally {
        btn.disabled = false;
      }
    });
  }

  container.querySelector("#show-following")!.addEventListener("click", () =>
    toggleFollowList(container, user.user_id, "following")
  );
  container.querySelector("#show-followers")!.addEventListener("click", () =>
    toggleFollowList(container, user.user_id, "followers")
  );

  await loadProfilePosts(container, user.user_id);
}

let openPanel: "followers" | "following" | null = null;

async function toggleFollowList(container: HTMLElement, userId: string, kind: "followers" | "following") {
  const panel = container.querySelector<HTMLDivElement>("#follow-list-panel")!;

  if (openPanel === kind) {
    panel.innerHTML = "";
    openPanel = null;
    return;
  }
  openPanel = kind;
  panel.innerHTML = `<div class="loading">読み込み中…</div>`;

  try {
    const { users } = kind === "followers" ? await api.listFollowers(userId) : await api.listFollowing(userId);
    if (users.length === 0) {
      panel.innerHTML = `<p class="post-byline" style="margin:16px 0">${kind === "followers" ? "フォロワー" : "フォロー中のユーザー"}はいません。</p>`;
      return;
    }
    panel.innerHTML = `
      <div class="form-card" style="padding:16px 20px">
        ${users
          .map(
            (u: any) => `
              <a href="#/users/${encodeURIComponent(u.user_id)}" style="display:block;padding:8px 0;border-bottom:1px solid var(--border)">
                <span class="comment-author">${escapeHtml(u.username)}</span>
                <span class="comment-time" style="margin-left:8px">@${escapeHtml(u.user_id)}</span>
              </a>
            `
          )
          .join("")}
      </div>
    `;
  } catch {
    panel.innerHTML = `<p class="post-byline">読み込みに失敗しました。</p>`;
  }
}

async function loadProfilePosts(container: HTMLElement, userId: string) {
  const listEl = container.querySelector<HTMLDivElement>("#profile-posts")!;
  try {
    const { posts } = await api.listPosts({ author: userId });
    if (posts.length === 0) {
      listEl.innerHTML = `<p class="post-byline">まだ投稿がありません。</p>`;
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
                <span>💬 ${p.comment_count}</span>
              </div>
            </div>
          </a>
        `;
      })
      .join("");
  } catch {
    listEl.innerHTML = `<p class="post-byline">読み込みに失敗しました。</p>`;
  }
}
