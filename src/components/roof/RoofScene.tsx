// The 3D roof. A gable house whose roof system lifts apart, layer by layer,
// as `progress` goes from 0 (assembled) to 1 (exploded). Everything is built
// from primitives and two small procedural textures, so there are no model
// or image files to ship.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import * as THREE from 'three'

export interface RoofSceneProps {
  /** 0 assembled, 1 exploded. Read every frame, so changing it never re-renders. */
  progress: MutableRefObject<number>
  /** Index of the layer being talked about, or -1. */
  active: MutableRefObject<number>
  /** Holds one [data-roof-label] element per layer; the scene positions them. */
  callouts: RefObject<HTMLDivElement | null>
  reducedMotion: boolean
  /** Warm, lit windows and a cooler moon instead of the sun. */
  night: boolean
  onReady?: () => void
}

// House, in metres-ish units. X runs along the ridge, Z is front to back.
const WALL_W = 6
const WALL_D = 4.4
const WALL_H = 2
const OVERHANG = 0.3
const RUN = WALL_D / 2 + OVERHANG
const RISE = 1.6
const ROOF_L = WALL_W + OVERHANG * 2
const SLOPE = Math.hypot(RUN, RISE)
const PITCH = Math.atan2(RISE, RUN)
const RIDGE_Y = WALL_H + (WALL_D / 2) * Math.tan(PITCH)

const LAYER_KEYS = ['framing', 'decking', 'barrier', 'underlayment', 'shingles', 'ridge'] as const
/** How far each layer travels along the roof normal when fully exploded. */
const LIFT = [0, 0.42, 0.86, 1.3, 1.84, 2.4]
/** Seconds after load at which each layer drops into place. */
const INTRO_AT = [0, 0.1, 0.32, 0.5, 0.72, 1.9]
const INTRO_END = 2.6

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeat: [number, number]) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function useMaterials(night: boolean) {
  return useMemo(() => {
    const random = seeded(7)

    // OSB sheathing: pressed wood flakes with sheet seams.
    const osb = canvasTexture(
      256,
      (ctx, size) => {
        ctx.fillStyle = '#c9a56c'
        ctx.fillRect(0, 0, size, size)
        for (let i = 0; i < 900; i += 1) {
          const tone = 150 + Math.floor(random() * 70)
          ctx.fillStyle = `rgba(${tone + 40}, ${tone}, ${tone - 70}, 0.35)`
          ctx.save()
          ctx.translate(random() * size, random() * size)
          ctx.rotate(random() * Math.PI)
          ctx.fillRect(0, 0, 6 + random() * 16, 2 + random() * 4)
          ctx.restore()
        }
        ctx.strokeStyle = 'rgba(70, 48, 20, 0.55)'
        ctx.lineWidth = 2
        ctx.strokeRect(1, 1, size - 2, size - 2)
      },
      [3, 2],
    )

    // Synthetic underlayment: woven grey-blue with printed lap lines.
    const felt = canvasTexture(
      256,
      (ctx, size) => {
        ctx.fillStyle = '#5d7b8a'
        ctx.fillRect(0, 0, size, size)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
        ctx.lineWidth = 1
        for (let i = 0; i < size; i += 6) {
          ctx.beginPath()
          ctx.moveTo(i, 0)
          ctx.lineTo(i, size)
          ctx.stroke()
        }
        ctx.strokeStyle = 'rgba(232, 240, 244, 0.6)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, size - 26)
        ctx.lineTo(size, size - 26)
        ctx.stroke()
        ctx.fillStyle = 'rgba(232, 240, 244, 0.5)'
        for (let x = 14; x < size; x += 48) ctx.fillRect(x, size - 60, 16, 3)
      },
      [4, 5],
    )

    const siding = canvasTexture(
      128,
      (ctx, size) => {
        ctx.fillStyle = '#f1f3f3'
        ctx.fillRect(0, 0, size, size)
        ctx.fillStyle = 'rgba(21, 35, 43, 0.16)'
        ctx.fillRect(0, size - 5, size, 5)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(0, 0, size, 3)
      },
      [1, 9],
    )

    const make = (color: string, options: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...options })

    return {
      framing: make('#dcbd8c', { roughness: 0.8 }),
      decking: make('#ffffff', { map: osb, roughness: 0.95 }),
      barrier: make('#20272c', { roughness: 0.55 }),
      metal: make('#d5dce0', { roughness: 0.32, metalness: 0.75 }),
      underlayment: make('#ffffff', { map: felt, roughness: 0.8 }),
      shingles: make('#ffffff', { roughness: 0.96 }),
      ridge: make('#272e33', { roughness: 0.95 }),
      wall: make('#f4efe6', { map: siding, roughness: 0.85 }),
      trim: make('#fbf8f1', { roughness: 0.7 }),
      glass: make(night ? '#6b4a22' : '#27404f', {
        roughness: 0.15,
        metalness: 0.3,
        emissive: new THREE.Color('#ffb25a'),
        emissiveIntensity: night ? 1.5 : 0.08,
      }),
      door: make('#ff4500', { roughness: 0.5 }),
      stone: make('#8c8a82', { roughness: 1 }),
      grass: make('#6f8a45', { roughness: 1 }),
      soil: make('#3b2b20', { roughness: 1 }),
      rock: make('#272019', { roughness: 1 }),
      leaf: make('#4f6f35', { roughness: 1, flatShading: true }),
      leafLight: make('#7a9447', { roughness: 1, flatShading: true }),
      bark: make('#4a3626', { roughness: 1 }),
    }
  }, [night])
}

