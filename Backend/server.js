require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verificarToken = require('./middlewares/auth');

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const connection = require('./database/connection');

const app = express(); // 👈 CRIA PRIMEIRO

// 👇 DEPOIS CONFIGURA O CORS
app.use(cors({
  origin: [
    'https://juanlimadev-rgb.github.io'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// -------------------------
// HELPERS
// -------------------------
function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function getFiltroAtleta(tipo) {
  if (tipo === 'atleta1') return 'AND id_atleta = 1';
  if (tipo === 'atleta2') return 'AND id_atleta = 2';
  if (tipo === 'dupla') return 'AND id_atleta IN (1,2)';
  return null;
}

function calcularResultadoFinal(sets) {
  let setsDupla = 0;
  let setsAdversario = 0;

  for (const set of sets) {
    if (set.pontos_dupla > set.pontos_adversario) setsDupla++;
    else if (set.pontos_adversario > set.pontos_dupla) setsAdversario++;
  }

  return `${setsDupla} x ${setsAdversario}`;
}

function formatarDataBR(data) {
  if (!data) return '-';
  const dataObj = new Date(data);
  if (Number.isNaN(dataObj.getTime())) return '-';

  return dataObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Maceio'
  });
}

// Aproveitamento: (Pontos / Total) * 100
// Eficiência: ((Pontos - Erros) / Total) * 100
function gerarSqlEstatistica(fundamento, filtroAtleta) {
  let campoPonto = "resultado = 'ponto'";
  let campoErro = "resultado = 'erro'";

  if (fundamento === 'saque') campoPonto = "resultado = 'ace'";
  if (fundamento === 'passe' || fundamento === 'defesa') campoPonto = "resultado = 'excelente'";

  if (fundamento === 'ataque' || fundamento === 'side-out' || fundamento === 'contra-ataque') {
    campoErro = "resultado IN ('erro', 'bloqueado')";
  }

  return `
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN ${campoPonto} THEN 1 ELSE 0 END) AS pontos,
      SUM(CASE WHEN ${campoErro} THEN 1 ELSE 0 END) AS erros,
      ROUND((SUM(CASE WHEN ${campoPonto} THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) AS aproveitamento,
      ROUND(((SUM(CASE WHEN ${campoPonto} THEN 1 ELSE 0 END) - SUM(CASE WHEN ${campoErro} THEN 1 ELSE 0 END)) / NULLIF(COUNT(*), 0)) * 100, 2) AS eficiencia
    FROM eventos_partida
    WHERE id_partida = ? ${filtroAtleta} AND fundamento = '${fundamento}'
  `;
}

async function buscarDadosRelatorio(id_partida, tipo) {
  const filtro = getFiltroAtleta(tipo);
  if (!filtro) throw new Error('Tipo de relatório inválido.');

  const sqlInfoPartida = `SELECT * FROM partidas WHERE id = ?`;
  const sqlSets = `SELECT * FROM sets_partida WHERE id_partida = ? ORDER BY set_numero`;

  const results = await Promise.all([
    queryAsync(sqlInfoPartida, [id_partida]),
    queryAsync(sqlSets, [id_partida]),
    queryAsync(gerarSqlEstatistica('ataque', filtro), [id_partida]),
    queryAsync(gerarSqlEstatistica('saque', filtro), [id_partida]),
    queryAsync(gerarSqlEstatistica('passe', filtro), [id_partida]),
    queryAsync(gerarSqlEstatistica('bloqueio', filtro), [id_partida]),
    queryAsync(gerarSqlEstatistica('defesa', filtro), [id_partida]),
    queryAsync(gerarSqlEstatistica('side-out', filtro), [id_partida]),
    queryAsync(gerarSqlEstatistica('contra-ataque', filtro), [id_partida])
  ]);

  return {
    partida: results[0][0] || {},
    sets: results[1] || [],
    ataque: results[2][0] || {},
    saque: results[3][0] || {},
    passe: results[4][0] || {},
    bloqueio: results[5][0] || {},
    defesa: results[6][0] || {},
    sideout: results[7][0] || {},
    contra_ataque: results[8][0] || {}
  };
}

// -------------------------
// CADASTRO
// -------------------------
app.post('/auth/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios.' });
    }

    const nomeLimpo = String(nome).trim();
    const emailLimpo = String(email).trim().toLowerCase();
    const senhaLimpa = String(senha);

    if (nomeLimpo.length < 2) {
      return res.status(400).json({ erro: 'Nome muito curto.' });
    }

    if (senhaLimpa.length < 6) {
      return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const usuarioExistente = await queryAsync(
      'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
      [emailLimpo]
    );

    if (usuarioExistente.length > 0) {
      return res.status(409).json({ erro: 'Este email já está cadastrado.' });
    }

    const senhaHash = await bcrypt.hash(senhaLimpa, 10);

    const result = await queryAsync(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nomeLimpo, emailLimpo, senhaHash]
    );

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso.',
      usuario: {
        id: result.insertId,
        nome: nomeLimpo,
        email: emailLimpo
      }
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
});

// -------------------------
// LOGIN
// -------------------------
app.post('/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
    }

    const emailLimpo = String(email).trim().toLowerCase();
    const senhaLimpa = String(senha);

    const usuarios = await queryAsync(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ? LIMIT 1',
      [emailLimpo]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }

    const usuario = usuarios[0];
    const senhaCorreta = await bcrypt.compare(senhaLimpa, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      mensagem: 'Login realizado com sucesso.',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ erro: 'Erro ao fazer login.' });
  }
});

