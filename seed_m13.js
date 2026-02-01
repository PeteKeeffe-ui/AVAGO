const { initDatabase, queries } = require('./server/database');

async function seed() {
    await initDatabase();

    const m13Questions = [
        {
            module_id: 'M13',
            topic: '13.3 Autoflight (ATA 22)',
            question_text: 'In an autopilot system, the feedback loop from the control surface to the computer is primarily used to:',
            question_type: 'single',
            options: [
                'Prevent control surface flutter',
                'Ensure the actual position matches the commanded position',
                'Bypass the pilot commands in an emergency',
                'Monitor the hydraulic pressure in the actuator'
            ],
            correct_answer: 1,
            explanation: 'The feedback (or follow-up) signal ensures that the servo has moved the control surface to the specific degree commanded by the autopilot computer.',
            difficulty: 'medium',
            created_by: 1
        },
        {
            module_id: 'M13',
            topic: '13.4 Communication/Navigation (ATA 23/34)',
            question_text: 'Which frequency range is typically used for long-distance oceanic HF communications?',
            question_type: 'single',
            options: [
                '118.000 to 136.975 MHz',
                '2 to 30 MHz',
                '108.00 to 117.95 MHz',
                '329.15 to 335.00 MHz'
            ],
            correct_answer: 1,
            explanation: 'High Frequency (HF) communications operate between 2 and 30 MHz to take advantage of skywave propagation for long-range communication.',
            difficulty: 'easy',
            created_by: 1
        },
        {
            module_id: 'M13',
            topic: '13.8 Instrument Systems (ATA 31)',
            question_text: 'An Electronic Flight Instrument System (EFIS) uses which of the following to display primary flight data?',
            question_type: 'multiple',
            options: [
                'Primary Flight Display (PFD)',
                'Hydraulic Pressure Indicator',
                'Navigation Display (ND)',
                'Standby Altimeter'
            ],
            correct_answer: [0, 2],
            explanation: 'EFIS typically consists of the PFD for flight parameters and the ND for navigation data.',
            difficulty: 'medium',
            created_by: 1
        }
    ];

    for (const q of m13Questions) {
        queries.createQuestion(
            q.module_id,
            q.topic,
            q.question_text,
            q.question_type,
            JSON.stringify(q.options),
            JSON.stringify(q.correct_answer),
            q.explanation,
            null,
            q.difficulty,
            q.created_by
        );
    }

    console.log(`✅ Seeded ${m13Questions.length} Module 13 questions.`);
}

seed().catch(console.error);
