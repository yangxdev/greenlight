import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { HealthResponse } from '../../../shared/api.ts';
import { apiGet } from '../../lib/api.ts';

export interface HealthState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  checkedAt: string | null;
  error: string | null;
}

const initialState: HealthState = { status: 'idle', checkedAt: null, error: null };

export const checkHealth = createAsyncThunk('health/check', () =>
  apiGet<HealthResponse>('/health'),
);

export const healthSlice = createSlice({
  name: 'health',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkHealth.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(checkHealth.fulfilled, (state, action) => {
        state.status = 'ok';
        state.checkedAt = action.payload.time;
      })
      .addCase(checkHealth.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message ?? 'Unknown error';
      });
  },
  selectors: {
    selectHealth: (state) => state,
  },
});

export const { selectHealth } = healthSlice.selectors;
