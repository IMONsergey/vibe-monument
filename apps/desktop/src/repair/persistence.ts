import { stateGet, stateSet } from '../host/native';
import type { RepairState } from './state';

function repairKey(projectId: string): string {
  return `repair:${projectId}`;
}

export async function loadRepairState(projectId: string): Promise<RepairState | null> {
  return stateGet<RepairState>(repairKey(projectId));
}

export async function saveRepairState(projectId: string, state: RepairState): Promise<void> {
  await stateSet(repairKey(projectId), state);
}

export async function clearRepairState(projectId: string): Promise<void> {
  await stateSet(repairKey(projectId), null);
}
