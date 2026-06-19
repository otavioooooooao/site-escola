const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Mudamos de sqlite3 para pg (PostgreSQL)
const app = express();

app.use(cors());
app.use(express.json());

// Conexão com o Banco de Dados PostgreSQL do Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // O Render vai preencher isto automaticamente
    ssl: { rejectUnauthorized: false }
});

// Inicialização das Tabelas no PostgreSQL
const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS utilizadores (
            id SERIAL PRIMARY KEY,
            nome TEXT UNIQUE,
            senha TEXT,
            tipo TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS notas (
            id SERIAL PRIMARY KEY,
            aluno TEXT,
            materia TEXT,
            n1 REAL,
            n2 REAL,
            media REAL,
            situacao TEXT
        )`);
        console.log("Tabelas verificadas/criadas no PostgreSQL.");
    } catch (err) {
        console.error("Erro ao criar tabelas:", err.message);
    }
};
initDB();

// Rotas da API
app.post('/api/registo', async (req, res) => {
    const { nome, senha, tipo } = req.body;
    try {
        await pool.query(`INSERT INTO utilizadores (nome, senha, tipo) VALUES ($1, $2, $3)`, [nome, senha, tipo]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(400).json({ erro: "Este utilizador já existe no sistema." });
    }
});

app.post('/api/login', async (req, res) => {
    const { nome, senha } = req.body;
    try {
        const result = await pool.query(`SELECT nome, tipo FROM utilizadores WHERE nome = $1 AND senha = $2`, [nome, senha]);
        if (result.rows.length === 0) return res.status(401).json({ erro: "Credenciais incorretas." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/alunos', async (req, res) => {
    try {
        const result = await pool.query(`SELECT nome FROM utilizadores WHERE tipo = 'aluno'`);
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

app.post('/api/notas', async (req, res) => {
    const { aluno, materia, n1, n2 } = req.body;
    const media = (parseFloat(n1) + parseFloat(n2)) / 2;
    const situacao = media >= 7.0 ? "APROVADO" : "REPROVADO";
    try {
        await pool.query(`INSERT INTO notas (aluno, materia, n1, n2, media, situacao) VALUES ($1, $2, $3, $4, $5, $6)`,
            [aluno, materia, n1, n2, media, situacao]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/notas', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM notas`);
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

app.get('/api/notas/:aluno', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM notas WHERE LOWER(aluno) = LOWER($1)`, [req.params.aluno]);
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

app.delete('/api/notas/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM notas WHERE id = $1`, [req.params.id]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// O Render define a porta automaticamente através de process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor a rodar na porta ${PORT}`));