import React, { useState } from 'react';
import {
    Users,
    Layers,
    TrendingUp,
    DollarSign,
    Clock,
    Calendar,
    Play,
    Check,
    UserPlus,
    RefreshCw,
    Waves,
    Wind,
    Sparkles,
    Search,
    Plus
} from 'lucide-react';

export default function ServicemanDashboard({
    jobs,
    students,
    feedbacks = [],
    onUpdateJobStatus,
    onUpdateStudentWashes
}) {
    const [activeTab, setActiveTab] = useState('active-queue');

    // Search query for students table
    const [searchQuery, setSearchQuery] = useState('');

    // Drop-off/Walk-in form states
    const [walkinRollNoQuery, setWalkinRollNoQuery] = useState('');
    const [walkinServices, setWalkinServices] = useState({ wash: true, dry: false, iron: false });
    const [walkinIronCount, setWalkinIronCount] = useState(0);
    const [walkinNotes, setWalkinNotes] = useState('');

    // Active queue calculations
    const activeJobs = jobs.filter(j => j.status !== 'Collected').sort((a, b) => new Date(a.date) - new Date(b.date));
    const collectedJobs = jobs.filter(j => j.status === 'Collected');

    const matchedStudent = walkinRollNoQuery
        ? students.find(s => s.rollNo.trim().toUpperCase() === walkinRollNoQuery.trim().toUpperCase())
        : null;

    // helper to calculate next logical status based on services requested
    const getNextStatusText = (job) => {
        if (job.status === 'Pending') {
            return { label: 'Mark Completed', nextStatus: 'Ready' };
        }
        if (job.status === 'Ready') {
            return { label: 'Collect & Settle', nextStatus: 'Collected' };
        }
        return null;
    };

    // Analytics Metrics
    const metrics = (() => {
        const totalRevenue = jobs.reduce((sum, j) => sum + j.bill.total, 0);
        const activeRevenue = activeJobs.reduce((sum, j) => sum + j.bill.total, 0);
        const collectedRevenue = collectedJobs.reduce((sum, j) => sum + j.bill.total, 0);

        let totalWashLoads = 0;
        let totalDryLoads = 0;
        let totalIronClothes = 0;

        jobs.forEach(j => {
            if (j.services.wash) totalWashLoads += 1;
            if (j.services.dry) totalDryLoads += 1;
            if (j.services.iron) totalIronClothes += j.ironCount;
        });

        return {
            totalRevenue,
            activeRevenue,
            collectedRevenue,
            totalOrders: jobs.length,
            activeJobsCount: activeJobs.length,
            collectedJobsCount: collectedJobs.length,
            washLoads: totalWashLoads,
            dryLoads: totalDryLoads,
            ironClothes: totalIronClothes
        };
    })();

    const handleWalkinSubmit = async (e) => {
        e.preventDefault();

        const studentObj = students.find(s => s.rollNo.trim().toUpperCase() === walkinRollNoQuery.trim().toUpperCase());
        if (!studentObj) {
            alert("Please enter a valid, onboarded student Roll Number.");
            return;
        }

        if (walkinServices.iron && walkinIronCount <= 0) {
            alert("Please enter a valid clothing count for ironing.");
            return;
        }

        // Trigger state callbacks and await validation/persistence
        const success = await onUpdateJobStatus({
            rollNo: walkinRollNoQuery.trim(),
            services: walkinServices,
            ironCount: walkinServices.iron ? parseInt(walkinIronCount) : 0,
            notes: walkinNotes ? walkinNotes + " (Walk-in)" : "Walk-in registration"
        }, 'CREATE');

        if (success) {
            // Reset inputs only on successful creation
            setWalkinRollNoQuery('');
            setWalkinServices({ wash: true, dry: false, iron: false });
            setWalkinIronCount(0);
            setWalkinNotes('');
            alert("Walk-in order created successfully!");
        }
    };

    // Filter students based on search string
    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div>
            {/* Stat banners */}
            <div className="metrics-grid">
                <div className="glass-panel metric-card">
                    <div className="metric-info">
                        <h3>Active Queue</h3>
                        <div className="metric-value text-primary">{metrics.activeJobsCount} Jobs</div>
                        <p className="subtitle mt-1" style={{ fontSize: '0.75rem' }}>Items currently in-shop</p>
                    </div>
                    <div className="metric-icon-bg">
                        <Layers size={24} />
                    </div>
                </div>

                <div className="glass-panel metric-card">
                    <div className="metric-info">
                        <h3>Completed Pickups</h3>
                        <div className="metric-value text-success">{metrics.collectedJobsCount} Jobs</div>
                        <p className="subtitle mt-1" style={{ fontSize: '0.75rem' }}>Archived & collected</p>
                    </div>
                    <div className="metric-icon-bg" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                        <Check size={24} />
                    </div>
                </div>

                <div className="glass-panel metric-card">
                    <div className="metric-info">
                        <h3>Total Processed</h3>
                        <div className="metric-value text-secondary">{metrics.totalOrders} Tasks</div>
                        <p className="subtitle mt-1" style={{ fontSize: '0.75rem' }}>All-time enqueued tasks</p>
                    </div>
                    <div className="metric-icon-bg" style={{ backgroundColor: 'var(--info-light)', color: 'var(--info)' }}>
                        <RefreshCw size={24} />
                    </div>
                </div>

                <div className="glass-panel metric-card">
                    <div className="metric-info">
                        <h3>Total Registered</h3>
                        <div className="metric-value">{students.length} Students</div>
                        <p className="subtitle mt-1" style={{ fontSize: '0.75rem' }}>Onboarded on system</p>
                    </div>
                    <div className="metric-icon-bg" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'rgb(99, 102, 241)' }}>
                        <Users size={24} />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-container">
                <button
                    className={`tab-btn ${activeTab === 'active-queue' ? 'active' : ''}`}
                    onClick={() => setActiveTab('active-queue')}
                >
                    Active Queue ({activeJobs.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'dropoff' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dropoff')}
                >
                    Create Task
                </button>
                <button
                    className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                    onClick={() => setActiveTab('students')}
                >
                    Student Database
                </button>
                <button
                    className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    Store Analytics
                </button>
                <button
                    className={`tab-btn ${activeTab === 'feedbacks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('feedbacks')}
                >
                    Student Feedbacks ({feedbacks.length})
                </button>
            </div>

            {/* Queue View */}
            {activeTab === 'active-queue' && (
                <div className="glass-panel card">
                    <h3 className="card-title">
                        <Layers size={20} className="text-primary" /> Active Laundry Queue
                    </h3>

                    {activeJobs.length === 0 ? (
                        <div className="text-center" style={{ padding: '3rem 1.5rem' }}>
                            <Clock size={40} className="text-secondary-light mb-2" />
                            <h4 style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Active queue is empty!</h4>
                            <p className="subtitle mt-1">Register a service task under the 'Create Task' tab to begin.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>Token No</th>
                                        <th>Student Info</th>
                                        <th>Services Required</th>
                                        <th>Details / Notes</th>
                                        <th>Bill Amt</th>
                                        <th>Status Phase</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeJobs.map((job) => {
                                        const action = getNextStatusText(job);

                                        return (
                                            <tr key={job.id}>
                                                <td>
                                                    <span className="font-bold text-primary font-mono" style={{ fontSize: '1rem', display: 'block' }}>#{job.tokenNumber || 'NO TOKEN'}</span>
                                                    <span className="font-mono" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        ID: {job.id}
                                                    </span>
                                                    <span className="font-mono" style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                        {formatDate(job.date)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <strong>{job.studentName}</strong>
                                                    <span className="font-mono" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        ID: {job.studentId}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex gap-2">
                                                        {job.services.wash && <span className="badge badge-processing"><Waves size={10} /> Wash</span>}
                                                        {job.services.dry && <span className="badge badge-processing"><Wind size={10} /> Dry</span>}
                                                        {job.services.iron && <span className="badge badge-processing"><Sparkles size={10} /> Iron ({job.ironCount})</span>}
                                                    </div>
                                                </td>
                                                <td style={{ maxWidth: '200px', fontSize: '0.85rem' }}>
                                                    <span className="text-secondary">{job.notes || <em className="text-muted">None Provided</em>}</span>
                                                </td>
                                                <td className="font-bold font-mono">₹{job.bill.total}</td>
                                                <td>
                                                    <span className={`badge ${job.status === 'Pending' ? 'badge-pending' :
                                                        job.status === 'Ready' ? 'badge-ready' : 'badge-processing'
                                                        }`}>
                                                        {job.status}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {action ? (
                                                        <button
                                                            className={`btn ${job.status === 'Ready' ? 'btn-primary' : 'btn-outline'}`}
                                                            style={{
                                                                padding: '0.35rem 0.75rem',
                                                                fontSize: '0.8rem',
                                                                borderRadius: 'var(--radius-sm)'
                                                            }}
                                                            onClick={() => onUpdateJobStatus(job.id, action.nextStatus)}
                                                        >
                                                            {job.status === 'Ready' ? <Check size={14} /> : <Play size={10} />}
                                                            {action.label}
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>None</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Create Task Panel */}
            {activeTab === 'dropoff' && (
                <div className="dashboard-grid equal">
                    <div className="glass-panel card">
                        <h3 className="card-title">
                            <Plus size={20} className="text-primary" /> Create Service Task
                        </h3>

                        <form onSubmit={handleWalkinSubmit}>
                            <div className="form-group mb-3">
                                <label className="form-label" htmlFor="walkin-student">
                                    Select Student Client (Search by Roll Number):
                                </label>
                                <input
                                    type="text"
                                    id="walkin-student"
                                    className="form-control"
                                    placeholder="Enter Roll Number (e.g. 2024CSB001)"
                                    value={walkinRollNoQuery}
                                    onChange={(e) => setWalkinRollNoQuery(e.target.value)}
                                    required
                                />
                                <div className="mt-2" style={{ fontSize: '0.85rem' }}>
                                    {!walkinRollNoQuery ? (
                                        <span className="text-secondary">Enter a registered student's Roll Number.</span>
                                    ) : matchedStudent ? (
                                        <span className="text-success" style={{ fontWeight: 600 }}>
                                            ✓ Student Found: {matchedStudent.name} (Quota: {matchedStudent.freeWashesLeft} / 15 free left)
                                        </span>
                                    ) : (
                                        <span className="text-danger" style={{ fontWeight: 600 }}>
                                            ⚠️ No student found with this Roll Number. Include them in the Database tab first.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Service Selectors for Serviceman */}
                            <div className="form-group mb-3">
                                <label className="form-label">Services:</label>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                    <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={walkinServices.wash}
                                            onChange={() => setWalkinServices({ ...walkinServices, wash: !walkinServices.wash })}
                                        />
                                        Washing load
                                    </label>
                                    <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={walkinServices.dry}
                                            onChange={() => setWalkinServices({ ...walkinServices, dry: !walkinServices.dry })}
                                        />
                                        Drying load
                                    </label>
                                    <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={walkinServices.iron}
                                            onChange={() => {
                                                const nextIron = !walkinServices.iron;
                                                setWalkinServices({ ...walkinServices, iron: nextIron });
                                                if (!nextIron) setWalkinIronCount(0);
                                            }}
                                        />
                                        Ironing
                                    </label>
                                </div>
                            </div>

                            {/* Clothes quantity if Ironing is active */}
                            {walkinServices.iron && (
                                <div className="form-group mb-3">
                                    <label className="form-label" htmlFor="walkin-iron-count">
                                        Number of clothes for Ironing:
                                    </label>
                                    <input
                                        type="number"
                                        id="walkin-iron-count"
                                        className="form-control"
                                        min="1"
                                        value={walkinIronCount || ''}
                                        onChange={(e) => setWalkinIronCount(Math.max(0, parseInt(e.target.value) || 0))}
                                        required
                                    />
                                </div>
                            )}

                            <div className="form-group mb-3">
                                <label className="form-label" htmlFor="walkin-notes">
                                    Additional Operator Notes:
                                </label>
                                <input
                                    type="text"
                                    id="walkin-notes"
                                    className="form-control"
                                    placeholder="e.g. Rack B-3, special instructions..."
                                    value={walkinNotes}
                                    onChange={(e) => setWalkinNotes(e.target.value)}
                                />
                            </div>

                            {/* upfront payment check */}
                            <div className="form-group mb-4">
                                <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    <input
                                        type="checkbox"
                                        checked={true}
                                        disabled
                                    />
                                    <span className="text-success">Confirm Payment Settled Upfront ✓</span>
                                </label>
                                <p className="text-secondary mt-1" style={{ fontSize: '0.75rem' }}>
                                    All operator-created tasks are initialized, paid, and enqueued directly to 'Pending'.
                                </p>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                Create Task & Enqueue
                            </button>
                        </form>
                    </div>

                    {/* Pricing helper block */}
                    <div className="glass-panel card">
                        <h3 className="card-title">
                            <DollarSign size={20} className="text-primary" /> Task Cost Breakdown
                        </h3>

                        {matchedStudent ? (
                            (() => {
                                const washP = walkinServices.wash ? (matchedStudent.freeWashesLeft > 0 ? 0 : 75) : 0;
                                const dryP = walkinServices.dry ? 75 : 0;
                                const ironP = walkinServices.iron ? (walkinIronCount * 8) : 0;
                                const sumTotal = washP + dryP + ironP;

                                return (
                                    <div>
                                        <p className="mb-4" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            Calculating pricing schema for <strong>{matchedStudent.name}</strong> ({matchedStudent.rollNo}).
                                        </p>
                                        <ul style={{ listStyleType: 'none', margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <li className="flex justify-between" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                                                <span>Washing charge:</span>
                                                <strong className={washP === 0 ? "text-success" : ""}>{walkinServices.wash ? (washP === 0 ? "Free (Quota)" : "₹75") : "—"}</strong>
                                            </li>
                                            <li className="flex justify-between" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                                                <span>Drying charge:</span>
                                                <strong>{walkinServices.dry ? "₹75" : "—"}</strong>
                                            </li>
                                            <li className="flex justify-between" style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                                                <span>Ironing charge:</span>
                                                <strong>{walkinServices.iron ? `₹${ironP} (${walkinIronCount} pcs)` : "—"}</strong>
                                            </li>
                                            <li className="flex justify-between text-primary-dark font-extrabold" style={{ fontSize: '1.15rem' }}>
                                                <span>Total Due (Paid):</span>
                                                <span>₹{sumTotal}</span>
                                            </li>
                                        </ul>
                                        <div style={{ background: 'var(--primary-light)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                                            <span className="font-bold text-primary-dark" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Student Quota Info</span>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                                                Currently has {matchedStudent.freeWashesLeft} semester free washes left on file.
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="text-center" style={{ padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
                                <Users size={32} className="mb-2" />
                                <p>Search and match a registered student by Roll Number to display custom billing breakdown.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Student Database Panel */}
            {activeTab === 'students' && (
                <div>
                    {/* Student database table */}
                    <div className="glass-panel card">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                            <h3 className="card-title" style={{ margin: 0 }}>
                                <Users size={20} className="text-primary" /> Onboarded Students
                            </h3>

                            {/* Search box */}
                            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
                                <Search
                                    size={16}
                                    className="text-secondary-light"
                                    style={{ position: 'absolute', left: '10px', top: '10px' }}
                                />
                                <input
                                    type="text"
                                    className="form-control"
                                    style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }}
                                    placeholder="Search by name or roll number..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="table-wrapper">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>Student ID</th>
                                        <th>Name</th>
                                        <th>Roll Number</th>
                                        <th>Phone</th>
                                        <th>Free Washes Left</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((s) => (
                                        <tr key={s.id}>
                                            <td className="font-bold text-secondary">{s.id}</td>
                                            <td><strong>{s.name}</strong></td>
                                            <td>{s.rollNo}</td>
                                            <td>{s.phone}</td>
                                            <td>
                                                <span className={`badge ${s.freeWashesLeft > 4 ? 'badge-ready' : s.freeWashesLeft > 0 ? 'badge-pending' : 'badge-collected'}`}>
                                                    {s.freeWashesLeft} / 15 left
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
                                                    onClick={() => {
                                                        if (window.confirm(`Reset free wash counter for ${s.name} to 15?`)) {
                                                            onUpdateStudentWashes(s.id, 15);
                                                        }
                                                    }}
                                                >
                                                    <RefreshCw size={10} /> Reset Quota
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Store Analytics Panel */}
            {activeTab === 'analytics' && (
                <div className="glass-panel card">
                    <h3 className="card-title">
                        <TrendingUp size={20} className="text-primary" /> Store Operations Analytics
                    </h3>

                    <div className="dashboard-grid equal">
                        <div className="glass-panel" style={{ padding: '1rem', background: 'var(--card-bg)' }}>
                            <h4 className="font-bold text-primary-dark mb-4">Service Volume processed</h4>
                            <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <li>
                                    <div className="flex justify-between mb-1" style={{ fontSize: '0.85rem' }}>
                                        <span className="flex items-center gap-2"><Waves size={16} className="text-primary" /> Washing loads:</span>
                                        <strong>{metrics.washLoads} loads</strong>
                                    </div>
                                    <div className="progress-bar-container">
                                        <div className="progress-fill" style={{ width: `${Math.min(100, (metrics.washLoads / Math.max(1, metrics.totalOrders)) * 100)}%` }} />
                                    </div>
                                </li>
                                <li>
                                    <div className="flex justify-between mb-1" style={{ fontSize: '0.85rem' }}>
                                        <span className="flex items-center gap-2"><Wind size={16} className="text-info" /> Drying loads:</span>
                                        <strong>{metrics.dryLoads} loads</strong>
                                    </div>
                                    <div className="progress-bar-container">
                                        <div className="progress-fill" style={{ width: `${Math.min(100, (metrics.dryLoads / Math.max(1, metrics.totalOrders)) * 100)}%`, backgroundColor: 'var(--info)' }} />
                                    </div>
                                </li>
                                <li>
                                    <div className="flex justify-between mb-1" style={{ fontSize: '0.85rem' }}>
                                        <span className="flex items-center gap-2"><Sparkles size={16} className="text-warning" /> Ironing items:</span>
                                        <strong>{metrics.ironClothes} pieces</strong>
                                    </div>
                                    <div className="progress-bar-container">
                                        <div className="progress-fill" style={{ width: `${Math.min(100, (metrics.ironClothes / Math.max(1, metrics.totalOrders * 5)) * 100)}%`, backgroundColor: 'var(--warning)' }} />
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Collected Revenue card inside Analytics tab */}
                            <div className="glass-panel metric-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                                <div className="metric-info">
                                    <h3>Collected Revenue</h3>
                                    <div className="metric-value text-success" style={{ fontSize: '1.8rem' }}>₹{metrics.totalRevenue}</div>
                                    <p className="subtitle mt-1" style={{ fontSize: '0.75rem' }}>Upfront settled payments</p>
                                </div>
                                <div className="metric-icon-bg" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', borderRadius: 'var(--radius-sm)' }}>
                                    <DollarSign size={24} />
                                </div>
                            </div>

                            <div className="glass-panel" style={{ padding: '1rem', background: 'var(--primary-light)', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                                <h5 className="font-bold text-primary-dark mb-1" style={{ fontSize: '0.9rem' }}>Queue Turnover Rate</h5>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                    Out of {metrics.totalOrders} total jobs created, {metrics.collectedJobsCount} are archived (Collected) and {metrics.activeJobsCount} are currently loading in the workshop queue.
                                </p>
                            </div>

                            <div className="glass-panel" style={{ padding: '1rem', background: 'var(--card-bg)' }}>
                                <h5 className="font-bold text-secondary mb-2" style={{ fontSize: '0.85rem' }}>Billing Summary</h5>
                                <div className="flex justify-between" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <span>Active Tasks Value:</span>
                                    <span className="font-bold text-primary">₹{metrics.activeRevenue}</span>
                                </div>
                                <div className="flex justify-between" style={{ fontSize: '0.85rem' }}>
                                    <span>Collected Tasks Value:</span>
                                    <span className="font-bold text-success">₹{metrics.collectedRevenue}</span>
                                </div>
                                <div className="flex justify-between font-bold" style={{ fontSize: '0.9rem', marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                                    <span>Total Collected Revenue:</span>
                                    <span>₹{metrics.totalRevenue}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feedbacks Viewer Tab */}
            {activeTab === 'feedbacks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Header metrics card */}
                    <div className="glass-panel card flex justify-between items-center gap-4 flex-col md:flex-row" style={{ padding: '1.25rem 1.5rem' }}>
                        <div>
                            <h3 className="card-title" style={{ margin: 0 }}>
                                <Users size={20} className="text-primary" /> Student Reviews & Feedback
                            </h3>
                            <p className="subtitle mt-1" style={{ fontSize: '0.8rem' }}>
                                Total received: <strong>{feedbacks.length}</strong> review{feedbacks.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {feedbacks.length > 0 && (
                            <div className="flex items-center gap-3" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                                <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                    {(feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)}
                                </span>
                                <div>
                                    <div style={{ display: 'flex', gap: '2px', color: '#f59e0b', fontSize: '0.9rem' }}>
                                        {Array.from({ length: 5 }).map((_, i) => {
                                            const avg = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
                                            return i < Math.round(avg) ? <span key={i}>★</span> : <span key={i} style={{ color: 'var(--text-muted)' }}>★</span>;
                                        })}
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 550, textTransform: 'uppercase' }}>Average Rating</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {feedbacks.length === 0 ? (
                        <div className="glass-panel card text-center" style={{ padding: '4rem 1.5rem', color: 'var(--text-muted)' }}>
                            <Users size={32} className="mb-2" />
                            <p>No student feedback has been submitted yet.</p>
                        </div>
                    ) : (
                        <div className="glass-panel card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[...feedbacks].sort((a, b) => new Date(b.date) - new Date(a.date)).map((fb) => (
                                    <div
                                        key={fb.id || fb.date}
                                        style={{
                                            padding: '1rem 1.25rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--card-bg)'
                                        }}
                                    >
                                        <div className="flex justify-between items-start gap-2 flex-col sm:flex-row pb-2 mb-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                            <div>
                                                <strong style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>{fb.studentName}</strong>
                                                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#f59e0b' }}>
                                                    {Array.from({ length: 5 }).map((_, idx) => (
                                                        <span key={idx}>{idx < fb.rating ? '★' : '☆'}</span>
                                                    ))}
                                                </span>
                                                <span className="badge badge-pending" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                                                    {fb.category}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {formatDate(fb.date)}
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-color)', lineHeight: '1.4', fontStyle: 'italic' }}>
                                            "{fb.comment || 'No added comment.'}"
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
