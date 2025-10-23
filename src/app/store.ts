import { configureStore } from '@reduxjs/toolkit';
import sipReducer from '@/entities/WebRtc/model/slice';

const store = configureStore({
  reducer: {
    sip: sipReducer
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;