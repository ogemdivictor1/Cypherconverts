
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileUp, 
  History, 
  Settings, 
  Zap, 
  ArrowRightLeft, 
  Download, 
  Copy, 
  Check, 
  AlertCircle,
  FileText,
  Code,
  Image as ImageIcon,
  Database,
  Trash2,
  Maximize2,
  FileBadge,
  Table,
  Sun,
  Moon,
  Save,
  DownloadCloud,
  FileJson
} from 'lucide-react';
import { FORMATS, ConversionHistoryItem, FormatOption } from './types';
import { performConversion, detectFormat } from './services/geminiService';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('cypher-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<string>('auto');
  const [targetFormat, setTargetFormat] = useState<string>('json');
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isBinaryResult, setIsBinaryResult] = useState(false);
  const [history, setHistory] = useState<ConversionHistoryItem[]>(() => {
    const savedHistory = localStorage.getItem('cypher-history');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'convert' | 'history'>('convert');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence and effect for theme
  useEffect(() => {
    localStorage.setItem('cypher-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('cypher-history', JSON.stringify(history));
  }, [history]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setIsBinaryResult(false);
      setError(null);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        setFileContent(text);
        if (sourceFormat === 'auto') {
          const detected = await detectFormat(text);
          setSourceFormat(detected);
        }
      };
      
      if (selectedFile.type.startsWith('image/')) {
        setFileContent('IMAGE_DATA');
        setSourceFormat(selectedFile.type.split('/')[1] || 'image');
      } else if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFileContent('PDF_DATA'); 
        setSourceFormat('pdf');
      } else {
        reader.readAsText(selectedFile);
      }
    }
  };

  const generatePDF = (text: string): string => {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(text, 180);
    doc.text(splitText, 10, 10);
    return doc.output('datauristring');
  };

  const generateDOCX = async (text: string): Promise<string> => {
    const docObj = new docx.Document({
      sections: [{
        properties: {},
        children: text.split('\n').map(line => new docx.Paragraph({
          children: [new docx.TextRun(line)],
        })),
      }],
    });
    const blob = await docx.Packer.toBlob(docObj);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const generateXLSX = (text: string): string => {
    let data: any[][] = [];
    try {
      data = text.split('\n').map(line => line.split(','));
    } catch {
      data = [[text]];
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ConvertedData");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`;
  };

  const startConversion = async () => {
    if (!fileContent && !file) return;
    setConverting(true);
    setError(null);

    const conversionId = Math.random().toString(36).substr(2, 9);
    const newHistoryItem: ConversionHistoryItem = {
      id: conversionId,
      timestamp: Date.now(),
      fileName: file?.name || 'Unknown',
      sourceFormat: sourceFormat === 'auto' ? 'Detected' : sourceFormat,
      targetFormat,
      status: 'pending'
    };

    setHistory(prev => [newHistoryItem, ...prev]);

    try {
      let finalResult = '';
      let isBinary = false;

      if (file?.type.startsWith('image/')) {
        finalResult = await convertImage(file, targetFormat);
        isBinary = true;
      } else {
        const intermediateTarget = ['pdf', 'docx', 'xlsx'].includes(targetFormat) ? 'markdown' : targetFormat;
        
        let textResult = await performConversion(
          fileContent,
          sourceFormat,
          intermediateTarget,
          'text'
        );

        if (targetFormat === 'pdf') {
          finalResult = generatePDF(textResult);
          isBinary = true;
        } else if (targetFormat === 'docx') {
          finalResult = await generateDOCX(textResult);
          isBinary = true;
        } else if (targetFormat === 'xlsx') {
          finalResult = generateXLSX(textResult);
          isBinary = true;
        } else {
          finalResult = textResult;
          isBinary = false;
        }
      }

      setResult(finalResult);
      setIsBinaryResult(isBinary);
      setHistory(prev => prev.map(item => 
        item.id === conversionId 
          ? { ...item, status: 'completed', result: finalResult, isBinary } 
          : item
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transformation failed.';
      setError(msg);
      setHistory(prev => prev.map(item => 
        item.id === conversionId 
          ? { ...item, status: 'failed' } 
          : item
      ));
    } finally {
      setConverting(false);
    }
  };

  const convertImage = (file: File, target: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const mime = `image/${target === 'jpg' ? 'jpeg' : target}`;
        resolve(canvas.toDataURL(mime));
      };
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = URL.createObjectURL(file);
    });
  };

  const copyToClipboard = () => {
    if (result && !isBinaryResult) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadResult = (specificResult?: string, specificFormat?: string) => {
    const dataToDownload = specificResult || result;
    const format = specificFormat || targetFormat;
    
    if (!dataToDownload) return;

    let url = dataToDownload;
    let isTempBlob = false;

    if (!dataToDownload.startsWith('data:')) {
      const blob = new Blob([dataToDownload], { type: 'text/plain' });
      url = URL.createObjectURL(blob);
      isTempBlob = true;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `cypher-converted-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (isTempBlob) {
      URL.revokeObjectURL(url);
    }
  };

  const exportHistoryJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "cypher_history_archive.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const clearAll = () => {
    setFile(null);
    setFileContent('');
    setResult(null);
    setIsBinaryResult(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const flushHistory = () => {
    setHistory([]);
    localStorage.removeItem('cypher-history');
    setShowClearConfirm(false);
  };

  const getFormatIcon = (format: string) => {
    if (['pdf', 'docx'].includes(format)) return <FileBadge className="w-12 h-12 text-red-400" />;
    if (['xlsx', 'csv'].includes(format)) return <Table className="w-12 h-12 text-green-400" />;
    if (['png', 'jpeg', 'webp'].includes(format)) return <ImageIcon className="w-12 h-12 text-blue-400" />;
    return <Code className="w-12 h-12 text-purple-400" />;
  };

  return (
    <div className={`min-h-screen flex flex-col items-center p-4 md:p-8 transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] transition-colors duration-1000 ${theme === 'dark' ? 'bg-blue-600/10' : 'bg-blue-400/20'}`}></div>
        <div className={`absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[120px] transition-colors duration-1000 ${theme === 'dark' ? 'bg-purple-600/10' : 'bg-purple-400/20'}`}></div>
      </div>

      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2 cypher-gradient rounded-xl shadow-lg">
            <Zap className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold cypher-text-gradient tracking-tight">CYPHER CONVERTS</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-white text-slate-700 shadow-md hover:bg-slate-50'}`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <nav className={`glass flex p-1 rounded-full ${theme === 'dark' ? 'bg-slate-900/70 border-white/5' : 'bg-white/80 border-slate-200 shadow-sm'}`}>
            <button 
              onClick={() => setActiveTab('convert')}
              className={`px-4 py-1.5 rounded-full transition-all text-sm font-medium ${activeTab === 'convert' ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-900') : (theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900')}`}
            >
              Converter
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-full transition-all text-sm font-medium ${activeTab === 'history' ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-900') : (theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900')}`}
            >
              History
            </button>
          </nav>
        </div>
      </header>

      {activeTab === 'convert' ? (
        <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className={`glass p-6 rounded-3xl space-y-6 shadow-2xl ${theme === 'dark' ? 'bg-slate-900/70 border-white/5' : 'bg-white/90 border-slate-200'}`}>
              <div className="flex justify-between items-center">
                <h2 className={`text-lg font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                  <FileUp className="w-5 h-5 text-blue-500" /> Source File
                </h2>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                  <Save className="w-3 h-3" /> Auto-Save Vault Active
                </div>
              </div>
              
              <div 
                className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${file ? 'border-blue-500/50 bg-blue-500/5' : (theme === 'dark' ? 'border-slate-700 hover:border-slate-500 bg-slate-800/20' : 'border-slate-300 hover:border-blue-400 bg-slate-50')}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                
                {file ? (
                  <div className="text-center">
                    <div className="p-3 bg-blue-500/20 rounded-2xl mb-3 inline-block">
                      {file.type.startsWith('image/') ? <ImageIcon className="w-8 h-8 text-blue-500" /> : <FileText className="w-8 h-8 text-blue-500" />}
                    </div>
                    <p className={`font-medium truncate max-w-[200px] ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{file.name}</p>
                    <p className={`text-xs mt-1 uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>{(file.size / 1024).toFixed(1)} KB • {sourceFormat}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearAll(); }}
                      className="mt-4 text-xs text-red-500 hover:underline flex items-center gap-1 mx-auto"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={`p-4 rounded-full mb-4 ${theme === 'dark' ? 'bg-slate-700/30' : 'bg-slate-200'}`}>
                      <FileUp className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                    </div>
                    <p className={`text-sm text-center ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span className="text-blue-500 font-medium">Select file</span> to begin<br/>
                      <span className="text-xs opacity-60 uppercase tracking-tighter">PDF, Word, Code, CSV, JSON, Images</span>
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className={`text-xs font-medium mb-1.5 block uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Source</label>
                    <select 
                      value={sourceFormat}
                      onChange={(e) => setSourceFormat(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}
                    >
                      <option value="auto">Auto-Detect</option>
                      {FORMATS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-5">
                    <ArrowRightLeft className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1">
                    <label className={`text-xs font-medium mb-1.5 block uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Target</label>
                    <select 
                      value={targetFormat}
                      onChange={(e) => setTargetFormat(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${theme === 'dark' ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}
                    >
                      {FORMATS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button 
                  onClick={startConversion}
                  disabled={!file || converting}
                  className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-xl ${!file || converting ? (theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-400') : 'cypher-gradient text-white hover:opacity-90 active:scale-[0.98] glow'}`}
                >
                  {converting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      CONVERTING...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      INITIATE TRANSFORMATION
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            <div className={`glass h-full min-h-[550px] rounded-3xl flex flex-col shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-slate-900/70 border-white/5' : 'bg-white/90 border-slate-200'}`}>
              <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${result ? 'bg-green-500' : 'bg-slate-400 animate-pulse'}`}></div>
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Transformation Result</span>
                </div>
                {result && (
                  <div className="flex items-center gap-2">
                    {!isBinaryResult && (
                      <button 
                        onClick={copyToClipboard}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${theme === 'dark' ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'}`}
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}
                    <button 
                      onClick={() => downloadResult()}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-500 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                    >
                      <Download className="w-4 h-4" />
                      Download {targetFormat.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 relative p-6 mono text-sm overflow-auto">
                {result ? (
                  isBinaryResult ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-6">
                      <div className={`p-10 rounded-full shadow-inner border relative group transition-all duration-500 ${theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {getFormatIcon(targetFormat)}
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Binary Transcoded Successfully</h3>
                        <p className={`max-w-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>The transformation process has materialized the target file into a binary stream and saved it to history.</p>
                      </div>
                      <button 
                        onClick={() => downloadResult()}
                        className={`px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2 shadow-2xl ${theme === 'dark' ? 'bg-white text-slate-900 hover:bg-blue-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                      >
                        <Download className="w-5 h-5" /> Download Now
                      </button>
                      
                      {result.startsWith('data:image') && (
                        <div className={`mt-8 border p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-slate-950/50 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <img src={result} alt="Preview" className="max-w-[300px] max-h-[200px] object-contain rounded-lg" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <pre className={`whitespace-pre-wrap flex-1 break-all selection:bg-blue-500/30 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {result}
                      </pre>
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-end">
                         <button 
                            onClick={() => downloadResult()}
                            className="px-6 py-2 cypher-gradient text-white rounded-full font-bold shadow-lg hover:opacity-90 flex items-center gap-2 text-sm"
                          >
                            <Download className="w-4 h-4" /> Save as {targetFormat.toUpperCase()}
                          </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center space-y-4">
                    <div className={`p-4 rounded-full border ${theme === 'dark' ? 'border-slate-700/50 text-slate-700' : 'border-slate-200 text-slate-300'}`}>
                      <Database className="w-12 h-12" />
                    </div>
                    <p className={`text-center max-w-[280px] font-medium tracking-tight ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                      Awaiting transformation input...<br/>
                      Ready for universal conversion.
                    </p>
                  </div>
                )}
                
                {converting && (
                  <div className={`absolute inset-0 backdrop-blur-[4px] flex items-center justify-center z-10 ${theme === 'dark' ? 'bg-slate-950/60' : 'bg-white/60'}`}>
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Zap className="w-6 h-6 text-blue-500 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-blue-500 font-bold block mb-1">RECODING BYTES...</span>
                        <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Quantum Engine Engaged</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`glass rounded-3xl overflow-hidden shadow-2xl ${theme === 'dark' ? 'bg-slate-900/70 border-white/5' : 'bg-white border-slate-200'}`}>
            <div className={`p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
              <div>
                <h2 className={`text-xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                  <History className="text-blue-500" /> Transaction Logs
                </h2>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Persisted in local vault</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportHistoryJSON}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  <FileJson className="w-4 h-4" /> Export Archive
                </button>
                {showClearConfirm ? (
                  <div className="flex items-center gap-2 animate-in zoom-in duration-200">
                    <button 
                      onClick={flushHistory}
                      className="text-xs bg-red-500/20 text-red-500 px-3 py-2 rounded-lg font-bold hover:bg-red-500/30"
                    >
                      Confirm Flush
                    </button>
                    <button 
                      onClick={() => setShowClearConfirm(false)}
                      className="text-xs text-slate-500 px-2 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs text-slate-500 hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
                  >
                    Flush Logs
                  </button>
                )}
              </div>
            </div>
            
            <div className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-slate-200'}`}>
              {history.length > 0 ? (
                history.map((item) => (
                  <div key={item.id} className={`p-6 transition-colors group ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl shrink-0 ${item.status === 'completed' ? 'bg-green-500/10 text-green-500' : item.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-500'}`}>
                          {item.status === 'completed' ? <Check className="w-5 h-5" /> : item.status === 'failed' ? <AlertCircle className="w-5 h-5" /> : <Zap className="w-5 h-5 animate-pulse" />}
                        </div>
                        <div>
                          <p className={`font-bold truncate max-w-[200px] sm:max-w-xs ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{item.fileName}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-widest">
                            <span className={`px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>{item.sourceFormat}</span>
                            <ArrowRightLeft className="w-3 h-3 opacity-50" />
                            <span className={`px-2 py-0.5 rounded text-blue-500 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>{item.targetFormat}</span>
                            <span className="opacity-30 mx-1">•</span>
                            <span>{new Date(item.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'completed' && item.result && (
                          <>
                            <button 
                              onClick={() => downloadResult(item.result, item.targetFormat)}
                              className={`p-2 transition-all rounded-lg ${theme === 'dark' ? 'hover:bg-green-500/20 text-slate-400 hover:text-green-400' : 'hover:bg-green-50 text-slate-400 hover:text-green-600'}`}
                              title="Download Directly"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                if (item.result) {
                                  setResult(item.result);
                                  setIsBinaryResult(!!item.isBinary);
                                  setTargetFormat(item.targetFormat);
                                  setActiveTab('convert');
                                }
                              }}
                              className={`p-2 transition-all rounded-lg ${theme === 'dark' ? 'hover:bg-blue-500/20 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-slate-400 hover:text-blue-500'}`}
                              title="Restore View"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ml-2 ${item.status === 'completed' ? 'bg-green-500/20 text-green-500' : item.status === 'failed' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-20 flex flex-col items-center text-slate-400">
                  <Database className="w-16 h-16 mb-4 opacity-10" />
                  <p className="text-lg">No transactions logged.</p>
                  <p className="text-sm opacity-60">Your transformation history will materialize here and persist across sessions.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Footer info */}
      <footer className={`w-full max-w-5xl mt-auto py-12 text-center border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-200'}`}>
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2 hover:text-blue-500 transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] ${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}></div>
            Gemini Quantum Core
          </div>
          <div className="flex items-center gap-2 hover:text-purple-500 transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)] ${theme === 'dark' ? 'bg-purple-600' : 'bg-purple-500'}`}></div>
            Universal Buffer Protocol
          </div>
          <div className="flex items-center gap-2 hover:text-green-500 transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] ${theme === 'dark' ? 'bg-green-600' : 'bg-green-500'}`}></div>
            Auto-Vault Persistence
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
