import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function ExcelViewer() {
    const [bankStats, setBankStats] = useState(null);
    const [cashStats, setCashStats] = useState(null);
    const [petpoojaStats, setPetpoojaStats] = useState(null);
    const [incomeCashStats, setIncomeCashStats] = useState(null);

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
        };

        reader.readAsArrayBuffer(file);
    };

    return (
        <div>
            {/* Header */}
            <header style={{ backgroundColor: "#1a202c", color: "#ffffff", padding: "1rem", textAlign: "center" }}>
                <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>Profit and Loss Statement</h1>
            </header>

            {/* File Uploader */}
            <div style={{ textAlign: "center", margin: "1.5rem 0" }}>
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e0" }} />
            </div>

            {/* Cards Container */}
            <div className="grid-container">
                {bankStats && (
                    <div className="card">
                        <h2>Bank Book</h2>
                        <p>Total Deposits: <span>₹{bankStats.totalDeposits.toFixed(2)}</span></p>
                        <p>Total Withdrawals: <span>₹{bankStats.totalWithdrawals.toFixed(2)}</span></p>
                        <p>Profit / Loss: <span style={{ color: bankStats.profitLoss >= 0 ? 'green' : 'red' }}>₹{bankStats.profitLoss.toFixed(2)}</span></p>
                    </div>
                )}

                {cashStats && (
                    <div className="card">
                        <h2>Cash Book</h2>
                        <p>Total Cash Orders: <span>₹{cashStats.cashOrdersTotal.toFixed(2)}</span></p>
                        <p>Total Cash Spent: <span>₹{cashStats.cashSpent.toFixed(2)}</span></p>
                        <p>Difference: <span style={{ color: cashStats.cashDifference >= 0 ? 'green' : 'red' }}>₹{cashStats.cashDifference.toFixed(2)}</span></p>
                    </div>
                )}

                {petpoojaStats && (
                    <div className="card">
                        <h2>Petpooja Payments</h2>
                        <p>Petpooja Order Total: <span>₹{petpoojaStats.petpoojaOrdersTotal.toFixed(2)}</span></p>
                        <p>Total Paid from Bank: <span>₹{petpoojaStats.bankSpent.toFixed(2)}</span></p>
                        <p>Difference: <span style={{ color: petpoojaStats.petpoojaDifference >= 0 ? 'green' : 'red' }}>₹{petpoojaStats.petpoojaDifference.toFixed(2)}</span></p>
                    </div>
                )}

                {incomeCashStats && (
                    <div className="card">
                        <h2>Income in Cash</h2>
                        <p>Total Cash Income: <span>₹{incomeCashStats.incomeCashTotal.toFixed(2)}</span></p>
                        <p>Total Cash Spent: <span>₹{incomeCashStats.totalCashSpent.toFixed(2)}</span></p>
                        <p>Difference: <span style={{ color: incomeCashStats.incomeCashDifference >= 0 ? 'green' : 'red' }}>₹{incomeCashStats.incomeCashDifference.toFixed(2)}</span></p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer style={{ backgroundColor: "#1a202c", color: "white", padding: "1rem", textAlign: "center", marginTop: "2rem" }}>
                <p>&copy; 2025 Bank Cash Book Viewer</p>
            </footer>
        </div>
    );
}