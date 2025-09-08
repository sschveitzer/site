// app.js
const SUPABASE_URL = "https://ppoufxezqmbxzflijmpx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwb3VmeGV6cW1ieHpmbGlqbXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzY1MTgsImV4cCI6MjA3MjE1MjUxOH0.7wntt2EbXsb16Zob9F81XFUKognKHKn0jxP6UdfF_ZY";

let supabaseClient;
window.addEventListener("DOMContentLoaded", () => {
  if (!window.supabase) {
    console.error("Supabase SDK não carregou.");
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const form = document.getElementById("login-form");
  const btn = document.getElementById("loginBtn");
  const statusMsg = document.getElementById("statusMsg");
  const pass = document.getElementById("password");
  const toggle = document.getElementById("togglePass");
  const emailEl = document.getElementById("email");

  toggle.addEventListener("click", () => {
    const isPwd = pass.type === "password";
    pass.type = isPwd ? "text" : "password";
    toggle.textContent = isPwd ? "🙈" : "👁️";
    toggle.setAttribute("aria-label", isPwd ? "Ocultar senha" : "Mostrar senha");
    toggle.setAttribute("aria-pressed", String(isPwd));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const password = pass.value;
    if (!email || !password) {
      showStatus("Preencha email e senha.", "error");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        showStatus(error.message || "Não foi possível entrar.", "error");
        setLoading(false);
        return;
      }

      showStatus("Login realizado com sucesso! Redirecionando…", "ok");
      setTimeout(() => { window.location.href = "dashboard.html"; }, 600);
    } catch (err) {
      console.error(err);
      showStatus("Erro inesperado. Tente novamente.", "error");
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    btn.disabled = isLoading;
    document.getElementById("login-form").setAttribute("aria-busy", String(isLoading));
    btn.textContent = isLoading ? "Entrando…" : btn.dataset.defaultText;
  }

  function showStatus(message, type) {
    statusMsg.textContent = message;
    statusMsg.className = "status " + (type || "");
  }
});
