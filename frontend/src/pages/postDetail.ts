import { api, getCurrentUser, ApiClientError } from "../api";
import { escapeHtml, formatRelative, VISIBILITY_LABEL } from "../utils";
import { navigate } from "../router";

export async function renderPostDetail(container: HTMLElement, id: number) {
  container.innerHTML = `<div class="loading">読み込み中…</div>`;
  const user = getCurrentUser();

  let post: any;
  try {
    const res = await api.getPost(id);
    post = res.post;
  } catch {
    container.innerHTML = `<div class="empty-state"><div class="headline">番組が見つかりません</div><p>削除されたか、非公開の可能性があります。</p></div>`;
    return;
  }

  const isOwner = user && user.id === post.user_id;

  container.innerHTML = `
    <a href="#/" class="btn btn-ghost" style="margin-top:20px">← 番組表に戻る</a>
    <div class="post-header">
      <div class="post-eyebrow">${escapeHtml(post.genre_name)}${post.visibility !== "public" ? ` ・ ${VISIBILITY_LABEL[post.visibility]}` : ""}</div>
      <h1 class="post-title">${escapeHtml(post.title)}</h1>
      <div class="post-byline">@${escapeHtml(post.author_user_id)} ・ ${formatRelative(post.created_at)} OA</div>
      ${
        isOwner
          ? `<div class="post-actions">
               <a href="#/posts/${post.id}/edit" class="btn">編集する</a>
               <button id="delete-post" class="btn btn-danger">削除する</button>
             </div>`
          : ""
      }
    </div>
    <div class="post-body">${escapeHtml(post.description)}</div>

    <div class="comments-section">
      <div class="comments-heading">💬 コメント</div>
      <div id="comment-list" class="loading">読み込み中…</div>
      ${
        user
          ? `<form id="comment-form" class="comment-form">
               <div class="field">
                 <textarea id="comment-content" maxlength="5000" placeholder="この番組について語る…" required></textarea>
               </div>
               <button type="submit" class="btn btn-primary">コメントする</button>
               <div id="comment-error"></div>
             </form>`
          : `<p class="post-byline"><a href="#/login" style="color:var(--accent)">ログイン</a>するとコメントできます。</p>`
      }
    </div>
  `;

  if (isOwner) {
    container.querySelector("#delete-post")!.addEventListener("click", async () => {
      if (!confirm("この番組を削除しますか？この操作は取り消せません。")) return;
      try {
        await api.deletePost(post.id);
        navigate("/");
      } catch {
        alert("削除に失敗しました。");
      }
    });
  }

  await loadComments(container, id, user);

  const commentForm = container.querySelector<HTMLFormElement>("#comment-form");
  if (commentForm) {
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorSlot = container.querySelector<HTMLDivElement>("#comment-error")!;
      errorSlot.innerHTML = "";
      const textarea = container.querySelector<HTMLTextAreaElement>("#comment-content")!;
      try {
        await api.createComment(id, textarea.value);
        textarea.value = "";
        await loadComments(container, id, user);
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : "コメントの投稿に失敗しました。";
        errorSlot.innerHTML = `<div class="error-banner">${message}</div>`;
      }
    });
  }
}

async function loadComments(container: HTMLElement, postId: number, user: { id: number } | null) {
  const listEl = container.querySelector<HTMLDivElement>("#comment-list")!;
  try {
    const { comments } = await api.listComments(postId);
    if (comments.length === 0) {
      listEl.innerHTML = `<p class="post-byline">まだコメントはありません。最初のコメントを残しましょう。</p>`;
      return;
    }
    listEl.innerHTML = comments
      .map((c: any) => {
        const canDelete = user && !c.is_deleted && user.id === c.author_id;
        return `
          <div class="comment">
            <div class="comment-head">
              <span class="comment-author">@${escapeHtml(c.author_user_id)}</span>
              <span class="comment-time">${formatRelative(c.created_at)}</span>
              ${c.is_edited && !c.is_deleted ? `<span class="comment-edited">編集済み</span>` : ""}
            </div>
            <div class="comment-body ${c.is_deleted ? "deleted" : ""}">${escapeHtml(c.content)}</div>
            ${
              canDelete
                ? `<div class="comment-actions"><button class="btn btn-ghost" data-delete-comment="${c.id}" style="padding:2px 8px;font-size:12px">削除</button></div>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll<HTMLButtonElement>("[data-delete-comment]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const commentId = Number(btn.dataset.deleteComment);
        if (!confirm("このコメントを削除しますか？")) return;
        try {
          await api.deleteComment(commentId);
          await loadComments(container, postId, user);
        } catch {
          alert("削除に失敗しました。");
        }
      });
    });
  } catch {
    listEl.innerHTML = `<p class="post-byline">コメントの読み込みに失敗しました。</p>`;
  }
}
