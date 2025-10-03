export type WaveProgressStatus = 'queued' | 'running' | 'complete' | 'error';

export interface WaveProgressBatch {
  batchNum: number;
  totalBatches: number;
  questionCount: number;
  status: WaveProgressStatus;
  duration?: string;
  okCount?: number;
  errCount?: number;
}

export interface WaveProgressData {
  type: 'wave';
  waveNum: number;
  totalWaves: number;
  batches: WaveProgressBatch[];
}
