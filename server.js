/* global process, Buffer */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration (see .env.example). Secrets come only from the environment.
// ---------------------------------------------------------------------------

// Minimal .env loader so the project needs no extra dependency. Real
// environment variables always win over values in the file.
const loadDotEnv = () => {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m || line.trim().startsWith('#')) continue;
        const value = m[2].replace(/^["']|["']$/g, '');
        if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
};
loadDotEnv();

const OPERATOR_ACCESS_KEY = process.env.OPERATOR_ACCESS_KEY || '';
if (OPERATOR_ACCESS_KEY.length < 12) {
    console.error('Refusing to start: set OPERATOR_ACCESS_KEY (at least 12 characters) in .env. See .env.example.');
    process.exit(1);
}
const OPERATOR_KEY_DIGEST = crypto.createHash('sha256').update(OPERATOR_ACCESS_KEY).digest();

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174')
    .split(',').map(s => s.trim()).filter(Boolean);
const ALLOW_DEMO_RESET = process.env.ALLOW_DEMO_RESET === 'true';
const DATA_FILE = path.resolve(__dirname, process.env.DATA_FILE || 'database.json');

const PRICING_RULES = {
    freeWashesPerSemester: 15,
    extraWashCost: 75,
    dryingCost: 75,
    ironingCostPerCloth: 8
};
const JOB_STATUSES = ['Pending', 'Ready', 'Collected'];
const ALLOWED_TRANSITIONS = { Pending: ['Ready', 'Collected'], Ready: ['Collected'], Collected: [] };
const FEEDBACK_CATEGORIES = ['Wash Quality', 'Drying', 'Ironing Speed', 'Staff Behaviour', 'General Operations', 'General'];
const MAX_BODY_BYTES = 16 * 1024;
const SESSION_TTL_MS = { student: 12 * 60 * 60 * 1000, serviceman: 8 * 60 * 60 * 1000 };

// ---------------------------------------------------------------------------
// Passwords (scrypt, built into Node; no plain-text storage)
// ---------------------------------------------------------------------------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const hashPassword = (password) => new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, SCRYPT, (err, key) => {
        if (err) return reject(err);
        resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`);
    });
});

// A fixed dummy hash so unknown accounts take the same time as known ones.
const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

const verifyPassword = (password, stored) => new Promise((resolve) => {
    const [scheme, saltHex, keyHex] = String(stored || DUMMY_HASH).split('$');
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return resolve(false);
    const expected = Buffer.from(keyHex, 'hex');
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT, (err, key) => {
        if (err) return resolve(false);
        resolve(crypto.timingSafeEqual(key, expected));
    });
});

const checkOperatorKey = (candidate) => {
    const digest = crypto.createHash('sha256').update(String(candidate || '')).digest();
    return crypto.timingSafeEqual(digest, OPERATOR_KEY_DIGEST);
};

// ---------------------------------------------------------------------------
// Storage: one JSON file, all writes serialized and written atomically
// ---------------------------------------------------------------------------

const DEMO_STUDENTS = [
    { name: 'Aarav Sharma', rollNo: '2024CSB001', phone: '+91 98765 43210' },
    { name: 'Ananya Iyer', rollNo: '2024ECA024', phone: '+91 98123 45678' },
    { name: 'Kabir Patel', rollNo: '2023MEB089', phone: '+91 96543 21098' },
    { name: 'Diya Malhotra', rollNo: '2024CHB102', phone: '+91 99112 23344' },
    { name: 'Rohan Das', rollNo: '2023CEB056', phone: '+91 98321 09876' }
];

const newId = (prefix) => `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// Demo data for local use. Each run that creates it prints a fresh random
// password for the fictional demo students; nothing is hard-coded.
const buildDemoData = async () => {
    const demoPassword = crypto.randomBytes(9).toString('base64url');
    const students = [];
    for (const s of DEMO_STUDENTS) {
        students.push({
            id: newId('ST'),
            ...s,
            email: '',
            freeWashesLeft: PRICING_RULES.freeWashesPerSemester,
            passwordHash: await hashPassword(demoPassword)
        });
    }
    console.log(`Demo data created. Demo students log in with their roll number and password: ${demoPassword}`);
    return { students, jobs: [], feedbacks: [] };
};

const readDbFile = async () => {
    try {
        const parsed = JSON.parse(await fs.promises.readFile(DATA_FILE, 'utf8'));
        parsed.students = parsed.students || [];
        parsed.jobs = parsed.jobs || [];
        parsed.feedbacks = parsed.feedbacks || [];
        return parsed;
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        const data = await buildDemoData();
        await writeDbFile(data);
        return data;
    }
};

const writeDbFile = async (data) => {
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.promises.rename(tmp, DATA_FILE);
};

// Every read-modify-write runs inside this queue, so two requests can never
// both read the same quota and both decrement it (no lost updates).
let dbQueue = Promise.resolve();
const withDb = (fn) => {
    const run = dbQueue.then(async () => {
        const data = await readDbFile();
        const result = await fn(data);
        if (result && result.write) await writeDbFile(data);
        return result;
    });
    dbQueue = run.catch(() => {});
    return run;
};

// Never send password hashes to any client.
// eslint-disable-next-line no-unused-vars
const publicStudent = ({ passwordHash, ...rest }) => rest;

// ---------------------------------------------------------------------------
// Sessions (in memory; a server restart signs everyone out)
// ---------------------------------------------------------------------------

const sessions = new Map();

const createSession = (info) => {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { ...info, expiresAt: Date.now() + SESSION_TTL_MS[info.role] });
    return token;
};

