// ── placeholder data ──────────────────────────────────────────────
const AGENT_NAME = 'Agent One'
const MODEL_NAME = 'claude-opus-4-7'
const CURRENT_TASK = 'Refactor the authentication middleware to meet the new compliance requirements.'
const PRIORITY: 'low' | 'medium' | 'high' = 'medium'
const SCOPE = '@Pipeline.md'
const TASK_LIST = [
  'Research existing auth patterns',
  'Draft new session token schema',
  'Implement middleware changes',
  'Write integration tests',
]
const TERMINAL_OUTPUT = [
  '> Initializing agent context...',
  '> Loading scope: @Pipeline.md',
  '> Hello Assistant!',
  '> Awaiting instructions...',
]
// ─────────────────────────────────────────────────────────────────

const PRIORITY_LEVELS = ['low', 'medium', 'high'] as const

const priorityColor: Record<typeof PRIORITY_LEVELS[number], string> = {
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  high: 'bg-red-500/20 text-red-400 border-red-500/40',
}

export default function AgentCard() {
  return (
    <div
      className="flex flex-col rounded-xl border border-white/10 bg-neutral-900 text-white overflow-hidden shadow-2xl"
      style={{ width: 820, height: 500 }}
    >
      {/* header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-neutral-800 shrink-0">
        <span className="font-semibold tracking-wide">{AGENT_NAME}</span>
        <button className="text-xs px-3 py-1 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors">
          Terminate
        </button>
      </div>

      {/* body */}
      <div className="flex flex-1 overflow-hidden">

        {/* left panel */}
        <div className="flex flex-col w-[280px] shrink-0 border-r border-white/10 px-4 py-4 gap-5">

          {/* current task */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Current Task</span>
            <div className="mt-1 rounded-md bg-neutral-800 border border-white/5 px-3 py-2 text-sm text-neutral-300 leading-snug">
              {CURRENT_TASK}
            </div>
          </div>

          {/* task list */}
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Task List</span>
            <ol className="mt-1 flex flex-col gap-1">
              {TASK_LIST.map((task, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-400">
                  <span className="text-neutral-600 tabular-nums shrink-0">{i + 1}.</span>
                  {task}
                </li>
              ))}
            </ol>
          </div>

          {/* model */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium">Model</span>
            <span className="text-sm text-neutral-300 font-mono">{MODEL_NAME}</span>
          </div>
        </div>

        {/* right panel */}
        <div className="flex flex-col flex-1 px-4 py-4 gap-4">

          {/* priority + scope row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {PRIORITY_LEVELS.map(level => (
                <span
                  key={level}
                  className={`text-[11px] px-2 py-0.5 rounded border capitalize
                    ${PRIORITY === level
                      ? priorityColor[level]
                      : 'border-white/5 text-neutral-600 bg-transparent'
                    }`}
                >
                  {level}
                </span>
              ))}
            </div>
            <span className="text-xs text-neutral-500">
              Scope: <span className="text-blue-400 font-mono">{SCOPE}</span>
            </span>
          </div>

          {/* terminal */}
          <div className="flex flex-col flex-1 rounded-md border border-white/10 bg-neutral-950 overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-neutral-900 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              <span className="ml-2 text-[10px] text-neutral-600 font-mono">terminal</span>
            </div>
            <div className="flex-1 px-4 py-3 font-mono text-xs text-emerald-400 leading-relaxed overflow-auto">
              {TERMINAL_OUTPUT.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              <span className="animate-pulse">▊</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
