import { ItemLifecycleRecord, ItemLifecycleStep, LineType } from '../types/factory';

/**
 * Creates default empty traceability records for items processed through the plant.
 * Ensures the traceability ledger starts clean without fake preloaded data,
 * ready to capture real-time live telemetry as entities flow.
 */
export function createDefaultItemLifecycleLedger(): ItemLifecycleRecord[] {
  return [];
}

/**
 * Records the creation of a new raw material item as it enters inventory from truck unloading.
 */
export function recordItemLifecycleBirth(
  ledger: ItemLifecycleRecord[],
  itemCode: string,
  line: LineType,
  lotBatchId: string,
  simSeconds: number,
  clockStr: string,
  unloadingStationId: string,
  unloadingStationName: string,
  unloadingDuration: number,
  inventoryStationId: string,
  inventoryStationName: string
): ItemLifecycleRecord[] {
  // Prevent duplicate insertion if already exists
  const existing = ledger.find(r => r.code === itemCode);
  if (existing) return ledger;

  const enteredUnload = Math.max(0, simSeconds - unloadingDuration);
  const enteredUnloadClock = formatSecondsToClock(enteredUnload);

  const newRecord: ItemLifecycleRecord = {
    itemId: itemCode,
    code: itemCode,
    rmType: line as 'RM1' | 'RM2' | 'RM3' | 'FINAL',
    lotBatchId,
    creationTimeSeconds: simSeconds,
    creationClock: clockStr,
    status: 'ACTIVE_WIP',
    totalLeadTimeSeconds: 0,
    steps: [
      {
        stepIndex: 1,
        stationId: unloadingStationId,
        stationName: unloadingStationName,
        line,
        enteredAtSimSeconds: enteredUnload,
        enteredAtClock: enteredUnloadClock,
        exitedAtSimSeconds: simSeconds,
        exitedAtClock: clockStr,
        durationSeconds: unloadingDuration,
        status: 'COMPLETED',
        notes: `Unloaded from ${line} delivery transport into staging buffer`,
      },
      {
        stepIndex: 2,
        stationId: inventoryStationId,
        stationName: inventoryStationName,
        line,
        enteredAtSimSeconds: simSeconds,
        enteredAtClock: clockStr,
        durationSeconds: 0,
        status: 'IN_PROGRESS',
        notes: `Staged in ${inventoryStationName} buffer rack`,
      },
    ],
  };

  // Keep all tracked items without any artificial limit
  return [newRecord, ...ledger];
}

/**
 * Records the movement of an item from one station to the next.
 * Closes the current active step and starts a new IN_PROGRESS step.
 */
export function recordItemLifecycleStepTransition(
  ledger: ItemLifecycleRecord[],
  itemCode: string,
  nextStationId: string,
  nextStationName: string,
  nextLine: LineType,
  simSeconds: number,
  clockStr: string,
  notes?: string
): ItemLifecycleRecord[] {
  let matched = false;
  const updated = ledger.map(record => {
    if (record.code !== itemCode) return record;
    matched = true;

    const steps = [...record.steps];
    const lastStep = steps[steps.length - 1];

    if (lastStep && lastStep.status === 'IN_PROGRESS') {
      const dur = Math.max(0.1, simSeconds - lastStep.enteredAtSimSeconds);
      steps[steps.length - 1] = {
        ...lastStep,
        exitedAtSimSeconds: simSeconds,
        exitedAtClock: clockStr,
        durationSeconds: Math.round(dur * 10) / 10,
        status: 'COMPLETED',
      };
    }

    steps.push({
      stepIndex: steps.length + 1,
      stationId: nextStationId,
      stationName: nextStationName,
      line: nextLine,
      enteredAtSimSeconds: simSeconds,
      enteredAtClock: clockStr,
      durationSeconds: 0,
      status: 'IN_PROGRESS',
      notes: notes || `Transferred to ${nextStationName}`,
    });

    const leadTime = Math.max(0, simSeconds - record.creationTimeSeconds);

    return {
      ...record,
      steps,
      totalLeadTimeSeconds: Math.round(leadTime * 10) / 10,
    };
  });

  return matched ? updated : ledger;
}

