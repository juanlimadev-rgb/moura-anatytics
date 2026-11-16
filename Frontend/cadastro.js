const API_BASE = window.location.origin;

const form = document.getElementById("form-cadastro");
const msgDiv = document.getElementById("mensagem");

function exibirMensagem(texto, tipo) {
  msgDiv.textContent = texto;
  msgDiv.className = `mensagem ${tipo}`;
  msgDiv.style.display = "block";
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    msgDiv.style.display = "none";

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const senha = document.getElementById("senha").value;

    if (!nome || !email || !senha) {
      exibirMensagem("Por favor, preencha todos os campos.", "erro");
      return;
    }

    if(form.dataset.busy==='1') return;
    form.dataset.busy='1';
    const submitButton=form.querySelector('[type=submit]');if(submitButton)submitButton.disabled=true;
    try {
      const response = await fetch(`${API_BASE}/auth/cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha })
      });

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.erro || "Erro ao realizar cadastro.");
      }

      exibirMensagem("Conta criada com sucesso! Redirecionando...", "sucesso");

      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    } catch (error) {
      exibirMensagem(error.message || "Erro ao realizar cadastro.", "erro");
    } finally {
      form.dataset.busy='0';if(submitButton)submitButton.disabled=false;
    }
  });
}
