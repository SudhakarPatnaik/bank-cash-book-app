import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export default function ExcelViewer() {
    const [bankStats, setBankStats] = useState(null);
    const [cashStats, setCashStats] = useState(null);
    const [petpoojaStats, setPetpoojaStats] = useState(null);
    const [incomeCashStats, setIncomeCashStats] = useState(null);
    const [activeTab, setActiveTab] = useState("profitloss");
    const [fileUploaded, setFileUploaded] = useState(false);
    const [expenseDiscrepancy, setExpenseDiscrepancy] = useState(null);
    const [discrepancyRows, setDiscrepancyRows] = useState([]);
    const [activeNav, setActiveNav] = useState("profitloss"); // NEW: for left nav
    const [showNav, setShowNav] = useState(false); // For mobile nav drawer
    const [darkMode, setDarkMode] = useState(false);
    const [forceMobile, setForceMobile] = useState(false); // NEW: force mobile view
    const [forceDesktop, setForceDesktop] = useState(false); // NEW: force desktop view

    // Helper to determine if mobile view should be used
    const isMobile = forceMobile || (!forceDesktop && window.innerWidth <= 700);

    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        // Add global styles
        const style = document.createElement('style');
        style.textContent = `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            @keyframes fadeSlideUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes pulseGlow {
                0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
                100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
            }

            @keyframes shimmer {
                0% { background-position: -1000px 0; }
                100% { background-position: 1000px 0; }
            }

            .card {
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                            box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .card:hover {
                transform: translateY(-2px);
            }

            .nav-btn {
                position: relative;
                overflow: hidden;
            }

            .nav-btn::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%);
                transform: translate(-50%, -50%) scale(0);
                transition: transform 0.5s;
            }

            .nav-btn:hover::after {
                transform: translate(-50%, -50%) scale(2);
            }

            table {
                --border-radius: 12px;
                border-radius: var(--border-radius);
                overflow: hidden;
            }

            table th:first-child {
                border-top-left-radius: var(--border-radius);
            }

            table th:last-child {
                border-top-right-radius: var(--border-radius);
            }

            tbody tr:last-child td:first-child {
                border-bottom-left-radius: var(--border-radius);
            }

            tbody tr:last-child td:last-child {
                border-bottom-right-radius: var(--border-radius);
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(link);
            document.head.removeChild(style);
        };
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            // --- Bank Book Calculation ---
            const bankSheet = workbook.Sheets["Bank Statement"];
            const bankJson = XLSX.utils.sheet_to_json(bankSheet, { defval: "" });
            const totalDeposits = bankJson.reduce((sum, row) => sum + (parseFloat(row["Deposit Amt."]) || 0), 0);
            const totalWithdrawals = bankJson.reduce((sum, row) => sum + (parseFloat(row["Withdrawal Amt."]) || 0), 0);
            const profitLoss = totalDeposits - totalWithdrawals;
            setBankStats({ totalDeposits, totalWithdrawals, profitLoss });

            // --- Cash Book Calculation ---
            const orderSheet = workbook.Sheets["Order Listing"];
            const orders = XLSX.utils.sheet_to_json(orderSheet, { defval: "" });
            const cashOrdersTotal = orders
                .filter((row) => ["Cash", "Home Website [Cash]"].includes(row["Payment Type"]))
                .reduce((sum, row) => sum + (parseFloat(row["Grand Total (₹)"]) || 0), 0);

            const petpoojaSheet = workbook.Sheets["Pet Pooja"];
            const rawPetpooja = XLSX.utils.sheet_to_json(petpoojaSheet, { header: 1 });
            const startRow = rawPetpooja.findIndex((row) => row[0] === "Date");
            const petpooja = XLSX.utils.sheet_to_json(petpoojaSheet, { range: startRow, defval: "" });

            const cashSpent = petpooja
                .filter((row) => row["Paid From"] === "From Cash")
                .reduce((sum, row) => sum + (parseFloat(row["Amount (₹)"]) || 0), 0);

            const cashDifference = cashOrdersTotal - cashSpent;
            setCashStats({ cashOrdersTotal, cashSpent, cashDifference });

            // --- Petpooja Calculation ---
            const petpoojaTypes = ["Other [UPI]", "Online", "Card", "Home Website [Other [UPI]]", "Home Website [Card]"];
            const petpoojaOrdersTotal = orders
                .filter((row) => petpoojaTypes.includes(row["Payment Type"]))
                .reduce((sum, row) => sum + (parseFloat(row["Grand Total (₹)"]) || 0), 0);

            const bankSpent = petpooja
                .filter((row) => row["Paid From"] === "From Bank")
                .reduce((sum, row) => sum + (parseFloat(row["Amount (₹)"]) || 0), 0);

            const petpoojaDifference = petpoojaOrdersTotal - bankSpent;
            setPetpoojaStats({ petpoojaOrdersTotal, bankSpent, petpoojaDifference });

            // --- Income in Cash Calculation ---
            const incomeCashTotal = orders
                .filter((row) => row["Payment Type"] === "Cash")
                .reduce((sum, row) => sum + (parseFloat(row["Grand Total (₹)"]) || 0), 0);

            const totalCashSpent = petpooja
                .filter((row) => row["Paid From"] === "From Cash")
                .reduce((sum, row) => sum + (parseFloat(row["Amount (₹)"]) || 0), 0);

            const incomeCashDifference = incomeCashTotal - totalCashSpent;
            setIncomeCashStats({ incomeCashTotal, totalCashSpent, incomeCashDifference });

            // Calculate Expense Discrepancies (Bank vs Petpooja)
            const totalBankWithdrawals = bankJson.reduce((sum, row) => sum + (parseFloat(row["Withdrawal Amt."]) || 0), 0);
            const totalPetpoojaBankSpent = petpooja
                .filter((row) => row["Paid From"] === "From Bank")
                .reduce((sum, row) => sum + (parseFloat(row["Amount (₹)"], 10) || 0), 0);
            const discrepancy = totalBankWithdrawals - totalPetpoojaBankSpent;
            setExpenseDiscrepancy({
                totalBankWithdrawals,
                totalPetpoojaBankSpent,
                discrepancy
            });

            // Prepare date-wise discrepancy table
            // For each withdrawal in bankJson, try to find a matching Petpooja row (by date and amount)
            // If not found, mark as discrepancy
            // Sort Petpooja rows by date ascending before comparison
            const petpoojaSorted = [...petpooja].sort((a, b) => {
                const d1 = excelDateToBankString(a["Date"]);
                const d2 = excelDateToBankString(b["Date"]);
                // Convert dd/mm/yy to yyyymmdd for comparison
                const toNum = d => {
                    if (!/^\d{2}\/\d{2}\/\d{2}$/.test(d)) return 0;
                    const [day, month, year] = d.split('/');
                    return parseInt(`20${year}${month}${day}`);
                };
                return toNum(d1) - toNum(d2);
            });
            // Use sorted Petpooja rows for further processing
            const petpoojaBankRows = petpoojaSorted.filter(row => row["Paid From"] === "From Bank");
            const usedPetpoojaIndexes = new Set();
            const rows = bankJson
                .filter(row => row["Withdrawal Amt."] && row["Date"]) // Only withdrawals with a date
                .map(bankRow => {
                    const bankDate = excelDateToBankString(bankRow["Date"], "bank");
                    const bankAmt = parseFloat(bankRow["Withdrawal Amt."]) || 0;
                    // Try to find a matching Petpooja row (same date and amount, not already matched)
                    const matchIdx = petpoojaBankRows.findIndex((pRow, idx) => {
                        if (usedPetpoojaIndexes.has(idx)) return false;
                        let petpoojaDate = excelDateToBankString(pRow["Date"]);
                        const normalize = d => d.replace(/^0/, '').replace(/\/(0)(\d)/g, '/$2');
                        return (
                            normalize(petpoojaDate) === normalize(bankDate) &&
                            (parseFloat(pRow["Amount (₹)"]) || 0) === bankAmt
                        );
                    });
                    // Get explanation from Petpooja row if available
                    const explanation =
                        matchIdx !== -1 && petpoojaBankRows[matchIdx] && petpoojaBankRows[matchIdx]["Explanation"]
                            ? petpoojaBankRows[matchIdx]["Explanation"]
                            : ' - ';
                    if (matchIdx !== -1) {
                        usedPetpoojaIndexes.add(matchIdx);
                        return null; // Matched, not a discrepancy
                    } else {
                        return {
                            date: bankDate,
                            bankAmount: bankAmt,
                            petpoojaAmount: '',
                            status: 'Not found in Petpooja',
                            explanation
                        };
                    }
                })
                .filter(Boolean);
            // Also, check for Petpooja rows not matched in Bank
            petpoojaBankRows.forEach((pRow, idx) => {
                if (!usedPetpoojaIndexes.has(idx)) {
                    rows.push({
                        date: excelDateToBankString(pRow["Date"]),
                        bankAmount: '',
                        petpoojaAmount: parseFloat(pRow["Amount (₹)"]) || 0,
                        status: 'Not found in Bank',
                        explanation: pRow["Explanation"] || 'This Petpooja expense (From Bank) does not have a matching withdrawal in the bank statement for the same date and amount.'
                    });
                }
            });
            // Sort the entire discrepancies table by date (ascending)
            rows.sort((a, b) => {
                // Convert dd/mm/yy to yyyymmdd for comparison
                const toNum = d => {
                    if (!/^\d{2}\/\d{2}\/\d{2}$/.test(d)) return 0;
                    const [day, month, year] = d.split('/');
                    return parseInt(`20${year}${month}${day}`);
                };
                return toNum(a.date) - toNum(b.date);
            });
            setDiscrepancyRows(rows);
            setFileUploaded(true);
        };

        reader.readAsArrayBuffer(file);
    };

    // Helper to convert Excel serial date or string to dd/mm/yy format
    function excelDateToBankString(excelDate, origin) {
        if (!excelDate) return '';
        if (typeof excelDate === 'number') {
            // Excel serial date to JS Date (Excel is always in UTC, but JS Date interprets as local, so use UTC)
            const utc_days = Math.floor(excelDate - 25569);
            const utc_value = utc_days * 86400; // seconds
            const date_info = new Date(utc_value * 1000);
            const day = String(date_info.getUTCDate()).padStart(2, '0');
            const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
            const year = String(date_info.getUTCFullYear()).slice(-2);
            if (origin === "bank") return `${month}/${day}/${year}`
            else return `${day}/${month}/${year}`;
        }
        // If already in dd/mm/yy format, return as is
        if (/^\d{2}\/\d{2}\/\d{2}$/.test(excelDate)) return excelDate;
        // If in dd mmm yyyy format, convert to dd/mm/yy
        if (/^\d{2} [A-Za-z]{3} \d{4}$/.test(excelDate)) {
            const [d, mmm, yyyy] = excelDate.split(' ');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = String(months.indexOf(mmm) + 1).padStart(2, '0');
            const year = yyyy.slice(-2);
            return `${d}/${month}/${year}`;
        }
        return excelDate;
    }

    const containerStyle = {
        minHeight: '100vh',
        background: darkMode ? '#1f2937' : '#f9fafb',
        color: darkMode ? '#f9fafb' : '#111827',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    };

    const navStyle = {
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        height: isMobile ? '100vh' : '100vh',
        width: isMobile ? (showNav ? '240px' : '0') : '240px',
        background: darkMode ? '#111827' : '#ffffff',
        borderRight: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 50,
        overflowY: 'auto',
        transform: isMobile && !showNav ? 'translateX(-100%)' : 'translateX(0)',
        boxShadow: isMobile && showNav ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
    }; const contentStyle = {
        flex: 1,
        padding: '1.5rem',
        marginLeft: isMobile ? 0 : '240px',
        transition: 'margin-left 0.3s',
        background: darkMode ? '#1f2937' : '#f9fafb',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
    };

    const cardStyle = {
        background: darkMode ? '#374151' : '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        animation: 'fadeSlideUp 0.5s ease forwards',
        border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
    };

    const tableContainerStyle = {
        width: '100%',
        margin: '12px 0',
        position: 'relative',
        overflowX: 'auto',
        borderRadius: '12px',
        background: darkMode ? '#1f2937' : '#ffffff',
        border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
        boxShadow: darkMode
            ? '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
            : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    };

    const tableStyle = {
        width: '100%',
        minWidth: isMobile ? '800px' : 'auto',
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: '0.875rem',
    };

    const cellStyle = {
        padding: '1rem 1.5rem',
        borderBottom: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
        whiteSpace: 'nowrap',
        transition: 'background-color 0.2s',
        lineHeight: '1.5',
        letterSpacing: '0.01em',
        verticalAlign: 'middle',
    };

    const headerCellStyle = {
        padding: '1.25rem 1.5rem',
        background: darkMode ? '#374151' : '#f8fafc',
        fontWeight: 600,
        textAlign: 'left',
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: darkMode ? '#f3f4f6' : '#1f2937',
        borderBottom: darkMode ? '2px solid #4b5563' : '2px solid #e5e7eb',
        position: 'sticky',
        top: 0,
    };

    const buttonStyle = {
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
        color: '#ffffff',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        overflow: 'hidden',
    };

    const navButtonStyle = {
        width: '100%',
        padding: '12px 16px',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        color: darkMode ? '#f9fafb' : '#111827',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'all 0.2s',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    };

    const tabStyle = {
        padding: '8px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid transparent',
        color: darkMode ? '#f9fafb' : '#111827',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'all 0.2s',
    };

    const activeTabStyle = {
        ...tabStyle,
        borderBottom: '2px solid #6366f1',
        color: '#6366f1',
    };

    const renderTable = (data, title) => {
        if (!data || !data.length) return null;

        return (<div className={isMobile ? "card" : ""} style={cardStyle}>
            <h3 style={{
                marginBottom: '16px',
                fontSize: '1.25rem',
                fontWeight: 700,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
            }}>{title}</h3>
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            {Object.keys(data[0]).map((key, index) => (
                                <th key={index} style={headerCellStyle}>
                                    {key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex} style={{
                                background: darkMode ? '#1f2937' : '#ffffff',
                                transition: 'background-color 0.2s'
                            }}>
                                {Object.values(row).map((cell, cellIndex) => (
                                    <td key={cellIndex} style={{
                                        ...cellStyle,
                                        background: typeof cell === 'number' && cell < 0 ?
                                            (darkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)') :
                                            'transparent',
                                        color: typeof cell === 'number' && cell < 0 ?
                                            '#ef4444' : 'inherit',
                                    }}>
                                        {typeof cell === 'number' ?
                                            new Intl.NumberFormat('en-IN', {
                                                style: 'currency',
                                                currency: 'INR'
                                            }).format(cell) :
                                            cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        );
    };

    const renderNavButton = (label, nav, icon) => (
        <Button
            variant={activeNav === nav ? "primary" : "ghost"}
            className={`nav-btn ${activeNav === nav ? "active" : ""}`}
            style={{
                width: '100%',
                justifyContent: 'flex-start',
                padding: '1.1rem 2rem',
                marginBottom: 8,
                borderRadius: '0 24px 24px 0',
                fontWeight: 600,
                fontSize: '1.08rem',
            }}
            onClick={() => { setActiveNav(nav); setShowNav(false); }}
        >
            {icon && <span role="img" aria-label={label.toLowerCase()}>{icon}</span>}
            {label}
        </Button>
    );

    const renderCard = (title, items, variant = 'default') => (
        <Card darkMode={darkMode} variant={variant}>
            <h2 style={{
                fontSize: '1.08rem',
                margin: '0 0 12px 0',
                fontWeight: 800,
                lineHeight: 1.1,
                color: darkMode ? '#f9fafb' : '#3b3b5c',
                letterSpacing: 0.2
            }}>{title}</h2>
            {items.map((item, index) => (
                <p key={index} style={{
                    margin: '8px 0',
                    fontSize: '1.01rem',
                    lineHeight: 1.13,
                    color: darkMode ? '#f9fafb' : '#4a5568'
                }}>
                    {item.label}: <span style={{
                        fontWeight: 700,
                        color: item.type === 'income' ? '#2563eb' :
                            item.type === 'expense' ? '#e11d48' :
                                item.type === 'difference' ? (item.value >= 0 ? '#059669' : '#e11d48') :
                                    (darkMode ? '#f9fafb' : '#111827')
                    }}>
                        {item.type === 'difference' && item.value >= 0 ? '+' : ''}
                        ₹{item.value.toFixed(2)}
                    </span>
                </p>
            ))}
        </Card>
    ); const FileUploader = ({ onChange }) => (
        <Card darkMode={darkMode} variant="default" isMobile={isMobile} style={{ maxWidth: 500, margin: '0 auto' }}>
            <label
                htmlFor="file-upload"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '2rem',
                    borderRadius: '8px',
                    border: `2px dashed ${darkMode ? '#4b5563' : '#e5e7eb'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                <span role="img" aria-label="upload" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                    📋
                </span>
                <span style={{
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    marginBottom: '0.5rem',
                    color: darkMode ? '#f9fafb' : '#111827'
                }}>
                    Upload Excel File
                </span>
                <span style={{
                    fontSize: '0.875rem',
                    color: darkMode ? '#9ca3af' : '#6b7280'
                }}>
                    Click to browse or drag and drop
                </span>
                <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={onChange}
                    style={{
                        position: 'absolute',
                        width: '1px',
                        height: '1px',
                        padding: 0,
                        margin: '-1px',
                        overflow: 'hidden',
                        clip: 'rect(0, 0, 0, 0)',
                        border: 0
                    }}
                />
            </label>
        </Card>
    );

    return (
        <div style={containerStyle}>
            {/* Header */}
            <header style={{
                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                color: darkMode ? "#f9fafb" : "#111827",
                padding: isMobile ? "1.2rem 0.8rem" : "1.5rem 2rem",
                position: 'sticky',
                top: 0,
                zIndex: 40,
                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
            }}>
                <button
                    onClick={() => setShowNav(!showNav)}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        padding: '4px',
                        color: darkMode ? '#f9fafb' : '#111827',
                    }}
                >
                    ☰
                </button>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    margin: 0,
                    flex: 1
                }}>
                    Expense Tracker
                </h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={() => {
                            if (isMobile) {
                                setForceMobile(false);
                                setForceDesktop(true);
                            } else {
                                setForceMobile(true);
                                setForceDesktop(false);
                            }
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            padding: '4px',
                            color: darkMode ? '#f9fafb' : '#111827',
                        }}
                    >
                        {isMobile ? '🖥️' : '📱'}
                    </button>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            padding: '4px',
                            color: darkMode ? '#f9fafb' : '#111827',
                        }}
                    >
                        {darkMode ? '🌙' : '☀️'}
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', minHeight: 'calc(100vh - 73px)' }}>
                {/* Nav Sidebar */}
                <nav style={{
                    width: isMobile ? (showNav ? '240px' : '0') : '240px',
                    background: darkMode ? '#111827' : '#ffffff',
                    borderRight: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                    transition: 'all 0.3s',
                    position: isMobile ? 'fixed' : 'sticky',
                    top: '73px',
                    height: 'calc(100vh - 73px)',
                    overflowY: 'auto',
                    transform: isMobile && !showNav ? 'translateX(-100%)' : 'translateX(0)',
                    zIndex: 30
                }}>
                    <div style={{ padding: '1.5rem 1rem' }}>
                        {renderNavButton("Profit & Loss", "profitloss", "💰")}
                        {renderNavButton("Expense Discrepancies", "expensediscrepancy", "📊")}
                    </div>
                </nav>

                {/* Main Content */}
                <main style={{
                    flex: 1,
                    padding: '1.5rem',
                    marginLeft: isMobile ? 0 : '240px',
                    transition: 'margin-left 0.3s',
                    background: darkMode ? '#1f2937' : '#f9fafb',
                    minHeight: '100%'
                }}>
                    {!fileUploaded ? (
                        <div style={{
                            maxWidth: '500px',
                            margin: '2rem auto',
                            padding: '0 1rem'
                        }}>
                            <FileUploader onChange={handleFileUpload} />
                        </div>
                    ) : (
                        <>
                            {activeNav === "profitloss" && (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                                    gap: '1rem',
                                    maxWidth: '1200px',
                                    margin: '0 auto'
                                }}>                                    {bankStats && renderCard("Bank Book", [
                                    { label: "Total Deposits", value: bankStats.totalDeposits, type: "income" },
                                    { label: "Total Withdrawals", value: bankStats.totalWithdrawals, type: "expense" },
                                    { label: "Profit / Loss", value: bankStats.profitLoss, type: "difference" }
                                ], "default", isMobile)}

                                    {cashStats && renderCard("Cash Book", [
                                        { label: "Total Cash Orders", value: cashStats.cashOrdersTotal, type: "income" },
                                        { label: "Total Cash Spent", value: cashStats.cashSpent, type: "expense" },
                                        { label: "Difference", value: cashStats.cashDifference, type: "difference" }
                                    ], "default", isMobile)}

                                    {petpoojaStats && renderCard("Petpooja Payments", [
                                        { label: "Petpooja Order Total", value: petpoojaStats.petpoojaOrdersTotal, type: "income" },
                                        { label: "Total Paid from Bank", value: petpoojaStats.bankSpent, type: "expense" },
                                        { label: "Difference", value: petpoojaStats.petpoojaDifference, type: "difference" }
                                    ], "default", isMobile)}

                                    {incomeCashStats && renderCard("Income in Cash", [
                                        { label: "Total Cash Income", value: incomeCashStats.incomeCashTotal, type: "income" },
                                        { label: "Total Cash Spent", value: incomeCashStats.totalCashSpent, type: "expense" },
                                        { label: "Difference", value: incomeCashStats.incomeCashDifference, type: "difference" }
                                    ])}
                                </div>
                            )}                            {activeNav === "expensediscrepancy" && expenseDiscrepancy && (
                                <div style={{
                                    maxWidth: '1200px',
                                    margin: '0 auto',
                                    animation: 'fadeSlideUp 0.5s ease forwards'
                                }}>                                    <Card darkMode={darkMode} variant="elevated" isMobile={isMobile}>
                                        <h2 style={{
                                            fontSize: '1.5rem',
                                            marginBottom: '1.5rem',
                                            fontWeight: 700,
                                            color: darkMode ? '#f9fafb' : '#111827',
                                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                                            borderBottom: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
                                            paddingBottom: '1rem'
                                        }}>
                                            Expense Discrepancies
                                        </h2>

                                        <div style={{
                                            display: 'flex',
                                            flexDirection: isMobile ? 'column' : 'row',
                                            gap: '1rem',
                                            justifyContent: 'space-between',
                                            marginBottom: '2rem',
                                            padding: '1rem',
                                            background: darkMode ? '#1f2937' : '#f8fafc',
                                            borderRadius: '0.5rem',
                                            border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                                        }}>
                                            <div style={{
                                                flex: 1,
                                                padding: '0.5rem 1rem',
                                                borderRadius: '0.375rem',
                                                background: darkMode ? '#374151' : '#ffffff',
                                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                            }}>
                                                <p style={{
                                                    margin: '0 0 0.25rem 0',
                                                    fontSize: '0.875rem',
                                                    color: darkMode ? '#9ca3af' : '#6b7280',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.025em'
                                                }}>
                                                    Total Bank Withdrawals
                                                </p>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '1.25rem',
                                                    fontWeight: 600,
                                                    color: '#2563eb'
                                                }}>
                                                    ₹{expenseDiscrepancy.totalBankWithdrawals.toFixed(2)}
                                                </p>
                                            </div>

                                            <div style={{
                                                flex: 1,
                                                padding: '0.5rem 1rem',
                                                borderRadius: '0.375rem',
                                                background: darkMode ? '#374151' : '#ffffff',
                                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                            }}>
                                                <p style={{
                                                    margin: '0 0 0.25rem 0',
                                                    fontSize: '0.875rem',
                                                    color: darkMode ? '#9ca3af' : '#6b7280',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.025em'
                                                }}>
                                                    Total Petpooja Bank Expenses
                                                </p>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '1.25rem',
                                                    fontWeight: 600,
                                                    color: '#e11d48'
                                                }}>
                                                    ₹{expenseDiscrepancy.totalPetpoojaBankSpent.toFixed(2)}
                                                </p>
                                            </div>

                                            <div style={{
                                                flex: 1,
                                                padding: '0.5rem 1rem',
                                                borderRadius: '0.375rem',
                                                background: darkMode ? '#374151' : '#ffffff',
                                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                                borderLeft: isMobile ? 'none' : (darkMode ? '2px solid #4b5563' : '2px solid #e5e7eb')
                                            }}>
                                                <p style={{
                                                    margin: '0 0 0.25rem 0',
                                                    fontSize: '0.875rem',
                                                    color: darkMode ? '#9ca3af' : '#6b7280',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.025em'
                                                }}>
                                                    Total Discrepancy
                                                </p>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '1.25rem',
                                                    fontWeight: 600,
                                                    color: expenseDiscrepancy.discrepancy === 0
                                                        ? (darkMode ? '#9ca3af' : '#6b7280')
                                                        : (expenseDiscrepancy.discrepancy > 0 ? '#f59e0b' : '#e11d48')
                                                }}>
                                                    ₹{expenseDiscrepancy.discrepancy.toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        {discrepancyRows.length > 0 && (
                                            <>
                                                {discrepancyRows.length > 0 ? (<div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '1.5rem'
                                                }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: isMobile ? 'column' : 'row',
                                                        justifyContent: 'space-between',
                                                        alignItems: isMobile ? 'stretch' : 'center',
                                                        gap: isMobile ? '1rem' : '0'
                                                    }}>
                                                        <h3 style={{
                                                            margin: 0,
                                                            color: darkMode ? '#f3f4f6' : '#1f2937',
                                                            fontSize: '1.125rem',
                                                            fontWeight: 600
                                                        }}>
                                                            Discrepancy Details
                                                        </h3>
                                                        <Button
                                                            onClick={() => {
                                                                const ws = XLSX.utils.json_to_sheet(discrepancyRows);
                                                                const wb = XLSX.utils.book_new();
                                                                XLSX.utils.book_append_sheet(wb, ws, 'Discrepancies');
                                                                XLSX.writeFile(wb, `discrepancies_${new Date().toISOString().slice(0, 10)}.xlsx`);
                                                            }}
                                                            style={{
                                                                marginLeft: 'auto'
                                                            }}
                                                        >
                                                            Export to Excel
                                                        </Button>
                                                    </div>

                                                    <div style={tableContainerStyle}>
                                                        <table style={tableStyle}>
                                                            <colgroup>
                                                                <col style={{ width: '15%' }} />
                                                                <col style={{ width: '15%' }} />
                                                                <col style={{ width: '15%' }} />
                                                                <col style={{ width: '20%' }} />
                                                                <col style={{ width: '35%' }} />
                                                            </colgroup>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{
                                                                        ...headerCellStyle,
                                                                        textAlign: 'left'
                                                                    }}>Date</th>
                                                                    <th style={{
                                                                        ...headerCellStyle,
                                                                        textAlign: 'right'
                                                                    }}>Bank Amount</th>
                                                                    <th style={{
                                                                        ...headerCellStyle,
                                                                        textAlign: 'right'
                                                                    }}>Petpooja Amount</th>
                                                                    <th style={{
                                                                        ...headerCellStyle,
                                                                        textAlign: 'center'
                                                                    }}>Status</th>
                                                                    <th style={{
                                                                        ...headerCellStyle,
                                                                        textAlign: 'left'
                                                                    }}>Explanation</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {discrepancyRows.map((row, idx) => (
                                                                    <tr key={idx} style={{
                                                                        background: darkMode
                                                                            ? (idx % 2 === 0 ? 'rgba(55, 65, 81, 0.5)' : 'rgba(31, 41, 55, 0.5)')
                                                                            : (idx % 2 === 0 ? '#ffffff' : '#f9fafb'),
                                                                        transition: 'background-color 0.2s',
                                                                    }}>
                                                                        <td style={{
                                                                            ...cellStyle,
                                                                            color: darkMode ? '#f3f4f6' : '#1f2937',
                                                                            fontWeight: 500
                                                                        }}>
                                                                            {row.date}
                                                                        </td>
                                                                        <td style={{
                                                                            ...cellStyle,
                                                                            textAlign: 'right',
                                                                            color: row.bankAmount
                                                                                ? (darkMode ? '#60a5fa' : '#2563eb')
                                                                                : (darkMode ? '#6b7280' : '#9ca3af'),
                                                                            fontWeight: row.bankAmount ? 600 : 400
                                                                        }}>
                                                                            {row.bankAmount
                                                                                ? new Intl.NumberFormat('en-IN', {
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                }).format(row.bankAmount)
                                                                                : '-'
                                                                            }
                                                                        </td>
                                                                        <td style={{
                                                                            ...cellStyle,
                                                                            textAlign: 'right',
                                                                            color: row.petpoojaAmount
                                                                                ? (darkMode ? '#34d399' : '#059669')
                                                                                : (darkMode ? '#6b7280' : '#9ca3af'),
                                                                            fontWeight: row.petpoojaAmount ? 600 : 400
                                                                        }}>
                                                                            {row.petpoojaAmount
                                                                                ? new Intl.NumberFormat('en-IN', {
                                                                                    style: 'currency',
                                                                                    currency: 'INR'
                                                                                }).format(row.petpoojaAmount)
                                                                                : '-'
                                                                            }
                                                                        </td>
                                                                        <td style={{
                                                                            ...cellStyle,
                                                                            textAlign: 'center'
                                                                        }}>
                                                                            <span style={{
                                                                                display: 'inline-block',
                                                                                padding: '0.25rem 0.75rem',
                                                                                borderRadius: '9999px',
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 500,
                                                                                background: row.status === 'Not found in Petpooja'
                                                                                    ? (darkMode ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)')
                                                                                    : (darkMode ? 'rgba(5, 150, 105, 0.2)' : 'rgba(5, 150, 105, 0.1)'),
                                                                                color: row.status === 'Not found in Petpooja'
                                                                                    ? (darkMode ? '#60a5fa' : '#2563eb')
                                                                                    : (darkMode ? '#34d399' : '#059669'),
                                                                            }}>
                                                                                {row.status}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{
                                                                            ...cellStyle,
                                                                            color: darkMode ? '#d1d5db' : '#4b5563',
                                                                            whiteSpace: 'normal',
                                                                            maxWidth: '400px',
                                                                            lineHeight: '1.5'
                                                                        }}>
                                                                            {row.explanation}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                                ) : (<div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '3rem 2rem',
                                                    gap: '1rem',
                                                    color: darkMode ? '#9ca3af' : '#6b7280',
                                                    background: darkMode ? 'rgba(31, 41, 55, 0.5)' : 'rgba(249, 250, 251, 0.8)',
                                                    borderRadius: '0.5rem',
                                                    border: darkMode ? '1px solid #374151' : '1px solid #e5e7eb'
                                                }}>
                                                    <span role="img" aria-label="check" style={{ fontSize: '2rem' }}>
                                                        ✅
                                                    </span>
                                                    <p style={{
                                                        fontSize: '1.125rem',
                                                        fontWeight: 500,
                                                        margin: 0
                                                    }}>
                                                        No discrepancies found
                                                    </p>
                                                    <p style={{
                                                        fontSize: '0.875rem',
                                                        maxWidth: '400px',
                                                        textAlign: 'center',
                                                        margin: 0
                                                    }}>
                                                        All bank withdrawals match with Petpooja expenses for the selected period.
                                                    </p>
                                                </div>
                                                )}
                                            </>
                                        )}
                                    </Card>
                                </div>
                            )}
                        </>
                    )}
                </main>

                {/* Mobile Nav Overlay */}
                {isMobile && showNav && (
                    <div
                        onClick={() => setShowNav(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 20
                        }}
                    />
                )}
            </div>

            {/* Footer */}
            <footer style={{
                backgroundColor: darkMode ? "#1f2937" : "#ffffff",
                color: darkMode ? "#f9fafb" : "#111827",
                padding: "0.8rem",
                textAlign: "center",
                fontSize: '0.9rem',
                marginTop: "auto",
                borderTop: darkMode ? '1px solid #374151' : '1px solid #e5e7eb'
            }}>
                <p style={{ margin: 0 }}>&copy; 2025 Bank Cash Book Viewer</p>
            </footer>
        </div>
    );
}