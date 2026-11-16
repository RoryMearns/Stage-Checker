import { setupSharePage } from './share-page.js';
import { collectNotesState, applyNotesState, buildNotesReport, restoreNotesDraft, resetFieldNotes } from './stationary-notes.js';
import { collectQualityState, applyQualityState, buildQualityReport, restoreQualityDraft, resetQuality } from './stationary-quality.js';

setupSharePage({
    notes: {
        collect: collectNotesState,
        apply: applyNotesState,
        build: buildNotesReport,
        restoreDraft: restoreNotesDraft,
        reset: resetFieldNotes
    },
    quality: {
        collect: collectQualityState,
        apply: applyQualityState,
        build: buildQualityReport,
        restoreDraft: restoreQualityDraft,
        reset: resetQuality
    },
    filePrefix: 'Stationary Gauging Results'
});
