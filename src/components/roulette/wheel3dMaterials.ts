// components/roulette/wheel3dMaterials.ts
// Centralised PBR material params for the 3D wheel (§11). Spread into the matching material element:
//   <meshStandardMaterial {...MAT.gold} />   <meshPhysicalMaterial {...BALL_MAT} />
// Metalness/roughness are tuned for a brass-and-dark-wood casino wheel under the Lightformer env map.
// Each surface reads as a DISTINCT material (wood ≠ brass ≠ chrome ≠ painted pocket ≠ pearl ball).
interface StdMat {
  color?: string;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export const MAT: Record<string, StdMat> = {
  // polished brass — outer rim, frets, hub, turret
  gold: { color: "#caa53a", metalness: 1, roughness: 0.27, envMapIntensity: 1.35 },
  goldHi: { color: "#f3df8e", metalness: 1, roughness: 0.15, envMapIntensity: 1.5 },
  goldLo: { color: "#8a6c26", metalness: 0.92, roughness: 0.42, envMapIntensity: 1.05 },
  // polished chrome — diamond deflectors
  steel: { color: "#dfe4ea", metalness: 1, roughness: 0.16, envMapIntensity: 1.45 },
  // turned dark wood — bowl + apron
  wood: { color: "#3c2511", metalness: 0.08, roughness: 0.74, envMapIntensity: 0.4 },
  woodDark: { color: "#231308", metalness: 0.08, roughness: 0.88, envMapIntensity: 0.28 },
  // brushed dark-lacquer centre cone
  cone: { color: "#1c1107", metalness: 0.55, roughness: 0.38, envMapIntensity: 0.95 },
  // painted pocket floor base (vertex colours carry the red/black/green)
  pocket: { color: "#ffffff", metalness: 0.18, roughness: 0.52, envMapIntensity: 0.55 },
} as const;

/** Pearl/ivory ball — meshPhysicalMaterial for a believable clearcoat sheen. */
export const BALL_MAT = {
  color: "#f4f1ea",
  metalness: 0.0,
  roughness: 0.16,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  envMapIntensity: 1.25,
  sheen: 0.4,
  sheenColor: "#fff8ec",
} as const;