/**
 * Updates notes or completion status on the current active step of an item
 */
export function recordItemLifecycleStepUpdate(
  ledger: ItemLifecycleRecord[],
  itemCode: string,
  status: 'COMPLETED' | 'IN_PROGRESS' | 'REWORKED' | 'SCRAPPED',
  notes: string,
  simSeconds: number,
  clockStr: string
): ItemLifecycleRecord[] {
  return ledger.map(record => {
    if (record.code !== itemCode) return record;

    const steps = [...record.steps];
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      const lastStep = steps[lastIndex];
      const dur = Math.max(0.1, simSeconds - lastStep.enteredAtSimSeconds);
      steps[lastIndex] = {
        ...lastStep,
        status,
        notes,
        durationSeconds: Math.round(dur * 10) / 10,
        exitedAtSimSeconds: status !== 'IN_PROGRESS' ? simSeconds : lastStep.exitedAtSimSeconds,
        exitedAtClock: status !== 'IN_PROGRESS' ? clockStr : lastStep.exitedAtClock,
      };
    }

    return {
      ...record,
      steps,
      totalLeadTimeSeconds: Math.round((simSeconds - record.creationTimeSeconds) * 10) / 10,
    };
  });
}

/**
 * Marks an item as scrapped in Quality Control and closes its journey
 */
export function recordItemLifecycleScrap(
  ledger: ItemLifecycleRecord[],
  itemCode: string,
  simSeconds: number,
  clockStr: string,
  scrapReason: string
): ItemLifecycleRecord[] {
  return ledger.map(record => {
    if (record.code !== itemCode) return record;

    const steps = [...record.steps];
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      const lastStep = steps[lastIndex];
      const dur = Math.max(0.1, simSeconds - lastStep.enteredAtSimSeconds);
      steps[lastIndex] = {
        ...lastStep,
        status: 'SCRAPPED',
        notes: scrapReason,
        durationSeconds: Math.round(dur * 10) / 10,
        exitedAtSimSeconds: simSeconds,
        exitedAtClock: clockStr,
      };
    }

    return {
      ...record,
      steps,
      status: 'SCRAPPED_QC',
      totalLeadTimeSeconds: Math.round((simSeconds - record.creationTimeSeconds) * 10) / 10,
    };
  });
}

/**
 * Marks an item as dispatched out of the plant to finished customer shipment
 */
export function recordItemLifecycleDispatch(
  ledger: ItemLifecycleRecord[],
  itemCode: string,
  simSeconds: number,
  clockStr: string
): ItemLifecycleRecord[] {
  return ledger.map(record => {
    if (record.code !== itemCode) return record;

    const steps = [...record.steps];
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      const lastStep = steps[lastIndex];
      const dur = Math.max(0.1, simSeconds - lastStep.enteredAtSimSeconds);
      steps[lastIndex] = {
        ...lastStep,
        status: 'COMPLETED',
        durationSeconds: Math.round(dur * 10) / 10,
        exitedAtSimSeconds: simSeconds,
        exitedAtClock: clockStr,
      };
    }

    // Add final exit dispatch step
    steps.push({
      stepIndex: steps.length + 1,
      stationId: 'sink_dispatch',
      stationName: 'Sink / Dispatch Out',
      line: 'FINAL',
      enteredAtSimSeconds: simSeconds,
      enteredAtClock: clockStr,
      exitedAtSimSeconds: simSeconds,
      exitedAtClock: clockStr,
      durationSeconds: 0,
      status: 'COMPLETED',
      notes: 'Customer dispatch & warehouse receipt logged (100% Steps completed)',
    });

    return {
      ...record,
      steps,
      status: 'COMPLETED_DISPATCH',
      totalLeadTimeSeconds: Math.round((simSeconds - record.creationTimeSeconds) * 10) / 10,
    };
  });
}

