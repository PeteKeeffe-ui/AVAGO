# AVAGO - Aviation Questions

A professional Kahoot-style multiplayer quiz platform for EASA Part-66 aircraft maintenance training.

![AVAGO Logo](✈️)

## Features

- **Real-Time Multiplayer**: Multiple instructors can run different quizzes simultaneously
- **Kahoot-Style Gameplay**: Engaging, competitive learning environment
- **Comprehensive Question Types**: Single/multiple choice, true/false, short answer with image support
- **EASA Part-66 Coverage**: All B1 and B2 modules with detailed explanations
- **Multiple Quiz Modes**: Practice, Exam (timed), and Mixed modes
- **Progress Tracking**: Detailed analytics and performance feedback
- **Flexible Deployment**: Works on local networks or cloud platforms

## Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- npm (comes with Node.js)

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initialize Database**
   ```bash
   npm run init-db
   ```

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Access the Application**
   - Landing Page: `http://localhost:3000`
   - Instructor Login: `http://localhost:3000/instructor/login.html`
   - Student Join: `http://localhost:3000/student/join.html`

### Test Accounts

**Instructors:**
- Username: `instructor1` | Password: `avago2026`
- Username: `instructor2` | Password: `avago2026`

**Students (optional - students can join without accounts):**
- Username: `student1` | Password: `avago2026`
- Username: `student2` | Password: `avago2026`
- Username: `student3` | Password: `avago2026`

## Usage Guide

### For Instructors

1. **Login** at `/instructor/login.html`
2. **Create a Quiz**:
   - Select quiz mode (Practice/Exam/Mixed)
   - Choose EASA modules
   - Set question count and time limits
3. **Start Live Quiz**:
   - Click "Start Live Quiz"
   - Share the 6-digit game code with students
   - Wait for students to join
   - Start the quiz when ready
4. **Control Quiz**:
   - Advance through questions
   - View live leaderboard
   - Show results after each question
   - End quiz and view final results

### For Students

1. **Join Quiz** at `/student/join.html`
2. **Enter Game Code** provided by instructor
3. **Enter Your Name**
4. **Wait in Lobby** for quiz to start
5. **Answer Questions**:
   - Read question carefully
   - Select answer before time runs out
   - See immediate feedback
6. **View Results** at the end

## Local Network Deployment

To allow students on your local network to access AVAGO:

1. **Find Your Local IP Address**:
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```
   Look for your IPv4 address (e.g., `192.168.1.100`)

2. **Share the URL with Students**:
   ```
   http://[YOUR-IP]:3000/student/join.html
   ```
   Example: `http://192.168.1.100:3000/student/join.html`

3. **Ensure Firewall Allows Connections**:
   - Windows: Allow Node.js through Windows Firewall
   - Mac: System Preferences → Security & Privacy → Firewall

## Cloud Deployment

### Heroku

1. **Create Heroku App**:
   ```bash
   heroku create avago-app
   ```

2. **Set Environment Variables**:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set SESSION_SECRET=your-random-secret-key
   ```

3. **Deploy**:
   ```bash
   git push heroku main
   ```

4. **Initialize Database**:
   ```bash
   heroku run npm run init-db
   ```

### Railway / Render

1. Connect your GitHub repository
2. Set environment variables:
   - `NODE_ENV=production`
   - `SESSION_SECRET=your-random-secret-key`
3. Deploy automatically on push

## Project Structure

```
AVAGO/
├── server/
│   ├── server.js           # Main server with Express & Socket.io
│   ├── database.js         # SQLite database setup
│   ├── initDatabase.js     # Database initialization script
│   └── routes/             # API routes (future expansion)
├── public/
│   ├── index.html          # Landing page
│   ├── instructor/         # Instructor pages
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── create-quiz.html
│   │   └── live-quiz.html
│   ├── student/            # Student pages
│   │   ├── join.html
│   │   ├── lobby.html
│   │   ├── quiz.html
│   │   └── results.html
│   ├── css/                # Stylesheets
│   │   ├── main.css
│   │   ├── instructor.css
│   │   └── student.css
│   ├── js/                 # Client-side JavaScript
│   └── assets/             # Images and media
├── data/
│   ├── modules.json        # EASA module structure
│   └── questions.json      # Sample question bank
├── package.json
├── .env                    # Environment variables
└── README.md
```

## EASA Part-66 Modules

### Common Modules (B1 & B2)
- Module 1: Mathematics
- Module 2: Physics
- Module 3: Electrical Fundamentals
- Module 4: Electronic Fundamentals
- Module 5: Digital Techniques
- Module 6: Materials & Hardware
- Module 7: Maintenance Practices
- Module 8: Basic Aerodynamics
- Module 9: Human Factors
- Module 10: Aviation Legislation

### B1 Category-Specific
- Module 11A/B: Aeroplane Systems
- Module 12: Helicopter Systems
- Module 15: Gas Turbine Engines
- Module 16: Piston Engines
- Module 17: Propellers

### B2 Category-Specific
- Module 13: Aircraft Systems (Avionic)
- Module 14: Propulsion

## Adding Questions

### Via JSON File

Edit `data/questions.json`:

```json
{
  "module_id": "M15",
  "topic": "Compressors",
  "question_text": "What causes compressor stall?",
  "question_type": "single",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": 0,
  "explanation": "Detailed explanation here...",
  "image_url": "/assets/images/diagram.png",
  "difficulty": "medium"
}
```

### Question Types

1. **Single Choice** (`"question_type": "single"`)
   - `correct_answer`: Index number (0-3)

2. **Multiple Choice** (`"question_type": "multiple"`)
   - `correct_answer`: Array of indices `[0, 2, 3]`

3. **True/False** (`"question_type": "truefalse"`)
   - `correct_answer`: `true` or `false`

4. **Short Answer** (`"question_type": "short"`)
   - `correct_answer`: Array of acceptable answers `["5", "x=5"]`

## Configuration

### Environment Variables

Create a `.env` file:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key-here
```

### Database

- **Development**: SQLite (`avq.db`)
- **Production**: Can migrate to PostgreSQL by setting `DATABASE_URL`

## Troubleshooting

### Students Can't Connect

1. Check firewall settings
2. Verify students are on the same network
3. Confirm correct IP address is shared
4. Ensure server is running (`npm start`)

### Quiz Not Starting

1. Check browser console for errors
2. Verify Socket.io connection
3. Refresh instructor and student pages
4. Check server logs

### Database Errors

1. Delete `avq.db` file
2. Run `npm run init-db` again
3. Restart server

## Development

### Run in Development Mode

```bash
npm run dev
```

This uses `nodemon` for automatic server restart on file changes.

### Adding New Features

1. Server-side: Edit `server/server.js`
2. Client-side: Add HTML/CSS/JS in `public/`
3. Database: Update schema in `server/database.js`

## Support

For issues or questions:
- Check the documentation above
- Review server logs
- Verify all dependencies are installed

## License

MIT License - Feel free to use and modify for your RTO.

## Credits

Developed for Australian RTOs teaching EASA Part-66 aircraft maintenance.

---

**AVAGO - Making Aircraft Maintenance Education Engaging** ✈️
