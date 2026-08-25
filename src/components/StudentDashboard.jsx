import React, { useState } from 'react';
import {
    Waves,
    Wind,
    Sparkles,
    Clock,
    FileText,
    CheckCircle,
    TrendingUp,
    Calendar,
    DollarSign,
    Info,
    ArrowRight,
    Star,
    MessageSquare,
    Check
} from 'lucide-react';


export default function StudentDashboard({ activeStudent, jobs, feedbacks, globalQueueSize = 0, onSubmitFeedback }) {
    const [activeTab, setActiveTab] = useState('track');
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    // Feedback States
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackCategory, setFeedbackCategory] = useState('Wash Quality');
    const [feedbackComment, setFeedbackComment] = useState('');
    const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);

    // Use feedbacks list passed down as a prop
    const myFeedbackList = feedbacks || [];

    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        try {
            await onSubmitFeedback({
                rating: feedbackRating,
                category: feedbackCategory,
                comment: feedbackComment
            });
            setFeedbackRating(5);
            setFeedbackCategory('Wash Quality');
            setFeedbackComment('');
            setIsFeedbackSubmitted(true);
            setTimeout(() => setIsFeedbackSubmitted(false), 5000);
        } catch (err) {
            console.error('Error submitting feedback:', err);
            alert('Failed to submit feedback. Check server connection.');
        }
    };

    // Pricing constants
    const EXTRA_WASH_PRICE = 75;
    const DRY_PRICE = 75;
    const IRON_PRICE = 8;

    // Filter jobs for this specific student
    const studentJobs = jobs.filter(j => j.studentId === activeStudent.id);
    const activeJobs = studentJobs.filter(j => j.status !== 'Collected');
    const pastJobs = studentJobs.filter(j => j.status === 'Collected');

    // Helper to render active jobs timeline status
    const getTimelineSteps = (job) => {
        return [
            { id: 'pending', label: 'Received & Enqueued' },
            { id: 'ready', label: 'Ready for Pickup' }
        ];
    };

    const getCurrentStepIndex = (job, steps) => {
        if (job.status === 'Pending') return 0;
        return 1; // Since there are no intermediate states, any state beyond Pending is Ready
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div>
            {/* Student Profile summary banner */}
            <div className="glass-panel card mb-4 flex justify-between items-center gap-4 flex-col lg:flex-row">
                <div>
                    <h2 className="page-title">Welcome back, {activeStudent.name}!</h2>
                    <p className="subtitle mt-1">Roll No: {activeStudent.rollNo} • Phone: {activeStudent.phone}</p>
                </div>

                {/* Remaining washes progress widget */}
                <div className="flex flex-col gap-2 items-end" style={{ minWidth: '280px' }}>
                    <div className="flex justify-between w-100 mb-2">
                        <span className="font-semibold text-secondary" style={{ fontSize: '0.85rem' }}>Semester Balance Washes</span>
                        <span className="font-bold text-primary" style={{ fontSize: '0.85rem' }}>{activeStudent.freeWashesLeft} / 15 Free</span>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className="progress-fill"
                            style={{ width: `${(activeStudent.freeWashesLeft / 15) * 100}%` }}
                        />
                    </div>
                    <span className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        {activeStudent.freeWashesLeft > 0
                            ? `${activeStudent.freeWashesLeft} free washes left. Then ₹75 per wash.`
                            : 'Free washes exhausted. Subsequent washes cost ₹75/load.'
                        }
                    </span>
                </div>
            </div>

            {/* Live Queue Status Banner */}
            <div className="glass-panel card mb-4" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid var(--primary-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: globalQueueSize <= 3 ? '#10b981' : globalQueueSize <= 7 ? '#f59e0b' : '#ef4444'
                    }} />
                    <div>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-color)' }}>Live Laundry Load: </strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{globalQueueSize} active load{globalQueueSize !== 1 ? 's' : ''} currently enqueued in-shop</span>
                    </div>
                </div>
                <span className={`badge ${globalQueueSize <= 3 ? 'badge-ready' : globalQueueSize <= 7 ? 'badge-pending' : 'badge-collected'}`} style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                    {globalQueueSize === 0 ? 'Empty Queue' : globalQueueSize <= 3 ? 'Quiet' : globalQueueSize <= 7 ? 'Moderate' : 'Busy'}
                </span>
            </div>

            {/* Tabs */}
            <div className="tab-container">
                <button
                    className={`tab-btn ${activeTab === 'track' ? 'active' : ''}`}
                    onClick={() => setActiveTab('track')}
                >
                    Track Active ({activeJobs.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    Task History ({studentJobs.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pricing')}
                >
                    Rates & Info
                </button>
                <button
                    className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
                    onClick={() => setActiveTab('feedback')}
                >
                    Feedback
                </button>
            </div>

            {/* Tab Panels */}
            {activeTab === 'track' && (
                <div className="glass-panel card">
                    <h3 className="card-title">
                        <Clock size={20} className="text-primary" /> Active Laundry Tracking
                    </h3>

                    {activeJobs.length === 0 ? (
                        <div className="text-center" style={{ padding: '3rem 1.5rem' }}>
                            <Waves size={40} className="text-secondary-light mb-2 animate-pulse" />
                            <h4 style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No Active Laundry in Queue</h4>
                            <p className="subtitle mt-1">Bring your dirty clothes to the basement laundry room. The serviceman will create a laundry token for you.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {activeJobs.map((job) => {
                                const steps = getTimelineSteps(job);
                                const currentStepIdx = getCurrentStepIndex(job, steps);

                                return (
                                    <div
                                        key={job.id}
                                        className="glass-panel"
                                        style={{
                                            padding: '1.5rem',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: 'var(--card-bg)'
                                        }}
                                    >
                                        {/* Job Card Header */}
                                        <div className="flex justify-between items-start gap-2 flex-col md:flex-row pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-primary font-mono" style={{ fontSize: '1.1rem' }}>Token: {job.tokenNumber}</h4>
                                                    <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({job.id})</span>
                                                    <span className={`badge ${job.status === 'Pending' ? 'badge-pending' :
                                                        job.status === 'Ready' ? 'badge-ready' : 'badge-processing'
                                                        }`}>
                                                        {job.status}
                                                    </span>
                                                    {job.status === 'Pending' && job.queuePosition && (
                                                        <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'rgb(99, 102, 241)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                                            Queue Position: #{job.queuePosition} of {globalQueueSize}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-secondary mt-1" style={{ fontSize: '0.8rem' }}>
                                                    Created: <span className="font-mono">{formatDate(job.date)}</span>
                                                </p>
                                            </div>

                                            <div className="text-right flex flex-col items-start md:items-end">
                                                <span className="font-bold text-text-primary font-mono" style={{ fontSize: '1.1rem' }}>₹{job.bill.total}</span>
                                                <p className="text-secondary mt-1" style={{ fontSize: '0.75rem' }}>
                                                    Paid: <span className="text-success font-semibold">✓ Yes</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Progress Info Indicator */}
                                        <div className="mb-4">
                                            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                Services Included: <strong>
                                                    {[
                                                        job.services.wash && "Washing",
                                                        job.services.dry && "Drying",
                                                        job.services.iron && `Ironing (${job.ironCount} clothes)`
                                                    ].filter(Boolean).join(" + ")}
                                                </strong>
                                            </p>
                                            {job.notes && (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                    Operator Notes: <em>"{job.notes}"</em>
                                                </p>
                                            )}
                                        </div>

                                        {/* Timeline stepper */}
                                        <div className="timeline-stepper">
                                            <div className="timeline-progress-bar">
                                                <div
                                                    className="timeline-progress-fill"
                                                    style={{ width: `${(currentStepIdx / (steps.length - 1)) * 100}%` }}
                                                />
                                            </div>
                                            {steps.map((step, idx) => {
                                                const isCompleted = idx < currentStepIdx;
                                                const isActive = idx === currentStepIdx;

                                                return (
                                                    <div
                                                        key={step.id}
                                                        className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                                                    >
                                                        <div className="step-node">
                                                            {isCompleted ? '✓' : idx + 1}
                                                        </div>
                                                        <span className="step-label">{step.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {job.status === 'Ready' && (
                                            <div
                                                className="mt-4 text-center toast"
                                                style={{
                                                    background: 'var(--success-light)',
                                                    padding: '0.75rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                                }}
                                            >
                                                <p className="font-bold text-success" style={{ fontSize: '0.85rem' }}>
                                                    ✨ Your laundry is processed and ready! Please go to the basement laundry room to retrieve your clean clothes.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="glass-panel card">
                    <h3 className="card-title">
                        <FileText size={20} className="text-primary" /> Comprehensive Task History
                    </h3>

                    {studentJobs.length === 0 ? (
                        <div className="text-center" style={{ padding: '3rem 1.5rem' }}>
                            <FileText size={40} className="text-secondary-light mb-2" />
                            <h4 style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No tasks on file</h4>
                            <p className="subtitle mt-1">Once the laundry shop creates a task for you, the logs and receipts will be visible here.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>Token No</th>
                                        <th>Task ID</th>
                                        <th>Date Created</th>
                                        <th>Services Requested</th>
                                        <th>Total Bill</th>
                                        <th>Current Status</th>
                                        <th>Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentJobs.map((job) => (
                                        <tr key={job.id}>
                                            <td className="font-bold text-primary">#{job.tokenNumber}</td>
                                            <td className="font-semibold text-secondary" style={{ fontSize: '0.85rem' }}>{job.id}</td>
                                            <td style={{ fontSize: '0.8rem' }}>{formatDate(job.date)}</td>
                                            <td style={{ fontSize: '0.85rem' }}>
                                                {[
                                                    job.services.wash && "Wash",
                                                    job.services.dry && "Dry",
                                                    job.services.iron && `Iron (${job.ironCount})`
                                                ].filter(Boolean).join(" + ")}
                                            </td>
                                            <td className="font-bold">₹{job.bill.total}</td>
                                            <td>
                                                <span className={`badge ${job.status === 'Pending' ? 'badge-pending' :
                                                    job.status === 'Ready' ? 'badge-ready' :
                                                        job.status === 'Collected' ? 'badge-collected' : 'badge-processing'
                                                    }`}>
                                                    {job.status}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
                                                    onClick={() => setSelectedReceipt(job)}
                                                >
                                                    View Receipt
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Receipt Modal */}
                    {selectedReceipt && (
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(15, 23, 42, 0.4)',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 100,
                                padding: '1rem'
                            }}
                            onClick={() => setSelectedReceipt(null)}
                        >
                            <div
                                className="glass-panel card receipt-card"
                                style={{
                                    background: 'var(--card-bg)',
                                    maxWidth: '380px',
                                    width: '100%',
                                    border: '1px solid var(--border-color)',
                                    maxHeight: '90vh',
                                    overflowY: 'auto'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                    <img src="/iiitb_logo.png" alt="IIIT-B Logo" style={{ height: '40px', display: 'block', margin: '0 auto 0.5rem auto', objectFit: 'contain' }} />
                                    <h3 className="font-extrabold text-primary-dark" style={{ fontSize: '1.25rem' }}>CAMPUS LAUNDRY</h3>
                                    <p className="text-secondary" style={{ fontSize: '0.75rem' }}>College Services Center</p>
                                    <p className="text-primary font-bold mt-1" style={{ fontSize: '1rem' }}>TOKEN: #{selectedReceipt.tokenNumber}</p>
                                    <p className="text-secondary" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>INVOICE #{selectedReceipt.id}</p>
                                </div>

                                <div className="mb-4" style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                                    <p><strong>Student Name:</strong> {selectedReceipt.studentName}</p>
                                    <p><strong>Roll number:</strong> {activeStudent.rollNo}</p>
                                    <p><strong>Date Filed:</strong> {formatDate(selectedReceipt.date)}</p>
                                    {selectedReceipt.collectedDate && <p><strong>Date Collected:</strong> {formatDate(selectedReceipt.collectedDate)}</p>}
                                    <p><strong>Order Status:</strong> <span className="font-bold text-primary">{selectedReceipt.status}</span></p>
                                </div>

                                <div style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                    <p className="font-bold text-secondary mb-2" style={{ fontSize: '0.75rem', uppercase: 'true' }}>Service Breakdown</p>
                                    {selectedReceipt.services.wash && (
                                        <div className="flex justify-between" style={{ fontSize: '0.8rem', margin: '0.25rem 0' }}>
                                            <span>Washing Load (1 Load)</span>
                                            <span className="font-bold">₹{selectedReceipt.bill.washCost}</span>
                                        </div>
                                    )}
                                    {selectedReceipt.services.dry && (
                                        <div className="flex justify-between" style={{ fontSize: '0.8rem', margin: '0.25rem 0' }}>
                                            <span>Drying Load (1 Load)</span>
                                            <span className="font-bold">₹{selectedReceipt.bill.dryCost}</span>
                                        </div>
                                    )}
                                    {selectedReceipt.services.iron && (
                                        <div className="flex justify-between" style={{ fontSize: '0.8rem', margin: '0.25rem 0' }}>
                                            <span>Ironing ({selectedReceipt.ironCount} clothes)</span>
                                            <span className="font-bold">₹{selectedReceipt.bill.ironCost}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mb-6">
                                    <span className="font-bold text-text-primary">GRAND TOTAL (PAID):</span>
                                    <span className="font-extrabold text-xl text-primary-dark">₹{selectedReceipt.bill.total}</span>
                                </div>

                                <div className="text-center" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <p>Thank you for using Campus Laundry services!</p>
                                    <p className="mt-1">Operational desk open: 9am - 7pm</p>
                                </div>

                                <button
                                    className="btn btn-secondary mt-6"
                                    style={{ width: '100%', padding: '0.5rem' }}
                                    onClick={() => setSelectedReceipt(null)}
                                >
                                    Close Receipt
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'pricing' && (
                <div className="glass-panel card">
                    <h3 className="card-title">
                        <Info size={20} className="text-primary" /> Semester Laundry Rules & Rates
                    </h3>

                    <div className="dashboard-grid equal">
                        <div className="glass-panel" style={{ padding: '1rem', background: 'var(--card-bg)' }}>
                            <h4 className="font-bold text-primary-dark mb-2">Service Pricing Table</h4>
                            <div className="table-wrapper">
                                <table className="custom-table">
                                    <thead>
                                        <tr>
                                            <th>Service Name</th>
                                            <th>Charges (INR)</th>
                                            <th>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="font-bold">Washing</td>
                                            <td>₹75 / load</td>
                                            <td>First 15 loads are FREE per Student per Semester.</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold">Drying</td>
                                            <td>₹75 / load</td>
                                            <td>Charged per load. No free drying quota.</td>
                                        </tr>
                                        <tr>
                                            <td className="font-bold">Ironing</td>
                                            <td>₹8 / cloth</td>
                                            <td>Charged per garment submitted.</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 justify-center">
                            <div className="glass-panel" style={{ padding: '1rem', background: 'var(--primary-light)', border: '1px solid rgba(37, 99, 235, 0.15)' }}>
                                <h5 className="font-bold text-primary-dark mb-2">How Does Quota Counting Work?</h5>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    Every Student gets <strong>15 Free Washes</strong> allocated.
                                    When you bring your dirty load to the basement laundry Room, the Serviceman will log a task.
                                    If your free wash quota is &gt; 0, the washing service component is charged at **₹0**.
                                    Once laundry is processed, the remaining wash quota is decremented from your balance.
                                    All additional washes cost ₹75/load.
                                </p>
                            </div>
                            <div className="glass-panel" style={{ padding: '1rem', background: 'var(--card-bg)' }}>
                                <h5 className="font-bold text-secondary mb-1" style={{ fontSize: '0.85rem' }}>Clean Clothes Delivery</h5>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                    Once your token status becomes **Ready**, you will be notified on this screen. Go to the basement laundry room counter and quote your token number to retrieve your laundry.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'feedback' && (
                <div className="glass-panel card">
                    <h3 className="card-title">
                        <MessageSquare size={20} className="text-primary" /> Share Your Feedback
                    </h3>

                    {isFeedbackSubmitted && (
                        <div
                            className="mb-4 toast"
                            style={{
                                background: 'var(--success-light)',
                                padding: '0.75rem 1rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Check size={16} className="text-success" />
                            <span className="font-semibold text-success" style={{ fontSize: '0.85rem' }}>
                                Thank you! Your feedback has been submitted successfully.
                            </span>
                        </div>
                    )}

                    <div className="dashboard-grid equal">
                        <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--card-bg)' }}>
                            <h4 className="font-bold text-primary mb-3" style={{ fontSize: '1rem' }}>Submit Feedback Form</h4>
                            <form onSubmit={handleFeedbackSubmit}>
                                {/* Star Rating Selection */}
                                <div className="form-group mb-3">
                                    <label className="form-label mb-1" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rating:</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        {[1, 2, 3, 4, 5].map((starValue) => {
                                            const isActive = starValue <= feedbackRating;
                                            return (
                                                <button
                                                    key={starValue}
                                                    type="button"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        padding: 0,
                                                        color: isActive ? '#f59e0b' : 'var(--text-muted)'
                                                    }}
                                                    onClick={() => setFeedbackRating(starValue)}
                                                >
                                                    <Star size={24} fill={isActive ? '#f59e0b' : 'none'} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Category Selection */}
                                <div className="form-group mb-3">
                                    <label className="form-label" htmlFor="feedback-category">Service Category:</label>
                                    <select
                                        id="feedback-category"
                                        className="form-control"
                                        value={feedbackCategory}
                                        onChange={(e) => setFeedbackCategory(e.target.value)}
                                        required
                                    >
                                        <option value="Wash Quality">Wash Quality</option>
                                        <option value="Drying">Drying</option>
                                        <option value="Ironing Speed">Ironing Speed</option>
                                        <option value="Staff Behaviour">Staff Behaviour</option>
                                        <option value="General Operations">General Operations</option>
                                    </select>
                                </div>

                                {/* Comments Text Area */}
                                <div className="form-group mb-4">
                                    <label className="form-label" htmlFor="feedback-comments">Comments / Suggestions:</label>
                                    <textarea
                                        id="feedback-comments"
                                        className="form-control"
                                        rows="4"
                                        placeholder="Please write your observations or suggestions here..."
                                        value={feedbackComment}
                                        onChange={(e) => setFeedbackComment(e.target.value)}
                                        style={{ resize: 'none', padding: '0.5rem' }}
                                        required
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                    Submit Feedback
                                </button>
                            </form>
                        </div>

                        {/* Submitted Feedbacks Ledger */}
                        <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <h4 className="font-bold text-secondary mb-3" style={{ fontSize: '1rem' }}>Your Submission History</h4>
                            {myFeedbackList.length === 0 ? (
                                <div className="text-center flex-1 flex flex-col justify-center items-center" style={{ color: 'var(--text-muted)', minHeight: '200px' }}>
                                    <MessageSquare size={32} className="mb-2 opacity-50" />
                                    <p style={{ fontSize: '0.85rem' }}>No feedback submitted yet during this session.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '350px', paddingRight: '0.25rem' }}>
                                    {myFeedbackList.map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                padding: '1rem',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'var(--bg-color)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="badge badge-processing" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.category}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(item.date)}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '2px', color: '#f59e0b' }}>
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <Star key={s} size={14} fill={s <= item.rating ? '#f59e0b' : 'none'} />
                                                ))}
                                            </div>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                                                "{item.comment}"
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
