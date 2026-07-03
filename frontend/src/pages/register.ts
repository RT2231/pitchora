import { api, setToken, setCurrentUser, ApiClientError } from "../api";
import { navigate } from "../router";

export function renderRegister(container: HTMLElement) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-tabs">
        <a href="#/login" style="color: var(--text-muted)">ログイン</a>
        <span>/</span>
        <span style="color: var(--text)">新規登録</span>
      </div>
      <div class="form-card" style="margin-top:0">
        <h1 class="form-title">好きな番組を、もっと語れる。</h1>
        <p class="form-sub">Pitchoraのアカウントを作成します。</p>
        <div id="error-slot"></div>
        <form id="register-form">
          <div class="field">
            <label for="username">ユーザー名</label>
            <input type="text" id="username" maxlength="30" required />
          </div>
          <div class="field">
            <label for="user_id">ID</label>
            <input type="text" id="user_id" placeholder="半角英数字・_・-　3〜20文字" pattern="[A-Za-z0-9_-]{3,20}" required />
          </div>
          <div class="field">
            <label for="email">メールアドレス</label>
            <input type="email" id="email" required />
          </div>
          <div class="field">
            <label for="password">パスワード</label>
            <input type="password" id="password" minlength="8" maxlength="128" required />
            <div class="hint">8〜128文字、英字と数字を含めてください。</div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">登録してはじめる</button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector<HTMLFormElement>("#register-form")!;
  const errorSlot = container.querySelector<HTMLDivElement>("#error-slot")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorSlot.innerHTML = "";

    const username = (container.querySelector("#username") as HTMLInputElement).value;
    const user_id = (container.querySelector("#user_id") as HTMLInputElement).value;
    const email = (container.querySelector("#email") as HTMLInputElement).value;
    const password = (container.querySelector("#password") as HTMLInputElement).value;

    try {
      const { token, user } = await api.register({ username, user_id, email, password });
      setToken(token);
      setCurrentUser(user);
      navigate("/");
      window.dispatchEvent(new Event("auth-changed"));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "登録に失敗しました。";
      errorSlot.innerHTML = `<div class="error-banner">${message}</div>`;
    }
  });
}