type Materials = ReturnType<typeof useMaterials>

/** One course-laid field of shingles, drawn as a single instanced mesh. */
function Shingles({ material, intro, startAt }: { material: THREE.Material; intro: boolean; startAt: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const { invalidate } = useThree()

  const tabs = useMemo(() => {
    const random = seeded(31)
    const width = 0.44
    const length = 0.34
    const exposure = 0.225
    const courses = Math.floor((SLOPE - 0.2) / exposure)
    const list: Array<{ x: number; z: number; scaleX: number; course: number; delay: number; color: THREE.Color }> = []
    const base = new THREE.Color('#353f46')
    for (let course = 0; course < courses; course += 1) {
      const z = SLOPE - length / 2 - course * exposure + 0.02
      const shift = course % 2 === 0 ? 0 : width / 2
      for (let left = -ROOF_L / 2 - shift; left < ROOF_L / 2; left += width) {
        const from = Math.max(left, -ROOF_L / 2)
        const to = Math.min(left + width, ROOF_L / 2)
        if (to - from < 0.04) continue
        const color = base.clone()
        const shade = (random() - 0.5) * 0.045
        color.offsetHSL(0, random() * 0.02, shade)
        if (random() > 0.93) color.lerp(new THREE.Color('#47525a'), 0.45)
        list.push({ x: (from + to) / 2, z, scaleX: (to - from) / width - 0.012, course, delay: random() * 0.1, color })
      }
    }
    return { list, width, length, courses, tilt: Math.atan2(0.034, exposure) }
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const startedAt = useRef(0)
  const done = useRef(false)

  const place = (time: number) => {
    const target = mesh.current
    if (!target) return
    tabs.list.forEach((tab, index) => {
      const local = intro ? clamp01((time - startAt - tab.course * 0.085 - tab.delay) / 0.42) : 1
      const eased = easeOutCubic(local)
      dummy.position.set(tab.x, 0.02 + tab.course * 0.0008 + (1 - eased) * 0.7, tab.z)
      dummy.rotation.set(-tabs.tilt - (1 - eased) * 0.5, 0, 0)
      dummy.scale.set(tab.scaleX * (0.4 + 0.6 * eased), 1, local <= 0 ? 0.0001 : 1)
      dummy.updateMatrix()
      target.setMatrixAt(index, dummy.matrix)
    })
    target.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    tabs.list.forEach((tab, index) => target.setColorAt(index, tab.color))
    if (target.instanceColor) target.instanceColor.needsUpdate = true
    place(intro ? 0 : 99)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  useFrame(() => {
    if (!intro || done.current) return
    // Wall-clock time: the roof finishes laying on schedule even on a slow GPU.
    const now = performance.now()
    if (startedAt.current === 0) startedAt.current = now
    const elapsed = (now - startedAt.current) / 1000
    place(elapsed)
    if (elapsed > startAt + tabs.courses * 0.085 + 0.6) done.current = true
    else invalidate()
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, tabs.list.length]} material={material} castShadow receiveShadow>
      <boxGeometry args={[tabs.width, 0.034, tabs.length]} />
    </instancedMesh>
  )
}

/**
 * One roof slope. Local axes: X along the ridge, Z down the slope from the
 * ridge (0) to the eave (SLOPE), Y out of the roof. Each layer sits in its own
 * group so the scene can lift it along Y.
 */
function Slope({ materials, anchors, intro }: { materials: Materials; anchors: boolean; intro: boolean }) {
  const rafterXs = useMemo(() => {
    const xs: number[] = []
    for (let x = -WALL_W / 2 + 0.05; x <= WALL_W / 2; x += 0.59) xs.push(x)
    return xs
  }, [])
  const capXs = useMemo(() => {
    const xs: number[] = []
    for (let x = -ROOF_L / 2 + 0.2; x < ROOF_L / 2; x += 0.4) xs.push(x)
    return xs
  }, [])

  // A point on the outer corner of each layer that its callout line starts from.
  const anchor = (index: number, y: number, z: number, x = -ROOF_L / 2) =>
    anchors ? <object3D userData={{ anchor: index }} position={[x, y, z]} /> : null

  return (
    <group position={[0, RIDGE_Y, 0]} rotation={[PITCH, 0, 0]}>
      <group userData={{ layer: 0 }}>
        {rafterXs.map((x) => (
          <mesh key={x} position={[x, -0.11, SLOPE / 2 - 0.02]} material={materials.framing} castShadow receiveShadow>
            <boxGeometry args={[0.085, 0.2, SLOPE - 0.06]} />
          </mesh>
        ))}
        {anchor(0, -0.11, SLOPE - 0.05, -WALL_W / 2 + 0.05)}
      </group>

      <group userData={{ layer: 1 }}>
        <mesh position={[0, 0.02, SLOPE / 2]} material={materials.decking} castShadow receiveShadow>
          <boxGeometry args={[ROOF_L, 0.045, SLOPE]} />
        </mesh>
        {anchor(1, 0.02, SLOPE)}
      </group>

      <group userData={{ layer: 2 }}>
        <mesh position={[0, 0.05, SLOPE - SLOPE * 0.15]} material={materials.barrier} castShadow receiveShadow>
          <boxGeometry args={[ROOF_L, 0.014, SLOPE * 0.3]} />
        </mesh>
        <mesh position={[0, 0.045, SLOPE + 0.03]} material={materials.metal} castShadow>
          <boxGeometry args={[ROOF_L + 0.02, 0.07, 0.06]} />
        </mesh>
        {anchor(2, 0.05, SLOPE - 0.02)}
      </group>

      <group userData={{ layer: 3 }}>
        <mesh position={[0, 0.066, SLOPE / 2 - 0.01]} material={materials.underlayment} castShadow receiveShadow>
          <boxGeometry args={[ROOF_L - 0.02, 0.012, SLOPE - 0.02]} />
        </mesh>
        {anchor(3, 0.066, SLOPE - 0.03)}
      </group>

      <group userData={{ layer: 4 }} position={[0, 0.074, 0]}>
        <Shingles material={materials.shingles} intro={intro} startAt={INTRO_AT[4]} />
        {anchor(4, 0.02, SLOPE)}
      </group>

      <group userData={{ layer: 5 }}>
        {capXs.map((x) => (
          <mesh key={x} position={[x, 0.135, 0.12]} rotation={[0, 0, 0.05]} material={materials.ridge} castShadow>
            <boxGeometry args={[0.44, 0.03, 0.27]} />
          </mesh>
        ))}
        {anchor(5, 0.135, 0.12)}
      </group>
    </group>
  )
}

function Body({ materials }: { materials: Materials }) {
  const gable = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-WALL_D / 2, 0)
    shape.lineTo(WALL_D / 2, 0)
    shape.lineTo(0, RIDGE_Y - WALL_H - 0.02)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false })
    geometry.translate(0, 0, -0.06)
    return geometry
  }, [])

  const window = (x: number, y: number, z: number, rotationY = 0, key?: string) => (
    <group key={key} position={[x, y, z]} rotation={[0, rotationY, 0]}>
      <mesh material={materials.trim}>
        <boxGeometry args={[0.92, 1.02, 0.07]} />
      </mesh>
      <mesh position={[0, 0, 0.02]} material={materials.glass}>
        <boxGeometry args={[0.76, 0.86, 0.06]} />
      </mesh>
      <mesh position={[0, 0, 0.05]} material={materials.trim}>
        <boxGeometry args={[0.04, 0.86, 0.02]} />
      </mesh>
    </group>
  )

  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={materials.stone} receiveShadow>
        <boxGeometry args={[WALL_W + 0.16, 0.2, WALL_D + 0.16]} />
      </mesh>
      <mesh position={[0, WALL_H / 2 + 0.1, 0]} material={materials.wall} castShadow receiveShadow>
        <boxGeometry args={[WALL_W, WALL_H - 0.2, WALL_D]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={gable}
          position={[(side * WALL_W) / 2 - side * 0.06, WALL_H, 0]}
          rotation={[0, Math.PI / 2, 0]}
          material={materials.trim}
          castShadow
          receiveShadow
        />
      ))}

      {/* Front: door with a stoop, two windows. */}
      <group position={[-0.2, 0, WALL_D / 2]}>
        <mesh position={[0, 1.02, 0.02]} material={materials.trim}>
          <boxGeometry args={[0.98, 1.74, 0.07]} />
        </mesh>
        <mesh position={[0, 0.98, 0.05]} material={materials.door}>
          <boxGeometry args={[0.8, 1.56, 0.06]} />
        </mesh>
        <mesh position={[0.28, 0.98, 0.09]} material={materials.metal}>
          <sphereGeometry args={[0.035, 12, 12]} />
        </mesh>
        <mesh position={[0, 0.1, 0.34]} material={materials.stone} receiveShadow castShadow>
          <boxGeometry args={[1.5, 0.2, 0.6]} />
        </mesh>
      </group>
      {window(-1.95, 1.2, WALL_D / 2 + 0.02, 0, 'front-left')}
      {window(1.6, 1.2, WALL_D / 2 + 0.02, 0, 'front-right')}

      {/* Gable end facing the camera. */}
      {window(WALL_W / 2 + 0.02, 1.2, 0.9, Math.PI / 2, 'side-a')}
      {window(WALL_W / 2 + 0.02, 1.2, -0.9, Math.PI / 2, 'side-b')}
      <mesh position={[WALL_W / 2 + 0.03, WALL_H + 0.62, 0]} rotation={[0, Math.PI / 2, 0]} material={materials.glass}>
        <circleGeometry args={[0.26, 24]} />
      </mesh>
    </group>
  )
}

