const bcrypt = require('bcrypt');
const { initDatabase, queries } = require('./database');

// Initialize database and create test accounts
async function setup() {
    await initDatabase();

    const saltRounds = 10;
    const defaultPassword = 'avq2026';
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

    const accounts = [
        { username: 'instructor1', password: hashedPassword, role: 'instructor' },
        { username: 'instructor2', password: hashedPassword, role: 'instructor' },
        { username: 'student1', password: hashedPassword, role: 'student' },
        { username: 'student2', password: hashedPassword, role: 'student' },
        { username: 'student3', password: hashedPassword, role: 'student' },
    ];

    for (const account of accounts) {
        try {
            // Check if user exists
            const existing = queries.getUserByUsername(account.username);
            if (existing) {
                console.log(`ℹ️  ${account.username} already exists`);
            } else {
                queries.createUser(account.username, account.password, account.role);
                console.log(`✅ Created ${account.role}: ${account.username}`);
            }
        } catch (error) {
            console.error(`❌ Error creating ${account.username}:`, error.message);
        }
    }

    console.log('\n✅ Database initialization complete!');
    console.log('📝 Test accounts created with password: avq2026');
    process.exit(0);
}

setup();
