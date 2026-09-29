import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store.ts'

// Use these everywhere instead of plain `useDispatch` and `useSelector`.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
