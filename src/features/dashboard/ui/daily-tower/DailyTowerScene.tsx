import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  MAP_DEPTH,
  MAP_WIDTH,
  SALES_RAMP,
  type DepartmentShapeData,
  type MapLayout,
} from "./tower-model";

/**
 * Este archivo es el único que importa `three`. Mantenerlo aislado es lo que
 * permite que el chunk 3D se cargue aparte y que el resto del dashboard no lo
 * arrastre nunca.
 */

export interface MapPalette {
  /** Departamento sin ventas. */
  cold: string;
  /** Contorno superior de cada pieza. */
  edge: string;
  /** Sombra bajo el país. */
  shadow: string;
}

interface SceneProps {
  layout: MapLayout;
  /** Colores ya resueltos a rgb() por el orquestador, para que el tema funcione. */
  palette: MapPalette;
  active: boolean;
  spinning: boolean;
  hoveredCode: string | null;
  onHoverChange: (code: string | null) => void;
}

/** Rozamiento del giro por inercia: decae hasta el reposo, no se frena de golpe. */
const FRICTION = 0.07;
const IDLE_SPEED = 0.06;

function sampleRamp(intensity: number): THREE.Color {
  const clamped = Math.max(0, Math.min(1, intensity));
  const position = clamped * (SALES_RAMP.length - 1);
  const index = Math.min(SALES_RAMP.length - 2, Math.floor(position));
  const start = new THREE.Color(SALES_RAMP[index]);
  const end = new THREE.Color(SALES_RAMP[index + 1]);
  return start.lerp(end, position - index);
}

function Department({
  department,
  palette,
  isHovered,
  isDimmed,
  onHoverChange,
}: {
  department: DepartmentShapeData;
  palette: MapPalette;
  isHovered: boolean;
  isDimmed: boolean;
  onHoverChange: (code: string | null) => void;
}) {
  // Cada departamento tiene su propia geometría porque su contorno es único;
  // son 9 mallas de pocos cientos de vértices, no hay nada que instanciar.
  const { geometry, outlinePositions } = useMemo(() => {
    const shape = new THREE.Shape();
    department.outline.forEach(([x, y], index) => {
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();

    const extruded = new THREE.ExtrudeGeometry(shape, {
      depth: department.height,
      bevelEnabled: false,
      curveSegments: 1,
    });
    extruded.computeVertexNormals();

    // Contorno sobre la cara superior: es lo que separa visualmente una pieza
    // de la vecina cuando dos departamentos venden parecido.
    const positions = new Float32Array(department.outline.length * 3);
    department.outline.forEach(([x, y], index) => {
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = department.height + 0.004;
    });

    return { geometry: extruded, outlinePositions: positions };
  }, [department.outline, department.height]);

  // R3F sólo libera lo que crea el JSX; esto viene de useMemo y hay que soltarlo
  // a mano, o cada cambio de período deja memoria de GPU atrás.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const color = useMemo(
    () => (department.sales > 0 ? sampleRamp(department.intensity) : new THREE.Color(palette.cold)),
    [department.sales, department.intensity, palette.cold],
  );

  return (
    <group position={[0, isHovered ? 0.07 : 0, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          geometry={geometry}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHoverChange(department.code);
          }}
          onPointerOut={() => onHoverChange(null)}
        >
          <meshStandardMaterial
            color={color}
            roughness={0.5}
            metalness={0.06}
            emissive={color}
            emissiveIntensity={isHovered ? 0.45 : 0.06 + department.intensity * 0.14}
            transparent={isDimmed}
            opacity={isDimmed ? 0.72 : 1}
          />
        </mesh>

        <lineLoop raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[outlinePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color={palette.edge}
            transparent
            opacity={isHovered ? 0.95 : 0.4}
          />
        </lineLoop>
      </group>
    </group>
  );
}

function Map({ layout, palette, hoveredCode, onHoverChange, active, spinning }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const drag = useRef({ dragging: false, lastX: 0, velocity: 0 });

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!drag.current.dragging) return;
      const delta = (event.clientX - drag.current.lastX) * 0.006;
      drag.current.lastX = event.clientX;
      drag.current.velocity = delta;
      if (groupRef.current) groupRef.current.rotation.y += delta;
    };
    const stop = () => {
      drag.current.dragging = false;
    };

    // El arrastre se sigue en window para que no se corte al salir de la tarjeta.
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;
    // Limitar el delta evita el salto al volver de una pestaña dormida.
    const delta = Math.min(rawDelta, 0.1);

    if (drag.current.dragging) return;

    if (Math.abs(drag.current.velocity) > 0.0005) {
      group.rotation.y += drag.current.velocity;
      drag.current.velocity *= 1 - FRICTION;
    } else if (spinning && active && !hoveredCode) {
      group.rotation.y += IDLE_SPEED * delta;
    }
  });

  return (
    <group
      ref={groupRef}
      onPointerDown={(event) => {
        drag.current.dragging = true;
        drag.current.lastX = event.clientX;
        drag.current.velocity = 0;
      }}
    >
      {/* Sombra bajo el relieve: da apoyo sin competir con los datos. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} raycast={() => null}>
        <planeGeometry args={[MAP_WIDTH * 1.4, MAP_DEPTH * 1.5]} />
        <meshStandardMaterial color={palette.shadow} transparent opacity={0.1} roughness={1} />
      </mesh>

      {layout.departments.map((department) => (
        <Department
          key={department.code}
          department={department}
          palette={palette}
          isHovered={hoveredCode === department.code}
          isDimmed={hoveredCode !== null && hoveredCode !== department.code}
          onHoverChange={onHoverChange}
        />
      ))}
    </group>
  );
}

export default function DailyTowerScene(props: SceneProps) {
  return (
    <Canvas
      frameloop={props.active ? "always" : "never"}
      dpr={[1, 1.5]}
      gl={{ powerPreference: "low-power", alpha: true, antialias: true }}
      // Cámara ortográfica: da la lectura de maqueta y evita que los
      // departamentos del fondo se achiquen y parezcan vender menos.
      orthographic
      camera={{ position: [0, 6, 5.2], zoom: 86, near: -40, far: 80 }}
      // Sin zoom por rueda a propósito: la tarjeta vive dentro de una página que
      // hace scroll y robárselo al pasar el cursor sería hostil.
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 9, 5]} intensity={1.1} />
      <directionalLight position={[-5, 4, -3]} intensity={0.4} />
      <Map {...props} />
    </Canvas>
  );
}
