import { api, setToken, setCurrentUser, ApiClientError } from "../api";
import { navigate } from "../router";

export function renderLogin(container: HTMLElement) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-tabs">
        <span style="color: var(--text)">ログイン</span>
        <span>/</span>
        <a href="#/register" style="color: var(--text-muted)">新規登録</a>
      </div>
      <div class="form-card" style="margin-top:0">
        <h1 class="form-title">おかえりなさい</h1>
        <p class="form-sub">番組の続きを、ここから。</p>
        <div id="error-slot"></div>
        <form id="login-form">
          <div class="field">
            <label for="email">メールアドレス</label>
            <input type="email" id="email" required />
          </div>
          <div class="field">
            <label for="password">パスワード</label>
            <input type="password" id="password" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block">ログイン</button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector<HTMLFormElement>("#login-form")!;
  const errorSlot = container.querySelector<HTMLDivElement>("#error-slot")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorSlot.innerHTML = "";
    const email = (container.querySelector("#email") as HTMLInputElement).value;
    const password = (container.querySelector("#password") as HTMLInputElement).value;

    try {
      const { token, user } = await api.login({ email, password });
      setToken(token);
      setCurrentUser(user);
      navigate("/");
      window.dispatchEvent(new Event("auth-changed"));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "ログインに失敗しました。";
      errorSlot.innerHTML = `<div class="error-banner">${message}</div>`;
    }
  });
}
