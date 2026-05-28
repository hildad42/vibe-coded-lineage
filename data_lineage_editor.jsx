import React, { useState, useRef, useEffect } from 'react';
import { 
  Database, Plus, Trash2, Settings2, Download, Upload, 
  X, GripHorizontal, Link2, Palette, RefreshCw, ZoomIn, ZoomOut, Home,
  FileJson, FileText, FileCode2, Menu, PanelLeftClose, Info, ClipboardPaste
} from 'lucide-react';

// --- Color & Rank Definitions ---
const RANK_COLORS = [
  { name: 'Iron', hex: '#a19d94' },
  { name: 'Copper', hex: '#b87333' },
  { name: 'Steel', hex: '#b0c4de' },
  { name: 'Bronze', hex: '#cd7f32' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'Gold', hex: '#ffd700' },
  { name: 'Platinum', hex: '#e5e4e2' },
  { name: 'Jade', hex: '#00a86b' },
  { name: 'Diamond', hex: '#b9f2ff' },
  { name: 'Onyx', hex: '#353839' }
];

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
  return color;
};

const getContrastText = (hex) => {
  if (!hex || hex.length !== 7) return '#1e293b'; 
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#1e293b' : '#ffffff';
};

// --- Default Data ---
const initialTables = [
  {
    id: 't1', name: 'raw_users', x: 50, y: 100, color: RANK_COLORS[4].hex,
    columns: [
      { id: 'c1', name: 'id', type: 'INT', description: 'Primary unique identifier' },
      { id: 'c2', name: 'full_name', type: 'VARCHAR', description: 'User full name from source' },
      { id: 'c3', name: 'date_of_birth', type: 'DATE', description: '' }
    ]
  },
  {
    id: 't2', name: 'dim_users', x: 450, y: 100, color: RANK_COLORS[5].hex,
    columns: [
      { id: 'c4', name: 'user_sk', type: 'INT', description: 'Surrogate key' },
      { id: 'c5', name: 'first_name', type: 'VARCHAR', description: '' },
      { id: 'c6', name: 'last_name', type: 'VARCHAR', description: '' },
      { id: 'c7', name: 'age', type: 'INT', description: 'Calculated age' }
    ]
  }
];

const initialConnections = [
  { id: 'conn1', sourceTable: 't1', sourceCol: 'c1', targetTable: 't2', targetCol: 'c4', info: 'Direct map' },
  { id: 'conn2', sourceTable: 't1', sourceCol: 'c2', targetTable: 't2', targetCol: 'c5', info: "SPLIT_PART(full_name, ' ', 1)" },
  { id: 'conn3', sourceTable: 't1', sourceCol: 'c2', targetTable: 't2', targetCol: 'c6', info: "SPLIT_PART(full_name, ' ', 2)" }
];

const TABLE_WIDTH = 280;
const HEADER_HEIGHT = 44; 
const COL_HEIGHT = 44; 
const PADDING_TOP = 8;    