// -------------------------
// USUÁRIO LOGADO
// -------------------------
app.get('/auth/me', verificarToken, async (req, res) => {
  return res.json({
    usuario: req.usuario
  });
});

// -------------------------
// ROTAS API
// -------------------------
app.post('/partidas', verificarToken, async (req, res) => {
  try {
    const { campeonato, local, adversario, data_partida, atleta1, atleta2 } = req.body;

    if (!campeonato || !local || !adversario || !data_partida || !atleta1 || !atleta2) {
      return res.status(400).json({ erro: 'Todos os campos da partida são obrigatórios.' });
    }

    const sql = `
      INSERT INTO partidas (
        campeonato,
        local,
        adversario,
        data_partida,
        dupla,
        atleta1,
        atleta2,
        resultado,
        id_usuario
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Em andamento', ?)
    `;

    const result = await queryAsync(sql, [
      campeonato,
      local,
      adversario,
      data_partida,
      `${atleta1} / ${atleta2}`,
      atleta1,
      atleta2,
      req.usuario.id
    ]);

    res.status(201).json({ id_partida: result.insertId });
  } catch (error) {
    console.error('Erro ao criar partida:', error);
    res.status(500).json({ erro: 'Erro ao criar partida' });
  }
});

app.post('/evento', async (req, res) => {
  try {
    const { id_partida, id_atleta, set_numero, fundamento, resultado } = req.body;

    const sql = `
      INSERT INTO eventos_partida (id_partida, id_atleta, set_numero, fundamento, resultado)
      VALUES (?, ?, ?, ?, ?)
    `;

    await queryAsync(sql, [id_partida, id_atleta, set_numero, fundamento, resultado]);
    res.json({ mensagem: 'Evento salvo!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao salvar evento' });
  }
});

app.post('/partidas/:id/finalizar', async (req, res) => {
  try {
    const id = req.params.id;
    const { sets } = req.body;

    await queryAsync(`DELETE FROM sets_partida WHERE id_partida = ?`, [id]);

    for (const set of sets) {
      await queryAsync(
        `INSERT INTO sets_partida (id_partida, set_numero, pontos_dupla, pontos_adversario) VALUES (?, ?, ?, ?)`,
        [id, set.set_numero, set.pontos_dupla, set.pontos_adversario]
      );
    }

    const final = calcularResultadoFinal(sets);
    await queryAsync(`UPDATE partidas SET resultado = ? WHERE id = ?`, [final, id]);

    res.json({ resultado: final });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao finalizar' });
  }
});

app.get('/partidas', verificarToken, async (req, res) => {
  try {
    const result = await queryAsync(
      `SELECT * FROM partidas WHERE id_usuario = ? ORDER BY data_partida DESC, id DESC`,
      [req.usuario.id]
    );

    res.json(result);
  } catch (error) {
    console.error('Erro ao buscar partidas:', error);
    res.status(500).json({ erro: 'Erro ao buscar partidas.' });
  }
});

// -------------------------
// RELATÓRIO PDF
// -------------------------
app.get('/relatorio/:id_partida/:tipo/pdf', async (req, res) => {
  try {
    const { id_partida, tipo } = req.params;
    const d = await buscarDadosRelatorio(id_partida, tipo);
    const p = d.partida;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 20px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 20px; }
          h2 { color: #0f766e; font-size: 18px; border-left: 4px solid #0f766e; padding-left: 10px; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-size: 11px; }
          th { background: #f1f5f9; font-weight: bold; }
          .highlight { background: #f8fafc; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin:0; font-size: 22px;">Relatório Estatístico - Moura Analytics</h1>
          <p style="margin:5px 0;">Relatório: ${tipo.toUpperCase()} | Dupla: ${p.dupla}</p>
        </div>

        <div class="meta-grid">
          <div><strong>Competição:</strong> ${p.campeonato}</div>
          <div><strong>Local:</strong> ${p.local}</div>
          <div><strong>Adversário:</strong> ${p.adversario}</div>
          <div><strong>Data:</strong> ${formatarDataBR(p.data_partida)}</div>
          <div><strong>Placar:</strong> ${p.resultado}</div>
        </div>

        <h2>Desempenho por Fundamento</h2>
        <table>
          <thead>
            <tr>
              <th>Fundamento</th>
              <th>Total</th>
              <th>Pontos/Sucesso</th>
              <th>Erros</th>
              <th>Aproveitamento (%)</th>
              <th>Eficiência (%)</th>
            </tr>
          </thead>
          <tbody>
            ${['ataque', 'sideout', 'contra_ataque', 'saque', 'passe', 'bloqueio', 'defesa'].map(f => `
              <tr>
                <td style="text-transform: capitalize; text-align: left;"><strong>${f.replace('sideout','Side-out').replace('contra_ataque','Contra-ataque')}</strong></td>
                <td>${d[f].total || 0}</td>
                <td>${d[f].pontos || 0}</td>
                <td>${d[f].erros || 0}</td>
                <td class="highlight">${d[f].aproveitamento || 0}%</td>
                <td class="highlight">${d[f].eficiencia || 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.contentType('application/pdf').send(pdf);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).send('Erro ao gerar PDF');
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});