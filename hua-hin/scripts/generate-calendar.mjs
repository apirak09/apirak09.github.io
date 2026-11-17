import {writeFile} from 'node:fs/promises';
import {days} from '../trip-data.mjs';
import {calendarFile} from '../core.mjs';
await writeFile(new URL('../train-times.ics',import.meta.url),calendarFile(days));
console.log('Updated train-times.ics from trip-data.mjs');