const generateCurvePath = (x1, y1, x2, y2) => {
  const dx = Math.abs(x2 - x1);
  const cpOffset = Math.max(dx / 2, 50); 
  return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`;
};

export default function LineageApp() {
  const [tables, setTables] = useState(initialTables);
  const [connections, setConnections] = useState(initialConnections);
  
  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Viewport State (Zoom & Pan)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const wrapperRef = useRef(null);
  const pinchRef = useRef({ dist: null, center: null });
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Interaction State
  const [draggingTable, setDraggingTable] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState(null); 
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // UI State
  const [hoveredConnection, setHoveredConnection] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [editingTable, setEditingTable] = useState(null);
  const [editingConnection, setEditingConnection] = useState(null);
  
  // Bulk Paste State
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');

  // Hidden file inputs
  const jsonImportRef = useRef(null);
  const csvImportRef = useRef(null);
  const yamlImportRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.jsyaml) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Window resize handler for sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Strict DOM Event Prevention for Mobile Canvas
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const preventNativeAction = (e) => {
      // Allow scrolling if we are editing a table or connection (inside a modal)
      if (editingTable || editingConnection) return;
      e.preventDefault();
    };
    el.addEventListener('touchmove', preventNativeAction, { passive: false });
    el.addEventListener('wheel', preventNativeAction, { passive: false });
    
    return () => {
      el.removeEventListener('touchmove', preventNativeAction);
      el.removeEventListener('wheel', preventNativeAction);
    };
  }, [editingTable, editingConnection]);

  const getClientCoords = (e) => {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX || 0, y: e.clientY || 0 };
  };

  const toCanvasCoords = (clientX, clientY) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale
    };
  };

  // --- Zoom Engine ---
  const doZoom = (factor, originX = null, originY = null) => {
    setViewport(prev => {
      const newScale = Math.max(0.01, Math.min(prev.scale * factor, 100));
      const actualFactor = newScale / prev.scale;

      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return prev;

      const cX = originX !== null ? originX : rect.width / 2;
      const cY = originY !== null ? originY : rect.height / 2;

      return {
        x: cX - (cX - prev.x) * actualFactor,
        y: cY - (cY - prev.y) * actualFactor,
        scale: newScale
      };
    });
  };

  const handleWheelReact = (e) => {
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const factor = 1 + delta;
    const rect = wrapperRef.current.getBoundingClientRect();
    doZoom(factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  // --- Handlers ---
  const handleCanvasDragStart = (e) => {
    if (e.target.closest('.table-node') || e.target.closest('.connection-line') || e.touches?.length > 1) return;
    const coords = getClientCoords(e);
    setIsPanningCanvas(true);
    setPanOffset({ x: coords.x - viewport.x, y: coords.y - viewport.y });
  };

  const handleTableDragStart = (e, table) => {
    e.stopPropagation();
    if (e.touches?.length > 1) return; 
    const coords = getClientCoords(e);
    const canvasCoords = toCanvasCoords(coords.x, coords.y);
    setDragOffset({ x: canvasCoords.x - table.x, y: canvasCoords.y - table.y });
    setDraggingTable(table.id);
  };

  const handleConnectionStart = (e, tableId, colId) => {
    e.stopPropagation();
    setConnectingFrom({ tableId, colId });
    const coords = getClientCoords(e);
    setMousePos(toCanvasCoords(coords.x, coords.y));
  };

  const handleGlobalMove = (e) => {
    if (e.touches && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

      if (pinchRef.current.dist > 0 && dist > 0) {
        const factor = dist / pinchRef.current.dist;
        
        setViewport(prev => {
          const newScale = Math.max(0.01, Math.min(prev.scale * factor, 100));
          const actualFactor = newScale / prev.scale;
          
          const rect = wrapperRef.current.getBoundingClientRect();
          const cX = center.x - rect.left;
          const cY = center.y - rect.top;

          return { 
            x: cX - (cX - prev.x) * actualFactor + (center.x - pinchRef.current.center.x), 
            y: cY - (cY - prev.y) * actualFactor + (center.y - pinchRef.current.center.y), 
            scale: newScale 
          };
        });
      }
      pinchRef.current = { dist, center };
      return;
    }

    const coords = getClientCoords(e);

    if (isPanningCanvas) {
      setViewport(prev => ({ ...prev, x: coords.x - panOffset.x, y: coords.y - panOffset.y }));
      return;
    }

    if (!draggingTable && !connectingFrom && !hoveredConnection) return;
    const canvasCoords = toCanvasCoords(coords.x, coords.y);
    setMousePos(canvasCoords);

    if (draggingTable) {
      setTables(prev => prev.map(t => 
        t.id === draggingTable ? { ...t, x: canvasCoords.x - dragOffset.x, y: canvasCoords.y - dragOffset.y } : t
      ));
    }
    
    if (hoveredConnection && !e.touches) {
      setHoverPos({ x: coords.x, y: coords.y }); 
    }
  };

  const handleGlobalEnd = (e) => {
    pinchRef.current = { dist: null, center: null };
    if (isPanningCanvas) setIsPanningCanvas(false);
    if (draggingTable) setDraggingTable(null);
    
    if (connectingFrom) {
      const coords = getClientCoords(e);
      const targetElement = document.elementFromPoint(coords.x, coords.y);
      if (targetElement) {
        const inputPort = targetElement.closest('.input-port');
        if (inputPort) {
          const targetTableId = inputPort.getAttribute('data-table-id');
          const targetColId = inputPort.getAttribute('data-col-id');
          
          if (connectingFrom.colId !== targetColId) {
            const exists = connections.some(c => c.sourceCol === connectingFrom.colId && c.targetCol === targetColId);
            if (!exists) {
              const newConnection = {
                id: `c_${Date.now()}`,
                sourceTable: connectingFrom.tableId, sourceCol: connectingFrom.colId,
                targetTable: targetTableId, targetCol: targetColId,
                info: 'New transformation logic...'
              };
              setConnections(prev => [...prev, newConnection]);
              setEditingConnection(newConnection);
            }
          }
        }
      }
      setConnectingFrom(null);
    }
  };

  // --- Toolbar Actions ---
  const addTable = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const centerX = rect ? (rect.width / 2 - viewport.x) / viewport.scale - (TABLE_WIDTH / 2) : 50;
    const centerY = rect ? (rect.height / 2 - viewport.y) / viewport.scale : 50;
    
    if (isMobile) setIsSidebarOpen(false);

    const newTable = {
      id: `t_${Date.now()}`, name: 'new_table', x: centerX, y: centerY, color: getRandomColor(),
      columns: [{ id: `col_${Date.now()}`, name: 'id', type: 'INT', description: '' }]
    };
    setTables([...tables, newTable]);
    setEditingTable(newTable);
  };

  const handleBulkPaste = () => {
    if (!bulkPasteText.trim()) return;
    const lines = bulkPasteText.split('\n');
    const newCols = lines.map(line => {
      // Split by tab or comma (handles Excel/Sheets pastes cleanly)
      const parts = line.split(/[\t,]/);
      if (!parts[0] || !parts[0].trim()) return null;
      return {
        id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: parts[0].trim(),
        type: (parts[1] || 'VARCHAR').trim().toUpperCase(),
        description: (parts[2] || '').trim()
      };
    }).filter(Boolean);

    setEditingTable(prev => ({ ...prev, columns: [...prev.columns, ...newCols] }));
    setShowBulkPaste(false);
    setBulkPasteText('');
  };

  // --- Import / Export Engines ---
  const triggerDownload = (dataStr, filename) => {
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = filename;
    a.click();
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tables, connections }, null, 2));
    triggerDownload(dataStr, "data_lineage.json");
  };

  const exportYAML = () => {
    if (!window.jsyaml) return alert("YAML parser is still loading, please try again in a moment.");
    const dataStr = "data:text/yaml;charset=utf-8," + encodeURIComponent(window.jsyaml.dump({ tables, connections }));
    triggerDownload(dataStr, "data_lineage.yaml");
  };

  const exportCSV = () => {
    const rows = [["RowType", "TableID", "TableName", "TableColor", "X", "Y", "ColID", "ColName", "ColType", "ConnID", "SourceColID", "TargetTableID", "TargetColID", "Logic", "ColDescription"].join(",")];
    tables.forEach(t => {
      rows.push(["TABLE", t.id, t.name, t.color || '', t.x, t.y, "", "", "", "", "", "", "", "", ""].join(","));
      t.columns.forEach(c => {
        const desc = `"${(c.description || '').replace(/"/g, '""')}"`;
        rows.push(["COLUMN", t.id, "", "", "", "", c.id, c.name, c.type, "", "", "", "", "", desc].join(","));
      });
    });
    connections.forEach(c => {
      const escapedLogic = `"${(c.info || '').replace(/"/g, '""')}"`; 
      rows.push(["CONNECTION", c.sourceTable, "", "", "", "", "", "", "", c.id, c.sourceCol, c.targetTable, c.targetCol, escapedLogic, ""].join(","));
    });
    triggerDownload("data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n")), "data_lineage.csv");
  };

  const splitCSVLines = (csv) => {
    const lines = []; let curLine = ''; let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
        if (csv[i] === '"') inQuotes = !inQuotes;
        if (csv[i] === '\n' && !inQuotes) { lines.push(curLine); curLine = ''; } 
        else { curLine += csv[i]; }
    }
    if (curLine) lines.push(curLine);
    return lines;
  };

  const parseCSVRow = (str) => {
    const result = []; let cur = ''; let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '"') { if (inQuotes && str[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; } } 
        else if (str[i] === ',' && !inQuotes) { result.push(cur); cur = ''; } 
        else { cur += str[i]; }
    }
    result.push(cur);
    return result;
  };

  const handleImport = (e, format) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target.result.trim();
        let parsedTables = [];
        let parsedConnections = [];

        if (format === 'json') {
          const data = JSON.parse(text);
          parsedTables = data.tables; parsedConnections = data.connections;
        } else if (format === 'yaml') {
          const data = window.jsyaml.load(text);
          parsedTables = data.tables; parsedConnections = data.connections;
        } else if (format === 'csv') {
          const lines = splitCSVLines(text);
          for (let i = 1; i < lines.length; i++) { 
            if (!lines[i].trim()) continue;
            const row = parseCSVRow(lines[i]);
            const type = row[0];
            if (type === "TABLE") {
              parsedTables.push({ id: row[1], name: row[2], color: row[3], x: parseFloat(row[4]), y: parseFloat(row[5]), columns: [] });
            } else if (type === "COLUMN") {
              const table = parsedTables.find(t => t.id === row[1]);
              if (table) table.columns.push({ id: row[6], name: row[7], type: row[8], description: row[14] || '' });
            } else if (type === "CONNECTION") {
              parsedConnections.push({ id: row[9], sourceTable: row[1], sourceCol: row[10], targetTable: row[11], targetCol: row[12], info: row[13] });
            }
          }
        }

        if (parsedTables && parsedConnections) {
          setTables(parsedTables);
          setConnections(parsedConnections);
          setViewport({ x: 0, y: 0, scale: 1 }); 
          if (isMobile) setIsSidebarOpen(false);
        } else { throw new Error("Invalid structure"); }

      } catch (err) { alert("Failed to parse file. " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = null; 
  };

  const getOutputNodePos = (table, colId) => {
    const colIndex = table.columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return null;
    return { x: table.x + TABLE_WIDTH, y: table.y + HEADER_HEIGHT + PADDING_TOP + (colIndex * COL_HEIGHT) + (COL_HEIGHT / 2) };
  };

  const getInputNodePos = (table, colId) => {
    const colIndex = table.columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return null;
    return { x: table.x, y: table.y + HEADER_HEIGHT + PADDING_TOP + (colIndex * COL_HEIGHT) + (COL_HEIGHT / 2) };
  };

  const validConnections = connections.filter(conn => {
    const srcTable = tables.find(t => t.id === conn.sourceTable);
    const tgtTable = tables.find(t => t.id === conn.targetTable);
    return srcTable && tgtTable && srcTable.columns.some(c => c.id === conn.sourceCol) && tgtTable.columns.some(c => c.id === conn.targetCol);
  });

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden overscroll-none">
      
      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- Sidebar Navigation Panel --- */}
      <div 
        className={`absolute md:relative z-40 h-full bg-white border-r border-slate-200 shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out flex flex-col w-64 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'}`}
      >
        <div className="flex-1 flex flex-col overflow-y-auto w-full">
          {/* Sidebar Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center space-x-2 text-indigo-600">
              <Database className="w-5 h-5" />
              <span className="font-bold text-slate-800">Lineage Map</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 text-slate-500 hover:bg-slate-200 rounded">
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Actions Group */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Actions</div>
              <div className="space-y-1">
                <button onClick={addTable} className="w-full flex items-center px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition text-sm font-medium">
                  <Plus className="w-4 h-4 mr-2" /> Add New Table
                </button>
                <button onClick={() => {if (window.confirm("Clear entire canvas?")) { setTables([]); setConnections([]); }}} className="w-full flex items-center px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm font-medium">
                  <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Clear Canvas
                </button>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Export Group */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Export Data</div>
              <div className="space-y-1">
                <button onClick={exportCSV} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded transition text-sm text-left">
                  <Download className="w-4 h-4 mr-2 text-emerald-500" /> CSV Format
                </button>
                <button onClick={exportJSON} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded transition text-sm text-left">
                  <Download className="w-4 h-4 mr-2 text-blue-500" /> JSON Format
                </button>
                <button onClick={exportYAML} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded transition text-sm text-left">
                  <Download className="w-4 h-4 mr-2 text-purple-500" /> YAML Format
                </button>
              </div>
            </div>
            
            <hr className="border-slate-200" />

            {/* Import Group */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Import Data</div>
              <div className="space-y-1">
                <button onClick={() => csvImportRef.current.click()} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-slate-100 rounded transition text-sm text-left">
                  <Upload className="w-4 h-4 mr-2 text-slate-400" /> Import CSV
                </button>
                <button onClick={() => jsonImportRef.current.click()} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-slate-100 rounded transition text-sm text-left">
                  <Upload className="w-4 h-4 mr-2 text-slate-400" /> Import JSON
                </button>
                <button onClick={() => yamlImportRef.current.click()} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-slate-100 rounded transition text-sm text-left">
                  <Upload className="w-4 h-4 mr-2 text-slate-400" /> Import YAML
                </button>
                
                <input type="file" ref={csvImportRef} accept=".csv" className="hidden" onChange={(e) => handleImport(e, 'csv')} />
                <input type="file" ref={jsonImportRef} accept=".json" className="hidden" onChange={(e) => handleImport(e, 'json')} />
                <input type="file" ref={yamlImportRef} accept=".yml,.yaml" className="hidden" onChange={(e) => handleImport(e, 'yaml')} />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- Main Workspace Area --- */}
      <div className="flex-1 flex flex-col relative w-full h-full min-w-0">
        
        {/* Workspace Header Layer */}
        <div className="absolute top-0 left-0 right-0 h-14 bg-white/70 backdrop-blur border-b border-slate-200 flex items-center px-3 z-20 pointer-events-none">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className={`p-2 text-slate-600 hover:bg-slate-200 rounded pointer-events-auto transition ${isSidebarOpen && !isMobile ? 'opacity-0 invisible' : 'opacity-100'}`}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex-1"></div>
          
          <div className="text-xs font-mono text-slate-500 mr-2 bg-white/80 border border-slate-200 px-2 py-1 rounded shadow-sm">
             {tables.length} Tables | {validConnections.length} Links
          </div>
        </div>

        {/* --- Infinite Canvas --- */}
        <div 
          ref={wrapperRef}
          className={`flex-1 relative bg-slate-50 touch-none overflow-hidden select-none ${isPanningCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
            backgroundSize: `${Math.max(20 * viewport.scale, 4)}px ${Math.max(20 * viewport.scale, 4)}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }}
          onWheel={handleWheelReact}
          onMouseDown={handleCanvasDragStart}
          onTouchStart={handleCanvasDragStart}
          onMouseMove={handleGlobalMove}
          onTouchMove={handleGlobalMove}
          onMouseUp={handleGlobalEnd}
          onTouchEnd={handleGlobalEnd}
          onMouseLeave={handleGlobalEnd}
        >
          {/* Scaled & Translated Layer */}
          <div 
            className="absolute inset-0 pointer-events-none origin-top-left"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
          >
            {/* SVG Lines Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0, overflow: 'visible' }}>
              {connectingFrom && (() => {
                const sourceTable = tables.find(t => t.id === connectingFrom.tableId);
                const startPos = getOutputNodePos(sourceTable, connectingFrom.colId);
                if (!startPos) return null;
                return (
                  <path
                    d={generateCurvePath(startPos.x, startPos.y, mousePos.x, mousePos.y)}
                    fill="none" stroke="#6366f1" strokeWidth={3 / viewport.scale} strokeDasharray="5,5"
                    className="opacity-70 animate-pulse pointer-events-none"
                  />
                );
              })()}

              {validConnections.map(conn => {
                const source = tables.find(t => t.id === conn.sourceTable);
                const target = tables.find(t => t.id === conn.targetTable);
                const start = getOutputNodePos(source, conn.sourceCol);
                const end = getInputNodePos(target, conn.targetCol);
                if (!start || !end) return null;

                const isHovered = hoveredConnection === conn.id;

                return (
                  <g key={conn.id} className="pointer-events-auto connection-line">
                    <path
                      d={generateCurvePath(start.x, start.y, end.x, end.y)}
                      fill="none"
                      stroke={isHovered ? '#6366f1' : (source.color || '#94a3b8')} 
                      strokeWidth={(isHovered ? 4 : 2.5) / viewport.scale}
                      className="transition-all cursor-pointer"
                      onMouseEnter={(e) => { setHoveredConnection(conn.id); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => setHoveredConnection(null)}
                      onClick={() => setEditingConnection(conn)}
                    />
                    <path
                      d={generateCurvePath(start.x, start.y, end.x, end.y)}
                      fill="none" stroke="transparent" strokeWidth={24 / viewport.scale}
                      className="cursor-pointer"
                      onMouseEnter={(e) => { setHoveredConnection(conn.id); setHoverPos({ x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => setHoveredConnection(null)}
                      onClick={() => setEditingConnection(conn)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Table Nodes */}
            {tables.map(table => {
              const tableColor = table.color || '#475569';
              const textColor = getContrastText(tableColor);
              
              return (
                <div
                  key={table.id}
                  className={`table-node absolute bg-white rounded-lg shadow-md border-2 flex flex-col pointer-events-auto ${draggingTable === table.id ? 'shadow-2xl opacity-95 scale-[1.02]' : ''}`}
                  style={{ 
                    left: table.x, top: table.y, width: TABLE_WIDTH,
                    zIndex: draggingTable === table.id ? 10 : 1,
                    borderColor: tableColor
                  }}
                >
                  {/* Header Handle */}
                  <div 
                    className="flex items-center justify-between px-3 h-[44px] rounded-t-[5px] cursor-grab active:cursor-grabbing"
                    style={{ backgroundColor: tableColor, color: textColor }}
                    onMouseDown={(e) => handleTableDragStart(e, table)}
                    onTouchStart={(e) => handleTableDragStart(e, table)}
                  >
                    <div className="flex items-center space-x-2 overflow-hidden pointer-events-none">
                      <GripHorizontal className="w-4 h-4 shrink-0" style={{ opacity: 0.8 }} />
                      <span className="font-semibold truncate text-sm">{table.name}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingTable(table); }}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="p-1.5 rounded transition hover:bg-black/20"
                      style={{ color: textColor }}
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Columns */}
                  <div className="py-2 relative flex-1 bg-white rounded-b-lg">
                    {table.columns.map((col) => (
                      <div key={col.id} className="group relative flex justify-between items-center px-3 hover:bg-slate-50 transition-colors" style={{ height: COL_HEIGHT }}>
                        
                        <div className="flex items-center space-x-2 overflow-hidden flex-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tableColor }}></span>
                          <span className="font-medium text-slate-700 text-xs md:text-sm truncate">{col.name}</span>
                          {col.description && (
                            <Info className="w-3 h-3 text-slate-400 shrink-0 outline-none" title={col.description} />
                          )}
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase ml-2">{col.type}</span>

                        <div 
                          className="input-port absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 rounded-full transition-transform z-20"
                          style={{ borderColor: tableColor }}
                          data-table-id={table.id} data-col-id={col.id}
                        />
                        <div 
                          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 rounded-full cursor-crosshair hover:scale-125 transition-transform z-20"
                          style={{ borderColor: tableColor }}
                          onMouseDown={(e) => handleConnectionStart(e, table.id, col.id)}
                          onTouchStart={(e) => handleConnectionStart(e, table.id, col.id)}
                        />
                      </div>
                    ))}
                    {table.columns.length === 0 && <div className="text-sm text-slate-400 italic text-center py-4">No columns</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- Floating Zoom Controls --- */}
        <div className="absolute bottom-6 right-6 flex flex-col bg-white/90 backdrop-blur border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20 pointer-events-auto">
          <button onClick={() => doZoom(1.2)} className="p-3 hover:bg-slate-100 text-slate-600 border-b border-slate-200">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={() => setViewport({x: 0, y: 0, scale: 1})} className="p-3 hover:bg-slate-100 text-slate-600 border-b border-slate-200">
            <Home className="w-5 h-5" />
          </button>
          <button onClick={() => doZoom(1 / 1.2)} className="p-3 hover:bg-slate-100 text-slate-600">
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>

        {/* --- Connection Hover Tooltip --- */}
        {hoveredConnection && !draggingTable && !connectingFrom && hoverPos.x !== 0 && (
          <div 
            className="fixed z-50 bg-slate-800 text-white p-3 rounded shadow-lg text-sm max-w-xs pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px]"
            style={{ left: hoverPos.x, top: hoverPos.y }}
          >
            <div className="flex items-center space-x-1 font-semibold mb-1 text-indigo-300">
              <Link2 className="w-4 h-4" /> <span>Logic</span>
            </div>
            <div className="whitespace-pre-wrap break-words text-slate-200 font-mono text-xs bg-slate-900 p-2 rounded border border-slate-700">
              {validConnections.find(c => c.id === hoveredConnection)?.info || "No details provided."}
            </div>
            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
          </div>
        )}
      </div>

      {/* --- Table Schema Editor Modal --- */}
      {editingTable && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 shrink-0" style={{ backgroundColor: editingTable.color, color: getContrastText(editingTable.color) }}>
              <h2 className="text-lg font-bold flex items-center"><Settings2 className="w-5 h-5 mr-2"/> Edit Table</h2>
              <button onClick={() => setEditingTable(null)} className="p-1 rounded-md hover:bg-black/20 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 md:p-5 overflow-y-auto flex-1 bg-white space-y-6">
              
              {/* Name and Color Selection Row */}
              <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Table Name</label>
                  <input 
                    type="text" value={editingTable.name}
                    onChange={(e) => setEditingTable({...editingTable, name: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  />
                </div>
                <div className="shrink-0">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center">
                    <Palette className="w-4 h-4 mr-1.5"/> Color / Rank
                  </label>
                  <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                    <input 
                      type="color" value={editingTable.color || '#ffffff'}
                      onChange={(e) => setEditingTable({...editingTable, color: e.target.value})}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0 ml-1"
                    />
                    <select 
                      onChange={(e) => setEditingTable({...editingTable, color: e.target.value})}
                      value={editingTable.color}
                      className="p-1.5 bg-transparent text-sm font-medium outline-none border-none text-slate-700"
                    >
                      <option value={editingTable.color}>Custom</option>
                      {RANK_COLORS.map(rank => (
                        <option key={rank.name} value={rank.hex}>{rank.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setEditingTable({...editingTable, color: getRandomColor()})}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded transition" title="Random Color"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Columns Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-semibold text-slate-700">Columns Schema</label>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setShowBulkPaste(!showBulkPaste)}
                      className="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-md font-medium hover:bg-slate-200 transition flex items-center border border-slate-200"
                    >
                      <ClipboardPaste className="w-3 h-3 mr-1" /> Paste Data
                    </button>
                    <button 
                      onClick={() => setEditingTable({...editingTable, columns: [...editingTable.columns, { id: `col_${Date.now()}`, name: 'new_col', type: 'VARCHAR', description: '' }]})}
                      className="text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-md font-medium hover:bg-indigo-100 transition flex items-center border border-indigo-100"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Column
                    </button>
                  </div>
                </div>

                {/* Bulk Paste Area */}
                {showBulkPaste && (
                  <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-indigo-800">Paste Spreadsheet / CSV Data (Tab or Comma separated)</label>
                      <span className="text-[10px] text-indigo-500 bg-indigo-100 px-1.5 rounded">Name | Type | Description</span>
                    </div>
                    <textarea
                      className="w-full text-xs p-2 rounded border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px] font-mono"
                      placeholder="user_id&#9;INT&#9;The primary key&#10;status&#9;VARCHAR&#9;Active or inactive"
                      value={bulkPasteText}
                      onChange={e => setBulkPasteText(e.target.value)}
                    />
                    <div className="flex justify-end mt-2 space-x-2">
                      <button onClick={() => {setShowBulkPaste(false); setBulkPasteText('');}} className="text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded transition font-medium">Cancel</button>
                      <button onClick={handleBulkPaste} className="text-xs px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded transition font-medium shadow-sm">Parse & Add Columns</button>
                    </div>
                  </div>
                )}
                
                {/* Individual Column Editors */}
                <div className="space-y-3">
                  {editingTable.columns.map((col, idx) => (
                    <div key={col.id} className="flex flex-col bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2 relative group">
                      <div className="flex space-x-2 items-center">
                        <input 
                          type="text" value={col.name} placeholder="Column Name"
                          onChange={(e) => {
                            const newCols = [...editingTable.columns]; newCols[idx].name = e.target.value;
                            setEditingTable({...editingTable, columns: newCols});
                          }}
                          className="flex-1 p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800"
                        />
                        <input 
                          type="text" value={col.type} placeholder="Type"
                          onChange={(e) => {
                            const newCols = [...editingTable.columns]; newCols[idx].type = e.target.value;
                            setEditingTable({...editingTable, columns: newCols});
                          }}
                          className="w-24 md:w-32 p-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none uppercase text-slate-600"
                        />
                        <button 
                          onClick={() => {
                            const newCols = editingTable.columns.filter((_, i) => i !== idx);
                            setEditingTable({...editingTable, columns: newCols});
                          }}
                          className="p-2 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Description Input Row */}
                      <div className="flex space-x-2 items-center">
                        <div className="pl-2 text-slate-300"><Info className="w-4 h-4"/></div>
                        <input 
                          type="text" value={col.description || ''} placeholder="Add a description or note for this column..."
                          onChange={(e) => {
                            const newCols = [...editingTable.columns]; newCols[idx].description = e.target.value;
                            setEditingTable({...editingTable, columns: newCols});
                          }}
                          className="flex-1 p-1.5 bg-transparent border-b border-transparent focus:border-indigo-300 rounded-none text-xs outline-none text-slate-500 placeholder:text-slate-400 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                  {editingTable.columns.length === 0 && (
                     <div className="text-center py-6 text-sm text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                       No columns defined. Add manually or paste data above.
                     </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <button 
                onClick={() => { setTables(tables.filter(t => t.id !== editingTable.id)); setEditingTable(null); }}
                className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center px-2 py-2 rounded hover:bg-red-50 transition"
              >
                <Trash2 className="w-4 h-4 md:mr-1.5" /> <span className="hidden md:inline">Delete Table</span>
              </button>
              <div className="flex space-x-2 md:space-x-3">
                <button onClick={() => setEditingTable(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition">Cancel</button>
                <button 
                  onClick={() => { setTables(tables.map(t => t.id === editingTable.id ? editingTable : t)); setEditingTable(null); }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
                >
                  Save Schema
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Connection Editor Modal --- */}
      {editingConnection && (() => {
        const srcTable = tables.find(t => t.id === editingConnection.sourceTable);
        const tgtTable = tables.find(t => t.id === editingConnection.targetTable);
        const srcCol = srcTable?.columns.find(c => c.id === editingConnection.sourceCol);
        const tgtCol = tgtTable?.columns.find(c => c.id === editingConnection.targetCol);

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
              <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800">Edit Mapping</h2>
                <button onClick={() => setEditingConnection(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200 transition"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="p-4 md:p-5">
                <div className="mb-4 text-sm text-slate-600 flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
                  <div className="flex flex-col w-[40%]">
                    <span className="text-[10px] md:text-xs text-slate-500 truncate">{srcTable?.name}</span>
                    <span className="font-bold text-slate-800 font-mono text-xs md:text-sm truncate" style={{color: srcTable?.color}}>{srcCol?.name}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center text-slate-400 px-2 w-[20%]">
                    <div className="h-px w-full bg-slate-300 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 border-4 border-transparent border-l-slate-400"></div>
                    </div>
                  </div>
                  <div className="flex flex-col text-right w-[40%]">
                    <span className="text-[10px] md:text-xs text-slate-500 truncate">{tgtTable?.name}</span>
                    <span className="font-bold text-slate-800 font-mono text-xs md:text-sm truncate" style={{color: tgtTable?.color}}>{tgtCol?.name}</span>
                  </div>
                </div>
                
                <label className="block text-sm font-semibold text-slate-700 mt-2 mb-1.5">Transformation Logic</label>
                <textarea 
                  value={editingConnection.info}
                  onChange={(e) => setEditingConnection({...editingConnection, info: e.target.value})}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-40 resize-none font-mono text-sm bg-slate-50"
                  placeholder="e.g. COALESCE(column_name, 'Unknown')"
                />
              </div>

              <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                <button 
                  onClick={() => { setConnections(connections.filter(c => c.id !== editingConnection.id)); setEditingConnection(null); }}
                  className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center px-2 py-2 rounded hover:bg-red-50 transition"
                >
                  <Trash2 className="w-4 h-4 md:mr-1.5" /> <span className="hidden md:inline">Delete Line</span>
                </button>
                <div className="flex space-x-2 md:space-x-3">
                  <button onClick={() => setEditingConnection(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition">Cancel</button>
                  <button 
                    onClick={() => { setConnections(connections.map(c => c.id === editingConnection.id ? editingConnection : c)); setEditingConnection(null); }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}