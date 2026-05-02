import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useReactFlow,
  type NodeProps,
  type NodeTypes,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import AgentCard from '../AgentCard'
import { Agent } from '@renderer/types/models'

// ── layout constants ──────────────────────────────────────────────
const CARD_W  = 820
const CARD_H  = 500
const GAP     = 60
const PADDING = 80
const COLS    = 2

const PLACEHOLDER_AGENTS: Agent[] = [
  { id: '1', name: 'Auth Refactor',   project_id: 'proj-1', model: 'claude-opus-4-7',   scope_path: '@Pipeline.md',     effort: 'high'   },
  { id: '2', name: 'Test Coverage',   project_id: 'proj-1', model: 'gpt-4o-mini',       scope_path: '@tests/README.md', effort: 'medium' },
  { id: '3', name: 'Docs Generator',  project_id: 'proj-1', model: 'claude-sonnet-4-6', scope_path: '',                 effort: 'low'    },
  { id: '4', name: 'Lint Fixer',      project_id: 'proj-1', model: 'gpt-4o',            scope_path: '@.eslintrc.md',    effort: 'low'    },
  { id: '5', name: 'Schema Migrator', project_id: 'proj-1', model: 'claude-haiku-4-5',  scope_path: '@schema.md',       effort: 'medium' },
  { id: '6', name: 'CI Optimizer',    project_id: 'proj-1', model: 'o3',                scope_path: '',                 effort: 'high'   },
]
// ─────────────────────────────────────────────────────────────────

function buildNodes(agents: Agent[]): Node[] {
  const rows    = Math.ceil(agents.length / COLS)
  const canvasW = COLS * CARD_W + (COLS - 1) * GAP + PADDING * 2
  const canvasH = rows  * CARD_H + (rows  - 1) * GAP + PADDING * 2

  return [
    // boundary — renders behind everything
    {
      id: '__boundary__',
      type: 'boundary',
      position: { x: -PADDING, y: -PADDING },
      data: { width: canvasW, height: canvasH },
      width: canvasW,
      height: canvasH,
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
    } as Node,

    // agent cards
    ...agents.map((agent, i) => ({
      id: agent.id,
      type: 'agentCard',
      position: {
        x: (i % COLS) * (CARD_W + GAP),
        y: Math.floor(i / COLS) * (CARD_H + GAP),
      },
      data: { agent },
      width: CARD_W,
      height: CARD_H,
      draggable: false,
      selectable: true,
      focusable: true,
    } as Node)),
  ]
}

// ── node: canvas boundary ─────────────────────────────────────────
function BoundaryNode({ data }: NodeProps) {
  return (
    <div
      style={{ width: data.width as number, height: data.height as number }}
      className="border border-white/10 rounded-sm pointer-events-none"
    />
  )
}

// ── node: agent card ──────────────────────────────────────────────
function AgentCardNode({ selected }: NodeProps) {
  return (
    <div
      className={`rounded-xl transition-all duration-150 ${
        selected ? 'ring-2 ring-white/30 ring-offset-4 ring-offset-neutral-950' : ''
      }`}
    >
      <AgentCard />
    </div>
  )
}

// stable outside component
const nodeTypes: NodeTypes = {
  boundary:  BoundaryNode,
  agentCard: AgentCardNode,
}

// ── inner canvas ──────────────────────────────────────────────────
function CanvasInner() {
  const agents = PLACEHOLDER_AGENTS
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(agents))
  const { setCenter } = useReactFlow()
  const selectedIdxRef = useRef(0)

  const selectAt = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, agents.length - 1))
    selectedIdxRef.current = clamped
    setNodes(nds =>
      nds.map(n => ({ ...n, selected: n.id === agents[clamped].id }))
    )
    setCenter(
      (clamped % COLS) * (CARD_W + GAP) + CARD_W / 2,
      Math.floor(clamped / COLS) * (CARD_H + GAP) + CARD_H / 2,
      { zoom: 1, duration: 300 },
    )
  }, [agents, setCenter, setNodes])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      e.preventDefault()
      const idx = selectedIdxRef.current
      if (e.key === 'ArrowRight') selectAt(idx + 1)
      if (e.key === 'ArrowLeft')  selectAt(idx - 1)
      if (e.key === 'ArrowDown')  selectAt(idx + COLS)
      if (e.key === 'ArrowUp')    selectAt(idx - COLS)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectAt])

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    if (!sel.length) return
    const idx = agents.findIndex(a => a.id === sel[0].id)
    if (idx !== -1) selectedIdxRef.current = idx
  }, [agents])

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      onNodesChange={onNodesChange}
      onSelectionChange={onSelectionChange}
      nodeTypes={nodeTypes}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      minZoom={1}
      maxZoom={1}
      panOnScroll
      panOnScrollMode={'free' as any}
      panOnDrag
      nodesDraggable={false}
      nodesConnectable={false}
      selectNodesOnDrag={false}
      defaultViewport={{ x: PADDING, y: PADDING, zoom: 1 }}
      proOptions={{ hideAttribution: true }}
      className="bg-neutral-950"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#ffffff18"
      />
    </ReactFlow>
  )
}

// ── export ────────────────────────────────────────────────────────
export default function ControlPanel() {
  return (
    <ReactFlowProvider>
      <div className="w-full h-full">
        <CanvasInner />
      </div>
    </ReactFlowProvider>
  )
}
