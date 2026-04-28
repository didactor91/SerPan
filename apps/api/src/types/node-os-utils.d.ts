declare module 'node-os-utils' {
  interface CpuInfo {
    model: string;
    speed: number;
    cores: number;
  }
  interface MemInfo {
    totalMemMb: number;
    usedMemMb: number;
    freeMemMb: number;
    usedMemPercentage: number;
  }
  interface DriveInfo {
    totalGb: number;
    usedGb: number;
    freeGb: number;
    usedPercentage: number;
  }
  interface NodeOsUtils {
    cpu: {
      usage: () => Promise<number>;
      info: () => Promise<CpuInfo>;
    };
    mem: {
      info: () => Promise<MemInfo>;
    };
    drive: {
      info: (path: string) => Promise<DriveInfo>;
    };
  }
  const osu: NodeOsUtils;
  export default osu;
}
