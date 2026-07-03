import { api, ApiClientError } from "../api";
import { navigate } from "../router";

export async function renderPostForm(container: HTMLElement, editId?: number) {
  container.innerHTML = `<div class="loading">読み込み中…</div>`;

  let genres: { id: number; name: string }[] = [];
  let existing: any = null;

  try {
    const genreRes = await api.listGenres();
    genres = genreRes.genres;
    if (editId) {
      const postRes = await api.getPost(editId);
      existing = postRes.post;
    }
  } catch {
    container.innerHTML = `<div class="empty-state">読み込みに失敗しました。</div>`;
    return;
  }

  const isEdit = Boolean(existing);

  container.innerHTML = `
    <div class="form-card">
      <h1 class="form-title">${isEdit ? "番組を編集する" : "番組を投稿する"}</h1>
      <p class="form-sub">${isEdit ? "内容を更新します。編集履歴は保存されません。" : "架空の番組の詳細を教えてください。"}</p>
      <div id="error-slot"></div>
      <form id="post-form">
        <div class="field">
          <label for="title">タイトル（100文字以内）</label>
          <input type="text" id="title" maxlength="100" required value="${isEdit ? escapeAttr(existing.title) : ""}" />
        </div>
        <div class="field">
          <label for="genre_id">ジャンル</label>
          <select id="genre_id" required>
            ${genres
              .map(
                (g) =>
                  `<option value="${g.id}" ${isEdit && existing.genre_id === g.id ? "selected" : ""}>${g.name}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="description">説明（10000文字以内・Markdown可・HTML不可）</label>
          <textarea id="description" maxlength="10000" required>${isEdit ? existing.description : ""}</textarea>
        </div>
        <div class="field">
          <label for="visibility">公開範囲</label>
          <select id="visibility" required>
            <option value="public" ${isEdit && existing.visibility === "public" ? "selected" : ""}>公開</option>
            <option value="unlisted" ${isEdit && existing.visibility === "unlisted" ? "selected" : ""}>限定公開</option>
            <option value="private" ${isEdit && existing.visibility === "private" ? "selected" : ""}>非公開（下書き）</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">${isEdit ? "更新する" : "投稿する"}</button>
      </form>
    </div>
  `;

  const form = container.querySelector<HTMLFormElement>("#post-form")!;
  const errorSlot = container.querySelector<HTMLDivElement>("#error-slot")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorSlot.innerHTML = "";

    const payload = {
      title: (container.querySelector("#title") as HTMLInputElement).value,
      genre_id: Number((container.querySelector("#genre_id") as HTMLSelectElement).value),
      description: (container.querySelector("#description") as HTMLTextAreaElement).value,
      visibility: (container.querySelector("#visibility") as HTMLSelectElement).value,
    };

    try {
      if (isEdit) {
        await api.updatePost(existing.id, payload);
        navigate(`/posts/${existing.id}`);
      } else {
        const { id } = await api.createPost(payload);
        navigate(`/posts/${id}`);
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "保存に失敗しました。";
      errorSlot.innerHTML = `<div class="error-banner">${message}</div>`;
    }
  });
}

function escapeAttr(input: string): string {
  return input.replace(/"/g, "&quot;");
}