const getSession = (req) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    const token = header.slice(7);
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        return null;
    }
    return { token, ...session };
};

setInterval(() => {
    const now = Date.now();
    for (const [token, s] of sessions) if (s.expiresAt < now) sessions.delete(token);
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Rate limits (in memory, single process; see SECURITY.md)
// ---------------------------------------------------------------------------

const buckets = new Map();

// Returns 0 if allowed, otherwise the number of seconds to wait.
const rateLimit = (key, limit, windowMs) => {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return 0;
    }
    b.count += 1;
    return b.count > limit ? Math.ceil((b.resetAt - now) / 1000) : 0;
};

setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, 5 * 60 * 1000).unref();

const MIN = 60 * 1000;
const LIMITS = {
    loginPerIp: [20, 15 * MIN],
    loginPerAccount: [5, 15 * MIN],
    registerPerIp: [5, 60 * MIN],
    feedbackPerStudent: [5, 60 * MIN],
    writesPerOperator: [300, 60 * MIN]
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store'
};

const send = (res, status, body, extraHeaders = {}) => {
    if (res.headersSent) return;
    res.writeHead(status, { 'Content-Type': 'application/json', ...SECURITY_HEADERS, ...extraHeaders });
    res.end(JSON.stringify(body));
};

const tooMany = (res, retryAfter) =>
    send(res, 429, { error: 'Too many attempts. Please wait and try again.' }, { 'Retry-After': String(retryAfter) });

const clientIp = (req) => req.socket.remoteAddress || 'unknown';

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const readJsonBody = (req) => new Promise((resolve, reject) => {
    const type = req.headers['content-type'] || '';
    if (!type.toLowerCase().startsWith('application/json')) {
        reject(new HttpError(415, 'Content-Type must be application/json.'));
        return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            reject(new HttpError(413, 'Request body too large.'));
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => {
        try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                reject(new HttpError(400, 'Request body must be a JSON object.'));
                return;
            }
            resolve(parsed);
        } catch {
            reject(new HttpError(400, 'Malformed JSON.'));
        }
    });
    req.on('error', () => reject(new HttpError(400, 'Request error.')));
});

// --- input validation ---

