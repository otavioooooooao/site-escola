const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o Banco de Dados SQLite
const dbPath = path.resolve(__dirname, 'academico.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao abrir o banco de dados:", err.message);
    else console.log("Conectado ao banco de dados SQLite: academico.db");
});

// Criar as tabelas caso não existam
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE,
        senha TEXT,
        tipo TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno TEXT,
        materia TEXT,
        n1 REAL,
        n2 REAL,
        media REAL,
        situacao TEXT
    )`);
});

// Rota de Registo com Trava de Segurança para Professor
app.post('/api/registo', (req, res) => {
    const { nome, senha, tipo, chaveSecreta } = req.body;

    if (!nome || !senha || !tipo) {
        return res.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
    }

    // Bloqueio de segurança para conta de professor
    if (tipo === 'professor') {
        if (chaveSecreta !== 'COORDENACAO2026') {
            return res.status(403).json({ erro: "Chave de segurança inválida! Apenas a coordenação cria professores." });
        }
    }

    db.run('INSERT INTO usuarios (nome, senha, tipo) VALUES (?, ?, ?)', [nome, senha, tipo], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ erro: "Este utilizador já está registado!" });
            }
            return res.status(500).json({ erro: "Erro ao salvar no banco de dados." });
        }
        res.status(201).json({ mensagem: "Usuário registrado com sucesso!" });
    });
});

// Rota de Login
app.post('/api/login', (req, res) => {
    const { nome, senha } = req.body;

    db.get('SELECT nome, tipo FROM usuarios WHERE nome = ? AND senha = ?', [nome, senha], (err, row) => {
        if (err) return res.status(500).json({ erro: "Erro no servidor." });
        if (!row) return res.status(401).json({ erro: "Utilizador ou senha incorretos!" });
        res.json(row);
    });
});

// Rota de Notas Inteligente (Insere nova ou Edita/Sobrescreve se já existir)
app.post('/api/notas', (req, res) => {
    const { aluno, materia, n1, n2 } = req.body;
    
    const nota1 = parseFloat(n1) || 0;
    const nota2 = parseFloat(n2) || 0;
    const media = (nota1 + nota2) / 2;
    const situacao = media >= 6.0 ? 'APROVADO' : 'REPROVADO';

    // 1. Verifica se o aluno já tem nota cadastrada nesta matéria
    db.get('SELECT id FROM notas WHERE aluno = ? AND materia = ?', [aluno, materia], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: "Erro ao consultar o banco de dados." });
        }

        if (row) {
            // 2. Se já existir, faz um UPDATE (sobrescreve a nota)
            db.run(
                'UPDATE notas SET n1 = ?, n2 = ?, media = ?, situacao = ? WHERE id = ?',
                [nota1, nota2, media, situacao, row.id],
                function(updateErr) {
                    if (updateErr) return res.status(500).json({ erro: "Erro ao atualizar a nota." });
                    return res.json({ mensagem: "Nota atualizada com sucesso!" });
                }
            );
        } else {
            // 3. Se não existir, faz o INSERT normal (cria nova linha)
            db.run(
                'INSERT INTO notas (aluno, materia, n1, n2, media, situacao) VALUES (?, ?, ?, ?, ?, ?)',
                [aluno, materia, nota1, nota2, media, situacao],
                function(insertErr) {
                    if (insertErr) return res.status(500).json({ erro: "Erro ao inserir nova nota." });
                    return res.status(201).json({ mensagem: "Nota lançada com sucesso!" });
                }
            );
        }
    });
});

// Rota para Listar Notas (Usada tanto por Alunos quanto por Professores)
app.get('/api/notas', (req, res) => {
    const { aluno } = req.query;

    if (aluno) {
        // Se passar o aluno no filtro, traz apenas as notas dele
        db.all('SELECT * FROM notas WHERE aluno = ?', [aluno], (err, rows) => {
            if (err) return res.status(500).json({ erro: "Erro ao buscar notas." });
            res.json(rows);
        });
    } else {
        // Se não passar filtro (professor), traz todas as notas do sistema
        db.all('SELECT * FROM notas', [], (err, rows) => {
            if (err) return res.status(500).json({ erro: "Erro ao buscar notas." });
            res.json(rows);
        });
    }
});

// Rota para Apagar Nota (Botão da lixeira)
app.delete('/api/notas/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM notas WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ erro: "Erro ao apagar nota." });
        res.json({ mensagem: "Nota removida com sucesso!" });
    });
});

// Porta do Servidor para o Render (usa a porta do ambiente ou a 10000)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor a rodar na porta ${PORT}`);
});