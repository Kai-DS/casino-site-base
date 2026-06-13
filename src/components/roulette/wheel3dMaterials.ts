// components/roulette/wheel3dMaterials.ts
// Centralised PBR material params for the 3D wheel (§9.2). Spread into <meshStandardMaterial {...x} />.
// Metalness/roughness are tuned for a brass-and-dark-wood casino wheel under an env map.
interface Mat {
  color?: string;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export const MAT: Record<string, Mat> = {
  gold: { color: "#d4af37", metalness: 0.96, roughness: 0.26, envMapIntensity: 1.25 },
  goldHi: { color: "#f6e27a", metalness: 1, roughness: 0.16, envMapIntensity: 1.4 },
  goldLo: { color: "#9a7a2a", metalness: 0.9, roughness: 0.4, envMapIntensity: 1.0 },
  wood: { color: "#3a2410", metalness: 0.12, roughness: 0.82, envMapIntensity: 0.4 },
  woodDark: { color: "#241510", metalness: 0.1, roughness: 0.9, envMapIntensity: 0.3 },
  red: { color: "#a1242e", metalness: 0.18, roughness: 0.5, envMapIntensity: 0.5 },
  black: { color: "#191d27", metalness: 0.22, roughness: 0.46, envMapIntensity: 0.6 },
  green: { color: "#1e7a4c", metalness: 0.16, roughness: 0.52, envMapIntensity: 0.5 },
  cone: { color: "#241608", metalness: 0.7, roughness: 0.45, envMapIntensity: 0.9 },
  ball: { color: "#eef1f6", metalness: 0.55, roughness: 0.14, envMapIntensity: 1.5 },
  felt: { color: "#175a3d", metalness: 0.05, roughness: 0.95, envMapIntensity: 0.2 },
};

export function pocketMat(color: "red" | "black" | "green"): Mat {
  return MAT[color]!;
}