/** The slice of lawn the house stands on, cut away to show the ground below. */
function Ground({ materials }: { materials: Materials }) {
  const W = 11
  const D = 9.4
  const shrubs: Array<[number, number, number, number]> = [
    [-2.55, 0.26, 2.72, 0.36],
    [-1.55, 0.2, 2.62, 0.27],
    [1.15, 0.22, 2.68, 0.3],
    [2.45, 0.28, 2.72, 0.38],
    [3.5, 0.26, 1.2, 0.34],
    [3.5, 0.22, -1.1, 0.28],
  ]
  return (
    <group>
      <mesh position={[0, -0.12, 0]} material={materials.grass} receiveShadow castShadow>
        <boxGeometry args={[W, 0.24, D]} />
      </mesh>
      <mesh position={[0, -0.74, 0]} material={materials.soil} castShadow>
        <boxGeometry args={[W, 1, D]} />
      </mesh>
      <mesh position={[0, -1.5, 0]} material={materials.rock} castShadow>
        <boxGeometry args={[W, 0.52, D]} />
      </mesh>
      {/* Front walk. */}
      <mesh position={[-0.2, 0.012, 3.76]} material={materials.stone} receiveShadow>
        <boxGeometry args={[1.15, 0.03, 1.88]} />
      </mesh>
      {shrubs.map(([x, y, z, r], index) => (
        <mesh key={index} position={[x, y, z]} material={index % 2 ? materials.leafLight : materials.leaf} castShadow>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
      ))}
      {/* A tree at the back corner. */}
      <group position={[-4.25, 0, -3.1]}>
        <mesh position={[0, 0.7, 0]} material={materials.bark} castShadow>
          <cylinderGeometry args={[0.09, 0.14, 1.4, 8]} />
        </mesh>
        <mesh position={[0, 1.85, 0]} material={materials.leaf} castShadow>
          <icosahedronGeometry args={[0.85, 1]} />
        </mesh>
        <mesh position={[0.4, 1.35, 0.3]} material={materials.leafLight} castShadow>
          <icosahedronGeometry args={[0.5, 1]} />
        </mesh>
      </group>
    </group>
  )
}