const str = (value, field, { min = 1, max = 200, pattern } = {}) => {
    if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`);
    const v = value.trim();
    if (v.length < min || v.length > max) throw new HttpError(400, `${field} must be ${min}-${max} characters.`);
    if (pattern && !pattern.test(v)) throw new HttpError(400, `${field} has an invalid format.`);
    return v;
};

const ROLL_PATTERN = /^[A-Z0-9]{4,20}$/;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE_PATTERN = /^\+?[0-9\s-]{10,15}$/;
const NAME_PATTERN = /^[^<>]+$/;

const rollNo = (value) => {
    const v = str(value, 'Roll number', { max: 20 }).toUpperCase();
    if (!ROLL_PATTERN.test(v)) throw new HttpError(400, 'Roll number has an invalid format.');
    return v;
};

const requireRole = (session, role) => {
    if (!session) throw new HttpError(401, 'Please log in.');
    if (session.role !== role) throw new HttpError(403, 'Forbidden.');
};

const audit = (action, details) =>
    console.log(`[audit] ${new Date().toISOString()} ${action} ${JSON.stringify(details)}`);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const routes = {};
const route = (method, pathname, handler) => { routes[`${method} ${pathname}`] = handler; };

route('POST', '/api/register', async (req, res) => {
    const wait = rateLimit(`register:${clientIp(req)}`, ...LIMITS.registerPerIp);
    if (wait) return tooMany(res, wait);

    const body = await readJsonBody(req);
    const name = str(body.name, 'Name', { max: 80, pattern: NAME_PATTERN });
    const roll = rollNo(body.rollNo);
    const email = str(body.email, 'Email', { max: 120, pattern: EMAIL_PATTERN }).toLowerCase();
    const phone = str(body.phone, 'Phone number', { min: 10, max: 15, pattern: PHONE_PATTERN });
    const password = str(body.password, 'Password', { min: 8, max: 128 });
    const passwordHash = await hashPassword(password);

    const student = await withDb(async (data) => {
        if (data.students.some(s => s.rollNo === roll)) {
            throw new HttpError(400, 'This roll number is already registered.');
        }
        const created = {
            id: newId('ST'), name, rollNo: roll, email, phone,
            freeWashesLeft: PRICING_RULES.freeWashesPerSemester, passwordHash
        };
        data.students.push(created);
        return { write: true, created };
    });

    const s = student.created;
    const token = createSession({ role: 'student', studentId: s.id, name: s.name });
    send(res, 200, { token, role: 'student', studentId: s.id, name: s.name });
});

route('POST', '/api/login', async (req, res) => {
    const ipWait = rateLimit(`login-ip:${clientIp(req)}`, ...LIMITS.loginPerIp);
    if (ipWait) return tooMany(res, ipWait);

    const body = await readJsonBody(req);

    if (body.role === 'student') {
        const roll = typeof body.rollNo === 'string' ? body.rollNo.trim().toUpperCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const accountWait = rateLimit(`login-acct:${roll}`, ...LIMITS.loginPerAccount);
        if (accountWait) return tooMany(res, accountWait);

        const data = await withDb(async (d) => d);
        const match = data.students.find(s => s.rollNo === roll);
        const ok = await verifyPassword(password, match?.passwordHash);
        if (!match || !ok) return send(res, 401, { error: 'Roll number or password is incorrect.' });

        const token = createSession({ role: 'student', studentId: match.id, name: match.name });
        return send(res, 200, { token, role: 'student', studentId: match.id, name: match.name });
    }

    if (body.role === 'serviceman') {
        const accountWait = rateLimit('login-acct:operator', ...LIMITS.loginPerAccount);
        if (accountWait) return tooMany(res, accountWait);
        if (!checkOperatorKey(body.accessKey)) {
            audit('operator_login_failed', { ip: clientIp(req) });
            return send(res, 401, { error: 'Access key incorrect.' });
        }
        audit('operator_login', { ip: clientIp(req) });
        const token = createSession({ role: 'serviceman' });
        return send(res, 200, { token, role: 'serviceman' });
    }

    send(res, 400, { error: 'Unknown role.' });
});

route('POST', '/api/logout', async (req, res, session) => {
    if (session) sessions.delete(session.token);
    send(res, 200, { success: true });
});

route('GET', '/api/student/dashboard', async (req, res, session) => {
    requireRole(session, 'student');
    const data = await withDb(async (d) => d);

    const profile = data.students.find(s => s.id === session.studentId);
    if (!profile) {
        sessions.delete(session.token);
        throw new HttpError(401, 'Account no longer exists. Please log in again.');
    }

    const allPending = data.jobs.filter(j => j.status === 'Pending')
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    const jobs = data.jobs.filter(j => j.studentId === session.studentId).map(job =>
        job.status === 'Pending'
            ? { ...job, queuePosition: allPending.findIndex(p => p.id === job.id) + 1 || null }
            : job);

    send(res, 200, {
        student: publicStudent(profile),
        jobs,
        feedbacks: data.feedbacks.filter(f => f.studentId === session.studentId),
        globalQueueSize: allPending.length,
        pricing: PRICING_RULES
    });
});

route('GET', '/api/operator/dashboard', async (req, res, session) => {
    requireRole(session, 'serviceman');
    const data = await withDb(async (d) => d);
    send(res, 200, {
        students: data.students.map(publicStudent),
        jobs: data.jobs,
        feedbacks: data.feedbacks,
        pricing: PRICING_RULES
    });
});

route('POST', '/api/operator/create-task', async (req, res, session) => {
    requireRole(session, 'serviceman');
    const wait = rateLimit(`op-writes:${session.token}`, ...LIMITS.writesPerOperator);
    if (wait) return tooMany(res, wait);

    const body = await readJsonBody(req);
    const roll = rollNo(body.rollNo);
    const services = body.services;
    if (!services || typeof services !== 'object' || Array.isArray(services)) {
        throw new HttpError(400, 'Services must be an object.');
    }
    const wash = services.wash === true;
    const dry = services.dry === true;
    const iron = services.iron === true;
    if (!wash && !dry && !iron) throw new HttpError(400, 'Choose at least one service.');

    const ironCount = iron ? Number(body.ironCount) : 0;
    if (!Number.isInteger(ironCount) || ironCount < 0 || ironCount > 100) {
        throw new HttpError(400, 'Ironing count must be a whole number from 0 to 100.');
    }
    const notes = body.notes == null || body.notes === ''
        ? '' : str(body.notes, 'Notes', { min: 0, max: 500 });

    const result = await withDb(async (data) => {
        const student = data.students.find(s => s.rollNo === roll);
        if (!student) throw new HttpError(404, 'Student roll number not onboarded.');

        let washCost = 0;
        if (wash) {
            if (student.freeWashesLeft > 0) student.freeWashesLeft -= 1;
            else washCost = PRICING_RULES.extraWashCost;
        }
        const dryCost = dry ? PRICING_RULES.dryingCost : 0;
        const ironCost = iron ? ironCount * PRICING_RULES.ironingCostPerCloth : 0;

        const maxToken = data.jobs.reduce((max, j) => {
            const n = parseInt(String(j.tokenNumber || '').split('-')[1], 10);
            return Number.isFinite(n) && n > max ? n : max;
        }, 100);

        const job = {
            id: newId('LND'),
            studentId: student.id,
            studentName: student.name,
            date: new Date().toISOString(),
            services: { wash, dry, iron },
            ironCount,
            status: 'Pending',
            bill: { washCost, dryCost, ironCost, total: washCost + dryCost + ironCost },
            notes: notes || 'Walk-in registration',
            tokenNumber: `TK-${maxToken + 1}`,
            wasProcessed: true
        };
        data.jobs.unshift(job);
        return { write: true, job, students: data.students.map(publicStudent) };
    });

    send(res, 200, { success: true, job: result.job, students: result.students });
});

route('POST', '/api/operator/update-status', async (req, res, session) => {
    requireRole(session, 'serviceman');
    const wait = rateLimit(`op-writes:${session.token}`, ...LIMITS.writesPerOperator);
    if (wait) return tooMany(res, wait);

    const body = await readJsonBody(req);
    const jobId = str(body.jobId, 'Job ID', { max: 40 });
    const newStatus = body.newStatus;
    if (!JOB_STATUSES.includes(newStatus)) throw new HttpError(400, 'Unknown status.');

    const result = await withDb(async (data) => {
        const job = data.jobs.find(j => j.id === jobId);
        if (!job) throw new HttpError(404, 'Task not found.');
        if (!ALLOWED_TRANSITIONS[job.status]?.includes(newStatus)) {
            throw new HttpError(409, `Cannot move a job from ${job.status} to ${newStatus}.`);
        }

        // Older jobs created before quota was charged at creation time.
        if (!job.wasProcessed && job.services.wash) {
            const student = data.students.find(s => s.id === job.studentId);
            if (student && student.freeWashesLeft > 0) student.freeWashesLeft -= 1;
        }
        job.wasProcessed = true;
        job.status = newStatus;
        if (newStatus === 'Ready') job.readyDate = new Date().toISOString();
        if (newStatus === 'Collected') job.collectedDate = new Date().toISOString();

        return { write: true, job, students: data.students.map(publicStudent) };
    });

    send(res, 200, { success: true, job: result.job, students: result.students });
});

route('POST', '/api/operator/reset-quota', async (req, res, session) => {
    requireRole(session, 'serviceman');
    const wait = rateLimit(`op-writes:${session.token}`, ...LIMITS.writesPerOperator);
    if (wait) return tooMany(res, wait);

    const body = await readJsonBody(req);
    const studentId = str(body.studentId, 'Student ID', { max: 40 });

    const students = await withDb(async (data) => {
        const student = data.students.find(s => s.id === studentId);
        if (!student) throw new HttpError(404, 'Student not found.');
        student.freeWashesLeft = PRICING_RULES.freeWashesPerSemester;
        return { write: true, students: data.students.map(publicStudent) };
    });

    audit('quota_reset', { studentId });
    send(res, 200, { success: true, students: students.students });
});

route('POST', '/api/student/feedback', async (req, res, session) => {
    requireRole(session, 'student');
    const wait = rateLimit(`feedback:${session.studentId}`, ...LIMITS.feedbackPerStudent);
    if (wait) return tooMany(res, wait);

    const body = await readJsonBody(req);
    const rating = body.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new HttpError(400, 'Rating must be a whole number from 1 to 5.');
    }
    // Stored as plain text; React escapes it when rendering.
    const comment = str(body.comment, 'Comment', { max: 1000 });
    const category = FEEDBACK_CATEGORIES.includes(body.category) ? body.category : 'General';

    const feedback = await withDb(async (data) => {
        const created = {
            id: newId('FB'),
            studentName: session.name,
            studentId: session.studentId,
            rating, category, comment,
            date: new Date().toISOString()
        };
        data.feedbacks.push(created);
        return { write: true, created };
    });

    send(res, 200, { success: true, feedback: feedback.created });
});

// Wipes all data. Demo-only: disabled unless ALLOW_DEMO_RESET=true, and the
// operator must re-enter the access key (a confirm dialog is not enough).
route('POST', '/api/reset', async (req, res, session) => {
    requireRole(session, 'serviceman');
    if (!ALLOW_DEMO_RESET) throw new HttpError(403, 'Database reset is disabled on this server.');

    const body = await readJsonBody(req);
    if (!checkOperatorKey(body.accessKey)) {
        audit('reset_denied', { ip: clientIp(req) });
        throw new HttpError(403, 'Access key incorrect.');
    }

    const data = await buildDemoData();
    await withDb(async (current) => {
        Object.keys(current).forEach(k => delete current[k]);
        Object.assign(current, data);
        return { write: true };
    });
    sessions.clear();
    audit('database_reset', { ip: clientIp(req) });
    send(res, 200, { success: true, students: data.students.map(publicStudent), jobs: [], feedbacks: [] });
});

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
    // CORS: only the configured portal origins, never a wildcard.
    const origin = req.headers.origin;
    if (origin) {
        if (!ALLOWED_ORIGINS.includes(origin)) return send(res, 403, { error: 'Origin not allowed.' });
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
        res.writeHead(204, SECURITY_HEADERS);
        return res.end();
    }

    let pathname;
    try {
        pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
        return send(res, 400, { error: 'Bad request.' });
    }

    const handler = routes[`${req.method} ${pathname}`];
    if (!handler) return send(res, 404, { error: 'Not Found' });

    try {
        await handler(req, res, getSession(req));
    } catch (err) {
        if (err instanceof HttpError) return send(res, err.status, { error: err.message });
        console.error(`[error] ${req.method} ${pathname}:`, err);
        send(res, 500, { error: 'Something went wrong. Please try again.' });
    }
});

// Load (or create) the data file before accepting requests, so a fresh
// install prints its demo password at startup.
withDb(async (d) => d).then(() => {
    server.listen(PORT, () => {
        console.log(`WashFlow API running at http://localhost:${PORT}`);
        if (ALLOW_DEMO_RESET) console.log('Demo reset is ENABLED (ALLOW_DEMO_RESET=true). Turn it off before real use.');
    });
}).catch((err) => {
    console.error('Could not open the data file:', err);
    process.exit(1);
});
