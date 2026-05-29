// ============================================================================
// DATA LINEAGE APP - UPGRADED & COLLABORATIVE WORKSPACE
// A React-based infinite canvas with universal ports, dynamic child-locking, 
// section backup systems, versatile compilers, and High-Performance Ghost Dragging.
// ============================================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Database, Plus, Trash2, Settings2, Download, Upload,
    X, GripHorizontal, Link2, Palette, RefreshCw, ZoomIn, ZoomOut, Home,
    FileJson, Menu, PanelLeftClose, Info, ClipboardPaste, Move,
    Lock, Unlock, FileDown, Layers
} from 'lucide-react';

// ============================================================================
// UTILITIES & CONSTANTS
// ============================================================================
const RANK_COLORS = [
    { name: 'Iron', hex: '#a19d94' }, { name: 'Copper', hex: '#b87333' },
    { name: 'Steel', hex: '#b0c4de' }, { name: 'Bronze', hex: '#cd7f32' },
    { name: 'Silver', hex: '#c0c0c0' }, { name: 'Gold', hex: '#ffd700' },
    { name: 'Platinum', hex: '#e5e4e2' }, { name: 'Jade', hex: '#00a86b' },
    { name: 'Diamond', hex: '#b9f2ff' }, { name: 'Onyx', hex: '#353839' }
];

const getRandomColor = () => {
    let color = '#';
    for (let i = 0; i < 6; i++) color += '0123456789ABCDEF'[Math.floor(Math.random() * 16)];
    return color;
};

const getContrastText = (hex) => {
    if (!hex || hex.length !== 7) return '#1e293b';
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128) ? '#1e293b' : '#ffffff';
};

const triggerDownload = (dataStr, filename) => {
    const a = document.createElement('a');
    a.href = dataStr; 
    a.download = filename; 
    a.click();
};

const TABLE_WIDTH = 280;
const HEADER_HEIGHT = 44;
const COL_HEIGHT = 44;
const PADDING_TOP = 8;

