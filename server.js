import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'database.json');

const DEFAULT_DATA = {
    students: [
        { id: "ST001", name: "Aarav Sharma", rollNo: "2024CSB001", phone: "+91 98765 43210", freeWashesLeft: 15 },
        { id: "ST002", name: "Ananya Iyer", rollNo: "2024ECA024", phone: "+91 98123 45678", freeWashesLeft: 15 },
        { id: "ST003", name: "Kabir Patel", rollNo: "2023MEB089", phone: "+91 96543 21098", freeWashesLeft: 15 },
        { id: "ST004", name: "Diya Malhotra", rollNo: "2024CHB102", phone: "+91 99112 23344", freeWashesLeft: 15 },
        { id: "ST005", name: "Rohan Das", rollNo: "2023CEB056", phone: "+91 98321 09876", freeWashesLeft: 15 }
    ],
    jobs: [],
    feedbacks: []
};

const PRICING_RULES = {
    freeWashesPerSemester: 15,
    extraWashCost: 75,
    dryingCost: 75,
    ironingCostPerCloth: 8
};

// In-memory active session token store: token -> { role, studentId, name }
const sessions = new Map();

// Helper to write database
const writeDb = (data, cb) => {
    fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8', cb);
};

// Helper to read database
const readDb = (cb) => {
    fs.readFile(DATA_FILE, 'utf8', (err, content) => {
        if (err) {
            writeDb(DEFAULT_DATA, (writeErr) => {
                if (writeErr) cb(writeErr, null);
                else cb(null, DEFAULT_DATA);
            });
        } else {
            try {
                const parsed = JSON.parse(content);
                // Guarantee feedbacks array key exists
                if (!parsed.feedbacks) parsed.feedbacks = [];
                cb(null, parsed);
            } catch (e) {
                cb(e, null);
            }
        }
    });
};

