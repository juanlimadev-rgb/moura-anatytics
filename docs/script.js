const API_BASE = "https://moura-anatytics.onrender.com";
const token = localStorage.getItem("token");

let idPartidaAtual = null;
let partidaFinalizada = false;

const stats = {
  1: {
    ataque: 0,
    saque: 0,
    passe: 0,
    bloqueio: 0,
    defesa: 0,
    "side-out": 0,
    "contra-ataque": 0
  },
  2: {
    ataque: 0,
    saque: 0,
    passe: 0,
    bloqueio: 0,
    defesa: 0,
    "side-out": 0,
    "contra-ataque": 0
  }
};

// -------------------------
// ELEMENTOS
// -------------------------
const btnIniciarPartida = document.getElementById("btn-iniciar-partida");
const btnFinalizarPartida = document.getElementById("btn-finalizar-partida");

const btnPdfDuda = document.getElementById("btn-pdf-duda");
const btnPdfAna = document.getElementById("btn-pdf-ana");
const btnPdfDupla = document.getElementById("btn-pdf-dupla");

const partidaStatus = document.getElementById("partida-status");
const finalizacaoStatus = document.getElementById("finalizacao-status");

const resumoCampeonato = document.getElementById("resumo-campeonato");
const resumoLocal = document.getElementById("resumo-local");
const resumoAdversario = document.getElementById("resumo-adversario");
const resumoData = document.getElementById("resumo-data");
const resumoDupla = document.getElementById("resumo-dupla");
const resumoAtleta1 = document.getElementById("resumo-atleta1");
const resumoAtleta2 = document.getElementById("resumo-atleta2");
const resumoStatus = document.getElementById("resumo-status");

const nomeAtleta1Painel = document.getElementById("nome-atleta1-painel");
const nomeAtleta2Painel = document.getElementById("nome-atleta2-painel");

const tituloRelatorioAtleta1 = document.getElementById("titulo-relatorio-atleta1");
const tituloRelatorioAtleta2 = document.getElementById("titulo-relatorio-atleta2");
const tituloRelatorioDupla = document.getElementById("titulo-relatorio-dupla");

const inputAtleta1 = document.getElementById("atleta1");
const inputAtleta2 = document.getElementById("atleta2");

const logList = document.getElementById("action-log-list");
const toast = document.getElementById("toast");

const listaPartidas = document.getElementById("lista-partidas");
const filtroData = document.getElementById("filtro-data");
const btnFiltrar = document.getElementById("btn-filtrar");

// -------------------------
// HELPERS
// -------------------------

function getAuthHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };

  const tokenSalvo = localStorage.getItem("token");
  if (tokenSalvo) {
    headers["Authorization"] = `Bearer ${tokenSalvo}`;
  }

  return headers;
}

function verificarAutenticacao() {
  const tokenSalvo = localStorage.getItem("token");

  if (!tokenSalvo) {
    window.location.href = "login.html";
    return false;
  }

  return true;
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
  window.location.href = "login.html";
}

function showToast(message, isError = false) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.style.background = isError ? "#fee2e2" : "#111827";
  toast.style.color = isError ? "#b91c1c" : "#ffffff";
  toast.style.border = isError ? "1px solid #fecaca" : "none";

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}

function formatFundamento(fundamento) {
  const mapa = {
    ataque: "Ataque",
    saque: "Saque",
    passe: "Passe / Recepção",
    bloqueio: "Bloqueio",
    defesa: "Defesa",
    "side-out": "Side-out",
    "contra-ataque": "Contra-ataque"
  };
  return mapa[fundamento] || fundamento;
}

