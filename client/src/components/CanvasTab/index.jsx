import { useState, useRef, useCallback, useEffect } from 'react';
import { NODE_TYPES } from '../../constants.js';
import { exportCanvasExcel } from '../../services/api.js';

const W = 162, H = 42;

function makeId() { return `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export default function CanvasTab({ analysis, canvas, setCanvas }) {
  const svgRef    = useRef();
  const [mode,    setMode]    = useState('select'); // select | connect
  const [addType, setAddType] = useState('ACTION');
  const [drag,    setDrag]    = useState(null);     // { nodeId, ox, oy }
  const [conn,    setConn]    = useState(null);     // { from, x, y }
  const [editNode,setEditNode]= useState(null);
  const [ctx,     setCtx]     = useState(null);     // { x, y, nodeId }
  const [wfName,  setWfName]  = useState('');
  const [activeWf,setActiveWf]= useState(null);

  const nodes     = canvas.nodes     || [];
  const edges     = canvas.edges     || [];
  const workflows = canvas.workflows || [];

  const setNodes     = fn => setCanvas(c => ({ ...c, nodes:     typeof fn === 'function' ? fn(c.nodes     || []) : fn }));
  const setEdges     = fn => setCanvas(c => ({ ...c, edges:     typeof fn === 'function' ? fn(c.edges     || []) : fn }));
  const setWorkflows = fn => setCanvas(c => ({ ...c, workflows: typeof fn === 'function' ? fn(c.workflows || []) : fn }));

  const getNode = id => nodes.find(n => n.id === id);

  /* ── Auto-populate from analysis ───────────────────── */
  const autoPopulate = () => {
    const pages = analysis.pages || [];
    if (!pages.length) return;
    const newNodes = []; const newEdges = [];
    let x = 80;
    pages.forEach((page, pi) => {
      const pid = makeId();
      newNodes.push({ id: pid, type: 'PAGE', label: page.name, x, y: 60 });
      let y = 150;
      (page.components || []).slice(0, 5).forEach(comp => {
        const cid = makeId();
        const type = comp.type === 'button' ? 'ACTION' : comp.type === 'input' ? 'ACTION' : 'ASSERTION';
        newNodes.push({ id: cid, type, label: comp.name, x, y });
        newEdges.push({ id: makeId(), from: pid, to: cid });
        y += 60;
      });
      const dbForPage = (analysis.dbQueries || []).slice(pi * 2, pi * 2 + 2);
      dbForPage.forEach(q => {
        const did = makeId();
        newNodes.push({ id: did, type: 'DB_CHECK', label: `${q.operation}: ${q.table}`, x: x + 200, y });
        newEdges.push({ id: makeId(), from: pid, to: did });
        y += 60;
      });
      x += 420;
    });
    setNodes(ns => [...ns, ...newNodes]);
    setEdges(es => [...es, ...newEdges]);
  };

  /* ── Mouse handlers ─────────────────────────────────── */
  const onNodeMouseDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    if (mode === 'connect') {
      setConn({ from: nodeId, x: e.clientX, y: e.clientY });
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    setDrag({ nodeId, ox: e.clientX - rect.left - node.x, oy: e.clientY - rect.top - node.y });
  }, [mode, nodes]);

  const onSvgMouseMove = useCallback((e) => {
    if (drag && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setNodes(ns => ns.map(n => n.id === drag.nodeId
        ? { ...n, x: e.clientX - rect.left - drag.ox, y: e.clientY - rect.top - drag.oy }
        : n
      ));
    }
    if (conn) setConn(c => c ? { ...c, x: e.clientX, y: e.clientY } : null);
  }, [drag, conn]);

  const onSvgMouseUp = useCallback((e, targetId) => {
    if (conn && targetId && targetId !== conn.from) {
      setEdges(es => [...es, { id: makeId(), from: conn.from, to: targetId }]);
    }
    setDrag(null);
    setConn(null);
  }, [conn]);

  /* ── Canvas click handlers ──────────────────────────── */
  const onCanvasClick = (e) => {
    if (mode === 'addNode') {
      const rect = svgRef.current.getBoundingClientRect();
      const id = makeId();
      setNodes(ns => [...ns, { id, type: addType, label: addType, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    }
    setCtx(null);
  };

  const onNodeDblClick = node => setEditNode({ ...node });
  const onNodeRightClick = (e, nodeId) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, nodeId }); };

  const deleteNode = (nodeId) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e => e.from !== nodeId && e.to !== nodeId));
    setCtx(null);
  };

  /* ── Workflow management ────────────────────────────── */
  const saveWorkflow = () => {
    if (!wfName.trim()) return;
    const nodeIds = nodes.map(n => n.id);
    setWorkflows(wfs => {
      const idx = wfs.findIndex(w => w.name === wfName);
      if (idx >= 0) return wfs.map((w, i) => i === idx ? { ...w, nodes: nodeIds, updatedAt: new Date().toLocaleString() } : w);
      return [...wfs, { id: makeId(), name: wfName.trim(), nodes: nodeIds, createdAt: new Date().toLocaleString() }];
    });
    setWfName('');
  };

  /* ── Export Excel ───────────────────────────────────── */
  const doExport = () => exportCanvasExcel({ nodes, edges, workflows }).catch(console.error);

  return (
    <div className="canvas-wrap" onClick={() => setCtx(null)}>
      {/* Sidebar */}
      <div className="canvas-sidebar">
        <div style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted2)', borderBottom: '1px solid var(--border)', background: 'var(--code-bg)' }}>
          Workflows
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {workflows.map(wf => (
            <div key={wf.id} className={`workflow-item${activeWf === wf.id ? ' active' : ''}`} onClick={() => setActiveWf(wf.id)}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{wf.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'JetBrains Mono' }}>{wf.nodes?.length} nodes · {wf.createdAt?.split(',')[0]}</div>
              </div>
            </div>
          ))}
          {!workflows.length && <div style={{ padding: 14, fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--muted2)' }}>// No workflows yet</div>}
        </div>
        <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="input" placeholder="Workflow name..." value={wfName} onChange={e => setWfName(e.target.value)}
              style={{ fontSize: 11, padding: '5px 8px' }}
              onKeyDown={e => e.key === 'Enter' && saveWorkflow()} />
            <button className="btn btn-primary btn-sm" onClick={saveWorkflow}>+</button>
          </div>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="canvas-main">
        {/* Toolbar */}
        <div className="canvas-toolbar">
          <button className={`btn btn-sm ${mode === 'select' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setMode('select')}>✦ SELECT</button>
          <button className={`btn btn-sm ${mode === 'connect' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setMode('connect')}>⟶ CONNECT</button>
          <button className={`btn btn-sm ${mode === 'addNode' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setMode('addNode')}>+ PLACE</button>
          <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
          <select className="select" value={addType} onChange={e => setAddType(e.target.value)}
            style={{ width: 110, padding: '4px 8px', fontSize: 11 }}>
            {Object.keys(NODE_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={autoPopulate}>⚡ AUTO-POPULATE</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNodes([]); setEdges([]); }}>🗑 CLEAR</button>
            <button className="btn btn-secondary btn-sm" onClick={doExport}>↓ EXCEL</button>
          </div>
        </div>

        {mode === 'connect' && (
          <div style={{ padding: '4px 12px', background: 'rgba(6,182,212,.1)', borderBottom: '1px solid rgba(6,182,212,.3)', fontSize: 11, color: 'var(--cyan)', fontFamily: 'JetBrains Mono' }}>
            CONNECT MODE — click source node, then drag to target node
          </div>
        )}
        {mode === 'addNode' && (
          <div style={{ padding: '4px 12px', background: 'rgba(245,158,11,.08)', borderBottom: '1px solid rgba(245,158,11,.3)', fontSize: 11, color: 'var(--amber)', fontFamily: 'JetBrains Mono' }}>
            PLACE MODE — click anywhere on canvas to drop a {addType} node
          </div>
        )}

        {/* SVG canvas */}
        <div className="canvas-area"
          onMouseMove={onSvgMouseMove}
          onMouseUp={() => onSvgMouseUp()}
          onClick={onCanvasClick}
        >
          <svg ref={svgRef} className="canvas-svg">
            <defs>
              <pattern id="cg" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(30,45,74,.5)" strokeWidth=".5" />
              </pattern>
              {Object.entries(NODE_TYPES).map(([k, nt]) => (
                <marker key={k} id={`arr-${k}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0 0 L0 6 L9 3z" fill={nt.color} opacity=".8" />
                </marker>
              ))}
              <marker id="arr-tmp" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0 0 L0 6 L9 3z" fill="var(--cyan)" opacity=".8" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#cg)" />

            {/* Edges */}
            {edges.map(e => {
              const n1 = getNode(e.from); const n2 = getNode(e.to);
              if (!n1 || !n2) return null;
              const nt = NODE_TYPES[n1.type] || NODE_TYPES.ACTION;
              const x1 = n1.x + W / 2, y1 = n1.y + H, x2 = n2.x + W / 2, y2 = n2.y;
              const cy = (y1 + y2) / 2;
              return (
                <path key={e.id}
                  d={`M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`}
                  fill="none" stroke={nt.color} strokeWidth="1.5" strokeOpacity=".45"
                  markerEnd={`url(#arr-${n1.type})`} />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const nt = NODE_TYPES[node.type] || NODE_TYPES.ACTION;
              const lbl = node.label.length > 16 ? node.label.slice(0, 14) + '..' : node.label;
              return (
                <g key={node.id} className="canvas-node"
                  transform={`translate(${node.x},${node.y})`}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onMouseUp={e => { e.stopPropagation(); onSvgMouseUp(e, node.id); }}
                  onDoubleClick={() => onNodeDblClick(node)}
                  onContextMenu={e => onNodeRightClick(e, node.id)}
                >
                  <rect width={W} height={H} fill={`${nt.color}18`} stroke={nt.color} strokeWidth="1.5" rx="3" />
                  <rect width={4} height={H} fill={nt.color} rx="2" />
                  <text x={12} y={13} fill={nt.color} fontSize={8} fontFamily="JetBrains Mono" fontWeight="700" letterSpacing="1.5">{nt.label}</text>
                  <text x={12} y={30} fill="#e2e8f0" fontSize={11} fontFamily="JetBrains Mono">{lbl}</text>
                </g>
              );
            })}

            {/* Temp connect line */}
            {conn && svgRef.current && (() => {
              const n = getNode(conn.from); if (!n) return null;
              const rect = svgRef.current.getBoundingClientRect();
              return <line x1={n.x + W / 2} y1={n.y + H / 2} x2={conn.x - rect.left} y2={conn.y - rect.top}
                stroke="var(--cyan)" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#arr-tmp)" />;
            })()}
          </svg>

          {!nodes.length && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--muted)', textAlign: 'center', gap: 8 }}>
              <div style={{ fontSize: 40, opacity: .25 }}>⬡</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>Canvas is empty</div>
              <div style={{ fontSize: 11, color: 'var(--border2)' }}>Use AUTO-POPULATE or PLACE mode to add nodes</div>
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctx && (
        <div className="ctx-menu" style={{ top: ctx.y, left: ctx.x }} onClick={e => e.stopPropagation()}>
          <div className="ctx-item" onClick={() => { const n = getNode(ctx.nodeId); if (n) setEditNode({ ...n }); setCtx(null); }}>✏ Edit Label</div>
          <div className="ctx-sep" />
          {Object.keys(NODE_TYPES).map(t => (
            <div key={t} className="ctx-item" onClick={() => { setNodes(ns => ns.map(n => n.id === ctx.nodeId ? { ...n, type: t } : n)); setCtx(null); }}>
              Change → {t}
            </div>
          ))}
          <div className="ctx-sep" />
          <div className="ctx-item danger" onClick={() => deleteNode(ctx.nodeId)}>🗑 Delete Node</div>
        </div>
      )}

      {/* Edit node modal */}
      {editNode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000 }}
          onClick={() => setEditNode(null)}>
          <div className="card" style={{ width: 320, background: 'var(--panel2)' }} onClick={e => e.stopPropagation()}>
            <div className="card-title">Edit Node</div>
            <div className="field">
              <label>Label</label>
              <input className="input" value={editNode.label} autoFocus
                onChange={e => setEditNode(n => ({ ...n, label: e.target.value }))} />
            </div>
            <div className="field">
              <label>Type</label>
              <select className="select" value={editNode.type} onChange={e => setEditNode(n => ({ ...n, type: e.target.value }))}>
                {Object.keys(NODE_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setEditNode(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={() => { setNodes(ns => ns.map(n => n.id === editNode.id ? { ...n, ...editNode } : n)); setEditNode(null); }}>SAVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
