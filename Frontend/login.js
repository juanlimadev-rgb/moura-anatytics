const API_BASE = window.location.origin;

const form = document.getElementById("form-login");

if (form) {
  form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const erro = document.getElementById("mensagem-erro");
  if (erro) {
    erro.style.display = "none";
    erro.textContent = "";
  }

  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

    if(form.dataset.busy==='1') return;
    form.dataset.busy='1';
    const submitButton=form.querySelector('[type=submit]');if(submitButton)submitButton.disabled=true;
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.erro || "Erro ao fazer login");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));

      window.location.href = "index.html";
    }catch (error) {
  console.error(error);

  const erro = document.getElementById("mensagem-erro");

  if (erro) {
    erro.textContent = error.message || "Erro ao fazer login";
    erro.style.display = "block";
  }

  document.getElementById("senha").value = "";
  document.getElementById("senha").focus();
} finally {
      form.dataset.busy='0';if(submitButton)submitButton.disabled=false;
    }
  });
}