function formatResultado(resultado) {
  const mapa = {
    ponto: "Ponto",
    neutro: "Neutro",
    bloqueado: "Bloqueado",
    erro: "Erro",
    ace: "Ace",
    excelente: "Excelente",
    bom: "Bom",
    regular: "Regular",
    ruim: "Ruim",
    acao: "Ação"
  };
  return mapa[resultado] || resultado;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function getNumberValue(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const value = el.value.trim();
  return value === "" ? null : Number(value);
}

function formatarDataHistorico(data) {
  if (!data) return "-";

  const dataStr = String(data).split("T")[0];
  const partes = dataStr.split("-");

  if (partes.length !== 3) return dataStr;

  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

function normalizarNome(nome, fallback) {
  const texto = (nome || "").trim();
  return texto || fallback;
}

function getNomesAtuais() {
  const atleta1 = normalizarNome(inputAtleta1?.value, "Atleta 1");
  const atleta2 = normalizarNome(inputAtleta2?.value, "Atleta 2");
  return { atleta1, atleta2, dupla: `${atleta1} / ${atleta2}` };
}

function aplicarNomesNaTela() {
  const { dupla, atleta1, atleta2 } = getNomesAtuais();

  if (nomeAtleta1Painel) nomeAtleta1Painel.textContent = atleta1;
  if (nomeAtleta2Painel) nomeAtleta2Painel.textContent = atleta2;

  if (resumoDupla) resumoDupla.textContent = dupla;
  if (resumoAtleta1) resumoAtleta1.textContent = atleta1;
  if (resumoAtleta2) resumoAtleta2.textContent = atleta2;

  if (tituloRelatorioAtleta1) tituloRelatorioAtleta1.textContent = `Relatório ${atleta1}`;
  if (tituloRelatorioAtleta2) tituloRelatorioAtleta2.textContent = `Relatório ${atleta2}`;
  if (tituloRelatorioDupla) tituloRelatorioDupla.textContent = "Relatório da Dupla";
}

function addLog(atletaNome, fundamento, resultado, setNumero) {
  if (!logList) return;

  const empty = logList.querySelector(".log-empty");
  if (empty) empty.remove();

  const div = document.createElement("div");
  div.className = "log-entry";

  let dotClass = "neutral";
  if (resultado === "erro") dotClass = "error";
  if (resultado === "ace") dotClass = "ace";
  if (["ponto", "excelente", "bom"].includes(resultado)) dotClass = "success";

  div.innerHTML = `
    <div class="log-dot ${dotClass}"></div>
    <div class="log-athlete">${atletaNome}</div>
    <div class="log-fund">${formatFundamento(fundamento)}</div>
    <div class="log-action">${formatResultado(resultado)}</div>
    <div class="log-set">${setNumero}º SET</div>
  `;

  logList.prepend(div);
}

function incrementarStats(idAtleta, fundamento) {
  if (!stats[idAtleta]) return;
  if (typeof stats[idAtleta][fundamento] !== "number") return;
  stats[idAtleta][fundamento] += 1;
}

function resetStats() {
  stats[1] = {
    ataque: 0,
    saque: 0,
    passe: 0,
    bloqueio: 0,
    defesa: 0,
    "side-out": 0,
    "contra-ataque": 0
  };

  stats[2] = {
    ataque: 0,
    saque: 0,
    passe: 0,
    bloqueio: 0,
    defesa: 0,
    "side-out": 0,
    "contra-ataque": 0
  };
}

function resetLogs() {
  if (!logList) return;
  logList.innerHTML = `<div class="log-empty">Nenhuma ação registrada ainda.</div>`;
}

function resetFinalizacaoInputs() {
  const ids = [
    "final_set1_dupla",
    "final_set1_adv",
    "final_set2_dupla",
    "final_set2_adv",
    "final_set3_dupla",
    "final_set3_adv"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function resetResumo() {
  if (resumoCampeonato) resumoCampeonato.textContent = "—";
  if (resumoLocal) resumoLocal.textContent = "—";
  if (resumoAdversario) resumoAdversario.textContent = "—";
  if (resumoData) resumoData.textContent = "—";
  if (resumoStatus) resumoStatus.textContent = "Aguardando início";
}

function prepararNovaPartida() {
  partidaFinalizada = false;
  idPartidaAtual = null;
  resetStats();
  resetLogs();
  resetFinalizacaoInputs();
  resetResumo();
  aplicarNomesNaTela();
  habilitarDownloads(false);

  if (finalizacaoStatus) finalizacaoStatus.textContent = "Aguardando finalização.";
  if (partidaStatus) partidaStatus.textContent = "Nenhuma partida iniciada.";
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function habilitarDownloads(habilitado) {
  [btnPdfDuda, btnPdfAna, btnPdfDupla].forEach((btn) => {
    if (!btn) return;
    btn.disabled = !habilitado;
    btn.style.opacity = habilitado ? "1" : "0.55";
    btn.style.pointerEvents = habilitado ? "auto" : "none";
  });
}

function baixarPDFHistorico(idPartida, tipo) {
  window.open(`${API_BASE}/relatorio/${idPartida}/${tipo}/pdf`, "_blank");
}

function extrairDataISO(valor) {
  if (!valor) return "";
  return String(valor).split("T")[0];
}

// -------------------------
// HISTÓRICO
// -------------------------
async function carregarHistorico() {
  if (!listaPartidas) return;

  try {
    // CORREÇÃO: Adicionado o header de autenticação na requisição de histórico
    const response = await fetch(`${API_BASE}/partidas`, {
      method: "GET",
      headers: getAuthHeaders()
    });
    
    const partidas = await safeJson(response);

    if (!response.ok) {
      throw new Error("Erro ao carregar histórico.");
    }

    listaPartidas.innerHTML = "";
    let partidasFiltradas = Array.isArray(partidas) ? [...partidas] : [];

    if (filtroData && filtroData.value) {
      partidasFiltradas = partidasFiltradas.filter((p) => {
        return extrairDataISO(p.data_partida) === filtroData.value;
      });
    }

    if (partidasFiltradas.length === 0) {
      listaPartidas.innerHTML = `<div class="log-empty">Nenhuma partida encontrada.</div>`;
      return;
    }

    partidasFiltradas.forEach((partida) => {
      const card = document.createElement("div");
      card.className = "report-download-card";

      const n1 = partida.atleta1 || "Atleta 1";
      const n2 = partida.atleta2 || "Atleta 2";

      card.innerHTML = `
        <div>
          <h3>${partida.dupla || `${n1} / ${n2}`}</h3>
          <p>
            <strong>Adversárias:</strong> ${partida.adversario || "-"}<br>
            <strong>Competição:</strong> ${partida.campeonato || "-"}<br>
            <strong>Data:</strong> ${formatarDataHistorico(partida.data_partida)}<br>
            <strong>Resultado:</strong> ${partida.resultado || "-"}
          </p>
        </div>
        <div class="topbar-actions">
          <button class="topbar-btn" type="button" data-historico-pdf="${partida.id}" data-tipo="atleta1">${n1}</button>
          <button class="topbar-btn" type="button" data-historico-pdf="${partida.id}" data-tipo="atleta2">${n2}</button>
          <button class="topbar-btn active" type="button" data-historico-pdf="${partida.id}" data-tipo="dupla">Dupla</button>
        </div>
      `;

      listaPartidas.appendChild(card);
    });

    document.querySelectorAll("[data-historico-pdf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        baixarPDFHistorico(btn.dataset.historicoPdf, btn.dataset.tipo);
      });
    });
  } catch (error) {
    console.error(error);
    listaPartidas.innerHTML = `<div class="log-empty">Erro ao carregar histórico.</div>`;
  }
}

// -------------------------
// INICIAR PARTIDA
// -------------------------
if (btnIniciarPartida) {
  btnIniciarPartida.addEventListener("click", async () => {
    const camp = getValue("campeonato");
    const loc = getValue("local");
    const adv = getValue("adversario");
    const dat = getValue("data_partida");
    const a1 = getValue("atleta1");
    const a2 = getValue("atleta2");

    if (!camp || !loc || !adv || !dat || !a1 || !a2) {
      showToast("Preencha todos os campos obrigatórios.", true);
      return;
    }

    try {
      prepararNovaPartida();

      const response = await fetch(`${API_BASE}/partidas`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          campeonato: camp,
          local: loc,
          adversario: adv,
          data_partida: dat,
          dupla: `${a1} / ${a2}`,
          atleta1: a1,
          atleta2: a2
        })
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data.erro || "Erro ao iniciar");
      }

      idPartidaAtual = data.id_partida;

      if (partidaStatus) partidaStatus.textContent = `Partida iniciada com ID ${idPartidaAtual}.`;
      if (resumoCampeonato) resumoCampeonato.textContent = camp;
      if (resumoLocal) resumoLocal.textContent = loc;
      if (resumoAdversario) resumoAdversario.textContent = adv;
      if (resumoData) resumoData.textContent = dat;
      if (resumoStatus) resumoStatus.textContent = "Partida em andamento";
      if (finalizacaoStatus) finalizacaoStatus.textContent = "Aguardando finalização.";

      aplicarNomesNaTela();
      showToast("Partida iniciada com sucesso!");
      carregarHistorico();
    } catch (error) {
      showToast(error.message || "Erro ao iniciar a partida.", true);
    }
  });
}