const generateCurvePath = (x1, y1, x2, y2) => {
    const cpOffset = Math.max(Math.abs(x2 - x1) / 2, 50);
    return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`;
};

// --- Extracted pure coordinate logic for memoized nodes ---
const getPortCoords = (table, portId, peerTable = null) => {
    if (!table) return { x: 0, y: 0 };
    const width = table.isUniversal ? 180 : TABLE_WIDTH;
    
    if (portId === '__HEADER__' || portId === '__HEADER_LEFT__') return { x: table.x, y: table.y + (table.isUniversal ? 18 : 22) };
    if (portId === '__HEADER_RIGHT__') return { x: table.x + width, y: table.y + (table.isUniversal ? 18 : 22) };
    if (portId === 'univ_col' || portId === 'univ_col_left') return { x: table.x, y: table.y + 65 };
    if (portId === 'univ_col_right') return { x: table.x + width, y: table.y + 65 };
    
    // Safely check columns array
    const cols = table.columns || [];
    const colIndex = cols.findIndex(c => c.id === portId);
    if (colIndex === -1) return { x: table.x, y: table.y };
    
    const yPos = table.y + HEADER_HEIGHT + PADDING_TOP + (colIndex * COL_HEIGHT) + (COL_HEIGHT / 2);
    return (peerTable && peerTable.x < table.x) ? { x: table.x, y: yPos } : { x: table.x + width, y: yPos };
};

const getOutputNodePos = (table, colId, targetTable = null) => {
    const mappedColId = (colId === '__HEADER_LEFT__' || colId === 'univ_col_left') ? colId : (colId === '__HEADER__' ? '__HEADER_RIGHT__' : colId);
    return getPortCoords(table, mappedColId, targetTable);
};

const getInputNodePos = (table, colId, sourceTable = null) => {
    const mappedColId = (colId === '__HEADER_RIGHT__' || colId === 'univ_col_right') ? colId : (colId === '__HEADER__' ? '__HEADER_LEFT__' : colId);
    return getPortCoords(table, mappedColId, sourceTable);
};


// ============================================================================
// MEMOIZED RENDER COMPONENTS (Bypasses Re-renders During Ghost Drag)
// ============================================================================
const SectionBox = React.memo(({ sec, isGhosted, handlers }) => {
    if (!sec) return null;
    
    return (
        <div
            className={`absolute rounded-xl border-2 border-dashed border-slate-300 pointer-events-none section-box-panel shadow-sm transition-opacity duration-200 ${isGhosted ? 'opacity-30 grayscale' : 'opacity-100'}`}
            style={{ 
                left: sec.x, top: sec.y, 
                width: sec.width, height: sec.height, 
                backgroundColor: sec.color || '#f8fafc', 
                zIndex: isGhosted ? 5 : 0 
            }}
        >
            <div 
                className="absolute top-0 left-0 right-0 h-10 px-3 bg-slate-200/60 rounded-t-[10px] border-b border-slate-300 flex items-center justify-between pointer-events-auto cursor-grab active:cursor-grabbing" 
                onMouseDown={(e) => handlers.onSectionDragStart(e, sec)} 
                onTouchStart={(e) => handlers.onSectionDragStart(e, sec)}
            >
                <div className="flex items-center space-x-1.5 shrink-0 overflow-hidden">
                    <Move className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-bold text-xs text-slate-700 truncate select-none">{sec.title}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                    <button onClick={(e) => { e.stopPropagation(); handlers.onToggleLock(sec.id); }} className="p-1 hover:bg-slate-300 rounded text-slate-600 transition" title={sec.locked !== false ? "Lock Bound Children inside" : "Children drag independently"}>
                        {sec.locked !== false ? <Lock className="w-3.5 h-3.5 text-indigo-600" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handlers.onExport(sec); }} className="p-1 hover:bg-slate-300 rounded text-slate-600 transition" title="Export Modular Section">
                        <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handlers.onSectionEdit(sec); }} className="p-1 hover:bg-slate-300 rounded text-slate-600 transition">
                        <Settings2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            
            <div 
                className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize pointer-events-auto flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors" 
                onMouseDown={(e) => handlers.onSectionResizeStart(e, sec)} 
                onTouchStart={(e) => handlers.onSectionResizeStart(e, sec)}
            >
                <svg width="10" height="10" viewBox="0 0 10 10" className="fill-current"><path d="M10,0 L10,10 L0,10 Z" /></svg>
            </div>
        </div>
    );
});

const ConnectionLine = React.memo(({ conn, sourceTable, targetTable, isHovered, viewportScale, handlers }) => {
    if (!conn || !sourceTable || !targetTable) return null;

    const start = getOutputNodePos(sourceTable, conn.sourceCol, targetTable);
    const end = getInputNodePos(targetTable, conn.targetCol, sourceTable);
    if (!start || !end) return null;

    const isHeaderConn = conn.sourceCol?.includes('HEADER') || conn.targetCol?.includes('HEADER');
    const pathD = isHeaderConn ? `M ${start.x} ${start.y} L ${end.x} ${end.y}` : generateCurvePath(start.x, start.y, end.x, end.y);

    return (
        <g className="pointer-events-auto connection-line">
            <path
                d={pathD} 
                fill="none" 
                stroke={isHovered ? '#6366f1' : (sourceTable.color || '#94a3b8')} 
                strokeWidth={(isHovered ? 4 : 2.5) / (viewportScale || 1)} 
                strokeDasharray={isHeaderConn ? "6,4" : undefined}
                className="transition-all cursor-pointer" 
                onMouseEnter={(e) => handlers.onConnHover(e, conn.id)} 
                onMouseLeave={handlers.onConnHoverEnd} 
                onClick={() => handlers.onConnClick(conn)}
            />
            {/* Thicker transparent path for easier hover/clicking */}
            <path
                d={pathD} 
                fill="none" 
                stroke="transparent" 
                strokeWidth={24 / (viewportScale || 1)} 
                className="cursor-pointer"
                onMouseEnter={(e) => handlers.onConnHover(e, conn.id)} 
                onMouseLeave={handlers.onConnHoverEnd} 
                onClick={() => handlers.onConnClick(conn)}
            />
        </g>
    );
});

const TableNode = React.memo(({ table, isGhosted, handlers }) => {
    if (!table) return null;

    const tableColor = table.color || '#475569';
    const textColor = getContrastText(tableColor);
    const columns = table.columns || [];

    if (table.isUniversal) {
        return (
            <div
                className={`table-node absolute bg-white rounded-lg shadow-md border-2 flex flex-col pointer-events-auto transition-opacity duration-200 ${isGhosted ? 'opacity-30 grayscale' : 'opacity-100'}`}
                style={{ left: table.x, top: table.y, width: 180, zIndex: isGhosted ? 5 : 10, borderColor: tableColor }}
            >
                <div 
                    className="flex items-center justify-between px-2 h-9 rounded-t-[5px] cursor-grab active:cursor-grabbing" 
                    style={{ backgroundColor: tableColor, color: textColor }} 
                    onMouseDown={(e) => handlers.onTableDragStart(e, table)} 
                    onTouchStart={(e) => handlers.onTableDragStart(e, table)}
                >
                    <div className="flex items-center space-x-1 overflow-hidden pointer-events-none">
                        <GripHorizontal className="w-3.5 h-3.5 shrink-0" style={{ opacity: 0.8 }} />
                        <span className="font-semibold truncate text-xs">{table.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handlers.onTableEdit(table); }} onTouchStart={(e) => e.stopPropagation()} className="p-1 rounded transition hover:bg-black/20" style={{ color: textColor }}>
                        <Settings2 className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="p-3 text-center bg-indigo-50/20 rounded-b-lg relative flex flex-col items-center justify-center min-h-[60px] border-t border-slate-100">
                    <span className="text-xs font-bold text-indigo-950 font-mono italic select-none break-all">{table.text || 'Loop Relay'}</span>
                    
                    {/* Universal Ports */}
                    <div className="input-port absolute -left-3 top-[10px] w-6 h-6 flex items-center justify-center z-20 cursor-crosshair hover:scale-125 transition-transform" data-table-id={table.id} data-col-id="__HEADER_LEFT__" onMouseDown={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_LEFT__')} onTouchStart={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_LEFT__')}><div className="w-3.5 h-3.5 bg-white border-2 rotate-45" style={{ borderColor: tableColor }} /></div>
                    <div className="input-port absolute -left-3 top-[34px] w-6 h-6 flex items-center justify-center z-20 cursor-crosshair hover:scale-125 transition-transform" data-table-id={table.id} data-col-id="univ_col_left" onMouseDown={(e) => handlers.onConnectionStart(e, table.id, 'univ_col_left')} onTouchStart={(e) => handlers.onConnectionStart(e, table.id, 'univ_col_left')}><div className="w-3.5 h-3.5 bg-white border-2 rounded-full" style={{ borderColor: tableColor }} /></div>
                    <div className="input-port absolute -right-3 top-[10px] w-6 h-6 flex items-center justify-center z-20 cursor-crosshair hover:scale-125 transition-transform" data-table-id={table.id} data-col-id="__HEADER_RIGHT__" onMouseDown={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_RIGHT__')} onTouchStart={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_RIGHT__')}><div className="w-3.5 h-3.5 bg-white border-2 rotate-45" style={{ borderColor: tableColor }} /></div>
                    <div className="input-port absolute -right-3 top-[34px] w-6 h-6 flex items-center justify-center z-20 cursor-crosshair hover:scale-125 transition-transform" data-table-id={table.id} data-col-id="univ_col_right" onMouseDown={(e) => handlers.onConnectionStart(e, table.id, 'univ_col_right')} onTouchStart={(e) => handlers.onConnectionStart(e, table.id, 'univ_col_right')}><div className="w-3.5 h-3.5 bg-white border-2 rounded-full" style={{ borderColor: tableColor }} /></div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`table-node absolute bg-white rounded-lg shadow-md border-2 flex flex-col pointer-events-auto transition-opacity duration-200 ${isGhosted ? 'opacity-30 grayscale' : 'opacity-100'}`}
            style={{ left: table.x, top: table.y, width: TABLE_WIDTH, zIndex: isGhosted ? 5 : 10, borderColor: tableColor }}
        >
            <div 
                className="flex items-center justify-between px-3 h-[44px] rounded-t-[5px] cursor-grab active:cursor-grabbing relative" 
                style={{ backgroundColor: tableColor, color: textColor }} 
                onMouseDown={(e) => handlers.onTableDragStart(e, table)} 
                onTouchStart={(e) => handlers.onTableDragStart(e, table)}
            >
                <div className="flex items-center space-x-2 overflow-hidden pointer-events-none">
                    <GripHorizontal className="w-4 h-4 shrink-0" style={{ opacity: 0.8 }} />
                    <span className="font-semibold truncate text-sm">{table.name}</span>
                </div>
                
                {/* Header Ports */}
                <div className="input-port absolute -left-3.5 top-[10px] w-6 h-6 flex items-center justify-center z-20 pointer-events-auto cursor-crosshair hover:scale-125 transition-transform" data-table-id={table.id} data-col-id="__HEADER_LEFT__" onMouseDown={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_LEFT__')} onTouchStart={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_LEFT__')}><div className="w-3.5 h-3.5 bg-white border-2 rotate-45" style={{ borderColor: tableColor }} /></div>
                <div className="input-port absolute -right-3.5 top-[10px] w-6 h-6 flex items-center justify-center z-20 cursor-crosshair hover:scale-125 transition-transform pointer-events-auto" data-table-id={table.id} data-col-id="__HEADER_RIGHT__" onMouseDown={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_RIGHT__')} onTouchStart={(e) => handlers.onConnectionStart(e, table.id, '__HEADER_RIGHT__')}><div className="w-3.5 h-3.5 bg-white border-2 rotate-45" style={{ borderColor: tableColor }} /></div>
                
                <button onClick={(e) => { e.stopPropagation(); handlers.onTableEdit(table); }} onTouchStart={(e) => e.stopPropagation()} className="p-1.5 rounded transition hover:bg-black/20" style={{ color: textColor }}>
                    <Settings2 className="w-4 h-4" />
                </button>
            </div>
            
            <div className="py-2 relative flex-1 bg-white rounded-b-lg">
                {columns.map((col) => (
                    <div key={col.id} className="group relative flex justify-between items-center px-3 hover:bg-slate-50 transition-colors" style={{ height: COL_HEIGHT }}>
                        <div className="flex items-center space-x-2 overflow-hidden flex-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tableColor }}></span>
                            <span className="font-medium text-slate-700 text-xs md:text-sm truncate">{col.name}</span>
                            {col.description && <Info className="w-3 h-3 text-slate-400 shrink-0 outline-none" title={col.description} />}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase ml-2">{col.type}</span>
                        
                        {/* Column Ports */}
                        <div className="input-port absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 rounded-full transition-transform z-20" style={{ borderColor: tableColor }} data-table-id={table.id} data-col-id={col.id} />
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 rounded-full cursor-crosshair hover:scale-125 transition-transform z-20" style={{ borderColor: tableColor }} onMouseDown={(e) => handlers.onConnectionStart(e, table.id, col.id)} onTouchStart={(e) => handlers.onConnectionStart(e, table.id, col.id)} />
                    </div>
                ))}
                {columns.length === 0 && <div className="text-sm text-slate-400 italic text-center py-4">No columns</div>}
            </div>
        </div>
    );
});


// ============================================================================
// COMPONENT WORKSPACE (Main App)
// ============================================================================
export default function App() {
    const [projectName, setProjectName] = useState('Lineage Map');
    
    const [tables, setTables] = useState([{
        id: 't1', name: 'raw_users', x: 80, y: 150, color: RANK_COLORS[4].hex, parentId: 'sec1',
        columns: [{ id: 'c1', name: 'id', type: 'INT', description: 'Primary unique identifier' }, { id: 'c2', name: 'full_name', type: 'VARCHAR', description: 'User full name from source' }]
    }, {
        id: 't2', name: 'dim_users', x: 500, y: 150, color: RANK_COLORS[5].hex, parentId: 'sec1',
        columns: [{ id: 'c4', name: 'user_sk', type: 'INT', description: 'Surrogate key' }, { id: 'c5', name: 'first_name', type: 'VARCHAR', description: '' }, { id: 'c6', name: 'last_name', type: 'VARCHAR', description: '' }]
    }]);
    
    const [connections, setConnections] = useState([
        { id: 'conn1', sourceTable: 't1', sourceCol: '__HEADER_RIGHT__', targetTable: 't2', targetCol: '__HEADER_LEFT__', info: 'Table-level Direct Lineage' },
        { id: 'conn2', sourceTable: 't1', sourceCol: 'c2', targetTable: 't2', targetCol: 'c5', info: "SPLIT_PART(full_name, ' ', 1)" },
        { id: 'conn3', sourceTable: 't1', sourceCol: 'c2', targetTable: 't2', targetCol: 'c6', info: "SPLIT_PART(full_name, ' ', 2)" }
    ]);
    
    const [sections, setSections] = useState([
        { id: 'sec1', title: 'Data Pipeline Core', x: 40, y: 80, width: 780, height: 330, color: '#f8fafc', locked: true }
    ]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
    
    // Core references
    const wrapperRef = useRef(null);
    const pinchRef = useRef({ dist: null, center: null });
    const activeHandlersRef = useRef({});

    // HIGH PERFORMANCE GHOST DRAG STATE
    const [activeDrag, setActiveDrag] = useState(null); 
    const [isPanningCanvas, setIsPanningCanvas] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [connectingFrom, setConnectingFrom] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [hoveredConnection, setHoveredConnection] = useState(null);
    const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
    const [editingTable, setEditingTable] = useState(null);
    const [editingConnection, setEditingConnection] = useState(null);
    const [editingSection, setEditingSection] = useState(null);

    const [showBulkPaste, setShowBulkPaste] = useState(false);
    const [bulkPasteText, setBulkPasteText] = useState('');

    const jsonImportRef = useRef(null);
    const sectionImportRef = useRef(null);

    useEffect(() => {
        const handleResize = () => { setIsMobile(window.innerWidth <= 768); setIsSidebarOpen(window.innerWidth > 768); };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const preventNativeAction = (e) => { if (!editingTable && !editingConnection && !editingSection) e.preventDefault(); };
        el.addEventListener('touchmove', preventNativeAction, { passive: false });
        el.addEventListener('wheel', preventNativeAction, { passive: false });
        return () => { el.removeEventListener('touchmove', preventNativeAction); el.removeEventListener('wheel', preventNativeAction); };
    }, [editingTable, editingConnection, editingSection]);

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

    const doZoom = (factor, originX = null, originY = null) => {
        setViewport(prev => {
            const newScale = Math.max(0.01, Math.min(prev.scale * factor, 100));
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return prev;
            const cX = originX !== null ? originX : rect.width / 2;
            const cY = originY !== null ? originY : rect.height / 2;
            return { 
                x: cX - (cX - prev.x) * (newScale / prev.scale), 
                y: cY - (cY - prev.y) * (newScale / prev.scale), 
                scale: newScale 
            };
        });
    };

    const handleWheelReact = (e) => {
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        doZoom(1 + delta, e.clientX - wrapperRef.current.getBoundingClientRect().left, e.clientY - wrapperRef.current.getBoundingClientRect().top);
    };

    const handleCanvasDragStart = (e) => {
        if (e.target.closest('.table-node') || e.target.closest('.connection-line') || e.target.closest('.section-box-panel') || e.touches?.length > 1) return;
        const coords = getClientCoords(e);
        setIsPanningCanvas(true); 
        setPanOffset({ x: coords.x - viewport.x, y: coords.y - viewport.y });
    };

    // --- High Performance GHOST Handler Setups ---
    const handleTableDragStart = (e, table) => {
        e.stopPropagation(); 
        if (e.touches?.length > 1) return;
        
        const coords = getClientCoords(e); 
        const canvasCoords = toCanvasCoords(coords.x, coords.y);
        
        setActiveDrag({
            type: 'table', 
            id: table.id,
            offsetX: canvasCoords.x - table.x, 
            offsetY: canvasCoords.y - table.y,
            x: table.x, 
            y: table.y,
            w: table.isUniversal ? 180 : TABLE_WIDTH,
            h: table.isUniversal ? 100 : HEADER_HEIGHT + ((table.columns || []).length * COL_HEIGHT) + PADDING_TOP + 12
        });
    };

    const handleSectionDragStart = (e, sec) => {
        e.stopPropagation(); 
        if (e.touches?.length > 1) return;
        
        const coords = getClientCoords(e); 
        const canvasCoords = toCanvasCoords(coords.x, coords.y);
        
        let childrenNodes = [];
        if (sec.locked !== false) {
            const children = tables.filter(t => t.parentId === sec.id || (t.x >= sec.x && t.x <= sec.x + sec.width && t.y >= sec.y && t.y <= sec.y + sec.height));
            childrenNodes = children.map(t => ({
                id: t.id, 
                dx: t.x - sec.x, 
                dy: t.y - sec.y,
                w: t.isUniversal ? 180 : TABLE_WIDTH,
                h: t.isUniversal ? 100 : HEADER_HEIGHT + ((t.columns || []).length * COL_HEIGHT) + PADDING_TOP + 12
            }));
        }

        setActiveDrag({
            type: 'section', 
            id: sec.id,
            offsetX: canvasCoords.x - sec.x, 
            offsetY: canvasCoords.y - sec.y,
            x: sec.x, 
            y: sec.y, 
            w: sec.width, 
            h: sec.height,
            children: childrenNodes
        });
    };

    const handleSectionResizeStart = (e, sec) => {
        e.stopPropagation(); 
        if (e.touches?.length > 1) return;
        
        const coords = getClientCoords(e); 
        const canvasCoords = toCanvasCoords(coords.x, coords.y);
        
        setActiveDrag({ 
            type: 'sectionResize', 
            id: sec.id, 
            startX: canvasCoords.x, 
            startY: canvasCoords.y, 
            startW: sec.width, 
            startH: sec.height, 
            x: sec.x, 
            y: sec.y, 
            w: sec.width, 
            h: sec.height 
        });
    };

    // Keep memoized references strictly updated
    useEffect(() => {
        activeHandlersRef.current = {
            handleTableDragStart, 
            handleSectionDragStart, 
            handleSectionResizeStart,
            handleConnectionStart: (e, tableId, colId) => { 
                e.stopPropagation(); 
                setConnectingFrom({ tableId, colId }); 
                setMousePos(toCanvasCoords(getClientCoords(e).x, getClientCoords(e).y)); 
            },
            toggleSectionLock: (id) => setSections(prev => prev.map(s => s.id === id ? { ...s, locked: s.locked === false ? true : false } : s)),
            exportSingleSection: (sec) => {
                const childTables = tables.filter(t => t.parentId === sec.id || (t.x >= sec.x && t.x <= sec.x + sec.width && t.y >= sec.y && t.y <= sec.y + sec.height));
                const childTableIds = childTables.map(t => t.id);
                const internalConns = connections.filter(c => childTableIds.includes(c.sourceTable) && childTableIds.includes(c.targetTable));
                const exportedObject = { type: "single_section_modular", section: { ...sec, children: childTableIds }, tables: childTables, connections: internalConns };
                triggerDownload("data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportedObject, null, 2)), `section_${sec.title.replace(/\s+/g, '_')}_modular.json`);
            },
            setEditingSection, 
            setEditingTable, 
            setEditingConnection, 
            setHoveredConnection, 
            setHoverPos
        };
    });

    const stableHandlers = useMemo(() => ({
        onTableDragStart: (e, table) => activeHandlersRef.current.handleTableDragStart(e, table),
        onTableEdit: (table) => activeHandlersRef.current.setEditingTable(table),
        onConnectionStart: (e, tableId, colId) => activeHandlersRef.current.handleConnectionStart(e, tableId, colId),
        onSectionDragStart: (e, sec) => activeHandlersRef.current.handleSectionDragStart(e, sec),
        onSectionResizeStart: (e, sec) => activeHandlersRef.current.handleSectionResizeStart(e, sec),
        onToggleLock: (id) => activeHandlersRef.current.toggleSectionLock(id),
        onExport: (sec) => activeHandlersRef.current.exportSingleSection(sec),
        onSectionEdit: (sec) => activeHandlersRef.current.setEditingSection(sec),
        onConnHover: (e, id) => { 
            activeHandlersRef.current.setHoveredConnection(id); 
            activeHandlersRef.current.setHoverPos({ x: e.clientX, y: e.clientY }); 
        },
        onConnHoverEnd: () => activeHandlersRef.current.setHoveredConnection(null),
        onConnClick: (conn) => activeHandlersRef.current.setEditingConnection(conn)
    }), []);

    const handleGlobalMove = (e) => {
        if (e.touches && e.touches.length === 2) {
            const t1 = e.touches[0], t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
            
            if (pinchRef.current.dist > 0 && dist > 0) {
                const factor = dist / pinchRef.current.dist;
                setViewport(prev => {
                    const newScale = Math.max(0.01, Math.min(prev.scale * factor, 100));
                    const rect = wrapperRef.current.getBoundingClientRect();
                    const cX = center.x - rect.left, cY = center.y - rect.top;
                    return { 
                        x: cX - (cX - prev.x) * (newScale / prev.scale) + (center.x - pinchRef.current.center.x), 
                        y: cY - (cY - prev.y) * (newScale / prev.scale) + (center.y - pinchRef.current.center.y), 
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

        const canvasCoords = toCanvasCoords(coords.x, coords.y);
        if (connectingFrom) setMousePos(canvasCoords);

        // Update Ghost Overlay Position Only
        if (activeDrag) {
            setActiveDrag(prev => {
                if (!prev) return null;
                if (prev.type === 'table' || prev.type === 'section') {
                    return { ...prev, x: canvasCoords.x - prev.offsetX, y: canvasCoords.y - prev.offsetY };
                }
                if (prev.type === 'sectionResize') {
                    return { ...prev, w: Math.max(150, prev.startW + (canvasCoords.x - prev.startX)), h: Math.max(100, prev.startH + (canvasCoords.y - prev.startY)) };
                }
                return prev;
            });
            return;
        }

        if (hoveredConnection && !e.touches) setHoverPos({ x: coords.x, y: coords.y });
    };

    const handleGlobalEnd = (e) => {
        pinchRef.current = { dist: null, center: null };
        if (isPanningCanvas) setIsPanningCanvas(false);

        // Apply Ghost overlay data back to main React state
        if (activeDrag) {
            if (activeDrag.type === 'table') {
                const containingSec = sections.find(sec => activeDrag.x >= sec.x && activeDrag.x <= sec.x + sec.width && activeDrag.y >= sec.y && activeDrag.y <= sec.y + sec.height);
                setTables(prev => prev.map(t => t.id === activeDrag.id ? { ...t, x: activeDrag.x, y: activeDrag.y, parentId: containingSec ? containingSec.id : null } : t));
            } else if (activeDrag.type === 'section') {
                setSections(prev => prev.map(s => s.id === activeDrag.id ? { ...s, x: activeDrag.x, y: activeDrag.y } : s));
                if (activeDrag.children && activeDrag.children.length > 0) {
                    setTables(prev => prev.map(t => {
                        const child = activeDrag.children.find(c => c.id === t.id);
                        return child ? { ...t, x: activeDrag.x + child.dx, y: activeDrag.y + child.dy, parentId: activeDrag.id } : t;
                    }));
                }
            } else if (activeDrag.type === 'sectionResize') {
                setSections(prev => prev.map(s => s.id === activeDrag.id ? { ...s, width: activeDrag.w, height: activeDrag.h } : s));
            }
            setActiveDrag(null);
        }

        if (connectingFrom) {
            const coords = getClientCoords(e);
            const inputPort = document.elementFromPoint(coords.x, coords.y)?.closest('.input-port');
            if (inputPort) {
                const targetTableId = inputPort.getAttribute('data-table-id');
                const targetColId = inputPort.getAttribute('data-col-id');
                
                if (connectingFrom.tableId !== targetTableId || connectingFrom.colId !== targetColId) {
                    if (!connections.some(c => c.sourceTable === connectingFrom.tableId && c.sourceCol === connectingFrom.colId && c.targetTable === targetTableId && c.targetCol === targetColId)) {
                        const newConn = { id: `c_${Date.now()}`, sourceTable: connectingFrom.tableId, sourceCol: connectingFrom.colId, targetTable: targetTableId, targetCol: targetColId, info: '' };
                        setConnections(prev => [...prev, newConn]); 
                        setEditingConnection(newConn);
                    }
                }
            }
            setConnectingFrom(null);
        }
    };

    // ============================================================================
    // EXPORTS & MISC LOGIC
    // ============================================================================

    const handleImportSingleSection = (e) => {
        const file = e.target.files[0]; 
        if (!file) return; 
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result.trim());
                if (data.type === "single_section_modular" && data.section && data.tables) {
                    const oldToNewIdMap = {}; 
                    const newSecId = `sec_${Date.now()}`; 
                    oldToNewIdMap[data.section.id] = newSecId; 
                    const offset = 80;
                    
                    const newTables = data.tables.map(t => { 
                        const newTId = `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`; 
                        oldToNewIdMap[t.id] = newTId; 
                        return { ...t, id: newTId, parentId: newSecId, x: t.x + offset, y: t.y + offset }; 
                    });
                    
                    const newConns = (data.connections || []).map(c => ({ 
                        ...c, 
                        id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 
                        sourceTable: oldToNewIdMap[c.sourceTable] || c.sourceTable, 
                        targetTable: oldToNewIdMap[c.targetTable] || c.targetTable 
                    }));
                    
                    setSections(prev => [...prev, { ...data.section, id: newSecId, x: data.section.x + offset, y: data.section.y + offset, locked: data.section.locked !== false }]);
                    setTables(prev => [...prev, ...newTables]); 
                    setConnections(prev => [...prev, ...newConns]);
                } else throw new Error("Invalid modular section schema.");
            } catch (err) { alert("Modular import failed: " + err.message); }
        }; 
        reader.readAsText(file); 
        e.target.value = null;
    };

    const exportAsSVG = () => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        sections.forEach(s => { 
            minX = Math.min(minX, s.x); minY = Math.min(minY, s.y); 
            maxX = Math.max(maxX, s.x + s.width); maxY = Math.max(maxY, s.y + s.height); 
        });
        tables.forEach(t => {
            const w = t.isUniversal ? 180 : TABLE_WIDTH; 
            const h = t.isUniversal ? 100 : HEADER_HEIGHT + ((t.columns || []).length * COL_HEIGHT) + PADDING_TOP + 12;
            minX = Math.min(minX, t.x); minY = Math.min(minY, t.y); 
            maxX = Math.max(maxX, t.x + w); maxY = Math.max(maxY, t.y + h);
        });
        if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; } 
        else { minX -= 60; minY -= 60; maxX += 60; maxY += 60; }

        let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="${maxX - minX}" height="${maxY - minY}" style="background-color: #f8fafc; font-family: sans-serif;">\n`;
        sections.forEach(sec => { 
            svgStr += `  <g id="${sec.id}"><rect x="${sec.x}" y="${sec.y}" width="${sec.width}" height="${sec.height}" rx="12" fill="${sec.color || '#f8fafc'}" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6,4" /><path d="M ${sec.x} ${sec.y} L ${sec.x} ${sec.y + 40} L ${sec.x + sec.width} ${sec.y + 40} L ${sec.x + sec.width} ${sec.y} Z" fill="#e2e8f0" opacity="0.3" /><text x="${sec.x + 16}" y="${sec.y + 24}" font-size="12" font-weight="bold" fill="#334155">${sec.title}</text></g>\n`; 
        });
        validConnectionsToShow.forEach(conn => {
            const source = tables.find(t => t.id === conn.sourceTable), target = tables.find(t => t.id === conn.targetTable);
            const start = getOutputNodePos(source, conn.sourceCol, target), end = getInputNodePos(target, conn.targetCol, source);
            if (start && end) {
                const isHeader = conn.sourceCol?.includes('HEADER') || conn.targetCol?.includes('HEADER');
                svgStr += `  <path d="${isHeader ? `M ${start.x} ${start.y} L ${end.x} ${end.y}` : generateCurvePath(start.x, start.y, end.x, end.y)}" fill="none" stroke="${source?.color || '#94a3b8'}" stroke-width="2.5" ${isHeader ? 'stroke-dasharray="6,4"' : ''} />\n`;
            }
        });
        tables.forEach(table => {
            const tc = table.color || '#475569', txt = getContrastText(tc);
            if (table.isUniversal) { 
                svgStr += `  <g id="${table.id}"><rect x="${table.x}" y="${table.y}" width="180" height="100" rx="8" fill="#ffffff" stroke="${tc}" stroke-width="2" /><rect x="${table.x}" y="${table.y}" width="180" height="36" rx="6" fill="${tc}" /><text x="${table.x + 10}" y="${table.y + 22}" font-size="12" font-weight="bold" fill="${txt}">${table.name}</text><text x="${table.x + 90}" y="${table.y + 68}" font-size="11" font-weight="bold" font-style="italic" fill="#312e81" text-anchor="middle">${table.text || 'Loop Relay'}</text></g>\n`;
            } else {
                const height = HEADER_HEIGHT + ((table.columns || []).length * COL_HEIGHT) + 12;
                svgStr += `  <g id="${table.id}"><rect x="${table.x}" y="${table.y}" width="${TABLE_WIDTH}" height="${height}" rx="8" fill="#ffffff" stroke="${tc}" stroke-width="2" /><rect x="${table.x}" y="${table.y}" width="${TABLE_WIDTH}" height="${HEADER_HEIGHT}" rx="6" fill="${tc}" /><text x="${table.x + 12}" y="${table.y + 26}" font-size="14" font-weight="bold" fill="${txt}">${table.name}</text>\n`;
                (table.columns || []).forEach((col, idx) => { 
                    const colY = table.y + HEADER_HEIGHT + PADDING_TOP + (idx * COL_HEIGHT); 
                    svgStr += `    <rect x="${table.x + 2}" y="${colY}" width="${TABLE_WIDTH - 4}" height="${COL_HEIGHT}" fill="none" /><circle cx="${table.x + 14}" cy="${colY + COL_HEIGHT/2}" r="4" fill="${tc}" /><text x="${table.x + 26}" y="${colY + COL_HEIGHT/2 + 5}" font-size="12" fill="#334155">${col.name}</text><rect x="${table.x + TABLE_WIDTH - 85}" y="${colY + COL_HEIGHT/2 - 9}" width="70" height="18" rx="4" fill="#f1f5f9" stroke="#e2e8f0" /><text x="${table.x + TABLE_WIDTH - 50}" y="${colY + COL_HEIGHT/2 + 4}" font-size="10" font-family="monospace" fill="#64748b" text-anchor="middle">${col.type}</text>\n`; 
                });
                svgStr += `  </g>\n`;
            }
        });
        
        const safeFilename = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_canvas.svg`;
        triggerDownload("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr + `</svg>`), safeFilename);
    };

    const exportDrawioXML = () => {
        let cells = `      <mxCell id="0" />\n      <mxCell id="1" parent="0" />\n`;
        sections.forEach(sec => { 
            cells += `      <mxCell id="sec_${sec.id}" value="${sec.title}" style="swimlane;whiteSpace=wrap;html=1;collapsible=0;bgOpacity=0.2;strokeWidth=2;dashed=1;fillColor=${sec.color || '#F8FAFC'};strokeColor=#CBD5E1;fontStyle=1;startSize=40;" vertex="1" parent="1"><mxGeometry x="${sec.x}" y="${sec.y}" width="${sec.width}" height="${sec.height}" as="geometry" /></mxCell>\n`; 
        });
        tables.forEach(table => {
            const parentId = table.parentId && sections.some(s => s.id === table.parentId) ? `sec_${table.parentId}` : '1';
            let localX = table.x, localY = table.y;
            
            if (parentId !== '1') { 
                const pSec = sections.find(s => s.id === table.parentId); 
                if (pSec) { localX = table.x - pSec.x; localY = table.y - pSec.y; }
            }
            
            if (table.isUniversal) { 
                cells += `      <mxCell id="tbl_${table.id}" value="${table.name}&lt;br&gt;&lt;i&gt;${table.text || 'Loop Relay'}&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;strokeWidth=2;strokeColor=${table.color || '#475569'};fillColor=#FFFFFF;align=center;fontSize=12;" vertex="1" parent="${parentId}"><mxGeometry x="${localX}" y="${localY}" width="180" height="100" as="geometry" /></mxCell>\n`;
            } else {
                cells += `      <mxCell id="tbl_${table.id}" value="${table.name}" style="swimlane;childLayout=stackLayout;horizontal=1;startSize=${HEADER_HEIGHT};horizontalStack=0;rounded=1;fontSize=14;fontStyle=1;strokeColor=${table.color || '#475569'};fillColor=${table.color || '#475569'};fontColor=#FFFFFF;collapsible=0;" vertex="1" parent="${parentId}"><mxGeometry x="${localX}" y="${localY}" width="${TABLE_WIDTH}" height="${HEADER_HEIGHT + ((table.columns || []).length * COL_HEIGHT) + 12}" as="geometry" /></mxCell>\n`;
                (table.columns || []).forEach((col, idx) => { 
                    cells += `      <mxCell id="col_${table.id}_${col.id}" value="${col.name} : ${col.type}" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=10;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;" vertex="1" parent="tbl_${table.id}"><mxGeometry y="${HEADER_HEIGHT + (idx * COL_HEIGHT)}" width="${TABLE_WIDTH}" height="${COL_HEIGHT}" as="geometry" /></mxCell>\n`; 
                });
            }
        });
        connections.forEach(conn => {
            if (!tables.find(t => t.id === conn.sourceTable) || !tables.find(t => t.id === conn.targetTable)) return;
            const isHead = conn.sourceCol?.includes('HEADER') || conn.sourceCol?.includes('univ_col') || conn.targetCol?.includes('HEADER') || conn.targetCol?.includes('univ_col');
            const style = isHead ? "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;strokeColor=#6366F1;strokeWidth=2;dashed=1;endArrow=classic;endFill=1;" : "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;strokeColor=#475569;strokeWidth=2;endArrow=classic;endFill=1;";
            cells += `      <mxCell id="conn_${conn.id}" value="${conn.info || ''}" style="${style}" edge="1" parent="1" source="${isHead ? `tbl_${conn.sourceTable}` : `col_${conn.sourceTable}_${conn.sourceCol}`}" target="${isHead ? `tbl_${conn.targetTable}` : `col_${conn.targetTable}_${conn.targetCol}`}"><mxGeometry relative="1" as="geometry" /></mxCell>\n`;
        });
        
        const safeFilename = `drawio_${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.drawio`;
        triggerDownload("data:text/xml;charset=utf-8," + encodeURIComponent(`<mxfile host="Electron" modified="${new Date().toISOString()}" agent="LineageApp" version="1.0" type="device">\n  <diagram id="lineage_workspace" name="${projectName}">\n    <mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">\n      <root>\n${cells}      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>`), safeFilename);
    };

    const handleImport = (e) => {
        const file = e.target.files[0]; 
        if (!file) return; 
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result.trim());
                if (data.tables && data.connections) { 
                    setTables(data.tables); 
                    setConnections(data.connections); 
                    setSections(data.sections || []); 
                    
                    // Set the project name if it exists in the JSON
                    if (data.projectName) setProjectName(data.projectName);
                    
                    setViewport({ x: 0, y: 0, scale: 1 }); 
                    if (isMobile) setIsSidebarOpen(false); 
                }
            } catch (err) { alert("Failed to parse file."); }
        }; 
        reader.readAsText(file); 
        e.target.value = null;
    };

    const handleBulkPaste = () => {
        if (!bulkPasteText.trim()) return;
        const newCols = bulkPasteText.split('\n').map(line => {
            const parts = line.split(/[\t,]/);
            if (!parts[0] || !parts[0].trim()) return null;
            return { id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, name: parts[0].trim(), type: (parts[1] || 'VARCHAR').trim().toUpperCase(), description: (parts[2] || '').trim() };
        }).filter(Boolean);
        setEditingTable(prev => ({ ...prev, columns: [...(prev.columns || []), ...newCols] })); 
        setShowBulkPaste(false); 
        setBulkPasteText('');
    };

    const validConnectionsToShow = useMemo(() => {
        return connections.filter(conn => {
            const srcTable = tables.find(t => t.id === conn.sourceTable);
            const tgtTable = tables.find(t => t.id === conn.targetTable);
            if (!srcTable || !tgtTable) return false;
            
            const sourceValid = conn.sourceCol?.includes('HEADER') || conn.sourceCol?.includes('univ_col') || srcTable.columns?.some(c => c.id === conn.sourceCol);
            const targetValid = conn.targetCol?.includes('HEADER') || conn.targetCol?.includes('univ_col') || tgtTable.columns?.some(c => c.id === conn.targetCol);
            
            return sourceValid && targetValid;
        });
    }, [connections, tables]);


    // ============================================================================
    // MAIN RENDER LOOP
    // ============================================================================
    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden overscroll-none">

            {isMobile && isSidebarOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30" onClick={() => setIsSidebarOpen(false)} />}

            {/* Sidebar Navigation */}
            <div className={`absolute md:relative z-40 h-full bg-white border-r border-slate-200 shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out flex flex-col w-64 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'}`}>
                <div className="flex-1 flex flex-col overflow-y-auto w-full">
                    <div className="h-14 flex items-center justify-between px-3 border-b border-slate-200 bg-slate-50 shrink-0">
                        <div className="flex items-center space-x-2 text-indigo-600 flex-1">
                            <Database className="w-5 h-5 shrink-0 ml-1" />
                            <input 
                                type="text" 
                                value={projectName} 
                                onChange={(e) => setProjectName(e.target.value)} 
                                className="font-bold text-slate-800 bg-transparent border-none outline-none hover:bg-slate-200/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-1 w-full transition-colors text-sm"
                                placeholder="Project Name"
                            />
                        </div>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 text-slate-500 hover:bg-slate-200 rounded ml-1 shrink-0"><PanelLeftClose className="w-5 h-5" /></button>
                    </div>

                    <div className="p-4 space-y-6">
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Actions</div>
                            <div className="space-y-1">
                                <button onClick={() => { setTables([...tables, { id: `t_${Date.now()}`, name: 'new_table', x: wrapperRef.current ? (wrapperRef.current.getBoundingClientRect().width / 2 - viewport.x) / viewport.scale - (TABLE_WIDTH / 2) : 50, y: wrapperRef.current ? (wrapperRef.current.getBoundingClientRect().height / 2 - viewport.y) / viewport.scale : 50, color: getRandomColor(), columns: [{ id: `col_${Date.now()}`, name: 'id', type: 'INT', description: '' }] }]); if (isMobile) setIsSidebarOpen(false); }} className="w-full flex items-center px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition text-sm font-medium shadow-sm"><Plus className="w-4 h-4 mr-2" /> Add New Table</button>
                                <button onClick={() => { setTables([...tables, { id: `univ_${Date.now()}`, name: 'Loop Relay', x: wrapperRef.current ? (wrapperRef.current.getBoundingClientRect().width / 2 - viewport.x) / viewport.scale - 90 : 100, y: wrapperRef.current ? (wrapperRef.current.getBoundingClientRect().height / 2 - viewport.y) / viewport.scale - 55 : 100, color: '#6366f1', isUniversal: true, text: 'Loop Utility Relay', columns: [{ id: 'univ_col', name: 'relay_col', type: 'ANY', description: 'Universal Column Relay' }] }]); if (isMobile) setIsSidebarOpen(false); }} className="w-full flex items-center px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition text-sm font-medium shadow-sm"><Plus className="w-4 h-4 mr-2" /> Add Universal Node</button>
                                <button onClick={() => { setSections([...sections, { id: `sec_${Date.now()}`, title: 'New Section Area', x: wrapperRef.current ? (wrapperRef.current.getBoundingClientRect().width / 2 - viewport.x) / viewport.scale - 200 : 50, y: wrapperRef.current ? (wrapperRef.current.getBoundingClientRect().height / 2 - viewport.y) / viewport.scale - 150 : 50, width: 400, height: 300, color: '#f8fafc' }]); if (isMobile) setIsSidebarOpen(false); }} className="w-full flex items-center px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-800 transition text-sm font-medium shadow-sm"><Plus className="w-4 h-4 mr-2" /> Add Section Box</button>
                                <button onClick={() => { if (window.confirm("Clear entire canvas?")) { setTables([]); setConnections([]); setSections([]); } }} className="w-full flex items-center px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm font-medium"><Trash2 className="w-4 h-4 mr-2 text-red-500" /> Clear Canvas</button>
                            </div>
                        </div>

                        <hr className="border-slate-200" />
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Export Data</div>
                            <div className="space-y-1">
                                <button 
                                    onClick={() => {
                                        const exportPayload = {
                                            projectName,
                                            sections: sections.map(sec => ({ ...sec, children: tables.filter(t => t.parentId === sec.id).map(t => t.id) })),
                                            tables: tables.map(t => ({ ...t, parentId: t.parentId || null })),
                                            connections
                                        };
                                        const safeFilename = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lineage.json`;
                                        triggerDownload("data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2)), safeFilename);
                                    }} 
                                    className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded transition text-sm text-left font-medium"
                                >
                                    <FileJson className="w-4 h-4 mr-2 text-blue-500" /> Save Full JSON
                                </button>
                                <button onClick={exportAsSVG} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded transition text-sm text-left font-medium"><Layers className="w-4 h-4 mr-2 text-emerald-500" /> Export as SVG</button>
                                <button onClick={exportDrawioXML} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded transition text-sm text-left font-medium"><FileDown className="w-4 h-4 mr-2 text-purple-500" /> Draw.io (XML)</button>
                            </div>
                        </div>

                        <hr className="border-slate-200" />
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Import Data</div>
                            <div className="space-y-1">
                                <button onClick={() => jsonImportRef.current?.click()} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-slate-100 rounded transition text-sm text-left"><Upload className="w-4 h-4 mr-2 text-slate-400" /> Load JSON Lineage</button>
                                <button onClick={() => sectionImportRef.current?.click()} className="w-full flex items-center px-3 py-2 text-slate-700 hover:bg-slate-100 rounded transition text-sm text-left"><Upload className="w-4 h-4 mr-2 text-emerald-500" /> Import Modular Section</button>
                                <input type="file" ref={jsonImportRef} accept=".json" className="hidden" onChange={handleImport} />
                                <input type="file" ref={sectionImportRef} accept=".json" className="hidden" onChange={handleImportSingleSection} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Interactive Canvas */}
            <div className="flex-1 flex flex-col relative w-full h-full min-w-0">
                <div className="absolute top-0 left-0 right-0 h-14 bg-white/70 backdrop-blur border-b border-slate-200 flex items-center px-3 z-20 pointer-events-none">
                    <button onClick={() => setIsSidebarOpen(true)} className={`p-2 text-slate-600 hover:bg-slate-200 rounded pointer-events-auto transition ${isSidebarOpen && !isMobile ? 'opacity-0 invisible' : 'opacity-100'}`}><Menu className="w-5 h-5" /></button>
                    <div className="flex-1"></div>
                    <div className="text-xs font-mono text-slate-500 mr-2 bg-white/80 border border-slate-200 px-2 py-1 rounded shadow-sm">{tables.length} Nodes | {validConnectionsToShow.length} Links | {sections.length} Areas</div>
                </div>

                <div
                    ref={wrapperRef}
                    className={`flex-1 relative bg-slate-50 touch-none overflow-hidden select-none ${isPanningCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: `${Math.max(20 * viewport.scale, 4)}px ${Math.max(20 * viewport.scale, 4)}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px` }}
                    onWheel={handleWheelReact} 
                    onMouseDown={handleCanvasDragStart} 
                    onTouchStart={handleCanvasDragStart}
                    onMouseMove={handleGlobalMove} 
                    onTouchMove={handleGlobalMove} 
                    onMouseUp={handleGlobalEnd} 
                    onTouchEnd={handleGlobalEnd} 
                    onMouseLeave={handleGlobalEnd}
                >
                    <div className="absolute inset-0 pointer-events-none origin-top-left" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
                        
                        {/* HIGH PERFORMANCE GHOST RENDERER */}
                        {activeDrag && (
                            <div className="absolute pointer-events-none z-[100]" style={{ left: activeDrag.x, top: activeDrag.y, width: activeDrag.w, height: activeDrag.h }}>
                                <div className="w-full h-full border-[3px] border-indigo-500 border-dashed bg-indigo-500/10 backdrop-blur-[1px] rounded-xl shadow-2xl" />
                                {(activeDrag.children || []).map(child => (
                                    <div key={child.id} className="absolute border-2 border-indigo-500/50 border-dashed bg-white/50 rounded-lg shadow-sm" style={{ left: child.dx, top: child.dy, width: child.w, height: child.h }} />
                                ))}
                            </div>
                        )}

                        {/* Memoized Sections */}
                        {sections.map(sec => (
                            <SectionBox key={sec.id} sec={sec} isGhosted={activeDrag?.id === sec.id} handlers={stableHandlers} />
                        ))}

                        {/* Memoized Connections SVG */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1, overflow: 'visible' }}>
                            {connectingFrom && (() => {
                                const sourceTable = tables.find(t => t.id === connectingFrom.tableId);
                                const startPos = getOutputNodePos(sourceTable, connectingFrom.colId, null);
                                if (!startPos) return null;
                                const isHeader = connectingFrom.colId?.includes('HEADER');
                                return <path d={isHeader ? `M ${startPos.x} ${startPos.y} L ${mousePos.x} ${mousePos.y}` : generateCurvePath(startPos.x, startPos.y, mousePos.x, mousePos.y)} fill="none" stroke="#6366f1" strokeWidth={3 / viewport.scale} strokeDasharray={isHeader ? "6,4" : "5,5"} className="opacity-70 animate-pulse pointer-events-none" />;
                            })()}
                            
                            {validConnectionsToShow.map(conn => {
                                const source = tables.find(t => t.id === conn.sourceTable);
                                const target = tables.find(t => t.id === conn.targetTable);
                                if (!source || !target) return null;
                                return <ConnectionLine key={conn.id} conn={conn} sourceTable={source} targetTable={target} isHovered={hoveredConnection === conn.id} viewportScale={viewport.scale} handlers={stableHandlers} />;
                            })}
                        </svg>

                        {/* Memoized Nodes */}
                        {tables.map(table => (
                            <TableNode key={table.id} table={table} isGhosted={activeDrag?.id === table.id || activeDrag?.children?.some(c => c.id === table.id)} handlers={stableHandlers} />
                        ))}
                    </div>
                </div>

                <div className="absolute bottom-6 right-6 flex flex-col bg-white/90 backdrop-blur border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20 pointer-events-auto">
                    <button onClick={() => doZoom(1.2)} className="p-3 hover:bg-slate-100 text-slate-600 border-b border-slate-200"><ZoomIn className="w-5 h-5" /></button>
                    <button onClick={() => setViewport({ x: 0, y: 0, scale: 1 })} className="p-3 hover:bg-slate-100 text-slate-600 border-b border-slate-200"><Home className="w-5 h-5" /></button>
                    <button onClick={() => doZoom(1 / 1.2)} className="p-3 hover:bg-slate-100 text-slate-600"><ZoomOut className="w-5 h-5" /></button>
                </div>

                {hoveredConnection && !activeDrag && !connectingFrom && hoverPos.x !== 0 && (
                    <div className="fixed z-50 bg-slate-800 text-white p-3 rounded shadow-lg text-sm max-w-xs pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px]" style={{ left: hoverPos.x, top: hoverPos.y }}>
                        <div className="flex items-center space-x-1 font-semibold mb-1 text-indigo-300"><Link2 className="w-4 h-4" /> <span>Logic</span></div>
                        <div className="whitespace-pre-wrap break-words text-slate-200 font-mono text-xs bg-slate-900 p-2 rounded border border-slate-700">{connections.find(c => c.id === hoveredConnection)?.info || "No details provided."}</div>
                        <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
                    </div>
                )}
            </div>

            {/* --- Modals --- */}
            {editingTable && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-200">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 shrink-0" style={{ backgroundColor: editingTable.color, color: getContrastText(editingTable.color) }}>
                            <h2 className="text-lg font-bold flex items-center"><Settings2 className="w-5 h-5 mr-2" /> {editingTable.isUniversal ? 'Edit Universal Node' : 'Edit Table Schema'}</h2>
                            <button onClick={() => setEditingTable(null)} className="p-1 rounded-md hover:bg-black/20 transition"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="p-4 md:p-5 overflow-y-auto flex-1 bg-white space-y-6">
                            <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Node Name</label>
                                    <input type="text" value={editingTable.name} onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                                </div>
                                <div className="shrink-0">
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center"><Palette className="w-4 h-4 mr-1.5" /> Color / Theme</label>
                                    <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                        <input type="color" value={editingTable.color || '#ffffff'} onChange={(e) => setEditingTable({ ...editingTable, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0 ml-1" />
                                        <select onChange={(e) => setEditingTable({ ...editingTable, color: e.target.value })} value={editingTable.color} className="p-1.5 bg-transparent text-sm font-medium outline-none border-none text-slate-700">
                                            <option value={editingTable.color}>Custom</option>
                                            {RANK_COLORS.map(rank => <option key={rank.name} value={rank.hex}>{rank.name}</option>)}
                                        </select>
                                        <button onClick={() => setEditingTable({ ...editingTable, color: getRandomColor() })} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded transition" title="Random Color"><RefreshCw className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>

                            {editingTable.isUniversal ? (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Display Text (Relay / Loop Label)</label>
                                    <textarea value={editingTable.text || ''} onChange={(e) => setEditingTable({ ...editingTable, text: e.target.value })} rows={3} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" placeholder="Enter routing explanation..." />
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-sm font-semibold text-slate-700">Columns Schema</label>
                                        <div className="flex space-x-2">
                                            <button onClick={() => setShowBulkPaste(!showBulkPaste)} className="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-md font-medium hover:bg-slate-200 transition flex items-center border border-slate-200"><ClipboardPaste className="w-3 h-3 mr-1" /> Paste Data</button>
                                            <button onClick={() => setEditingTable({ ...editingTable, columns: [...(editingTable.columns || []), { id: `col_${Date.now()}`, name: 'new_col', type: 'VARCHAR', description: '' }] })} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-md font-medium hover:bg-indigo-100 transition flex items-center border border-indigo-100"><Plus className="w-3 h-3 mr-1" /> Add Column</button>
                                        </div>
                                    </div>

                                    {showBulkPaste && (
                                        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg shadow-inner">
                                            <div className="flex justify-between items-center mb-2"><label className="text-xs font-semibold text-indigo-800">Paste Spreadsheet / CSV Data (Tab or Comma separated)</label><span className="text-[10px] text-indigo-500 bg-indigo-100 px-1.5 rounded">Name | Type | Description</span></div>
                                            <textarea className="w-full text-xs p-2 rounded border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[100px] font-mono" placeholder="user_id&#9;INT&#9;The primary key" value={bulkPasteText} onChange={e => setBulkPasteText(e.target.value)} />
                                            <div className="flex justify-end mt-2 space-x-2">
                                                <button onClick={() => { setShowBulkPaste(false); setBulkPasteText(''); }} className="text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded transition font-medium">Cancel</button>
                                                <button onClick={handleBulkPaste} className="text-xs px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded transition font-medium shadow-sm">Parse & Add Columns</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {(editingTable.columns || []).map((col, idx) => (
                                            <div key={col.id} className="flex flex-col bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2 relative group">
                                                <div className="flex space-x-2 items-center">
                                                    <input type="text" value={col.name} placeholder="Column Name" onChange={(e) => { const newCols = [...editingTable.columns]; newCols[idx].name = e.target.value; setEditingTable({ ...editingTable, columns: newCols }); }} className="flex-1 p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-800" />
                                                    <input type="text" value={col.type} placeholder="Type" onChange={(e) => { const newCols = [...editingTable.columns]; newCols[idx].type = e.target.value; setEditingTable({ ...editingTable, columns: newCols }); }} className="w-24 md:w-32 p-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none uppercase text-slate-600" />
                                                    <button onClick={() => { const newCols = editingTable.columns.filter((_, i) => i !== idx); setEditingTable({ ...editingTable, columns: newCols }); }} className="p-2 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded transition"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                <div className="flex space-x-2 items-center">
                                                    <div className="pl-2 text-slate-300"><Info className="w-4 h-4" /></div>
                                                    <input type="text" value={col.description || ''} placeholder="Add notes..." onChange={(e) => { const newCols = [...editingTable.columns]; newCols[idx].description = e.target.value; setEditingTable({ ...editingTable, columns: newCols }); }} className="flex-1 p-1.5 bg-transparent border-b border-transparent focus:border-indigo-300 rounded-none text-xs outline-none text-slate-500 placeholder:text-slate-400 transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                            <button onClick={() => { setTables(tables.filter(t => t.id !== editingTable.id)); setEditingTable(null); }} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center px-2 py-2 rounded hover:bg-red-50 transition"><Trash2 className="w-4 h-4 md:mr-1.5" /> <span className="hidden md:inline">Delete Node</span></button>
                            <div className="flex space-x-2 md:space-x-3">
                                <button onClick={() => setEditingTable(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition">Cancel</button>
                                <button onClick={() => { setTables(tables.map(t => t.id === editingTable.id ? editingTable : t)); setEditingTable(null); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm">Save Config</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingConnection && (() => {
                const srcTable = tables.find(t => t.id === editingConnection.sourceTable);
                const tgtTable = tables.find(t => t.id === editingConnection.targetTable);
                const srcColName = editingConnection.sourceCol?.includes('HEADER') ? 'Table Level Link' : srcTable?.columns?.find(c => c.id === editingConnection.sourceCol)?.name;
                const tgtColName = editingConnection.targetCol?.includes('HEADER') ? 'Table Level Link' : tgtTable?.columns?.find(c => c.id === editingConnection.targetCol)?.name;

                return (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50"><h2 className="text-lg font-bold text-slate-800">Edit Mapping</h2><button onClick={() => setEditingConnection(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200 transition"><X className="w-6 h-6" /></button></div>
                            <div className="p-4 md:p-5">
                                <div className="mb-4 text-sm text-slate-600 flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
                                    <div className="flex flex-col w-[40%]"><span className="text-[10px] text-slate-500 truncate">{srcTable?.name}</span><span className="font-bold text-slate-800 font-mono text-xs truncate" style={{ color: srcTable?.color }}>{srcColName}</span></div>
                                    <div className="flex flex-col items-center justify-center text-slate-400 px-2 w-[20%]"><div className="h-px w-full bg-slate-300 relative"><div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 border-4 border-transparent border-l-slate-400"></div></div></div>
                                    <div className="flex flex-col text-right w-[40%]"><span className="text-[10px] text-slate-500 truncate">{tgtTable?.name}</span><span className="font-bold text-slate-800 font-mono text-xs truncate" style={{ color: tgtTable?.color }}>{tgtColName}</span></div>
                                </div>
                                <label className="block text-sm font-semibold text-slate-700 mt-2 mb-1.5">Transformation Logic</label>
                                <textarea value={editingConnection.info} onChange={(e) => setEditingConnection({ ...editingConnection, info: e.target.value })} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-40 resize-none font-mono text-sm bg-slate-50" placeholder="e.g. COALESCE(column, 'None')" />
                            </div>
                            <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                                <button onClick={() => { setConnections(connections.filter(c => c.id !== editingConnection.id)); setEditingConnection(null); }} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center px-2 py-2 rounded hover:bg-red-50 transition"><Trash2 className="w-4 h-4 md:mr-1.5" /> <span className="hidden md:inline">Delete Line</span></button>
                                <div className="flex space-x-2 md:space-x-3">
                                    <button onClick={() => setEditingConnection(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition">Cancel</button>
                                    <button onClick={() => { setConnections(connections.map(c => c.id === editingConnection.id ? editingConnection : c)); setEditingConnection(null); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm">Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {editingSection && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50"><h2 className="text-lg font-bold text-slate-800">Edit Section Area</h2><button onClick={() => setEditingSection(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200 transition"><X className="w-6 h-6" /></button></div>
                        <div className="p-4 md:p-5 space-y-4">
                            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Section Title</label><input type="text" value={editingSection.title} onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium" /></div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Background Theme</label>
                                <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                    <input type="color" value={editingSection.color || '#f8fafc'} onChange={(e) => setEditingSection({ ...editingSection, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-slate-300 p-0" />
                                    <div className="flex flex-col font-medium"><span className="text-xs font-mono uppercase text-slate-700 font-bold">{editingSection.color}</span><span className="text-[10px] text-slate-500">Pick background color</span></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                            <button onClick={() => { setSections(sections.filter(s => s.id !== editingSection.id)); setEditingSection(null); }} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center px-2 py-2 rounded hover:bg-red-50 transition"><Trash2 className="w-4 h-4 mr-1.5" /> Delete Area</button>
                            <div className="flex space-x-2">
                                <button onClick={() => setEditingSection(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition">Cancel</button>
                                <button onClick={() => { setSections(sections.map(s => s.id === editingSection.id ? editingSection : s)); setEditingSection(null); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-sm">Save Area</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}