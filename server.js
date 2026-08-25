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
    } else if (origin) {
        // Reject request from unauthorized origins
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CORS Origin Blocked' }));
        return;
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
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
        let destroyed = false;
        req.on('data', chunk => {
            if (destroyed) return;
            body += chunk.toString();
            if (body.length > 256000) { // Limit chunks to 256KB
                destroyed = true;
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body exceeds size quota.' }));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (destroyed) return;
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

            // Strict regex patterns
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^\+?[0-9\s-]{10,15}$/;

            if (!emailRegex.test(email)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid email address format.' }));
                return;
            }
            if (!phoneRegex.test(phone)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid phone number format.' }));
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
                    name: name.trim().replace(/[<>]/g, ''),
                    rollNo: normalizedRoll,
                    email: email.trim().replace(/[<>]/g, ''),
                    phone: phone.trim().replace(/[<>]/g, ''),
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

    // Route: POST /api/operator/create-task (Server-driven task registration & quota decrement)
    if (parsedUrl.pathname === '/api/operator/create-task' && req.method === 'POST') {
        if (!activeSession || activeSession.role !== 'serviceman') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden. Admin credentials required.' }));
            return;
        }

        parseJsonBody(req, res, (err, payload) => {
            const { rollNo, services, ironCount, notes } = payload;
            if (err || !rollNo || !services) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Roll number and services object are required.' }));
                return;
            }

            const cleanNotes = notes ? String(notes).trim().replace(/[<>]/g, '').substring(0, 500) : '';
            const countForIroning = Math.max(0, parseInt(ironCount) || 0);

            readDb((dbErr, data) => {
                if (dbErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Database access failure.' }));
                    return;
                }

                const nRoll = rollNo.trim().toUpperCase();
                const studentIndex = data.students.findIndex(s => s.rollNo.trim().toUpperCase() === nRoll);
                if (studentIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Student roll number not onboarded.' }));
                    return;
                }

                const student = data.students[studentIndex];

                // Calculate costs securely on backend
                let washCost = 0;
                let dryCost = 0;
                let ironCost = 0;

                if (services.wash) {
                    if (student.freeWashesLeft > 0) {
                        data.students[studentIndex].freeWashesLeft -= 1;
                        washCost = 0;
                    } else {
                        washCost = 75;
                    }
                }
                if (services.dry) {
                    dryCost = 75;
                }
                if (services.iron) {
                    ironCost = countForIroning * 8;
                }

                const jobId = 'LND' + Math.floor(1000 + Math.random() * 9000);

                // Find next token number sequential
                let maxTokenNum = 100;
                (data.jobs || []).forEach(j => {
                    if (j.tokenNumber && j.tokenNumber.startsWith('TK-')) {
                        const num = parseInt(j.tokenNumber.split('-')[1]);
                        if (!isNaN(num) && num > maxTokenNum) {
                            maxTokenNum = num;
                        }
                    }
                });
                const tokenNumber = `TK-${maxTokenNum + 1}`;

                const newJob = {
                    id: jobId,
                    studentId: student.id,
                    studentName: student.name,
                    date: new Date().toISOString(),
                    services: {
                        wash: !!services.wash,
                        dry: !!services.dry,
                        iron: !!services.iron
                    },
                    ironCount: countForIroning,
                    status: 'Pending',
                    bill: {
                        washCost,
                        dryCost,
                        ironCost,
                        total: washCost + dryCost + ironCost
                    },
                    notes: cleanNotes || 'Walk-in registration',
                    tokenNumber,
                    wasProcessed: true
                };

                if (!data.jobs) data.jobs = [];
                data.jobs.unshift(newJob);

                writeDb(data, (writeErr) => {
                    if (writeErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Database write failure.' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, job: newJob, students: data.students }));
                    }
                });
            });
        });
        return;
    }

    // Route: POST /api/operator/update-status (Server-controlled phase transitions)
    if (parsedUrl.pathname === '/api/operator/update-status' && req.method === 'POST') {
        if (!activeSession || activeSession.role !== 'serviceman') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden. Admin credentials required.' }));
            return;
        }

        parseJsonBody(req, res, (err, payload) => {
            const { jobId, newStatus } = payload;
            if (err || !jobId || !newStatus) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Job ID and new status are required.' }));
                return;
            }

            readDb((dbErr, data) => {
                if (dbErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Database access failure.' }));
                    return;
                }

                const jobIndex = (data.jobs || []).findIndex(j => j.id === jobId);
                if (jobIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Task not found.' }));
                    return;
                }

                const job = data.jobs[jobIndex];
                let wasProcessed = job.wasProcessed;
                let readyDate = job.readyDate;
                let collectedDate = job.collectedDate;

                // Validate state transitions
                if (newStatus !== 'Pending' && newStatus !== 'Collected' && !wasProcessed) {
                    if (job.services.wash) {
                        const studentIndex = data.students.findIndex(s => s.id === job.studentId);
                        if (studentIndex !== -1) {
                            const currentFree = data.students[studentIndex].freeWashesLeft;
                            if (currentFree > 0) {
                                data.students[studentIndex].freeWashesLeft -= 1;
                            }
                        }
                    }
                    wasProcessed = true;
                }

                if (newStatus === 'Ready') {
                    readyDate = new Date().toISOString();
                }

                if (newStatus === 'Collected') {
                    collectedDate = new Date().toISOString();
                    if (!wasProcessed) {
                        if (job.services.wash) {
                            const studentIndex = data.students.findIndex(s => s.id === job.studentId);
                            if (studentIndex !== -1) {
                                const currentFree = data.students[studentIndex].freeWashesLeft;
                                if (currentFree > 0) {
                                    data.students[studentIndex].freeWashesLeft -= 1;
                                }
                            }
                        }
                        wasProcessed = true;
                    }
                }

                data.jobs[jobIndex] = {
                    ...job,
                    status: newStatus,
                    wasProcessed,
                    readyDate,
                    collectedDate
                };

                writeDb(data, (writeErr) => {
                    if (writeErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Database write failure.' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, job: data.jobs[jobIndex], students: data.students }));
                    }
                });
            });
        });
        return;
    }

    // Route: POST /api/operator/reset-quota (Reset student wash quota)
    if (parsedUrl.pathname === '/api/operator/reset-quota' && req.method === 'POST') {
        if (!activeSession || activeSession.role !== 'serviceman') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden. Admin credentials required.' }));
            return;
        }

        parseJsonBody(req, res, (err, payload) => {
            const { studentId } = payload;
            if (err || !studentId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Student ID is required.' }));
                return;
            }

            readDb((dbErr, data) => {
                if (dbErr) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Database access failure.' }));
                    return;
                }

                const sIndex = data.students.findIndex(s => s.id === studentId);
                if (sIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Student not found.' }));
                    return;
                }

                data.students[sIndex].freeWashesLeft = 15;

                writeDb(data, (writeErr) => {
                    if (writeErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Database write failure.' }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, students: data.students }));
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
