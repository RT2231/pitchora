import "./style.css";
import { addRoute, setNotFound, startRouter, navigate } from "./router";
import { getCurrentUser, setToken, setCurrentUser } from "./api";
import { renderHome } from "./pages/home";
import { renderLogin } from "./pages/login";
import { renderRegister } from "./pages/register";
import { renderPostDetail } from "./pages/postDetail";
import { renderPostForm } from "./pages/newPost";
import { renderProfile } from "./pages/profile";

const app = document.getElementById("app")!;

app.innerHTML = `
  <header class="topbar">
    <div class="topbar-inner">
      <a href="#/" class="brand"><span class="dot"></span>Pitchora</a>
      <div class="nav-actions" id="nav-actions"></div>
    </div>
  </header>
  <main class="shell" id="page"></main>
`;

const navActions = document.getElementById("nav-actions")!;
const page = document.getElementById("page")!;

function renderNav() {
  const user = getCurrentUser();
  if (user) {
    navActions.innerHTML = `
      <a href="#/users/${encodeURIComponent(user.user_id)}" class="user-chip">@${user.user_id}</a>
      <button id="logout-btn" class="btn btn-ghost">ログアウト</button>
    `;
    document.getElementById("logout-btn")!.addEventListener("click", () => {
      setToken(null);
      setCurrentUser(null);
      renderNav();
      navigate("/");
    });
  } else {
    navActions.innerHTML = `
      <a href="#/login" class="btn btn-ghost">ログイン</a>
      <a href="#/register" class="btn btn-primary">はじめる</a>
    `;
  }
}

window.addEventListener("auth-changed", renderNav);

// --- ルーティング定義 ---
addRoute("/", () => renderHome(page));
addRoute("/login", () => renderLogin(page));
addRoute("/register", () => renderRegister(page));
addRoute("/new", () => {
  if (!getCurrentUser()) return navigate("/login");
  renderPostForm(page);
});
addRoute("/posts/:id/edit", (params) => {
  if (!getCurrentUser()) return navigate("/login");
  renderPostForm(page, Number(params.id));
});
addRoute("/posts/:id", (params) => renderPostDetail(page, Number(params.id)));
addRoute("/users/:userId", (params) => renderProfile(page, params.userId));

setNotFound(() => {
  page.innerHTML = `<div class="empty-state"><div class="headline">ページが見つかりません</div><a href="#/" class="btn" style="margin-top:12px">番組表に戻る</a></div>`;
});

renderNav();
startRouter();
