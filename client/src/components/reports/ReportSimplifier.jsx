import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  ChevronRight,
  Loader2,
  Download,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  LockKeyhole,
  Zap,
  Stethoscope,
  Info,
  CircleCheck,
  Plus,
} from "lucide-react";
import { api } from "../../services/api";
import jsPDF from "jspdf";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ReportSimplifier({ language = "English" }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingToTracker, setSavingToTracker] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError("");

    if (rejectedFiles?.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection?.errors?.some((item) => item.code === "file-too-large")) {
        setError("This file is larger than 10 MB. Please choose a smaller file.");
      } else {
        setError("Please upload a PDF, PNG, JPG, or JPEG file.");
      }
      return;
    }

    if (!acceptedFiles?.length) return;

    const selectedFile = acceptedFiles[0];
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("This file is larger than 10 MB. Please choose a smaller file.");
      return;
    }

    setFile(selectedFile);
    setResult("");
    setReportData(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    noClick: true, // we handle click on browse link
  });

  const handleUpload = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");

    try {
      const resData = await api.simplifyReport(file, language);
      if (!resData) {
        throw new Error("We couldn't generate a summary from this document. Please try a clearer report.");
      }
      const summaryText = typeof resData === "string" ? resData : (resData.simplifiedText || resData.summary || "");
      if (!summaryText.trim()) {
        throw new Error("We couldn't generate a summary from this document. Please try a clearer report.");
      }
      setResult(summaryText.trim());
      setReportData(typeof resData === "object" ? resData : { summary: summaryText });
    } catch (err) {
      setResult("");
      setReportData(null);
      setError(err?.message || "Failed to process the document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = (event) => {
    event?.stopPropagation();
    if (loading) return;
    setFile(null);
    setReportData(null);
    setError("");
  };

  const handleReset = () => {
    setResult("");
    setReportData(null);
    setFile(null);
    setError("");
    setLoading(false);
    setSaveSuccess(false);
  };

  const handleAddToHealthTracker = async () => {
    if (!reportData) return;
    const conditions = reportData.conditions || [];
    const medicines = reportData.medicines || [];
    
    if (conditions.length === 0 && medicines.length === 0) {
      setError("No medical conditions or medicines were identified in this report to add.");
      return;
    }
    
    setSavingToTracker(true);
    setSaveSuccess(false);
    
    try {
      for (const condition of conditions) {
        await api.healthTracker.addHistory({
          category: 'Condition',
          title: condition,
          startDate: new Date().toISOString().split('T')[0]
        });
      }
      for (const medicine of medicines) {
        await api.healthTracker.addHistory({
          category: 'Medicine',
          title: medicine,
          startDate: new Date().toISOString().split('T')[0]
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error("Failed to add to health tracker:", err);
      setError("Failed to save to Health Tracker. Please try again.");
    } finally {
      setSavingToTracker(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result && !reportData) return;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 20;
    const contentWidth = pageWidth - marginX * 2;
    let cursorY = 20;

    const addPageIfNeeded = (requiredHeight = 6) => {
      if (cursorY + requiredHeight > pageHeight - 20) {
        doc.addPage();
        cursorY = 20;
      }
    };

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(30, 41, 59);
    doc.text("SANJEEVANI - Medical Report Summary", marginX, cursorY);
    cursorY += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Language: ${language} | Type: ${reportData?.detectedType || 'Clinical Summary'}`, marginX, cursorY);
    cursorY += 6;

    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 10;

    const printSectionHeader = (title, r = 30, g = 41, b = 59) => {
      addPageIfNeeded(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(r, g, b);
      doc.text(title, marginX, cursorY);
      cursorY += 6;
    };

    const printBodyText = (text, r = 51, g = 65, b = 85) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(r, g, b);
      const lines = doc.splitTextToSize(text, contentWidth);
      addPageIfNeeded(lines.length * 5 + 2);
      doc.text(lines, marginX, cursorY);
      cursorY += lines.length * 5 + 4;
    };

    // 1. Clinical Summary
    const summaryText = reportData?.summary || result;
    if (summaryText) {
      printSectionHeader("Clinical Summary", 37, 99, 235);
      printBodyText(summaryText);
    }

    // 2. Out-of-Range / Flagged Items
    if (reportData?.abnormalParameters?.length > 0) {
      printSectionHeader("Out-of-Range / Flagged Items", 220, 38, 38);
      reportData.abnormalParameters.forEach((item) => {
        const itemStr = typeof item === "object" ? `${item.parameter}: ${item.value} (${item.referenceRange || 'out of range'})` : item;
        printBodyText(`• ${itemStr}`, 153, 27, 27);
      });
    }

    // 3. Key Findings
    if (reportData?.keyFindings?.length > 0) {
      printSectionHeader("Key Findings", 22, 163, 74);
      reportData.keyFindings.forEach((finding) => {
        printBodyText(`• ${finding}`, 20, 83, 45);
      });
    }

    // 4. Recommendations & Next Steps
    if (reportData?.recommendations?.length > 0) {
      printSectionHeader("Recommendations & Next Steps", 2, 132, 199);
      reportData.recommendations.forEach((rec) => {
        printBodyText(`• ${rec}`, 12, 74, 110);
      });
    }

    // Fallback if structured arrays are absent
    if (!reportData?.keyFindings?.length && !reportData?.abnormalParameters?.length && result && result !== summaryText) {
      printSectionHeader("Additional Detailed Findings");
      printBodyText(result);
    }

    // Disclaimer
    cursorY += 4;
    addPageIfNeeded(20);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    const disclaimer = "Disclaimer: This AI-generated summary is for informational and educational purposes only and does not replace professional medical evaluation, diagnosis, or treatment. Always consult your healthcare provider.";
    const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth - 8);
    const boxHeight = disclaimerLines.length * 4.5 + 8;
    doc.roundedRect(marginX, cursorY, contentWidth, boxHeight, 2, 2, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(disclaimerLines, marginX + 4, cursorY + 6);

    // Footer on every page
    const totalPages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(165, 165, 165);
      doc.text(`Sanjeevani • Medical Report Summary • ${page}/${totalPages}`, marginX, pageHeight - 10);
    }
    doc.save("Sanjeevani_Medical_Report_Summary.pdf");
  };

  const renderFormattedText = (rawText) => {
    if (!rawText) return null;
    return rawText.split("\n").map((line, lineIdx) => {
      const trimmed = line.trim();
      if (!trimmed) return null; // Using padding/margin instead of <div h-2> for styling

      const isWarning = trimmed.startsWith("⚠️");
      const isDoctor = trimmed.startsWith("🩺");
      const isInsight = trimmed.startsWith("💡");
      const isPinned = trimmed.startsWith("📌");
      const isHeader = isWarning || isDoctor || isInsight || isPinned || trimmed.startsWith("###");
      const isListItem = trimmed.startsWith("•") || trimmed.startsWith("-") || /^\d+\.\s/.test(trimmed);

      const parts = line.split(/(\*\*.*?\*\*)/g);
      const parsedContent = parts.map((part, partIdx) => {
        const isBold = part.startsWith("**") && part.endsWith("**") && part.length >= 4;
        if (isBold) {
          return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
        }
        return <span key={partIdx}>{part}</span>;
      });

      if (isHeader) {
        let iconClass = "neutral";
        let IconComponent = Info;
        if (isWarning) {
          iconClass = "red";
          IconComponent = AlertTriangle;
        } else if (isDoctor) {
          iconClass = "green";
          IconComponent = Stethoscope;
        } else if (isInsight) {
          iconClass = "indigo";
          IconComponent = Sparkles;
        }
        
        return (
          <div key={lineIdx} className="report-section-heading">
            <div className={`section-icon ${iconClass}`}>
              <IconComponent size={18} />
            </div>
            <h3>{parsedContent}</h3>
          </div>
        );
      }

      if (isListItem) {
        return (
          <div key={lineIdx} className="report-list-item">
            <span className="list-bullet" />
            <div>{parsedContent}</div>
          </div>
        );
      }

      return (
        <p key={lineIdx} className="report-paragraph">
          {parsedContent}
        </p>
      );
    });
  };

  return (
    <section className="report-reader">
      {!result && (
        <header className="page-heading report-reader-header">
          <span className="section-kicker">AI MEDICAL REPORT READER</span>
          <h1>Understand your medical reports with clarity.</h1>
          <p>
            Upload a lab report, prescription, or medical scan. Sanjeevani uses AI to turn
            complex medical information into a clear and easy-to-understand explanation.
          </p>
        </header>
      )}

      {!result && (
        <div className="report-reader-upload-card">
          <div 
            {...getRootProps()} 
            className={`report-reader-dropzone ${isDragActive ? 'active' : ''}`}
            onClick={(e) => {
               // Only trigger open on click if it's the main dropzone, so button inside works
               if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                   open();
               }
            }}
          >
            <input {...getInputProps()} />
            <div className="dropzone-icon">
              <UploadCloud size={32} />
            </div>
            <h2>
              {isDragActive ? "Drop your report here" : "Upload your medical report"}
            </h2>
            <p>
              Drag & drop your file here, or{" "}
              <button type="button" className="browse-link" onClick={(e) => { e.stopPropagation(); open(); }}>
                browse from your device
              </button>
            </p>
            <div className="report-reader-formats">
              <FileText size={14} /> PDF, PNG, JPG • Max 10 MB
            </div>
          </div>

          <div className="report-reader-trust">
            <div className="trust-item">
              <div className="trust-icon green"><LockKeyhole size={16} /></div>
              <div className="trust-text">
                <b>Private & secure</b>
                <small>Your report stays protected</small>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon blue"><Zap size={16} /></div>
              <div className="trust-text">
                <b>AI powered</b>
                <small>Fast & easy explanations</small>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon amber"><ShieldCheck size={16} /></div>
              <div className="trust-text">
                <b>Simple language</b>
                <small>Made for everyone</small>
              </div>
            </div>
          </div>

          {file && (
            <div className="report-reader-file">
              <div className="file-info">
                <div className="file-icon">
                  <FileText size={20} />
                </div>
                <div className="file-details">
                  <b>{file.name}</b>
                  <small>{(file.size / 1024 / 1024).toFixed(2)} MB • Ready for analysis</small>
                </div>
                {!loading && (
                  <button type="button" className="remove-btn" onClick={handleRemoveFile}>
                    <X size={18} />
                  </button>
                )}
              </div>
              <button 
                type="button" 
                className="button primary" 
                style={{ width: "100%" }} 
                onClick={handleUpload} 
                disabled={loading}
              >
                {loading ? <Loader2 size={16} /> : <ChevronRight size={16} />}
                {loading ? "Analyzing your report..." : "Analyze Report"}
              </button>

              {loading && (
                <div className="report-reader-loading">
                  <Loader2 size={16} />
                  Reading your document and preparing a simplified explanation...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="report-reader-error" style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "12px", padding: "16px 20px", margin: "20px 0", display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: "2px", color: "#e11d48" }} />
          <div className="error-content" style={{ flex: 1 }}>
            <b style={{ color: "#9f1239", fontSize: "0.95rem" }}>
              Medical Document Validation Notice
            </b>
            <p style={{ margin: "4px 0 0 0", color: "#be123c", fontSize: "0.9rem", lineHeight: "1.5" }}>{error}</p>
          </div>
          <button type="button" onClick={() => setError("")} style={{ background: "transparent", border: 0, cursor: "pointer", color: "#9f1239" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {result && (
        <div className="report-reader-result">
          <div className="report-reader-result-header">
            <div className="result-title">
              <div className="result-meta" style={{ marginBottom: "12px", display: "inline-flex", background: "transparent", border: 0, padding: 0, color: "#2f7cc0" }}>
                <CircleCheck size={14} /> Analysis complete
              </div>
              <h1>Your simplified report</h1>
              <p>A clearer explanation of the information found in your uploaded document.</p>
            </div>
            <div className="result-meta">
              <Sparkles size={14} style={{ color: "#2f7cc0" }} />
              AI Analysis • {language}
            </div>
          </div>
          
          <div className="report-reader-result-content" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Clinical Summary */}
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "20px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "1.05rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={18} style={{ color: "#2563eb" }} /> Clinical Summary
              </h3>
              <p style={{ margin: 0, color: "#334155", lineHeight: "1.6" }}>
                {reportData?.summary || result}
              </p>
            </div>

            {/* Abnormal Parameters / Alerts */}
            {reportData?.abnormalParameters?.length > 0 && (
              <div style={{ background: "#fef2f2", borderRadius: "12px", padding: "20px", border: "1px solid #fecaca" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", color: "#991b1b", display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertTriangle size={18} style={{ color: "#dc2626" }} /> Out-of-Range / Flagged Items
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {reportData.abnormalParameters.map((item, idx) => (
                    <div key={idx} style={{ background: "#ffffff", border: "1px solid #fca5a5", color: "#991b1b", padding: "8px 14px", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                      {typeof item === "object" ? `${item.parameter}: ${item.value} (${item.referenceRange || 'out of range'})` : item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Findings */}
            {reportData?.keyFindings?.length > 0 && (
              <div style={{ background: "#f0fdf4", borderRadius: "12px", padding: "20px", border: "1px solid #bbf7d0" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", color: "#166534", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={18} style={{ color: "#16a34a" }} /> Key Findings
                </h3>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "#14532d", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {reportData.keyFindings.map((finding, idx) => (
                    <li key={idx} style={{ lineHeight: "1.5" }}>{finding}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {reportData?.recommendations?.length > 0 && (
              <div style={{ background: "#f0f9ff", borderRadius: "12px", padding: "20px", border: "1px solid #bae6fd" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", color: "#075985", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Stethoscope size={18} style={{ color: "#0284c7" }} /> Recommendations & Next Steps
                </h3>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "#0c4a6e", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {reportData.recommendations.map((rec, idx) => (
                    <li key={idx} style={{ lineHeight: "1.5" }}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fallback formatted text rendering if structured data is absent */}
            {(!reportData?.keyFindings?.length && !reportData?.abnormalParameters?.length) && renderFormattedText(result)}
          </div>
          
          <div className="report-reader-actions" style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "20px 32px 32px", justifyContent: "flex-start", alignItems: "center" }}>
            <button 
              onClick={handleDownloadPDF}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#ecfdf5", color: "#065f46", border: "1px solid #6ee7b7", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
            >
              <Download size={16} style={{ color: "#047857" }} /> Download PDF
            </button>
            <button 
              onClick={handleAddToHealthTracker}
              disabled={savingToTracker}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 mt-4"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "#2563eb", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", marginTop: 0 }}
            >
              {savingToTracker ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={16} />}
              {savingToTracker ? "Saving..." : "Add to Health Tracker"}
            </button>
            <button 
              onClick={handleReset}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#f5f5f4", color: "#44403c", border: "1px solid #d6d3d1", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "500", cursor: "pointer", transition: "all 0.2s" }}
            >
              <RotateCcw size={16} style={{ color: "#57534e" }} /> Analyze Another Document
            </button>
            {saveSuccess && (
              <span style={{ fontSize: "12px", color: "#047857", fontWeight: "500", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <CheckCircle2 size={14} /> Added to Health Tracker
              </span>
            )}
          </div>
          
          <div className="disclaimer" style={{ margin: "0 32px 32px", borderTop: "1px solid #eee9e1", paddingTop: "20px", fontSize: "11px", color: "#817b72" }}>
            Disclaimer: This AI-generated summary is for informational and educational purposes only and does not replace professional medical evaluation, diagnosis, or treatment. Always consult your healthcare provider.
          </div>
        </div>
      )}
    </section>
  );
}