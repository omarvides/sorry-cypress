import {
  Run,
  Task,
  RunMetaData,
  InstanceResult,
  ExecutionDriver,
  CreateRunResponse,
  CreateRunParameters
} from '@src/types';
import { getDashboardRunURL } from '@src/lib/urls';
import {
  AppError,
  RUN_NOT_EXIST,
  INSTANCE_EXISTS,
  INSTANCE_NOT_EXIST
} from '@src/lib/errors';
import {
  generateRunIdHash,
  generateGroupId,
  generateUUID
} from '@src/lib/hash';

const runs: { [key: string]: Run } = {};
const instances: {
  [key: string]: {
    runId: string;
    results?: InstanceResult;
  };
} = {};

const createRun = async (
  params: CreateRunParameters
): Promise<CreateRunResponse> => {
  const runId = generateRunIdHash(params);
  const groupId = generateGroupId(params.platform, params.ciBuildId);

  const response = {
    groupId,
    machineId: generateUUID(),
    runId,
    runUrl: getDashboardRunURL(runId),
    warnings: [] as string[]
  };

  if (runs[runId]) {
    return response;
  }

  runs[runId] = {
    runId,
    createdAt: new Date(),
    meta: {} as RunMetaData,
    specs: params.specs.map(spec => ({
      spec,
      instanceId: generateUUID(),
      claimed: false
    }))
  };

  return response;
};

const getNextTask = async (runId: string): Promise<Task> => {
  if (!runs[runId]) {
    throw new AppError(RUN_NOT_EXIST);
  }

  const unclaimedSpecIndex = runs[runId].specs.findIndex(s => !s.claimed);
  if (unclaimedSpecIndex === -1) {
    return {
      instance: null,
      claimedInstances: runs[runId].specs.length,
      totalInstances: runs[runId].specs.length
    };
  }

  const spec = runs[runId].specs[unclaimedSpecIndex];

  spec.claimed = true;
  instances[spec.instanceId] = { runId };

  return {
    instance: runs[runId].specs[unclaimedSpecIndex],
    claimedInstances: runs[runId].specs.filter(s => s.claimed).length,
    totalInstances: runs[runId].specs.length
  };
};

const setInstanceResults = async (
  instanceId: string,
  results: InstanceResult
) => {
  if (!instances[instanceId]) {
    throw new AppError(INSTANCE_NOT_EXIST);
  }
  instances[instanceId] = { ...instances[instanceId], results };
};
export const driver: ExecutionDriver = {
  id: 'in-memory',
  init: () => Promise.resolve(),
  setScreenshotUrl: () => Promise.resolve(),
  setVideoUrl: () => Promise.resolve(),
  createRun,
  getNextTask,
  setInstanceResults
};
