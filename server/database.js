const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '..', 'avq.db');
let db;

// Initialize SQL.js
async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  let buffer;
  if (fs.existsSync(dbPath)) {
    buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('single', 'multiple', 'truefalse', 'short', 'fillblank')),
      options TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      image_url TEXT,
      difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Check if the CHECK constraint for question_type needs updating
  // In SQLite, we have to recreate the table to change CHECK constraints
  const schemaRes = db.exec("SELECT sql FROM sqlite_master WHERE name='questions'");
  if (schemaRes.length > 0 && schemaRes[0].values.length > 0) {
    const schema = schemaRes[0].values[0][0];
    // Check if 'fillblank' is missing from the constraint
    if (!schema.includes("'fillblank'") && !schema.includes('"fillblank"')) {
      console.log('🔄 Migrating questions table to support new types...');
      db.run('BEGIN TRANSACTION');
      try {
        db.run('ALTER TABLE questions RENAME TO questions_old');
        db.run(`
        CREATE TABLE questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module_id TEXT NOT NULL,
          topic TEXT NOT NULL,
          question_text TEXT NOT NULL,
          question_type TEXT NOT NULL CHECK(question_type IN ('single', 'multiple', 'truefalse', 'short', 'fillblank')),
          options TEXT,
          correct_answer TEXT NOT NULL,
          explanation TEXT NOT NULL,
          image_url TEXT,
          difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
        db.run('INSERT INTO questions SELECT * FROM questions_old');
        db.run('DROP TABLE questions_old');
        db.run('COMMIT');
        console.log('✅ Migration successful');
      } catch (e) {
        db.run('ROLLBACK');
        console.error('❌ Migration failed:', e);
      }
    }
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      topics TEXT, -- JSON array of strings
      is_custom BOOLEAN DEFAULT 0
    )
  `);

  // Migrate modules from JSON if table is empty
  const modCount = db.exec('SELECT COUNT(*) FROM modules')[0].values[0][0];
  if (modCount === 0) {
    console.log('📦 Migrating modules from JSON to database...');
    const modulesPath = path.join(__dirname, '..', 'data', 'modules.json');
    if (fs.existsSync(modulesPath)) {
      try {
        const { modules: jsonMods } = JSON.parse(fs.readFileSync(modulesPath, 'utf8'));
        jsonMods.forEach(m => {
          db.run('INSERT INTO modules (id, name, category, topics) VALUES (?, ?, ?, ?)',
            [m.id, m.name, m.category, JSON.stringify(m.topics || [])]);
        });
      } catch (e) { console.error('Migration error:', e); }
    }
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      mode TEXT NOT NULL CHECK(mode IN ('practice', 'exam', 'mixed')),
      modules TEXT,
      time_limit INTEGER,
      question_count INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER,
      game_code TEXT UNIQUE NOT NULL,
      instructor_id INTEGER,
      status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'completed')),
      started_at DATETIME,
      ended_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS student_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      student_name TEXT NOT NULL,
      question_id INTEGER,
      answer TEXT,
      is_correct BOOLEAN,
      response_time INTEGER,
      points INTEGER,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDatabase();
  console.log('✅ Database schema initialized');
}

// Save database to file
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper functions for queries
const queries = {
  createUser: (username, password, role) => {
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role]);
    saveDatabase();
    return { lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] };
  },

  getUserByUsername: (username) => {
    const result = db.exec('SELECT * FROM users WHERE username = ?', [username]);
    if (result.length === 0) return null;
    const row = result[0];
    return rowToObject(row);
  },

  getUserById: (id) => {
    const result = db.exec('SELECT * FROM users WHERE id = ?', [id]);
    if (result.length === 0) return null;
    return rowToObject(result[0]);
  },

  createQuestion: (module_id, topic, question_text, question_type, options, correct_answer, explanation, image_url, difficulty, created_by) => {
    db.run(`

      INSERT INTO questions (module_id, topic, question_text, question_type, options, correct_answer, explanation, image_url, difficulty, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [module_id, topic, question_text, question_type, options, correct_answer, explanation, image_url, difficulty, created_by]);
    saveDatabase();
    return { lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] };
  },

  updateQuestion: (id, module_id, topic, question_text, question_type, options, correct_answer, explanation, image_url, difficulty) => {
    db.run(`
      UPDATE questions 
      SET module_id = ?, topic = ?, question_text = ?, question_type = ?, options = ?, correct_answer = ?, explanation = ?, image_url = ?, difficulty = ?
      WHERE id = ?
    `, [module_id, topic, question_text, question_type, options, correct_answer, explanation, image_url, difficulty, id]);
    saveDatabase();
  },

  getQuestionById: (id) => {
    const result = db.exec('SELECT * FROM questions WHERE id = ?', [id]);
    if (result.length === 0) return null;
    return rowToObject(result[0]);
  },

  getQuestionsByModule: (moduleId) => {
    const result = db.exec('SELECT * FROM questions WHERE module_id = ?', [moduleId]);
    if (result.length === 0) return [];
    return rowsToObjects(result[0]);
  },

  getAllQuestions: () => {
    const result = db.exec('SELECT * FROM questions');
    if (result.length === 0) return [];
    return rowsToObjects(result[0]);
  },

  deleteQuestion: (id) => {
    db.run('DELETE FROM questions WHERE id = ?', [id]);
    saveDatabase();
  },

  createQuiz: (title, description, mode, modules, time_limit, question_count, created_by) => {
    db.run(`
      INSERT INTO quizzes (title, description, mode, modules, time_limit, question_count, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [title, description, mode, modules, time_limit, question_count, created_by]);
    saveDatabase();
    return { lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] };
  },

  getQuizById: (id) => {
    const result = db.exec('SELECT * FROM quizzes WHERE id = ?', [id]);
    if (result.length === 0) return null;
    return rowToObject(result[0]);
  },

  getQuizzesByInstructor: (instructorId) => {
    const result = db.exec('SELECT * FROM quizzes WHERE created_by = ? ORDER BY created_at DESC', [instructorId]);
    if (result.length === 0) return [];
    return rowsToObjects(result[0]);
  },

  getAllQuizzes: () => {
    const result = db.exec('SELECT * FROM quizzes ORDER BY created_at DESC');
    if (result.length === 0) return [];
    return rowsToObjects(result[0]);
  },

  createSession: (quiz_id, game_code, instructor_id, status) => {
    db.run(`
      INSERT INTO quiz_sessions (quiz_id, game_code, instructor_id, status)
      VALUES (?, ?, ?, ?)
    `, [quiz_id, game_code, instructor_id, status]);
    saveDatabase();
    return { lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] };
  },

  getSessionByCode: (gameCode) => {
    const result = db.exec('SELECT * FROM quiz_sessions WHERE game_code = ?', [gameCode]);
    if (result.length === 0) return null;
    return rowToObject(result[0]);
  },

  getSessionById: (id) => {
    const result = db.exec('SELECT * FROM quiz_sessions WHERE id = ?', [id]);
    if (result.length === 0) return null;
    return rowToObject(result[0]);
  },

  updateSessionStatus: (status, started_at, id) => {
    db.run('UPDATE quiz_sessions SET status = ?, started_at = ? WHERE id = ?', [status, started_at, id]);
    saveDatabase();
  },

  endSession: (status, ended_at, id) => {
    db.run('UPDATE quiz_sessions SET status = ?, ended_at = ? WHERE id = ?', [status, ended_at, id]);
    saveDatabase();
  },

  getActiveSessionsByInstructor: (instructorId) => {
    const result = db.exec(`
      SELECT * FROM quiz_sessions WHERE instructor_id = ? AND status IN ('waiting', 'active')
    `, [instructorId]);
    if (result.length === 0) return [];
    return rowsToObjects(result[0]);
  },

  createResponse: (session_id, student_name, question_id, answer, is_correct, response_time, points) => {
    db.run(`
      INSERT INTO student_responses (session_id, student_name, question_id, answer, is_correct, response_time, points)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [session_id, student_name, question_id, answer, is_correct, response_time, points]);
    saveDatabase();
  },

  getResponsesBySession: (sessionId) => {
    const result = db.exec('SELECT * FROM student_responses WHERE session_id = ?', [sessionId]);
    if (result.length === 0) return [];
    return rowsToObjects(result[0]);
  },

  getResponsesByStudent: (sessionId, studentName) => {
    const result = db.exec('SELECT * FROM student_responses WHERE session_id = ? AND student_name = ?', [sessionId, studentName]);
    if (result.length === 0) return [];
    return rowsToObjects(result[0]);
  },

  // Module Management
  getAllModules: () => {
    const result = db.exec('SELECT * FROM modules ORDER BY id ASC');
    if (result.length === 0) return [];
    return rowsToObjects(result[0]).map(m => ({ ...m, topics: JSON.parse(m.topics || '[]') }));
  },

  updateModule: (id, name, category, topics) => {
    db.run('UPDATE modules SET name = ?, category = ?, topics = ?, is_custom = 1 WHERE id = ?',
      [name, category, JSON.stringify(topics), id]);
    saveDatabase();
  },

  createModule: (id, name, category, topics) => {
    db.run('INSERT INTO modules (id, name, category, topics, is_custom) VALUES (?, ?, ?, ?, 1)',
      [id, name, category, JSON.stringify(topics)]);
    saveDatabase();
  },

  deleteModule: (id) => {
    db.run('DELETE FROM modules WHERE id = ?', [id]);
    saveDatabase();
  }
};

// Helper to convert SQL.js result to object
function rowToObject(result) {
  if (!result || !result.columns || !result.values || result.values.length === 0) return null;
  const obj = {};
  result.columns.forEach((col, i) => {
    obj[col] = result.values[0][i];
  });
  return obj;
}

// Helper to convert SQL.js results to array of objects
function rowsToObjects(result) {
  if (!result || !result.columns || !result.values) return [];
  return result.values.map(row => {
    const obj = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

module.exports = {
  initDatabase,
  queries,
  saveDatabase
};
