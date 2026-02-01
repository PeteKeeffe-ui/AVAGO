const { initDatabase, queries } = require('./database');
const fs = require('fs');
const path = require('path');

async function loadQuestions() {
    await initDatabase();

    // Load questions from JSON
    const questionsPath = path.join(__dirname, '..', 'data', 'questions.json');
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

    console.log(`Loading ${questionsData.questions.length} questions...`);

    for (const q of questionsData.questions) {
        try {
            queries.createQuestion(
                q.module_id,
                q.topic,
                q.question_text,
                q.question_type,
                JSON.stringify(q.options),
                JSON.stringify(q.correct_answer),
                q.explanation,
                q.image_url,
                q.difficulty,
                1 // Created by instructor1
            );
            console.log(`✅ Loaded: ${q.question_text.substring(0, 50)}...`);
        } catch (error) {
            console.error(`❌ Error loading question:`, error.message);
        }
    }

    console.log('\n✅ All questions loaded!');
    process.exit(0);
}

loadQuestions();
