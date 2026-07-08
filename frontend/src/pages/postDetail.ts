import { api, getCurrentUser, ApiClientError } from "../api";
import { escapeHtml, formatRelative, VISIBILITY_LABEL } from "../utils";
import { navigate } from "../router";

const MAX_DEPTH = 4; // SPEC 7章: 最大5階層（0始まりなので上限は4） worker側と合わせる

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
      <div class="post-byline">@<a href="#/users/${encodeURIComponent(post.author_user_id)}" style="color:inherit">${escapeHtml(post.author_user_id)}</a> ・ ${formatRelative(post.created_at)} OA</div>
      <div class="post-actions">
        <button id="like-toggle" class="btn like-btn ${post.liked_by_me ? "active" : ""}" ${user ? "" : "disabled title=\"ログインするといいねできます\""}>
          <span id="like-icon">${post.liked_by_me ? "❤️" : "🤍"}</span> <span id="like-count">${post.like_count}</span>
        </button>
        ${
          isOwner
            ? `<a href="#/posts/${post.id}/edit" class="btn">編集する</a>
               <button id="delete-post" class="btn btn-danger">削除する</button>`
            : ""
        }
      </div>
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

  if (user) {
    const likeBtn = container.querySelector<HTMLButtonElement>("#like-toggle")!;
    let liked = Boolean(post.liked_by_me);
    likeBtn.addEventListener("click", async () => {
      likeBtn.disabled = true;
      try {
        const res = liked ? await api.unlikePost(post.id) : await api.likePost(post.id);
        liked = res.liked;
        container.querySelector("#like-icon")!.textContent = liked ? "❤️" : "🤍";
        container.querySelector("#like-count")!.textContent = String(res.like_count);
        likeBtn.classList.toggle("active", liked);
      } catch {
        alert("操作に失敗しました。");
      } finally {
        likeBtn.disabled = false;
      }
    });
  }

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

interface CommentNode {
  id: number;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  parent_comment_id: number | null;
  depth: number;
  created_at: string;
  author_id: number;
  author_user_id: string;
  author_username: string;
  children: CommentNode[];
}

function buildCommentTree(flat: any[]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  flat.forEach((c) => byId.set(c.id, { ...c, children: [] }));

  const roots: CommentNode[] = [];
  byId.forEach((node) => {
    if (node.parent_comment_id && byId.has(node.parent_comment_id)) {
      byId.get(node.parent_comment_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function renderCommentNode(node: CommentNode, postId: number, user: { id: number } | null): string {
  const canDelete = user && !node.is_deleted && user.id === node.author_id;
  const canReply = user && !node.is_deleted && node.depth < MAX_DEPTH;

  return `
    <div class="comment" style="margin-left:${Math.min(node.depth, MAX_DEPTH) * 20}px">
      <div class="comment-head">
        <span class="comment-author">@<a href="#/users/${encodeURIComponent(node.author_user_id)}" style="color:inherit">${escapeHtml(node.author_user_id)}</a></span>
        <span class="comment-time">${formatRelative(node.created_at)}</span>
        ${node.is_edited && !node.is_deleted ? `<span class="comment-edited">編集済み</span>` : ""}
      </div>
      <div class="comment-body ${node.is_deleted ? "deleted" : ""}">${escapeHtml(node.content)}</div>
      <div class="comment-actions">
        ${canReply ? `<button class="btn btn-ghost" data-reply-to="${node.id}" data-reply-user="${escapeHtml(node.author_user_id)}" style="padding:2px 8px;font-size:12px">返信</button>` : ""}
        ${canDelete ? `<button class="btn btn-ghost" data-delete-comment="${node.id}" style="padding:2px 8px;font-size:12px">削除</button>` : ""}
      </div>
      <div class="reply-form-slot" data-reply-slot="${node.id}"></div>
      ${node.children.map((child) => renderCommentNode(child, postId, user)).join("")}
    </div>
  `;
}

async function loadComments(container: HTMLElement, postId: number, user: { id: number } | null) {
  const listEl = container.querySelector<HTMLDivElement>("#comment-list")!;
  try {
    const { comments } = await api.listComments(postId);
    if (comments.length === 0) {
      listEl.innerHTML = `<p class="post-byline">まだコメントはありません。最初のコメントを残しましょう。</p>`;
      return;
    }

    const tree = buildCommentTree(comments);
    listEl.innerHTML = tree.map((node) => renderCommentNode(node, postId, user)).join("");

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

    listEl.querySelectorAll<HTMLButtonElement>("[data-reply-to]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parentId = Number(btn.dataset.replyTo);
        const replyUser = btn.dataset.replyUser || "";
        const slot = listEl.querySelector<HTMLDivElement>(`[data-reply-slot="${parentId}"]`)!;

        // 既に開いていたら閉じる（トグル）
        if (slot.dataset.open === "true") {
          slot.innerHTML = "";
          slot.dataset.open = "false";
          return;
        }
        // 他の返信フォームは閉じる
        listEl.querySelectorAll<HTMLDivElement>(".reply-form-slot").forEach((s) => {
          s.innerHTML = "";
          s.dataset.open = "false";
        });

        slot.dataset.open = "true";
        slot.innerHTML = `
          <form class="comment-form reply-form">
            <div class="field">
              <textarea maxlength="5000" required>@${escapeHtml(replyUser)} </textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="padding:6px 14px;font-size:13px">返信する</button>
            <div class="reply-error"></div>
          </form>
        `;
        const form = slot.querySelector<HTMLFormElement>("form")!;
        const textarea = slot.querySelector<HTMLTextAreaElement>("textarea")!;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const errorSlot = slot.querySelector<HTMLDivElement>(".reply-error")!;
          errorSlot.innerHTML = "";
          try {
            await api.createComment(postId, textarea.value, parentId);
            await loadComments(container, postId, user);
          } catch (err) {
            const message = err instanceof ApiClientError ? err.message : "返信の投稿に失敗しました。";
            errorSlot.innerHTML = `<div class="error-banner">${message}</div>`;
          }
        });
      });
    });
  } catch {
    listEl.innerHTML = `<p class="post-byline">コメントの読み込みに失敗しました。</p>`;
  }
}