// -------------------------
// REGISTRAR EVENTOS
// -------------------------
document.querySelectorAll(".action-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!idPartidaAtual || partidaFinalizada) {
      showToast("Partida não iniciada ou já finalizada.", true);
      return;
    }

    const idAtleta = Number(button.dataset.atleta);
    const setNum = Number(document.getElementById(button.dataset.setSelector)?.value);
    const fund = button.dataset.fundamento;
    const res = button.dataset.resultado;

    if (!idAtleta || !setNum || !fund || !res) {
      showToast("Dados do evento inválidos.", true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/evento`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id_partida: idPartidaAtual,
          id_atleta: idAtleta,
          set_numero: setNum,
          fundamento: fund,
          resultado: res
        })
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data.erro || "Erro ao registrar");
      }

      incrementarStats(idAtleta, fund);

      const nomes = getNomesAtuais();
      addLog(idAtleta === 1 ? nomes.atleta1 : nomes.atleta2, fund, res, setNum);
      showToast("Registrado!");
    } catch (error) {
      showToast(error.message || "Erro ao registrar evento.", true);
    }
  });
});

// -------------------------
// FINALIZAR
// -------------------------
function pontosAlvoDoSet(setNumero) {
  return setNumero === 3 ? 15 : 21;
}

function setFoiFinalizado(setNumero, pD, pA) {
  if (pD === null || pA === null) return false;
  if (Number.isNaN(pD) || Number.isNaN(pA)) return false;

  const alvo = pontosAlvoDoSet(setNumero);
  const maior = Math.max(pD, pA);
  const dif = Math.abs(pD - pA);

  return maior >= alvo && dif >= 2;
}

function validarSetsDaPartida(sets) {
  const s1 = sets.find((s) => s.set_numero === 1);
  const s2 = sets.find((s) => s.set_numero === 2);
  const s3 = sets.find((s) => s.set_numero === 3);

  if (!s1 || !s2) {
    return { ok: false, message: "Preencha o 1º e o 2º set." };
  }

  if (!setFoiFinalizado(1, s1.pontos_dupla, s1.pontos_adversario)) {
    return { ok: false, message: "1º set incompleto ou inválido." };
  }

  if (!setFoiFinalizado(2, s2.pontos_dupla, s2.pontos_adversario)) {
    return { ok: false, message: "2º set incompleto ou inválido." };
  }

  if (s3) {
    const umPreenchido = s3.pontos_dupla !== null || s3.pontos_adversario !== null;
    const ambosPreenchidos = s3.pontos_dupla !== null && s3.pontos_adversario !== null;

    if (umPreenchido && !ambosPreenchidos) {
      return { ok: false, message: "Preencha os dois campos do 3º set." };
    }

    if (ambosPreenchidos && !setFoiFinalizado(3, s3.pontos_dupla, s3.pontos_adversario)) {
      return { ok: false, message: "3º set incompleto ou inválido." };
    }
  }

  return { ok: true };
}

if (btnFinalizarPartida) {
  btnFinalizarPartida.addEventListener("click", async () => {
    if (!idPartidaAtual) {
      showToast("Inicie uma partida antes de finalizar.", true);
      return;
    }

    if (partidaFinalizada) {
      showToast("Essa partida já foi finalizada.", true);
      return;
    }

    const sets = [
      {
        set_numero: 1,
        pontos_dupla: getNumberValue("final_set1_dupla"),
        pontos_adversario: getNumberValue("final_set1_adv")
      },
      {
        set_numero: 2,
        pontos_dupla: getNumberValue("final_set2_dupla"),
        pontos_adversario: getNumberValue("final_set2_adv")
      }
    ];

    const s3d = getNumberValue("final_set3_dupla");
    const s3a = getNumberValue("final_set3_adv");

    if (s3d !== null || s3a !== null) {
      sets.push({
        set_numero: 3,
        pontos_dupla: s3d,
        pontos_adversario: s3a
      });
    }

    const valid = validarSetsDaPartida(sets);

    if (!valid.ok) {
      showToast(valid.message, true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/partidas/${idPartidaAtual}/finalizar`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ sets })
      });

      const data = await safeJson(response);

      if (!response.ok) {
        throw new Error(data.erro || "Erro ao finalizar");
      }

      partidaFinalizada = true;

      if (resumoStatus) resumoStatus.textContent = "Finalizada";
      if (finalizacaoStatus) finalizacaoStatus.textContent = `Partida finalizada. Resultado: ${data.resultado || "-"}`;
      if (partidaStatus) partidaStatus.textContent = `Partida finalizada com ID ${idPartidaAtual}.`;

      habilitarDownloads(true);
      showToast("Partida finalizada com sucesso!");
      carregarHistorico();

      window.open(`${API_BASE}/relatorio/${idPartidaAtual}/dupla/pdf`, "_blank");
    } catch (error) {
      showToast(error.message || "Erro ao finalizar a partida.", true);
    }
  });
}