/**
 * Helper to format seconds of day into 12-hour clock (e.g. "08:15:30 AM")
 */
function formatSecondsToClock(seconds: number): string {
  const totalSecs = Math.floor(seconds) % 86400;
  const hours24 = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')} ${ampm}`;
}

/**
 * Dynamically updates in-progress step durations and lead times for active WIP items
 */
export function tickActiveLifecycleRecords(
  ledger: ItemLifecycleRecord[],
  simSeconds: number
): ItemLifecycleRecord[] {
  let hasChanges = false;
  const updated = ledger.map(record => {
    if (record.status !== 'ACTIVE_WIP') return record;

    const steps = record.steps;
    const lastIndex = steps.length - 1;
    if (lastIndex < 0) return record;

    const lastStep = steps[lastIndex];
    if (lastStep.status === 'IN_PROGRESS') {
      const dur = Math.max(0.1, simSeconds - lastStep.enteredAtSimSeconds);
      const leadTime = Math.max(0.1, simSeconds - record.creationTimeSeconds);

      hasChanges = true;
      const updatedSteps = [...steps];
      updatedSteps[lastIndex] = {
        ...lastStep,
        durationSeconds: Math.round(dur * 10) / 10,
      };

      return {
        ...record,
        steps: updatedSteps,
        totalLeadTimeSeconds: Math.round(leadTime * 10) / 10,
      };
    }

    return record;
  });

  return hasChanges ? updated : ledger;
}

/**
 * Generates an Excel-compatible RFC 4180 CSV with UTF-8 BOM.
 * Every step, entry time, station name, duration, and quality notes are included.
 */
export function exportItemLifecycleToCSV(records: ItemLifecycleRecord[]): string {
  // UTF-8 BOM so Microsoft Excel immediately opens UTF-8 without garbled characters
  const BOM = '\uFEFF';

  // Find max steps across records to create dynamic step headers
  let maxSteps = 0;
  for (const r of records) {
    if (r.steps.length > maxSteps) maxSteps = r.steps.length;
  }

  // Base headers
  const headers = [
    'Material ID',
    'Lot / Batch Number',
    'Material Classification',
    'Entry Clock',
    'Lifecycle Status',
    'Total Lead Time (s)',
    'Total Lead Time (min)',
    'Steps Completed',
  ];

  // Dynamic step headers
  for (let s = 1; s <= maxSteps; s++) {
    headers.push(
      `Step ${s} Station`,
      `Step ${s} Line`,
      `Step ${s} Entry Clock`,
      `Step ${s} Exit Clock`,
      `Step ${s} Duration (s)`,
      `Step ${s} Status`,
      `Step ${s} Audit Notes`
    );
  }

  const escapeCSV = (value: string | number | undefined | null) => {
    if (value === undefined || value === null) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows: string[] = [headers.map(escapeCSV).join(',')];

  for (const r of records) {
    const rowValues: (string | number)[] = [
      r.itemId,
      r.lotBatchId,
      r.rmType === 'FINAL' ? 'Finished Assembly' : `Raw Material (${r.rmType})`,
      r.creationClock,
      r.status,
      r.totalLeadTimeSeconds.toFixed(1),
      (r.totalLeadTimeSeconds / 60).toFixed(2),
      r.steps.length,
    ];

    for (let s = 0; s < maxSteps; s++) {
      const step = r.steps[s];
      if (step) {
        rowValues.push(
          step.stationName,
          step.line,
          step.enteredAtClock,
          step.exitedAtClock || 'Active In-Progress',
          step.durationSeconds.toFixed(1),
          step.status,
          step.notes || ''
        );
      } else {
        rowValues.push('', '', '', '', '', '', '');
      }
    }

    rows.push(rowValues.map(escapeCSV).join(','));
  }

  return BOM + rows.join('\r\n');
}

/**
 * Browser file download trigger for generated CSV
 */
export function downloadCSVFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