function House({ progress, active, callouts, reducedMotion, night, onReady }: RoofSceneProps) {
  const root = useRef<THREE.Group>(null)
  const materials = useMaterials(night)
  const { camera, size, invalidate } = useThree()
  const pointer = useRef({ x: 0, y: 0 })
  const intro = !reducedMotion

  const state = useRef({ shown: reducedMotion ? progress.current : 0, startedAt: 0, time: 0, yaw: 0, tilt: 0, shift: 0, emphasis: new Array(6).fill(1) as number[] })
  const layerGroups = useRef<THREE.Group[][]>([])
  const baseY = useRef<number[]>([])
  const anchorNodes = useRef<Array<THREE.Object3D | undefined>>([])
  const projected = useMemo(() => new THREE.Vector3(), [])

  const dimTarget = useMemo(() => new THREE.Color('#8b8a80'), [])
  const tints = useMemo(
    () => [
      { material: materials.framing, base: new THREE.Color('#dcbd8c') },
      { material: materials.decking, base: new THREE.Color('#ffffff') },
      { material: materials.barrier, base: new THREE.Color('#20272c') },
      { material: materials.underlayment, base: new THREE.Color('#ffffff') },
      { material: materials.shingles, base: new THREE.Color('#ffffff') },
      { material: materials.ridge, base: new THREE.Color('#272e33') },
    ],
    [materials],
  )

  useLayoutEffect(() => {
    const groups: THREE.Group[][] = LAYER_KEYS.map(() => [])
    root.current?.traverse((object) => {
      const index = object.userData.layer
      if (typeof index === 'number') groups[index].push(object as THREE.Group)
    })
    const anchors: Array<THREE.Object3D | undefined> = []
    root.current?.traverse((object) => {
      const index = object.userData.anchor
      if (typeof index === 'number') anchors[index] = object
    })
    layerGroups.current = groups
    anchorNodes.current = anchors
    baseY.current = groups.map((list) => list[0]?.position.y ?? 0)
  }, [])

  useEffect(() => {
    onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Any scroll or pointer movement needs a fresh frame; the loop is on demand.
  useEffect(() => {
    const kick = () => invalidate()
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
      invalidate()
    }
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      window.removeEventListener('scroll', kick)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('resize', kick)
    }
  }, [invalidate])

  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const direction = useMemo(() => new THREE.Vector3(8.2, 4.4, 9.6).normalize(), [])

  useFrame((_, rawDelta) => {
    // Generous clamp: a slow device still settles in a few frames.
    const delta = Math.min(rawDelta, 0.25)
    const current = state.current
    // Wall-clock time, so the opening finishes on schedule even if frames drop.
    const now = performance.now()
    if (current.startedAt === 0) current.startedAt = now
    current.time = (now - current.startedAt) / 1000

    const target = clamp01(progress.current)
    current.shown = reducedMotion ? target : THREE.MathUtils.damp(current.shown, target, 7, delta)
    const spread = easeInOut(current.shown)
    const focus = active.current

    layerGroups.current.forEach((groups, index) => {
      const dropped = intro ? easeOutCubic(clamp01((current.time - INTRO_AT[index]) / 0.55)) : 1
      // Shingles animate tab by tab instead of dropping as a slab.
      const introLift = index === 4 || index === 0 ? 0 : (1 - dropped) * 1.4
      const wanted = focus >= 0 && spread > 0.4 ? (focus === index ? 1 : 0.42) : 1
      current.emphasis[index] = reducedMotion ? wanted : THREE.MathUtils.damp(current.emphasis[index], wanted, 8, delta)
      const nudge = focus === index && spread > 0.4 ? 0.1 : 0
      for (const group of groups) {
        group.position.y = baseY.current[index] + LIFT[index] * spread + introLift + nudge * spread
        group.visible = index === 0 || index === 4 || dropped > 0.001
      }
      const tint = tints[index]
      tint.material.color.copy(dimTarget).lerp(tint.base, current.emphasis[index])
    })

    // A little parallax so the model feels like an object, not a picture.
    const wantYaw = reducedMotion ? 0 : pointer.current.x * 0.16
    const wantTilt = reducedMotion ? 0 : pointer.current.y * 0.05
    current.yaw = THREE.MathUtils.damp(current.yaw, wantYaw, 4, delta)
    current.tilt = THREE.MathUtils.damp(current.tilt, wantTilt, 4, delta)
    if (root.current) {
      root.current.rotation.y = -0.16 + current.yaw + spread * 0.14
      root.current.rotation.x = -current.tilt
    }

    // Frame the house: pull back in portrait, and as the layers lift. On wide
    // screens the lifted roof also slides left to leave room for its callouts.
    const aspect = size.width / Math.max(size.height, 1)
    const portrait = aspect < 1.15 ? (1.15 - aspect) * 9.5 : 0
    const cramped = size.width < 780 && aspect > 0.9 ? (780 - size.width) / 780 : 0
    const distance = 27 + portrait + spread * (5 + cramped * 16)
    lookAt.set(0.1 + (aspect > 0.9 ? spread * 2.5 : 0) + current.shift * spread, 0.15 + spread * 2.9, 0.1 + spread * 0.5)
    camera.position.copy(direction).multiplyScalar(distance).add(lookAt)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld()
    root.current?.updateMatrixWorld(true)

    // Callouts: a column of names to the right, each joined to its layer by a
    // accent line that starts at the layer's outer corner.
    const labels = callouts.current?.querySelectorAll<HTMLElement>('[data-roof-label]')
    if (labels && labels.length > 0) {
      const points: Array<{ x: number; y: number } | null> = []
      let column = 0
      anchorNodes.current.forEach((node, index) => {
        if (!node) {
          points[index] = null
          return
        }
        node.getWorldPosition(projected).project(camera)
        const x = (projected.x * 0.5 + 0.5) * size.width
        const y = (-projected.y * 0.5 + 0.5) * size.height
        points[index] = { x, y }
        column = Math.max(column, x)
      })
      // If the names would run off the edge, ease the house left until they fit.
      const overflow = column + 34 - (size.width - 190)
      if (spread > 0.3 && overflow > 2) current.shift = Math.min(current.shift + overflow * 0.004, 6)
      else if (overflow < -40 && current.shift > 0) current.shift = Math.max(current.shift + overflow * 0.002, 0)
      if (spread > 0.3 && (overflow > 2 || (overflow < -40 && current.shift > 0))) invalidate()
      column = Math.min(column + 34, size.width - 190)
      // Keep neighbouring names from touching, working up from the lowest layer.
      let previous = Infinity
      labels.forEach((label) => {
        const index = Number(label.dataset.roofLabel)
        const point = points[index]
        if (!point) return
        const y = Math.min(point.y, previous - 23)
        previous = y
        const reveal = clamp01((spread - 0.5 - index * 0.035) / 0.22)
        label.style.opacity = String(reveal)
        label.style.transform = `translate3d(${point.x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translateY(-50%)`
        label.style.setProperty('--lead', `${Math.max(column - point.x, 18).toFixed(1)}px`)
        label.dataset.active = String(focus === index)
      })
    }

    const settling =
      current.time < INTRO_END ||
      Math.abs(current.shown - target) > 0.0008 ||
      Math.abs(current.yaw - wantYaw) > 0.0008 ||
      Math.abs(current.tilt - wantTilt) > 0.0008 ||
      current.emphasis.some((value, index) => Math.abs(value - (focus >= 0 && spread > 0.4 ? (focus === index ? 1 : 0.42) : 1)) > 0.004)
    if (settling) invalidate()
  })

  return (
    <>
      <hemisphereLight args={[night ? '#8a9ccc' : '#f0e6da', night ? '#3c4230' : '#6c7355', night ? 1.35 : 1.25]} />
      <directionalLight
        position={[5.5, 10, 6.5]}
        intensity={night ? 2.1 : 2.6}
        color={night ? '#b9c8ff' : '#ffe6c4'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      >
        <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -6, 0.5, 32]} />
      </directionalLight>
      <directionalLight position={[-5, 7, -8]} intensity={night ? 0.5 : 0.9} color="#cfd8ff" />

      <group ref={root}>
        <Ground materials={materials} />
        <Body materials={materials} />
        <Slope materials={materials} anchors={false} intro={intro} />
        <group rotation={[0, Math.PI, 0]}>
          <Slope materials={materials} anchors intro={intro} />
        </group>
      </group>
    </>
  )
}

export default function RoofScene(props: RoofSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      shadows
      camera={{ fov: 26, near: 0.5, far: 80, position: [10, 7, 12] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <House {...props} />
    </Canvas>
  )
}
