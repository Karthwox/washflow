import React, { useState, useEffect } from 'react';
import { Shirt, Waves, Sun, Moon, RotateCcw } from 'lucide-react';
import { DEFAULT_STUDENTS, DEFAULT_JOBS } from './data/mockData';
import StudentDashboard from './components/StudentDashboard';
import ServicemanDashboard from './components/ServicemanDashboard';

export default function App() {
  const [students, setStudents] = useState(DEFAULT_STUDENTS);
  const [jobs, setJobs] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [globalQueueSize, setGlobalQueueSize] = useState(0);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('laundry_theme') || 'light';
  });

  const BACKEND_URL = 'http://localhost:3000';

  // Dynamic locked role based on window.location.port
  const getLockedRole = () => {
    const port = window.location.port;
    if (port === '5174') {
      return 'serviceman';
    }
    return 'student'; // default to student pathway
  };

  const portalRole = getLockedRole();

  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('laundry_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.role === portalRole) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });

  useEffect(() => {
    if (session) {
      localStorage.setItem('laundry_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('laundry_session');
    }
  }, [session]);

  // Load and poll data from the Node API server
  useEffect(() => {
    if (!session || !session.token) {
      return;
    }

    const fetchLatest = async () => {
      try {
        const headers = {
          'Authorization': `Bearer ${session.token}`
        };

        if (session.role === 'student') {
          const res = await fetch(`${BACKEND_URL}/api/student/dashboard`, { headers });
          if (res.ok) {
            const data = await res.json();
            setStudents((prev) => {
              const arr = [data.student];
              const nextStr = JSON.stringify(arr);
              if (JSON.stringify(prev) !== nextStr) {
                return arr;
              }
              return prev;
            });
            setJobs((prev) => {
              const nextStr = JSON.stringify(data.jobs);
              if (JSON.stringify(prev) !== nextStr) {
                return data.jobs;
              }
              return prev;
            });
            if (data.feedbacks) {
              setFeedbacks((prev) => {
                const nextStr = JSON.stringify(data.feedbacks);
                if (JSON.stringify(prev) !== nextStr) {
                  return data.feedbacks;
                }
                return prev;
              });
            }
            if (typeof data.globalQueueSize === 'number') {
              setGlobalQueueSize(data.globalQueueSize);
            }
          }
        } else if (session.role === 'serviceman') {
          const res = await fetch(`${BACKEND_URL}/api/operator/dashboard`, { headers });
          if (res.ok) {
            const data = await res.json();
            setStudents((prev) => {
              const nextStr = JSON.stringify(data.students);
              if (JSON.stringify(prev) !== nextStr) {
                return data.students;
              }
              return prev;
            });
            setJobs((prev) => {
              const nextStr = JSON.stringify(data.jobs);
              if (JSON.stringify(prev) !== nextStr) {
                return data.jobs;
              }
              return prev;
            });
            if (data.feedbacks) {
              setFeedbacks((prev) => {
                const nextStr = JSON.stringify(data.feedbacks);
                if (JSON.stringify(prev) !== nextStr) {
                  return data.feedbacks;
                }
                return prev;
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to load data from backend server:', e);
      }
    };

    fetchLatest(); // initial fetch

    const interval = setInterval(fetchLatest, 2000); // poll every 2s
    return () => clearInterval(interval);
  }, [session]);

  const saveToBackend = async (nextStudents, nextJobs) => {
    if (!session || !session.token) return;
    try {
      await fetch(`${BACKEND_URL}/api/operator/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({ students: nextStudents, jobs: nextJobs })
      });
    } catch (e) {
      console.error('Failed to sync changes to backend API:', e);
    }
  };

  const handleSubmitFeedback = async (feedbackData) => {
    if (!session || !session.token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/student/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify(feedbackData)
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbacks((prev) => [data.feedback, ...prev]);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Feedback submission rejected.');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('laundry_theme', theme);
  }, [theme]);


  // Handler for inserting new client requests
  const handleNewJob = (newJob) => {
    const nextJobs = [newJob, ...jobs];
    setJobs(nextJobs);
    saveToBackend(students, nextJobs);
  };

  // Handler for advancing job status
  const handleUpdateJobStatus = (jobIdOrItem, newStatus) => {
    let nextJobs = [...jobs];
    let nextStudents = [...students];

    // If we are inserting a new job from the serviceman walkin panel:
    if (newStatus === 'CREATE' && typeof jobIdOrItem === 'object') {
      const walkinJob = { ...jobIdOrItem };

      // Generate sequential Token Number matching 'TK-XXX' format
      let maxTokenNum = 100;
      jobs.forEach(j => {
        if (j.tokenNumber && j.tokenNumber.startsWith('TK-')) {
          const num = parseInt(j.tokenNumber.split('-')[1]);
          if (!isNaN(num) && num > maxTokenNum) {
            maxTokenNum = num;
          }
        }
      });
      walkinJob.tokenNumber = `TK-${maxTokenNum + 1}`;

      // Since all operator tasks are paid upfront, set wasProcessed = true
      walkinJob.wasProcessed = true;

      // Deduct washes if walkin requests washing and student has quota
      if (walkinJob.services.wash) {
        const studentIndex = nextStudents.findIndex(s => s.id === walkinJob.studentId);
        if (studentIndex !== -1) {
          const currentFree = nextStudents[studentIndex].freeWashesLeft;
          if (currentFree > 0) {
            nextStudents[studentIndex] = {
              ...nextStudents[studentIndex],
              freeWashesLeft: currentFree - 1
            };
          }
        }
      }

      nextJobs = [walkinJob, ...jobs];
      setJobs(nextJobs);
      setStudents(nextStudents);
      saveToBackend(nextStudents, nextJobs);
      return;
    }

    const jobId = jobIdOrItem;

    nextJobs = jobs.map((job) => {
      if (job.id !== jobId) return job;

      let wasProcessed = job.wasProcessed;
      let readyDate = job.readyDate;
      let collectedDate = job.collectedDate;

      // If status is shifting from Pending to a processing phase:
      // deduct remaining washes if wash is featured in the list and hasn't been charged
      if (newStatus !== 'Pending' && newStatus !== 'Collected' && !wasProcessed) {
        if (job.services.wash) {
          const studentIndex = nextStudents.findIndex(s => s.id === job.studentId);
          if (studentIndex !== -1) {
            const currentFree = nextStudents[studentIndex].freeWashesLeft;
            if (currentFree > 0) {
              nextStudents[studentIndex] = {
                ...nextStudents[studentIndex],
                freeWashesLeft: currentFree - 1
              };
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
        // Safety fallback: if job is collected but somehow never flagged as processed/quotas deducted
        if (!wasProcessed) {
          if (job.services.wash) {
            const studentIndex = nextStudents.findIndex(s => s.id === job.studentId);
            if (studentIndex !== -1) {
              const currentFree = nextStudents[studentIndex].freeWashesLeft;
              if (currentFree > 0) {
                nextStudents[studentIndex] = {
                  ...nextStudents[studentIndex],
                  freeWashesLeft: currentFree - 1
                };
              }
            }
          }
          wasProcessed = true;
        }
      }

      return {
        ...job,
        status: newStatus,
        wasProcessed,
        readyDate,
        collectedDate
      };
    });

    setJobs(nextJobs);
    setStudents(nextStudents);
    saveToBackend(nextStudents, nextJobs);
  };

  const handleUpdateStudentWashes = (studentId, count) => {
    const nextStudents = students.map(s => s.id === studentId ? { ...s, freeWashesLeft: count } : s);
    setStudents(nextStudents);
    saveToBackend(nextStudents, jobs);
  };

  // Screen rendered if user session is not active
  const LoginScreen = () => {
    const [rollNo, setRollNo] = useState('');
    const [accessKey, setAccessKey] = useState('');
    const [loginError, setLoginError] = useState('');

    // Registration States
    const [isRegistering, setIsRegistering] = useState(false);
    const [regName, setRegName] = useState('');
    const [regRoll, setRegRoll] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPhone, setRegPhone] = useState('');

    const handleStudentLogin = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${BACKEND_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'student', rollNo })
        });
        if (res.ok) {
          const data = await res.json();
          const targetSession = { role: 'student', studentId: data.studentId, token: data.token };
          setSession(targetSession);
          localStorage.setItem('laundry_session', JSON.stringify(targetSession));
          setLoginError('');
        } else {
          const errData = await res.json();
          setLoginError(`⚠️ ${errData.error || 'Login failed.'}`);
        }
      } catch (err) {
        console.error(err);
        setLoginError('⚠️ Server connection error.');
      }
    };

    const handleStudentRegister = async (e) => {
      e.preventDefault();
      if (!regName.trim() || !regRoll.trim() || !regEmail.trim() || !regPhone.trim()) {
        setLoginError('⚠️ All fields are required to register.');
        return;
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: regName.trim(),
            rollNo: regRoll.trim(),
            email: regEmail.trim(),
            phone: regPhone.trim()
          })
        });
        if (res.ok) {
          const data = await res.json();
          const targetSession = { role: 'student', studentId: data.studentId, token: data.token };
          setSession(targetSession);
          localStorage.setItem('laundry_session', JSON.stringify(targetSession));
          setLoginError('');
        } else {
          const errData = await res.json();
          setLoginError(`⚠️ ${errData.error || 'Registration failed.'}`);
        }
      } catch (err) {
        console.error(err);
        setLoginError('⚠️ Server connection error.');
      }
    };

    const handleServicemanLogin = async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${BACKEND_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'serviceman', accessKey })
        });
        if (res.ok) {
          const data = await res.json();
          const targetSession = { role: 'serviceman', token: data.token };
          setSession(targetSession);
          localStorage.setItem('laundry_session', JSON.stringify(targetSession));
          setLoginError('');
        } else {
          const errData = await res.json();
          setLoginError(`⚠️ ${errData.error || 'Access denied.'}`);
        }
      } catch (err) {
        console.error(err);
        setLoginError('⚠️ Server connection error.');
      }
    };

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          padding: '2rem 1rem'
        }}
      >
        <div
          className="glass-panel card"
          style={{
            maxWidth: '420px',
            width: '100%',
            padding: '2.5rem 2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <img src="/iiitb_logo.png" alt="IIIT-B Logo" style={{ height: '48px', objectFit: 'contain', backgroundColor: 'white', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>WashFlow</span>
            </div>
            {portalRole === 'serviceman' ? (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Operator Staff Login</h2>
                <p className="subtitle mt-1" style={{ fontSize: '0.85rem' }}>Enter system passkey to access laundry queue admin panel.</p>
              </>
            ) : isRegistering ? (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Student Registration</h2>
                <p className="subtitle mt-1" style={{ fontSize: '0.85rem' }}>Create your WashFlow student account to access laundry services.</p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Student Portal Login</h2>
                <p className="subtitle mt-1" style={{ fontSize: '0.85rem' }}>Enter your IIIT-B Roll Number to check your quota, bills, and logs.</p>
              </>
            )}
          </div>

          <form onSubmit={
            portalRole === 'serviceman'
              ? handleServicemanLogin
              : isRegistering
                ? handleStudentRegister
                : handleStudentLogin
          }>
            {portalRole === 'serviceman' ? (
              <div className="form-group mb-3">
                <label className="form-label" htmlFor="access-key-input">Operator Access Key:</label>
                <input
                  type="password"
                  id="access-key-input"
                  className="form-control"
                  placeholder="Enter Operator Access Key (use 'admin')"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  required
                />
              </div>
            ) : isRegistering ? (
              <>
                <div className="form-group mb-3">
                  <label className="form-label" htmlFor="register-name-input">Full Name:</label>
                  <input
                    type="text"
                    id="register-name-input"
                    className="form-control"
                    placeholder="e.g. John Doe"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label" htmlFor="register-roll-input">Roll Number:</label>
                  <input
                    type="text"
                    id="register-roll-input"
                    className="form-control"
                    style={{ textTransform: 'uppercase' }}
                    placeholder="e.g. 2026CSB009"
                    value={regRoll}
                    onChange={(e) => setRegRoll(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label" htmlFor="register-email-input">IIIT-B Email ID:</label>
                  <input
                    type="email"
                    id="register-email-input"
                    className="form-control"
                    placeholder="e.g. john.doe@iiitb.ac.in"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group mb-3">
                  <label className="form-label" htmlFor="register-phone-input">Phone Number:</label>
                  <input
                    type="text"
                    id="register-phone-input"
                    className="form-control"
                    placeholder="e.g. +91 98765 43210"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="form-group mb-3">
                <label className="form-label" htmlFor="roll-number-input">College Roll Number:</label>
                <input
                  type="text"
                  id="roll-number-input"
                  className="form-control"
                  style={{ textTransform: 'uppercase' }}
                  placeholder="e.g. 2024CSB001"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  required
                />
              </div>
            )}

            {loginError && (
              <div className="mb-3 animate-fade-in" style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                {loginError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontWeight: 600 }}>
              {portalRole === 'serviceman' ? 'Log In' : isRegistering ? 'Register' : 'Log In'}
            </button>

            {portalRole !== 'serviceman' && (
              <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem' }}>
                {isRegistering ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsRegistering(false);
                        setLoginError('');
                      }}
                      style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Log In
                    </a>
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Don't have an account?{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsRegistering(true);
                        setLoginError('');
                      }}
                      style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Register here
                    </a>
                  </span>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    );
  };

  // Derive active view details
  const isServiceman = session?.role === 'serviceman';
  const activeStudentId = session?.role === 'student' ? session.studentId : null;
  const activeStudent = students.find((s) => s.id === activeStudentId);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header className="navbar">
        <div className="nav-container">
          {/* Logo Brand */}
          <a href="#" className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img src="/iiitb_logo.png" alt="IIIT-B Logo" style={{ height: '36px', objectFit: 'contain', backgroundColor: 'white', padding: '2px', borderRadius: '4px' }} />
            <span>WashFlow</span>
          </a>

          {/* Controls Container */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Reset Database Button */}
            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to reset all jobs and database records to a clean slate?")) {
                  try {
                    const headers = {};
                    if (session && session.token) {
                      headers['Authorization'] = `Bearer ${session.token}`;
                    }
                    const res = await fetch(`${BACKEND_URL}/api/reset`, { method: 'POST', headers });
                    if (res.ok) {
                      const data = await res.json();
                      setJobs(data.jobs);
                      setStudents(data.students);
                      setSession(null);
                      localStorage.removeItem('laundry_session');
                      alert("Database reset successfully!");
                    } else {
                      alert("Permission denied or database reset failed.");
                    }
                  } catch (e) {
                    console.error(e);
                    alert("Failure to reset database server.");
                  }
                }
              }}
              className="btn btn-secondary"
              style={{
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '38px',
                minWidth: '38px',
                color: 'var(--text-danger, #ef4444)'
              }}
              title="Reset Database to Clean State"
              id="reset-db-btn"
            >
              <RotateCcw size={18} />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="btn btn-secondary"
              style={{
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '38px',
                minWidth: '38px'
              }}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              id="theme-toggle-btn"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* User Session Info / Logout */}
            {session && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>
                  {session.role === 'serviceman' ? (
                    "Staff: Operator (Admin)"
                  ) : (
                    (() => {
                      const activeSObj = students.find(s => s.id === session.studentId);
                      return activeSObj ? `${activeSObj.name} (${activeSObj.rollNo})` : 'Student';
                    })()
                  )}
                </span>
                <button
                  onClick={() => setSession(null)}
                  className="btn btn-outline"
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    minHeight: '34px',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#f8fafc'
                  }}
                  id="logout-button"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Primary Dashboards */}
      <main className="container" style={{ flex: 1 }}>
        {!session ? (
          <LoginScreen />
        ) : isServiceman ? (
          <ServicemanDashboard
            jobs={jobs}
            students={students}
            feedbacks={feedbacks}
            onUpdateJobStatus={handleUpdateJobStatus}
            onUpdateStudentWashes={handleUpdateStudentWashes}
          />
        ) : activeStudent ? (
          <StudentDashboard
            activeStudent={activeStudent}
            jobs={jobs}
            feedbacks={feedbacks}
            globalQueueSize={globalQueueSize}
            onSubmitFeedback={handleSubmitFeedback}
            onNewJob={handleNewJob}
          />
        ) : (
          <div className="glass-panel card text-center" style={{ padding: '3rem 1rem' }}>
            <h2>Student profile not found</h2>
            <p className="subtitle mt-2">Please contact the operator to onboard your account.</p>
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '1.25rem',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        background: 'rgba(255,255,255,0.6)'
      }}>
        WashFlow college laundry tracking module. Designed for service providers and students.
      </footer>
    </div>
  );
}
