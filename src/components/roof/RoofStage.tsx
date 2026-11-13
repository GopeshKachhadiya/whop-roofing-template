// Loads the WebGL scene in the browser only, and shows a drawn roof until it
// is ready (or for good, if WebGL is unavailable).
import { Component, Suspense, lazy, useRef, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { useMediaQuery, useMounted } from '#/lib/useMediaQuery'

const RoofScene = lazy(() => import('./RoofScene'))

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** A flat drawing of the same roof build-up, used before and instead of 3D. */
export function RoofDrawing({ faded = false }: { faded?: boolean }) {
  const layers = [
    { y: 250, fill: '#6f8a45' },
    { y: 214, fill: '#c9a56c' },
    { y: 178, fill: '#5d7b8a' },
    { y: 142, fill: '#2e363b' },
  ]
  return (
    <svg
      viewBox="0 0 640 420"
      className="absolute inset-0 m-auto h-full max-h-[78%] w-full max-w-[86%] transition-opacity duration-500"
      style={{ opacity: faded ? 0 : 1 }}
      aria-hidden="true"
    >
      {layers.map((layer) => (
        <g key={layer.y}>
          <path d={`M90 ${layer.y} 320 ${layer.y - 96} 550 ${layer.y} 320 ${layer.y + 96}Z`} fill={layer.fill} opacity="0.92" />
          <path d={`M90 ${layer.y} 320 ${layer.y + 96} 550 ${layer.y}`} fill="none" stroke="rgb(255 255 255 / 0.5)" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  )
}

export interface RoofStageProps {
  progress: MutableRefObject<number>
  active: MutableRefObject<number>
  layers: ReadonlyArray<{ key: string; name: string }>
  night: boolean
}

export function RoofStage({ progress, active, layers, night }: RoofStageProps) {
  const mounted = useMounted()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const wide = useMediaQuery('(min-width: 1024px)')
  const [ready, setReady] = useState(false)
  const callouts = useRef<HTMLDivElement>(null)

  return (
    <div className="absolute inset-0">
      <RoofDrawing faded={ready} />
      {mounted ? (
        <SceneBoundary fallback={null}>
          <Suspense fallback={null}>
            <RoofScene
              // Motion and lighting are fixed when the scene is built.
              key={`${reducedMotion}-${night}`}
              progress={progress}
              active={active}
              callouts={callouts}
              reducedMotion={reducedMotion}
              night={night}
              onReady={() => setReady(true)}
            />
          </Suspense>
        </SceneBoundary>
      ) : null}
      {/* Names for the lifted layers. The scene moves these every frame. */}
      <div ref={callouts} className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {wide
          ? layers.map((layer, index) => (
              <div key={layer.key} data-roof-label={index} className="roof-label type-note">
                <span>{layer.name}</span>
              </div>
            ))
          : null}
      </div>
    </div>
  )
}
