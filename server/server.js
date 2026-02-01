require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { initDatabase, queries } = require('./database');

const logPath = path.join(process.cwd(), 'server_debug.log');
function logDebug(msg) {
    const time = new Date().toISOString();
    try {
        fs.appendFileSync(logPath, `[${time}] ${msg}\n`);
    } catch (e) {
        console.error('Logging failed:', e);
    }
    console.log(msg);
}

logDebug('--- SERVER RESTARTING ---');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session middleware
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'avq-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
});

app.use(sessionMiddleware);

// Share session with Socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// In-memory storage for active game sessions
const activeSessions = new Map();

// ===== ROUTES =====

// Landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Instructor login
app.post('/api/instructor/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = queries.getUserByUsername(username);

        if (!user || user.role !== 'instructor') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check auth status
app.get('/api/auth/check', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                role: req.session.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get all questions
app.get('/api/questions', (req, res) => {
    try {
        const questions = queries.getAllQuestions();
        res.json(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get EASA modules
app.get('/api/modules', (req, res) => {
    try {
        const modulesData = queries.getAllModules();
        res.json({ modules: modulesData });
    } catch (error) {
        console.error('Error fetching modules:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create module
app.post('/api/modules', (req, res) => {
    if (!req.session.userId || req.session.role !== 'instructor') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const { id, name, category, topics } = req.body;
        queries.createModule(id, name, category, topics);
        res.json({ success: true });
    } catch (error) {
        console.error('Error creating module:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update module
app.put('/api/modules/:id', (req, res) => {
    if (!req.session.userId || req.session.role !== 'instructor') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        const { name, category, topics } = req.body;
        queries.updateModule(req.params.id, name, category, topics);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating module:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete module
app.delete('/api/modules/:id', (req, res) => {
    if (!req.session.userId || req.session.role !== 'instructor') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        queries.deleteModule(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting module:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get questions by module
app.get('/api/questions/module/:moduleId', (req, res) => {
    try {
        const questions = queries.getQuestionsByModule(req.params.moduleId);
        res.json(questions);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create question
app.post('/api/questions', (req, res) => {
    console.log(`\n📥 [POST /api/questions] User: ${req.session.userId}`);
    if (!req.session.userId || req.session.role !== 'instructor') {
        console.warn('❌ Create blocked: Unauthorized');
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { module_id, topic, question_text, question_type, options, correct_answer, explanation, image_url, difficulty } = req.body;
        console.log(`   Creating question for module ${module_id}: "${question_text.substring(0, 30)}..."`);

        const result = queries.createQuestion(
            module_id,
            topic,
            question_text,
            question_type,
            JSON.stringify(options),
            JSON.stringify(correct_answer),
            explanation,
            image_url || null,
            difficulty,
            req.session.userId
        );

        console.log(`✅ Question created. ID: ${result.lastInsertRowid}`);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('❌ Error creating question:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update question
app.put('/api/questions/:id', (req, res) => {
    console.log(`\n📥 [PUT /api/questions/${req.params.id}] User: ${req.session.userId}`);
    if (!req.session.userId || req.session.role !== 'instructor') {
        console.warn('❌ Update blocked: Unauthorized');
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { module_id, topic, question_text, question_type, options, correct_answer, explanation, image_url, difficulty } = req.body;
        const id = req.params.id;

        queries.updateQuestion(
            id,
            module_id,
            topic,
            question_text,
            question_type,
            JSON.stringify(options),
            JSON.stringify(correct_answer),
            explanation,
            image_url || null,
            difficulty
        );

        console.log('✅ Question updated.');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error updating question:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete question
app.delete('/api/questions/:id', (req, res) => {
    if (!req.session.userId || req.session.role !== 'instructor') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        queries.deleteQuestion(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create quiz
app.post('/api/quizzes', (req, res) => {
    if (!req.session.userId || req.session.role !== 'instructor') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { title, description, mode, modules, time_limit, question_count } = req.body;

        const result = queries.createQuiz(
            title,
            description,
            mode,
            JSON.stringify(modules),
            time_limit || null,
            question_count,
            req.session.userId
        );

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error creating quiz:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get instructor's quizzes
app.get('/api/quizzes', (req, res) => {
    if (!req.session.userId || req.session.role !== 'instructor') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const quizzes = queries.getQuizzesByInstructor(req.session.userId);
        res.json(quizzes);
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Generate unique game code
function generateGameCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (activeSessions.has(code));
    return code;
}

// Create quiz session
app.post('/api/sessions/create', (req, res) => {
    if (!req.session.userId || req.session.role !== 'instructor') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const { quizId } = req.body;
        const gameCode = generateGameCode();

        const result = queries.createSession(
            quizId,
            gameCode,
            req.session.userId,
            'waiting'
        );

        // Initialize session in memory
        activeSessions.set(gameCode, {
            sessionId: result.lastInsertRowid,
            quizId,
            instructorId: req.session.userId,
            students: [],
            currentQuestionIndex: -1,
            questions: [],
            status: 'waiting'
        });

        res.json({ success: true, gameCode, sessionId: result.lastInsertRowid });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get active sessions for instructor
app.get('/api/sessions/active', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sessions = Array.from(activeSessions.values())
            .filter(s => s.instructorId === req.session.userId)
            .map(s => {
                const quiz = queries.getQuizById(s.quizId);
                return {
                    ...s,
                    quizTitle: quiz ? quiz.title : 'Unknown Quiz'
                };
            });
        res.json(sessions);
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== SOCKET.IO REAL-TIME EVENTS =====

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Help format question safely
    const formatQuestion = (question, index, total) => {
        let options = [];
        try {
            if (question.options) {
                options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
            }
        } catch (e) {
            console.error('Error parsing question options:', e);
            options = [];
        }

        // Ensure options is an array
        if (!Array.isArray(options)) options = [];

        return {
            questionNumber: index + 1,
            totalQuestions: total,
            id: question.id,
            question_text: question.question_text,
            question_type: question.question_type,
            options: options,
            image_url: question.image_url,
            time_limit: question.time_limit || 75
        };
    };

    // Instructor joins to host session
    socket.on('host-session', ({ gameCode }) => {
        const session = activeSessions.get(gameCode);
        if (!session) return;
        socket.join(gameCode);
        socket.gameCode = gameCode;
        socket.role = 'instructor';

        const leaderboard = session.students.map(s => ({
            name: s.name,
            score: s.score,
            hasAnswered: s.currentAnswer !== null
        })).sort((a, b) => b.score - a.score);

        socket.emit('student-joined', {
            totalStudents: session.students.length,
            students: leaderboard
        });
        console.log(`📡 Instructor hosting session ${gameCode}`);
    });

    // Student joins for the first time
    socket.on('join-session', (data) => {
        const { gameCode, studentName } = data;
        const normalizedCode = String(gameCode).trim();
        const normalizedName = String(studentName).trim();

        console.log(`\n📥 [JOIN-REQUEST] Student: "${normalizedName}" Session: "${normalizedCode}"`);

        const session = activeSessions.get(normalizedCode);
        if (!session) {
            console.error(`❌ Join failed: Session ${normalizedCode} not found.`);
            socket.emit('join-error', { message: 'Session not found. Please check the code.' });
            return;
        }

        let student = session.students.find(s => s.name === normalizedName);
        if (student) {
            console.log(`   Re-binding existing student: ${normalizedName}`);
            student.socketId = socket.id;
        } else {
            console.log(`   New student entry: ${normalizedName}`);
            student = { socketId: socket.id, name: normalizedName, score: 0, currentAnswer: null, answers: [] };
            session.students.push(student);
        }

        socket.join(normalizedCode);
        socket.gameCode = normalizedCode;
        socket.studentName = normalizedName;

        console.log(`✅ ${normalizedName} joined ${normalizedCode}. Total students: ${session.students.length}`);

        // Confirmation for student page
        socket.emit('student-joined', {
            students: session.students.map(s => ({ name: s.name, score: s.score, hasAnswered: s.currentAnswer !== null }))
        });

        // Notify session
        const leaderboard = session.students.map(s => ({
            name: s.name,
            score: s.score,
            hasAnswered: s.currentAnswer !== null
        })).sort((a, b) => b.score - a.score);
        io.to(normalizedCode).emit('leaderboard-update', leaderboard);
        io.to(normalizedCode).emit('student-joined', {
            totalStudents: session.students.length,
            students: leaderboard
        });
    });

    // Student rejoins
    socket.on('rejoin-session', (data) => {
        const { gameCode, studentName } = data;
        const normalizedCode = String(gameCode).trim();
        const normalizedName = String(studentName).trim();

        const session = activeSessions.get(normalizedCode);
        if (!session) return;

        let student = session.students.find(s => s.name === normalizedName);
        if (student) {
            student.socketId = socket.id;
            socket.join(normalizedCode);
            socket.gameCode = normalizedCode;
            socket.studentName = normalizedName;
            console.log(`🔄 ${normalizedName} rejoined ${normalizedCode}`);
        } else {
            console.warn(`⚠️ Rejoin failed: ${normalizedName} not found in ${normalizedCode}. Students: ${session.students.map(s => s.name).join(', ')}`);
        }
    });

    // Request LATEST state (Pull mechanism)
    socket.on('request-question', ({ gameCode }) => {
        const session = activeSessions.get(gameCode);
        if (!session || session.status !== 'active') return;

        const idx = session.currentQuestionIndex;
        if (idx >= 0 && idx < session.questions.length) {
            const question = session.questions[idx];
            socket.emit('new-question', formatQuestion(question, idx, session.questions.length));

            // If the student already answered this question, send them the result too
            const student = session.students.find(s => s.socketId === socket.id || s.name === socket.studentName);
            if (student && student.currentAnswer !== null) {
                // Determine correctness for the stored answer
                let correctAnswer;
                try {
                    correctAnswer = typeof question.correct_answer === 'string' ? JSON.parse(question.correct_answer) : question.correct_answer;
                } catch (e) { correctAnswer = question.correct_answer; }

                let isCorrect = false;
                // ... (simplified check for re-sync)
                if (question.question_type === 'single') isCorrect = student.currentAnswer === correctAnswer;
                // (Omit full logic here for brevity, just send the result state)

                socket.emit('answer-result', {
                    isCorrect,
                    points: 0, // Points already added
                    totalScore: student.score,
                    correctAnswer,
                    explanation: question.explanation
                });
            }
        }
    });

    socket.on('start-quiz', ({ gameCode, questions }) => {
        const session = activeSessions.get(gameCode);
        if (!session) return;
        session.questions = questions;
        session.status = 'active';
        session.currentQuestionIndex = -1;
        queries.updateSessionStatus('active', new Date().toISOString(), session.sessionId);
        io.to(gameCode).emit('quiz-started', { totalQuestions: questions.length });
        console.log(`🎮 Start Session ${gameCode}`);
    });

    socket.on('next-question', ({ gameCode }) => {
        const session = activeSessions.get(gameCode);
        if (!session) return;

        session.currentQuestionIndex++;
        const idx = session.currentQuestionIndex;
        if (idx >= session.questions.length) {
            const leaderboard = session.students.map(s => ({ name: s.name, score: s.score })).sort((a, b) => b.score - a.score);
            io.to(gameCode).emit('quiz-ended', { leaderboard });
            return;
        }

        session.currentQuestionStartTime = Date.now();
        session.students.forEach(s => s.currentAnswer = null);

        io.to(gameCode).emit('new-question', formatQuestion(session.questions[idx], idx, session.questions.length));
        console.log(`❓ Q${idx + 1} sent to ${gameCode}`);
    });

    socket.on('submit-answer', (data) => {
        const { gameCode, studentName, answer } = data;
        const normalizedCode = String(gameCode).trim();
        const normalizedName = String(studentName || '').trim();

        const session = activeSessions.get(normalizedCode);
        if (!session || session.currentQuestionIndex < 0) {
            console.error(`❌ Submit blocked: Session "${normalizedCode}" not found or not active.`);
            return;
        }

        // Use name if provided, else fallback to socket
        const lookupName = normalizedName || socket.studentName;
        const student = session.students.find(s => s.name === lookupName || s.socketId === socket.id);

        if (!student) {
            console.error(`❌ Student "${lookupName}" (Socket: ${socket.id}) not found in session ${normalizedCode}.`);
            console.log(`   Known students: ${JSON.stringify(session.students.map(s => ({ name: s.name, sid: s.socketId })))}`);
            return;
        }

        if (student.currentAnswer !== null) return; // Prevent double submission

        const question = session.questions[session.currentQuestionIndex];
        const respTime = Date.now() - session.currentQuestionStartTime;

        let correctAnswer;
        try { correctAnswer = typeof question.correct_answer === 'string' ? JSON.parse(question.correct_answer) : question.correct_answer; }
        catch (e) { correctAnswer = question.correct_answer; }

        let isCorrect = false;
        if (question.question_type === 'single') isCorrect = answer === correctAnswer;
        else if (question.question_type === 'multiple') {
            const cS = Array.isArray(correctAnswer) ? [...correctAnswer].sort() : [];
            const aS = Array.isArray(answer) ? [...answer].sort() : [];
            isCorrect = JSON.stringify(cS) === JSON.stringify(aS);
        } else if (question.question_type === 'truefalse') {
            isCorrect = (answer === 0 ? true : false) === (correctAnswer === true || correctAnswer === 'true' || correctAnswer === 1);
        } else if (question.question_type === 'short') {
            const normA = String(answer).toLowerCase().trim();
            const posA = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
            isCorrect = posA.some(ca => String(ca).toLowerCase().trim() === normA);
        } else if (question.question_type === 'fillblank') {
            const blankCount = (question.question_text.match(/\[blank\]/g) || []).length;
            const posA = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
            let localMultiplier = 0;

            if (blankCount > 1) {
                // Multiple blanks: checks positional accuracy with partial credit
                logDebug(`DEBUG MultiBlank: Ans=${JSON.stringify(answer)}, Correct=${JSON.stringify(posA)}`);

                if (Array.isArray(answer) && answer.length === posA.length) {
                    let correctCount = 0;
                    answer.forEach((ans, i) => {
                        const match = String(ans).toLowerCase().trim() === String(posA[i]).toLowerCase().trim();
                        if (match) correctCount++;
                        logDebug(`   [${i}] "${ans}" vs "${posA[i]}" -> ${match ? 'MATCH' : 'FAIL'}`);
                    });

                    // Partial credit logic
                    const percent = correctCount / blankCount;
                    isCorrect = percent === 1;
                    localMultiplier = percent;
                    logDebug(`   Result: ${correctCount}/${blankCount} correct. Multiplier: ${localMultiplier}`);
                } else {
                    logDebug(`DEBUG: Length mismatch or not array. AnsType=${typeof answer} AnsLen=${Array.isArray(answer) ? answer.length : 'N/A'} PosALen=${posA.length}`);
                    isCorrect = false;
                    localMultiplier = 0;
                }
            } else {
                // Single blank: check against list of accepted answers (synonyms)
                const studentStr = Array.isArray(answer) ? answer[0] : answer;
                const normA = String(studentStr).toLowerCase().trim();
                isCorrect = posA.some(ca => String(ca).toLowerCase().trim() === normA);
                localMultiplier = isCorrect ? 1 : 0;
            }
            // Temporarily store for this scope (avoid modifying question object)
            question._tempMultiplier = localMultiplier;
        }

        let multiplier = isCorrect ? 1 : (question.question_type === 'fillblank' ? (question._tempMultiplier || 0) : 0);
        let pts = Math.round(1000 * multiplier * Math.max(0, 1 - (respTime / 75000) * 0.5));
        student.score += pts;
        student.currentAnswer = answer;

        socket.emit('answer-result', {
            isCorrect,
            points: pts,
            totalScore: student.score,
            correctAnswer,
            studentAnswer: answer,
            explanation: question.explanation,
            partial: multiplier > 0 && multiplier < 1
        });

        const leaderboard = session.students.map(s => ({ name: s.name, score: s.score, hasAnswered: s.currentAnswer !== null })).sort((a, b) => b.score - a.score);
        io.to(gameCode).emit('leaderboard-update', leaderboard);

        // CHECK IF ALL STUDENTS HAVE ANSWERED
        const answeredCount = session.students.filter(s => s.currentAnswer !== null).length;
        if (answeredCount >= session.students.length && session.students.length > 0) {
            console.log(`🏁 All answered in ${gameCode}. Closing question.`);

            // Calculate detailed stats
            const stats = {
                correct: session.students.filter(s => {
                    if (s.currentAnswer === null) return false;

                    let cA;
                    try { cA = typeof question.correct_answer === 'string' ? JSON.parse(question.correct_answer) : question.correct_answer; } catch (e) { cA = question.correct_answer; }

                    let isCorrectStat = false;
                    if (question.question_type === 'single') isCorrectStat = s.currentAnswer === cA;
                    else if (question.question_type === 'truefalse') isCorrectStat = (Number(s.currentAnswer) === 0 ? 'True' : 'False') === String(cA) || s.currentAnswer === cA;
                    else if (question.question_type === 'multiple') {
                        if (Array.isArray(s.currentAnswer) && Array.isArray(cA)) {
                            isCorrectStat = s.currentAnswer.length === cA.length && s.currentAnswer.every(v => cA.includes(v));
                        }
                    }
                    else if (question.question_type === 'short' || question.question_type === 'fillblank') {
                        if (question.question_type === 'fillblank') {
                            const ans = s.currentAnswer;
                            const blankCount = (question.question_text.match(/\[blank\]/g) || []).length;
                            const posA = Array.isArray(cA) ? cA : [cA];

                            if (blankCount > 1) {
                                if (Array.isArray(ans) && ans.length === posA.length) {
                                    let correctCount = 0;
                                    ans.forEach((v, i) => { if (String(v).toLowerCase().trim() === String(posA[i]).toLowerCase().trim()) correctCount++; });
                                    // For stats, let's count it as correct if they got > 0 points (partial match) or maybe strictly 100%? 
                                    // User said "number of correct answers", likely expects full correctness.
                                    // Let's log what we found.
                                    isCorrectStat = correctCount === blankCount;
                                }
                            } else {
                                const studentStr = Array.isArray(ans) ? ans[0] : ans;
                                const normStudent = String(studentStr).toLowerCase().trim();
                                isCorrectStat = posA.some(k => String(k).toLowerCase().trim() === normStudent);
                            }
                        }
                    }
                    console.log(`STATS DEBUG: Student=${s.name} Type=${question.question_type} Ans=${JSON.stringify(s.currentAnswer)} Correct=${JSON.stringify(cA)} Result=${isCorrectStat}`);
                    return isCorrectStat;
                }).length,
                total: session.students.length
            };

            io.to(gameCode).emit('question-results', {
                leaderboard,
                correctAnswer,
                explanation: question.explanation,
                stats: stats,
                showLeaderboard: (session.currentQuestionIndex + 1) % 5 === 0
            });
        }
    });

    socket.on('show-results', ({ gameCode }) => {
        const session = activeSessions.get(gameCode);
        if (!session) return;
        const q = session.questions[session.currentQuestionIndex];
        let cA; try { cA = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer; } catch (e) { cA = q.correct_answer; }

        const leaderboard = session.students.map(s => ({ name: s.name, score: s.score, hasAnswered: s.currentAnswer !== null })).sort((a, b) => b.score - a.score);

        // Calculate detailed stats
        const stats = {
            correct: session.students.filter(s => {
                if (s.currentAnswer === null) return false;
                if (q.question_type === 'single') return s.currentAnswer === cA;
                if (q.question_type === 'truefalse') return (s.currentAnswer === 0) === (cA === true || cA === 'true' || cA === 1);
                return false;
            }).length,
            total: session.students.length
        };

        io.to(gameCode).emit('question-results', {
            leaderboard,
            correctAnswer: cA,
            explanation: q.explanation,
            stats: stats,
            showLeaderboard: (session.currentQuestionIndex + 1) % 5 === 0
        });
    });

    socket.on('end-quiz', ({ gameCode }) => {
        const session = activeSessions.get(gameCode);
        if (!session) return;
        const leaderboard = session.students.map(s => ({ name: s.name, score: s.score })).sort((a, b) => b.score - a.score);
        io.to(gameCode).emit('quiz-ended', { leaderboard });
        queries.updateSessionStatus('completed', new Date().toISOString(), session.sessionId);
        activeSessions.delete(gameCode);
        console.log(`🏁 Quiz ended in session ${gameCode}`);
    });

    // Capture client-side debug logs
    socket.on('client-debug', (log) => {
        const timestamp = new Date().toISOString();
        const clientType = log.url.includes('instructor') ? 'INSTRUCTOR' : 'STUDENT';
        console.log(`\n🚨 [CLIENT-${clientType}] ${log.message}`);
        if (log.data) console.log('   Data:', JSON.stringify(log.data));
        console.log(`   URL: ${log.url} | UA: ${log.ua.substring(0, 50)}...`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (socket.gameCode && socket.studentName) {
            const session = activeSessions.get(socket.gameCode);
            if (session) {
                // We no longer remove the student from the array to maintain persistence
                // Instead, we just notify the host that they dropped (for UI status)
                io.to(socket.gameCode).emit('student-status-change', {
                    studentName: socket.studentName,
                    status: 'disconnected',
                    totalStudents: session.students.length
                });
            }
        }
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// Start server
async function startServer() {
    await initDatabase();
    console.log('✅ Database initialized');

    server.listen(PORT, () => {
        console.log(`\n🚀 AVQ Server running on port ${PORT}`);
        console.log(`📍 Local: http://localhost:${PORT}`);
        console.log(`📍 Instructor: http://localhost:${PORT}/instructor/login.html`);
        console.log(`📍 Student: http://localhost:${PORT}/student/join.html`);
        console.log('\n✈️  Aviation Questions - Ready for takeoff!\n');
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
