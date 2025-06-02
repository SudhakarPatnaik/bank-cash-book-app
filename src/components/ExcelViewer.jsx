import React, { useState } from "react";
import * as XLSX from "xlsx";

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: darkMode ? '#181c25' : '#f4f6fa', transition: 'background 0.2s' }}>
            {/* Mobile Header with Hamburger for Nav */}
            <header style={{ backgroundColor: darkMode ? "#181c25" : "#1a202c", color: "#ffffff", padding: "1.2rem 0.8rem 1.1rem 0.8rem", textAlign: "center", position: 'relative', boxShadow: '0 1px 8px 0 rgba(44,62,80,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <button
                    aria-label="Open navigation"
                    onClick={() => setShowNav(!showNav)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        fontSize: '1.8rem',
                        marginRight: 4,
                        display: 'block',
                        cursor: 'pointer',
                        padding: '0 4px',
                    }}
                >
                    <span style={{ fontSize: '1.8rem', verticalAlign: 'middle' }}>☰</span>
                </button>
                <h1
                    style={{
                        fontSize: '2.1rem',
                        fontWeight: 900,
                        margin: 0,
                        flex: 1,
                        textAlign: 'center',
                        letterSpacing: 1.2,
                        background: 'linear-gradient(90deg, #fbbf24 10%, #6366f1 60%, #06b6d4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textFillColor: 'transparent',
                        textShadow: '0 2px 12px rgba(44,62,80,0.18)',
                        lineHeight: 1.1,
                        padding: '0 0.5rem',
                        userSelect: 'none',
                    }}
                >
                    Expense Tracker
                </h1>
                <button
                    aria-label="Toggle dark mode"
                    onClick={() => setDarkMode(dm => !dm)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        fontSize: '1.7rem',
                        marginLeft: 8,
                        cursor: 'pointer',
                        padding: '0 4px',
                        transition: 'color 0.2s',
                    }}
                    title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {darkMode ? '🌙' : '☀️'}
                </button>
            </header>

            {/* Slide-out Mobile Nav */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: showNav ? 0 : '-70vw',
                width: '70vw',
                height: '100vh',
                background: '#232946',
                color: '#fff',
                zIndex: 100,
                transition: 'left 0.25s',
                boxShadow: showNav ? '2px 0 16px 0 rgba(44,62,80,0.16)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                padding: '2.5rem 0 1.5rem 0',
            }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: 1, textAlign: 'center', marginBottom: '2.5rem', color: '#f4f6fa' }}>
                    <span role="img" aria-label="bank" style={{ marginRight: 8 }}>🏦</span> Dashboard
                </div>
                <button
                    className={activeNav === "profitloss" ? "nav-btn active" : "nav-btn"}
                    style={{
                        background: activeNav === "profitloss" ? '#eebbc3' : 'transparent',
                        color: activeNav === "profitloss" ? '#232946' : '#fff',
                        border: 'none',
                        borderRadius: '0 24px 24px 0',
                        padding: '1.1rem 2rem 1.1rem 2.2rem',
                        fontSize: '1.08rem',
                        fontWeight: 600,
                        marginBottom: 8,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s',
                        boxShadow: activeNav === "profitloss" ? '2px 2px 12px 0 rgba(238,187,195,0.10)' : 'none'
                    }}
                    onClick={() => { setActiveNav("profitloss"); setShowNav(false); }}
                >
                    Profit & Loss
                </button>
                <button
                    className={activeNav === "expensediscrepancy" ? "nav-btn active" : "nav-btn"}
                    style={{
                        background: activeNav === "expensediscrepancy" ? '#eebbc3' : 'transparent',
                        color: activeNav === "expensediscrepancy" ? '#232946' : '#fff',
                        border: 'none',
                        borderRadius: '0 24px 24px 0',
                        padding: '1.1rem 2rem 1.1rem 2.2rem',
                        fontSize: '1.08rem',
                        fontWeight: 600,
                        marginBottom: 8,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s',
                        boxShadow: activeNav === "expensediscrepancy" ? '2px 2px 12px 0 rgba(238,187,195,0.10)' : 'none'
                    }}
                    onClick={() => { setActiveNav("expensediscrepancy"); setShowNav(false); }}
                >
                    Expense Discrepencies
                </button>
            </div>
            {/* Overlay for nav */}
            {showNav && <div onClick={() => setShowNav(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(30,30,40,0.25)', zIndex: 99 }} />}

            {/* Main Content Area */}
            <main style={{ flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', padding: '0 0.25rem', background: '#f4f6fa' }}>
                {/* File Uploader (mobile-friendly) */}
                <div style={{ margin: '0.8rem 0 1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ padding: "0.5rem 0.8rem", borderRadius: "6px", border: "1.5px solid #cbd5e0", fontSize: '0.95rem', background: '#fff', boxShadow: '0 1px 4px 0 rgba(44,62,80,0.03)', width: '100%' }} />
                </div>
                {/* Dashboard View after file upload */}
                {fileUploaded && (
                    <>
                        {/* Main Content Switcher */}
                        {activeNav === "profitloss" && (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center' }}>
                                {bankStats && (
                                    <div className="card" style={{
                                        width: '100%',
                                        maxWidth: 400,
                                        borderRadius: 14,
                                        boxShadow: '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        padding: '0.7rem 1.1rem',
                                        background: darkMode
                                            ? 'linear-gradient(135deg, #232946 60%, #181c25 100%)'
                                            : 'linear-gradient(135deg, #f8fafc 60%, #e0e7ff 100%)',
                                        color: darkMode ? '#f4f6fa' : '#232946',
                                        border: darkMode ? '1.5px solid #232946' : '1.5px solid #e0e7ef',
                                        boxShadow: darkMode ? '0 4px 18px 0 rgba(30,41,59,0.25)' : '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        margin: '0 auto',
                                        animation: 'fadeIn 0.4s',
                                        minHeight: 'unset',
                                        height: 'auto',
                                        display: 'block',
                                        lineHeight: 1.1,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = '0 8px 28px 0 rgba(44,62,80,0.16)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 18px 0 rgba(44,62,80,0.10)'; }}
                                    >
                                        <h2 style={{ fontSize: '1.08rem', margin: '0 0 4px 0', fontWeight: 800, lineHeight: 1.1, color: '#3b3b5c', letterSpacing: 0.2 }}>Bank Book</h2>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Total Deposits: <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{bankStats.totalDeposits.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Total Withdrawals: <span style={{ fontWeight: 700, color: '#e11d48' }}>₹{bankStats.totalWithdrawals.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Profit / Loss: <span style={{ color: bankStats.profitLoss >= 0 ? '#059669' : '#e11d48', fontWeight: 800 }}>{bankStats.profitLoss >= 0 ? '+' : ''}₹{bankStats.profitLoss.toFixed(2)}</span></p>
                                    </div>
                                )}
                                {cashStats && (
                                    <div className="card" style={{
                                        width: '100%',
                                        maxWidth: 400,
                                        borderRadius: 14,
                                        boxShadow: '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        padding: '0.7rem 1.1rem',
                                        background: darkMode
                                            ? 'linear-gradient(135deg, #232946 60%, #181c25 100%)'
                                            : 'linear-gradient(135deg, #f8fafc 60%, #fce7f3 100%)',
                                        color: darkMode ? '#f4f6fa' : '#232946',
                                        border: darkMode ? '1.5px solid #232946' : '1.5px solid #e0e7ef',
                                        boxShadow: darkMode ? '0 4px 18px 0 rgba(30,41,59,0.25)' : '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        margin: '0 auto',
                                        animation: 'fadeIn 0.4s',
                                        minHeight: 'unset',
                                        height: 'auto',
                                        display: 'block',
                                        lineHeight: 1.1,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = '0 8px 28px 0 rgba(44,62,80,0.16)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 18px 0 rgba(44,62,80,0.10)'; }}
                                    >
                                        <h2 style={{ fontSize: '1.08rem', margin: '0 0 4px 0', fontWeight: 800, lineHeight: 1.1, color: '#3b3b5c', letterSpacing: 0.2 }}>Cash Book</h2>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Total Cash Orders: <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{cashStats.cashOrdersTotal.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Total Cash Spent: <span style={{ fontWeight: 700, color: '#e11d48' }}>₹{cashStats.cashSpent.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Difference: <span style={{ color: cashStats.cashDifference >= 0 ? '#059669' : '#e11d48', fontWeight: 800 }}>{cashStats.cashDifference >= 0 ? '+' : ''}₹{cashStats.cashDifference.toFixed(2)}</span></p>
                                    </div>
                                )}
                                {petpoojaStats && (
                                    <div className="card" style={{
                                        width: '100%',
                                        maxWidth: 400,
                                        borderRadius: 14,
                                        boxShadow: '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        padding: '0.7rem 1.1rem',
                                        background: darkMode
                                            ? 'linear-gradient(135deg, #232946 60%, #181c25 100%)'
                                            : 'linear-gradient(135deg, #f8fafc 60%, #d1fae5 100%)',
                                        color: darkMode ? '#f4f6fa' : '#232946',
                                        border: darkMode ? '1.5px solid #232946' : '1.5px solid #e0e7ef',
                                        boxShadow: darkMode ? '0 4px 18px 0 rgba(30,41,59,0.25)' : '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        margin: '0 auto',
                                        animation: 'fadeIn 0.4s',
                                        minHeight: 'unset',
                                        height: 'auto',
                                        display: 'block',
                                        lineHeight: 1.1,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = '0 8px 28px 0 rgba(44,62,80,0.16)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 18px 0 rgba(44,62,80,0.10)'; }}
                                    >
                                        <h2 style={{ fontSize: '1.08rem', margin: '0 0 4px 0', fontWeight: 800, lineHeight: 1.1, color: '#3b3b5c', letterSpacing: 0.2 }}>Petpooja Payments</h2>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Petpooja Order Total: <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{petpoojaStats.petpoojaOrdersTotal.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Total Paid from Bank: <span style={{ fontWeight: 700, color: '#e11d48' }}>₹{petpoojaStats.bankSpent.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Difference: <span style={{ color: petpoojaStats.petpoojaDifference >= 0 ? '#059669' : '#e11d48', fontWeight: 800 }}>{petpoojaStats.petpoojaDifference >= 0 ? '+' : ''}₹{petpoojaStats.petpoojaDifference.toFixed(2)}</span></p>
                                    </div>
                                )}
                                {incomeCashStats && (
                                    <div className="card" style={{
                                        width: '100%',
                                        maxWidth: 400,
                                        borderRadius: 14,
                                        boxShadow: '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        padding: '0.7rem 1.1rem',
                                        background: darkMode
                                            ? 'linear-gradient(135deg, #232946 60%, #181c25 100%)'
                                            : 'linear-gradient(135deg, #f8fafc 60%, #fef9c3 100%)',
                                        color: darkMode ? '#f4f6fa' : '#232946',
                                        border: darkMode ? '1.5px solid #232946' : '1.5px solid #e0e7ef',
                                        boxShadow: darkMode ? '0 4px 18px 0 rgba(30,41,59,0.25)' : '0 4px 18px 0 rgba(44,62,80,0.10)',
                                        margin: '0 auto',
                                        animation: 'fadeIn 0.4s',
                                        minHeight: 'unset',
                                        height: 'auto',
                                        display: 'block',
                                        lineHeight: 1.1,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }}
                                        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.025)'; e.currentTarget.style.boxShadow = '0 8px 28px 0 rgba(44,62,80,0.16)'; }}
                                        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 18px 0 rgba(44,62,80,0.10)'; }}
                                    >
                                        <h2 style={{ fontSize: '1.08rem', margin: '0 0 4px 0', fontWeight: 800, lineHeight: 1.1, color: '#3b3b5c', letterSpacing: 0.2 }}>Income in Cash</h2>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Total Cash Income: <span style={{ fontWeight: 700, color: '#2563eb' }}>₹{incomeCashStats.incomeCashTotal.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Total Cash Spent: <span style={{ fontWeight: 700, color: '#e11d48' }}>₹{incomeCashStats.totalCashSpent.toFixed(2)}</span></p>
                                        <p style={{ margin: 0, fontSize: '1.01rem', lineHeight: 1.13, color: '#4a5568' }}>Difference: <span style={{ color: incomeCashStats.incomeCashDifference >= 0 ? '#059669' : '#e11d48', fontWeight: 800 }}>{incomeCashStats.incomeCashDifference >= 0 ? '+' : ''}₹{incomeCashStats.incomeCashDifference.toFixed(2)}</span></p>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeNav === "expensediscrepancy" && expenseDiscrepancy && (
                            <div style={{ width: '100%', margin: '0 auto', marginBottom: '1.5rem', padding: '0.25rem 0.2rem' }}>
                                <div className="card" style={{
                                    width: '100%',
                                    borderRadius: 8,
                                    boxShadow: darkMode ? '0 1px 8px 0 rgba(30,41,59,0.18)' : '0 1px 4px 0 rgba(44,62,80,0.08)',
                                    padding: '0.8rem 0.4rem',
                                    background: darkMode ? '#232946' : '#fff',
                                    margin: '0 auto',
                                    animation: 'fadeIn 0.4s',
                                    border: darkMode ? '1.5px solid #181c25' : '1.5px solid #e0e7ef',
                                    color: darkMode ? '#f4f6fa' : '#232946',
                                }}>
                                    <h2 style={{ fontSize: '1rem', marginBottom: 4, fontWeight: 700, color: darkMode ? '#fbbf24' : '#232946' }}>Expence Discrepencies</h2>
                                    <p style={{ margin: 0, fontSize: '0.91rem', lineHeight: 1.2 }}>Total Withdrawals from Bank: <span style={{ fontWeight: 600 }}>₹{expenseDiscrepancy.totalBankWithdrawals.toFixed(2)}</span></p>
                                    <p style={{ margin: 0, fontSize: '0.91rem', lineHeight: 1.2 }}>Total Spent from Bank in Petpooja: <span style={{ fontWeight: 600 }}>₹{expenseDiscrepancy.totalPetpoojaBankSpent.toFixed(2)}</span></p>
                                    <p style={{ margin: 0, fontSize: '0.91rem', lineHeight: 1.2 }}>Discrepancy: <span style={{ color: expenseDiscrepancy.discrepancy === 0 ? (darkMode ? '#f4f6fa' : '#4a5568') : (expenseDiscrepancy.discrepancy > 0 ? 'orange' : '#e11d48'), fontWeight: 600 }}>₹{expenseDiscrepancy.discrepancy.toFixed(2)}</span></p>
                                    {/* Export to Excel Button */}
                                    {discrepancyRows.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const ws = XLSX.utils.json_to_sheet(discrepancyRows);
                                                const wb = XLSX.utils.book_new();
                                                XLSX.utils.book_append_sheet(wb, ws, 'Discrepancies');
                                                XLSX.writeFile(wb, `discrepancies_${new Date().toISOString().slice(0, 10)}.xlsx`);
                                            }}
                                            style={{
                                                margin: '14px 0 10px 0',
                                                padding: '0.5rem 1.1rem',
                                                background: darkMode ? 'linear-gradient(90deg, #6366f1 40%, #232946 100%)' : 'linear-gradient(90deg, #6366f1 40%, #06b6d4 100%)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: 8,
                                                fontWeight: 700,
                                                fontSize: '1rem',
                                                boxShadow: darkMode ? '0 2px 8px 0 rgba(30,41,59,0.18)' : '0 2px 8px 0 rgba(44,62,80,0.10)',
                                                cursor: 'pointer',
                                                transition: 'background 0.18s',
                                                letterSpacing: 0.2,
                                                outline: 'none',
                                                display: 'block',
                                                marginLeft: 'auto',
                                            }}
                                        >
                                            Export to Excel
                                        </button>
                                    )}
                                    {/* Date-wise discrepancy table */}
                                    {discrepancyRows.length > 0 && (
                                        <div style={{ overflowX: 'auto', marginTop: 12, margin: '12px -0.4rem 0' }}>
                                            <table style={{
                                                width: '100%',
                                                fontSize: '0.88rem',
                                                borderCollapse: 'collapse',
                                                background: darkMode ? '#232946' : '#fff',
                                                tableLayout: 'fixed',
                                                color: darkMode ? '#f4f6fa' : '#232946',
                                                border: darkMode ? '1.2px solid #232946' : '1.2px solid #e2e8f0',
                                            }}>
                                                <colgroup>
                                                    <col style={{ width: '20%' }} />
                                                    <col style={{ width: '17%' }} />
                                                    <col style={{ width: '17%' }} />
                                                    <col style={{ width: '17%' }} />
                                                    <col style={{ width: '29%' }} />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th style={{
                                                            padding: '0.35rem 0.2rem',
                                                            background: darkMode ? '#181c25' : '#f7fafc',
                                                            color: darkMode ? '#fbbf24' : '#2d3748',
                                                            fontWeight: 600,
                                                            textAlign: 'left',
                                                            borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                            fontSize: '0.88rem',
                                                        }}>Date</th>
                                                        <th style={{
                                                            padding: '0.35rem 0.2rem',
                                                            background: darkMode ? '#181c25' : '#f7fafc',
                                                            color: darkMode ? '#fbbf24' : '#2d3748',
                                                            fontWeight: 600,
                                                            textAlign: 'right',
                                                            borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                            fontSize: '0.88rem',
                                                        }}>Bank</th>
                                                        <th style={{
                                                            padding: '0.35rem 0.2rem',
                                                            background: darkMode ? '#181c25' : '#f7fafc',
                                                            color: darkMode ? '#fbbf24' : '#2d3748',
                                                            fontWeight: 600,
                                                            textAlign: 'right',
                                                            borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                            fontSize: '0.88rem',
                                                        }}>Petpooja</th>
                                                        <th style={{
                                                            padding: '0.35rem 0.2rem',
                                                            background: darkMode ? '#181c25' : '#f7fafc',
                                                            color: darkMode ? '#fbbf24' : '#2d3748',
                                                            fontWeight: 600,
                                                            textAlign: 'center',
                                                            borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                            fontSize: '0.88rem',
                                                        }}>Status</th>
                                                        <th style={{
                                                            padding: '0.35rem 0.2rem',
                                                            background: darkMode ? '#181c25' : '#f7fafc',
                                                            color: darkMode ? '#fbbf24' : '#2d3748',
                                                            fontWeight: 600,
                                                            textAlign: 'left',
                                                            borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                            fontSize: '0.88rem',
                                                        }}>Explanation</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {discrepancyRows.map((row, idx) => (
                                                        <tr key={idx} style={{
                                                            background: darkMode
                                                                ? (idx % 2 === 0 ? '#232946' : '#181c25')
                                                                : (idx % 2 === 0 ? '#f9fafb' : '#fff'),
                                                        }}>
                                                            <td style={{
                                                                padding: '0.35rem 0.2rem',
                                                                color: darkMode ? '#f4f6fa' : '#2d3748',
                                                                fontSize: '0.88rem',
                                                                borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                                wordBreak: 'break-word',
                                                            }}>{row.date}</td>
                                                            <td style={{
                                                                padding: '0.35rem 0.2rem',
                                                                color: row.bankAmount !== '' ? (darkMode ? '#60a5fa' : '#2b6cb0') : (darkMode ? '#64748b' : '#a0aec0'),
                                                                fontWeight: 500,
                                                                textAlign: 'right',
                                                                fontSize: '0.88rem',
                                                                borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                                wordBreak: 'break-word',
                                                            }}>{row.bankAmount !== '' ? `₹${row.bankAmount}` : '-'}</td>
                                                            <td style={{
                                                                padding: '0.35rem 0.2rem',
                                                                color: row.petpoojaAmount !== '' ? (darkMode ? '#34d399' : '#38a169') : (darkMode ? '#64748b' : '#a0aec0'),
                                                                fontWeight: 500,
                                                                textAlign: 'right',
                                                                fontSize: '0.88rem',
                                                                borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                                wordBreak: 'break-word',
                                                            }}>{row.petpoojaAmount !== '' ? `₹${row.petpoojaAmount}` : '-'}</td>
                                                            <td style={{
                                                                padding: '0.35rem 0.2rem',
                                                                color:
                                                                    row.status === 'Not found in Petpooja'
                                                                        ? (darkMode ? '#60a5fa' : '#2b6cb0')
                                                                        : row.status === 'Not found in Bank'
                                                                            ? (darkMode ? '#34d399' : '#38a169')
                                                                            : (darkMode ? '#f4f6fa' : '#4a5568'),
                                                                fontWeight: 600,
                                                                textAlign: 'center',
                                                                fontSize: '0.88rem',
                                                                borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                                wordBreak: 'break-word',
                                                            }}>{row.status}</td>
                                                            <td style={{
                                                                padding: '0.35rem 0.2rem',
                                                                color: darkMode ? '#f4f6fa' : '#4a5568',
                                                                fontSize: '0.88rem',
                                                                borderBottom: darkMode ? '1px solid #232946' : '1px solid #e2e8f0',
                                                                textAlign: 'left',
                                                                wordBreak: 'break-word',
                                                            }}>{row.explanation}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
            {/* Footer */}
            <footer style={{ backgroundColor: "#1a202c", color: "white", padding: "0.6rem", textAlign: "center", fontSize: '0.9rem', marginTop: "auto" }}>
                <p style={{ margin: 0 }}>&copy; 2025 Bank Cash Book Viewer</p>
            </footer>
        </div>
    );
}