const server = http.createServer((req, res) => {
    // Safe whitelisted CORS origins check
    const origin = req.headers.origin;
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse authorization headers Bearer tokens
    const authHeader = req.headers.authorization || '';
    let activeSession = null;
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        activeSession = sessions.get(token);
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    // Helper to read POST body safely with limits to prevent buffer exhaustion DoS
    const parseJsonBody = (req, res, callback) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 256000) { // Limit chunks to 256KB
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body exceeds size quota.' }));
                req.destroy();
            }
        });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                callback(null, parsed);
            } catch (e) {
                callback(e, null);
            }
        });
    };

    // Route: POST /api/register
    if (parsedUrl.pathname === '/api/register' && req.method === 'POST') {
        parseJsonBody(req, res, (err, payload) => {
            const { name, rollNo, email, phone } = payload;
            if (err || !name || !rollNo || !email || !phone) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'All fields (name, rollNo, email, phone) are required.' }));
                return;
            }

            readDb((dbErr, data) => {
                if (dbErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to access database.' }));
                    return;
                }

                const normalizedRoll = rollNo.trim().toUpperCase();
                const exists = data.students.some(s => s.rollNo.trim().toUpperCase() === normalizedRoll);
                if (exists) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Roll number already registered.' }));
                    return;
                }

                const newStudent = {
                    id: 'ST' + Math.floor(1000 + Math.random() * 9000),
                    name: name.trim(),
                    rollNo: normalizedRoll,
                    email: email.trim(),
                    phone: phone.trim(),
                    freeWashesLeft: 15
                };

                data.students.push(newStudent);

                writeDb(data, (writeErr) => {
                    if (writeErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to write to database.' }));
                    } else {
                        const token = 'ST-' + crypto.randomBytes(16).toString('hex');
                        sessions.set(token, { role: 'student', studentId: newStudent.id, name: newStudent.name });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ token, role: 'student', studentId: newStudent.id, name: newStudent.name }));
                    }
                });
            });
        });
        return;
    }

    // Route: POST /api/login
    if (parsedUrl.pathname === '/api/login' && req.method === 'POST') {
        parseJsonBody(req, res, (err, payload) => {
            if (err || !payload.role) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid login configuration.' }));
                return;
            }

            readDb((dbErr, data) => {
                if (dbErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to access database.' }));
                    return;
                }

                if (payload.role === 'student') {
                    const studentInput = (payload.rollNo || '').trim().toUpperCase();
                    const match = data.students.find(s => s.rollNo.trim().toUpperCase() === studentInput);
                    if (match) {
                        const token = 'ST-' + crypto.randomBytes(16).toString('hex');
                        sessions.set(token, { role: 'student', studentId: match.id, name: match.name });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ token, role: 'student', studentId: match.id, name: match.name }));
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Roll number not found.' }));
                    }
                } else if (payload.role === 'serviceman') {
                    const pass = payload.accessKey || '';
                    if (pass === 'admin') {
                        const token = 'OP-' + crypto.randomBytes(16).toString('hex');
                        sessions.set(token, { role: 'serviceman' });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ token, role: 'serviceman' }));
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Access key incorrect.' }));
                    }
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unknown role.' }));
                }
            });
        });
        return;
    }

    // Route: GET /api/student/dashboard (Scoped data access)
    if (parsedUrl.pathname === '/api/student/dashboard' && req.method === 'GET') {
        if (!activeSession || activeSession.role !== 'student') {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized student access.' }));
            return;
        }

        readDb((dbErr, data) => {
            if (dbErr) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database read failure.' }));
                return;
            }

            const studentProfile = data.students.find(s => s.id === activeSession.studentId);

            // All pending jobs sorted chronologically (FIFO queue)
            const allPendingJobs = (data.jobs || [])
                .filter(j => j.status === 'Pending')
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            const studentJobs = (data.jobs || []).filter(j => j.studentId === activeSession.studentId);

            // Map over student jobs to inject queuePosition for Pending jobs
            const studentJobsWithQueue = studentJobs.map(job => {
                if (job.status === 'Pending') {
                    const pos = allPendingJobs.findIndex(pj => pj.id === job.id);
                    return {
                        ...job,
                        queuePosition: pos !== -1 ? pos + 1 : null
                    };
                }
                return job;
            });

            const studentFeedbacks = (data.feedbacks || []).filter(f => f.studentId === activeSession.studentId);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                student: studentProfile || { id: activeSession.studentId, name: activeSession.name, freeWashesLeft: 0 },
                jobs: studentJobsWithQueue,
                feedbacks: studentFeedbacks,
                globalQueueSize: allPendingJobs.length,
                pricing: PRICING_RULES
            }));
        });
        return;
    }

    // Route: GET /api/operator/dashboard (Full access required)
    if (parsedUrl.pathname === '/api/operator/dashboard' && req.method === 'GET') {
        if (!activeSession || activeSession.role !== 'serviceman') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden. Admin credentials required.' }));
            return;
        }

        readDb((dbErr, data) => {
            if (dbErr) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database read failure.' }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    students: data.students,
                    jobs: data.jobs,
                    feedbacks: data.feedbacks || [],
                    pricing: PRICING_RULES
                }));
            }
        });
        return;
    }

    // Route: POST /api/operator/action (Mutations signed by admin sessions)
    if (parsedUrl.pathname === '/api/operator/action' && req.method === 'POST') {
        if (!activeSession || activeSession.role !== 'serviceman') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden. Admin credentials required.' }));
            return;
        }

        parseJsonBody(req, res, (err, payload) => {
            if (err || !payload.students || !payload.jobs) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid payload schemas.' }));
                return;
            }

            readDb((dbErr, existingData) => {
                if (dbErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Database Access Failure.' }));
                    return;
                }

                // Retain original feedbacks array
                const updatedData = {
                    students: payload.students,
                    jobs: payload.jobs,
                    feedbacks: existingData.feedbacks || []
                };

                writeDb(updatedData, (writeErr) => {
                    if (writeErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Database write failure.' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                });
            });
        });
        return;
    }

    // Route: POST /api/student/feedback (Submit feedback safely)
    if (parsedUrl.pathname === '/api/student/feedback' && req.method === 'POST') {
        if (!activeSession || activeSession.role !== 'student') {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized student access.' }));
            return;
        }

        parseJsonBody(req, res, (err, payload) => {
            // Validate schema input to prevent prototype injections or parameter corruption
            if (err || typeof payload.rating !== 'number' || !payload.comment) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Rating and comment fields required.' }));
                return;
            }

            // Sanitize inputs of script elements
            const cleanComment = String(payload.comment)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const cleanCategory = String(payload.category || 'General')
                .replace(/[<>]/g, '');

            readDb((dbErr, data) => {
                if (dbErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Database query error.' }));
                    return;
                }

                const newFeedback = {
                    id: 'FB' + Math.floor(1000 + Math.random() * 9000),
                    studentName: activeSession.name,
                    studentId: activeSession.studentId,
                    rating: Math.min(5, Math.max(1, payload.rating)),
                    category: cleanCategory,
                    comment: cleanComment,
                    date: new Date().toISOString()
                };

                if (!data.feedbacks) data.feedbacks = [];
                data.feedbacks.push(newFeedback);

                writeDb(data, (writeErr) => {
                    if (writeErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to record feedback.' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, feedback: newFeedback }));
                    }
                });
            });
        });
        return;
    }

    // Route: POST /api/reset (Hard wipe limits)
    if (parsedUrl.pathname === '/api/reset' && req.method === 'POST') {
        if (!activeSession || activeSession.role !== 'serviceman') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden. Admin credentials required.' }));
            return;
        }

        writeDb(DEFAULT_DATA, (err) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to reset database.' }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...DEFAULT_DATA }));
            }
        });
        return;
    }

    // Fallback: 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`WashFlow DB API running at http://localhost:${PORT}`);
});