// -------------------------
// DOWNLOADS
// -------------------------
if (btnPdfDuda) {
  btnPdfDuda.addEventListener("click", () => {
    if (!idPartidaAtual || !partidaFinalizada) {
      showToast("Finalize a partida para liberar o PDF.", true);
      return;
    }

    window.open(`${API_BASE}/relatorio/${idPartidaAtual}/atleta1/pdf`, "_blank");
  });
}

if (btnPdfAna) {
  btnPdfAna.addEventListener("click", () => {
    if (!idPartidaAtual || !partidaFinalizada) {
      showToast("Finalize a partida para liberar o PDF.", true);
      return;
    }

    window.open(`${API_BASE}/relatorio/${idPartidaAtual}/atleta2/pdf`, "_blank");
  });
}

if (btnPdfDupla) {
  btnPdfDupla.addEventListener("click", () => {
    if (!idPartidaAtual || !partidaFinalizada) {
      showToast("Finalize a partida para liberar o PDF.", true);
      return;
    }

    window.open(`${API_BASE}/relatorio/${idPartidaAtual}/dupla/pdf`, "_blank");
  });
}

// -------------------------
// EVENTOS INICIAIS
// -------------------------
habilitarDownloads(false);
aplicarNomesNaTela();
carregarHistorico();

[inputAtleta1, inputAtleta2].forEach((input) => {
  input?.addEventListener("input", aplicarNomesNaTela);
});

if (btnFiltrar) {
  btnFiltrar.addEventListener("click", carregarHistorico);
}
verificarAutenticacao();