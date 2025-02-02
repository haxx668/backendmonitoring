require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import cors middleware

// Create the Express app
const app = express();

// Enable CORS for all routes and origins (or specify allowed origins)
app.use(cors());

// Parse JSON request bodies
app.use(bodyParser.json());

// Environment Variables
const connection = mysql.createConnection(process.env.DATABASE_URL);

connection.connect(err => {
    if (err) throw err;
    console.log('Database Connected!');
});

// Middleware for authenticating JWT tokens
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token
    if (!token) return res.status(401).json({ error: 'Access denied, no token provided' });

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified; // Add user data to request object
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid token' });
    }
}

// API Routes

// 1. Register
app.post('/auth/register', async (req, res) => {
    const { username, email, no_telp, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        const sql = 'INSERT INTO userdata (username, email, no_telp, password) VALUES (?, ?, ?, ?)';
        await db.promise().execute(sql, [username, email, no_telp, hashedPassword]);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Error registering user', details: err });
    }
});

// 2. Login
// app.post('/auth/login', async (req, res) => {
//     const { email, password } = req.body;

//     try {
//         const [rows] = await db.promise().execute('SELECT * FROM user WHERE email = ?', [email]);

//         if (rows.length === 0) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         const user = rows[0];
//         const isValidPassword = await bcrypt.compare(password, user.password);

//         if (!isValidPassword) {
//             return res.status(401).json({ error: 'Invalid password' });
//         }

//         // Create JWT Token
//         const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
//         res.json({ message: 'Login successful', token });
//     } catch (err) {
//         res.status(500).json({ error: 'Error logging in', details: err });
//     }
// });

// // 3. Add Alat
// app.post('/alat/add-alat', authenticate, async (req, res) => {
//     const { nama_anak, usia, jeniskelamin, idalat } = req.body;
//     const username = req.user.username; // Logged-in user's username

//     try {
//         const sql = 'INSERT INTO dataalat (username, nama_anak, usia, jeniskelamin, idalat) VALUES (?, ?, ?, ?, ?)';
//         await db.promise().execute(sql, [username, nama_anak, usia, jeniskelamin, idalat]);
//         res.status(201).json({ message: 'Alat added successfully' });
//     } catch (err) {
//         res.status(500).json({ error: 'Error adding alat', details: err });
//     }
// });

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Fetch user from the database
        const [rows] = await db.promise().execute('SELECT * FROM userdata WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User  not found' });
        }

        const user = rows[0];

        // Validate password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Create JWT Token
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        // Return token and username
        res.json({ 
            message: 'Login successful', 
            token, 
            username: user.username 
        });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

app.post('/alat/add-alat', authenticate, async (req, res) => {
    const { nama_anak, usia, jeniskelamin, idalat } = req.body;
    const username = req.user.username; // Logged-in user's username

    // Validate input
    if (!nama_anak || !usia || !jeniskelamin || !idalat) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Check if the alat ID already exists
        const [existingAlat] = await db.promise().execute('SELECT * FROM dataalat WHERE idalat = ?', [idalat]);
        if (existingAlat.length > 0) {
            return res.status(409).json({ error: 'Alat ID already exists' });
        }

        // Insert new alat
        const sql = 'INSERT INTO dataalat (username, nama_anak, usia, jeniskelamin, idalat) VALUES (?, ?, ?, ?, ?)';
        await db.promise().execute(sql, [username, nama_anak, usia, jeniskelamin, idalat]);

        res.status(201).json({ message: 'Alat added successfully' });
    } catch (err) {
        console.error('Error adding alat:', err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});


// 4. List Alat
app.get('/alat/list-alat', authenticate, async (req, res) => {
    const username = req.user.username; // Logged-in user's username

    try {
        const sql = 'SELECT nama_anak, idalat FROM dataalat WHERE username = ?';
        const [rows] = await db.promise().execute(sql, [username]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No data found for this user' });
        }

        res.json({ alat: rows });
    } catch (err) {
        console.error('Error fetching alat:', err);
        res.status(500).json({ error: 'Error fetching alat', details: err.message });
    }
});


// Endpoint to get the latest data for a specific alat by idalat
app.get('/monitoring/latest/:idalat', async (req, res) => {
    const { idalat } = req.params;

    try {
        // Fetch the latest monitoring data for the specified idalat
        const [rows] = await db.promise().execute(
            `SELECT * FROM monitoring WHERE idalat = ? ORDER BY updated_at DESC LIMIT 1`,
            [idalat]
        );

        if (rows.length === 0) {
            return res.status(200).json({ message: 'Alat belum dihidupkan' });
        }

        res.json({ data: rows[0] });
    } catch (err) {
        console.error('Error fetching latest monitoring data:', err);
        res.status(500).json({ error: 'Error fetching monitoring data', details: err.message });
    }
});

// API to save history when data remains unchanged for 10 seconds
app.post('/history/save', async (req, res) => {
    const { idalat, duration } = req.body;

    try {
        // Fetch the first updated_at for the specified idalat
        const [rows] = await db.promise().execute(
            `SELECT updated_at FROM monitoring WHERE idalat = ? ORDER BY updated_at ASC LIMIT 1`,
            [idalat]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No data found for this alat' });
        }

        const createdAt = rows[0].updated_at;

        // Save history data to the database
        const sql = `INSERT INTO history (idalat, created_at, duration) VALUES (?, ?, ?)`;
        await db.promise().execute(sql, [idalat, createdAt, duration]);

        // Delete all data from monitoring table for the specified idalat
        const deleteSql = `DELETE FROM monitoring WHERE idalat = ?`;
        const result = await db.promise().execute(deleteSql, [idalat]);

        if (result.affectedRows === 0) {
            console.error('Error deleting data from monitoring table:', 'No rows affected');
            return res.status(500).json({ error: 'Error deleting data from monitoring table', details: 'No rows affected' });
        }

        res.status(201).json({ message: 'History saved successfully' });
    } catch (err) {
        console.error('Error saving history:', err);
        res.status(500).json({ error: 'Error saving history', details: err.message });
    }
});

// Endpoint to fetch history for a specific alat by idalat
// Endpoint to fetch history for a specific alat by idalat
app.get('/history/:idalat', async (req, res) => {
    const { idalat } = req.params;

    try {
        const [rows] = await db.promise().execute(
            `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, 
                    duration 
             FROM history 
             WHERE idalat = ? 
             ORDER BY created_at ASC`,
            [idalat]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No history found for this alat' });
        }

        res.status(200).json({ history: rows });
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ error: 'Error fetching history', details: err.message });
    }
});




// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🖥️`);
});
